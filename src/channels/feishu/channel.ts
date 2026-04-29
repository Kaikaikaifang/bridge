import type { FeishuChannelConfig } from "../../config/schema.js";
import type {
	ChannelAdapter,
	ChannelRuntime,
	OutgoingMessage,
} from "../../core/types.js";

/**
 * 飞书通道 — 尚未实现。
 * TODO: 实现为 HTTP Webhook 服务：接收飞书事件 → 转成 ChatMessage → 调用 runtime.onMessage。
 */
export class FeishuChannel implements ChannelAdapter {
	name = "feishu";

	constructor(private readonly config: FeishuChannelConfig = {}) {}

	async start(runtime: ChannelRuntime): Promise<void> {
		runtime.log(`飞书通道尚未实现 (计划端口: ${this.config.port ?? 8787})`);
		// Keep the process alive but don't throw — allows the bridge to start
		// with feishu channel in config without crashing.
		return new Promise(() => {});
	}

	async send(_message: OutgoingMessage): Promise<void> {
		throw new Error("飞书通道尚未实现发送能力。");
	}
}
