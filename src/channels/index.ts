import type { BridgeConfig } from "../config/schema.js";
import type { ChannelAdapter, ChannelName } from "../core/types.js";
import { CliChannel } from "./cli/channel.js";
import { FeishuChannel } from "./feishu/channel.js";
import { WeixinChannel } from "./weixin/channel.js";

export function createChannel(
	name: ChannelName,
	config: BridgeConfig,
): ChannelAdapter {
	if (name === "weixin") return new WeixinChannel(config.channels.weixin);
	if (name === "feishu") return new FeishuChannel(config.channels.feishu);
	if (name === "cli") return new CliChannel(config.channels.cli);
	throw new Error(`未知通道：${name}`);
}
