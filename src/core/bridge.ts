import type { BridgeConfig } from "../config/schema.js";
import { StateStore } from "../storage/state.js";
import { logger } from "../util/logger.js";
import { handleBuiltinCommand } from "./commands.js";
import { KeyedQueue } from "./locks.js";
import type {
	AgentProvider,
	AgentResponse,
	ChannelAdapter,
	ChatMessage,
} from "./types.js";

const DEFAULT_AGENT_TIMEOUT_MS = 300_000;
const TYPING_INTERVAL_MS = 5_000;
const MAX_MESSAGE_LENGTH = 10_000;

export class BridgeRuntime {
	private readonly stateStore = new StateStore();
	private readonly queue = new KeyedQueue();
	private stopping = false;

	constructor(
		private readonly config: BridgeConfig,
		private readonly agents: Map<string, AgentProvider>,
		private readonly channel: ChannelAdapter,
	) {}

	async start(): Promise<void> {
		await this.channel.start({
			onMessage: (message) => this.handleMessage(message),
			log: (message) => logger.info(message, "channel"),
			error: (message) => logger.error(message, "channel"),
		});
	}

	async stop(): Promise<void> {
		this.stopping = true;
		logger.info("正在停止 Bridge...");
		await this.channel.stop?.();
		logger.info("Bridge 已停止");
	}

	private async handleMessage(message: ChatMessage): Promise<void> {
		const queueKey = `${message.channel}:${message.conversationId}`;
		await this.queue.run(queueKey, async () => {
			if (this.stopping) return;

			if (message.text.length > MAX_MESSAGE_LENGTH) {
				logger.warn(`消息过长 (${message.text.length} 字符)，已截断`, queueKey);
				await this.channel.send({
					conversationId: message.conversationId,
					replyToken: message.replyToken,
					text: `消息过长（${message.text.length} 字符），请缩短后重试。上限：${MAX_MESSAGE_LENGTH} 字符。`,
				});
				return;
			}

			if (!this.config.allowUsers.includes(message.senderId)) {
				logger.warn(`拒绝未知用户消息：senderId=${message.senderId}`, queueKey);
				await this.channel.send({
					conversationId: message.conversationId,
					replyToken: message.replyToken,
					text: [
						"当前用户不在 allowUsers 白名单中，已拒绝执行。",
						"",
						`你的用户 ID：${message.senderId}`,
						"",
						"如需授权，请把该 ID 加入运行者本机配置文件的 allowUsers。",
					].join("\n"),
				});
				return;
			}

			const commandResult = handleBuiltinCommand({
				message,
				config: this.config,
				stateStore: this.stateStore,
				agents: this.agents,
			});
			if (commandResult.handled) {
				await this.channel.send({
					conversationId: message.conversationId,
					replyToken: message.replyToken,
					text: commandResult.reply ?? "已处理。",
				});
				return;
			}

			const conversation = this.stateStore.getConversation(
				message.channel,
				message.conversationId,
			);
			const agentName = conversation.agent ?? this.config.defaultAgent;
			const agent = this.agents.get(agentName);
			if (!agent) {
				await this.channel.send({
					conversationId: message.conversationId,
					replyToken: message.replyToken,
					text: `未找到 Agent：${agentName}`,
				});
				return;
			}

			const sessionId = conversation.sessions?.[agentName];
			logger.info(
				`调用 Agent: ${agentName} sessionId=${sessionId ?? "(none)"}`,
				queueKey,
			);
			let response: AgentResponse;
			const typingTimer = this.startTypingLoop(message.conversationId);
			try {
				response = await agent.ask({
					text: message.text,
					userId: message.senderId,
					conversationId: message.conversationId,
					cwd: conversation.cwd ?? this.config.workspace,
					sessionId,
					timeoutMs: DEFAULT_AGENT_TIMEOUT_MS,
				});
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				logger.error(`Agent ${agentName} 执行失败：${errorMsg}`, queueKey);
				await this.channel.send({
					conversationId: message.conversationId,
					replyToken: message.replyToken,
					text: `Agent ${agentName} 执行失败：${errorMsg}`,
				});
				return;
			} finally {
				clearInterval(typingTimer);
			}

			if (response.sessionId) {
				this.stateStore.setAgentSession(
					message.channel,
					message.conversationId,
					agentName,
					response.sessionId,
				);
			}

			await this.channel.send({
				conversationId: message.conversationId,
				replyToken: message.replyToken,
				text: response.text,
			});
		});
	}

	private startTypingLoop(
		conversationId: string,
	): ReturnType<typeof setInterval> {
		if (!this.channel.sendTyping) return setInterval(() => {}, 0);
		const channel = this.channel;
		void channel.sendTyping?.(conversationId);
		return setInterval(() => {
			void channel.sendTyping?.(conversationId);
		}, TYPING_INTERVAL_MS);
	}
}
