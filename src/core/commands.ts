import type { BridgeConfig } from "../config/schema.js";
import type { StateStore } from "../storage/state.js";
import { isUnderAllowedRoots, resolveWorkspacePath } from "../util/path.js";
import type { AgentProvider, ChatMessage } from "./types.js";

export type CommandResult = {
	handled: boolean;
	reply?: string;
};

export type CommandContext = {
	message: ChatMessage;
	config: BridgeConfig;
	stateStore: StateStore;
	agents?: Map<string, AgentProvider>;
};

export function handleBuiltinCommand(params: CommandContext): CommandResult {
	const { message, config, stateStore, agents } = params;
	const text = message.text.trim();
	if (!text.startsWith("/")) return { handled: false };

	const [command, ...rest] = text.split(/\s+/);
	const current = stateStore.getConversation(
		message.channel,
		message.conversationId,
	);

	if (command === "/status") {
		return {
			handled: true,
			reply: [
				`通道：${message.channel}`,
				`会话：${message.conversationId}`,
				`Agent：${current.agent ?? config.defaultAgent}`,
				`工作目录：${current.cwd ?? config.workspace}`,
			].join("\n"),
		};
	}

	if (command === "/agents") {
		if (!agents || agents.size === 0) {
			return { handled: true, reply: "未配置任何 Agent。" };
		}
		const currentAgent = current.agent ?? config.defaultAgent;
		const lines = ["可用 Agent：", ""];
		for (const [name, provider] of agents) {
			const marker = name === currentAgent ? " *" : "";
			lines.push(`  ${name} (${provider.name})${marker}`);
		}
		lines.push("", `* = 当前会话使用`);
		return { handled: true, reply: lines.join("\n") };
	}

	if (command === "/agent") {
		const nextAgent = rest[0];
		if (!nextAgent)
			return {
				handled: true,
				reply:
					"用法：/agent <name>\n例如：/agent codex, /agent claude, /agent codebuddy",
			};
		if (agents && !agents.has(nextAgent)) {
			const available = [...agents.keys()].join(", ");
			return {
				handled: true,
				reply: `未知 Agent：${nextAgent}\n可用：${available}`,
			};
		}
		stateStore.updateConversation(
			message.channel,
			message.conversationId,
			(state) => ({
				...state,
				agent: nextAgent,
			}),
		);
		return { handled: true, reply: `已切换当前会话 Agent：${nextAgent}` };
	}

	if (command === "/cwd") {
		const cwd = rest.join(" ").trim();
		if (!cwd) return { handled: true, reply: "用法：/cwd /path/to/project" };
		const resolved = resolveWorkspacePath(cwd, config.workspace);
		if (!isUnderAllowedRoots(resolved, config.allowedWorkspaceRoots)) {
			return {
				handled: true,
				reply: `该目录不在 allowedWorkspaceRoots 中：${resolved}`,
			};
		}
		stateStore.updateConversation(
			message.channel,
			message.conversationId,
			(state) => ({
				...state,
				cwd: resolved,
			}),
		);
		return { handled: true, reply: `已切换工作目录：${resolved}` };
	}

	if (command === "/reset") {
		stateStore.resetConversation(message.channel, message.conversationId);
		return { handled: true, reply: "已清理当前会话状态。" };
	}

	if (command === "/help") {
		return {
			handled: true,
			reply: [
				"可用命令：",
				"  /status       查看当前会话状态",
				"  /agents       列出所有可用 Agent",
				"  /agent <name> 切换当前会话 Agent",
				"  /cwd <path>   切换工作目录",
				"  /reset        清理当前会话状态",
				"  /help         显示帮助",
			].join("\n"),
		};
	}

	return {
		handled: true,
		reply: `未知命令：${command}\n输入 /help 查看可用命令。`,
	};
}
