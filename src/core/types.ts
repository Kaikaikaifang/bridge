export type AgentName = "codex" | "claude" | string;
export type ChannelName = "weixin" | "feishu" | string;

export type ChatMessage = {
	/** 通讯软件名称，例如 weixin、feishu。 */
	channel: ChannelName;
	/** 通讯软件里的会话 ID。私聊通常等于 senderId，群聊可为 room/open_chat_id。 */
	conversationId: string;
	/** 发送者 ID，用于鉴权和按用户保存状态。 */
	senderId: string;
	/** 原始文本内容。 */
	text: string;
	/** 通道回复所需的透明上下文，例如微信 context_token。 */
	replyToken?: string;
	/** 通道原始消息，便于未来扩展媒体/调试。 */
	raw?: unknown;
};

export type OutgoingMessage = {
	conversationId: string;
	text: string;
	replyToken?: string;
};

export type AgentRequest = {
	text: string;
	userId: string;
	conversationId: string;
	cwd: string;
	sessionId?: string;
	timeoutMs: number;
};

export type AgentResponse = {
	text: string;
	sessionId?: string;
	meta?: Record<string, unknown>;
};

export interface AgentProvider {
	name: AgentName;
	ask(request: AgentRequest): Promise<AgentResponse>;
}

export type ChannelRuntime = {
	onMessage(message: ChatMessage): Promise<void>;
	authorizeUser?(userId: string): void;
	log(message: string): void;
	error(message: string): void;
};

export interface ChannelAdapter {
	name: ChannelName;
	start(runtime: ChannelRuntime): Promise<void>;
	stop?(): Promise<void>;
	send(message: OutgoingMessage): Promise<void>;
	sendTyping?(conversationId: string): Promise<void>;
}

export type ConversationState = {
	agent?: AgentName;
	cwd?: string;
	sessions?: Record<string, string>;
	updatedAt?: string;
};
