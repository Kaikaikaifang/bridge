#!/usr/bin/env node
import fs from "node:fs";
import { createAgentRegistry } from "./agents/index.js";
import { createChannel } from "./channels/index.js";
import { loadConfig } from "./config/load.js";
import { BridgeRuntime } from "./core/bridge.js";

function getArg(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	if (index >= 0 && index + 1 < process.argv.length)
		return process.argv[index + 1];
	const prefix = `${name}=`;
	const matched = process.argv.find((arg) => arg.startsWith(prefix));
	if (matched) return matched.slice(prefix.length) || undefined;
	return undefined;
}

function printHelp(): void {
	console.log(`Agent Bridge

用法：
  agent-bridge run [--config path] [--channel weixin|cli] [--agent codex]
  agent-bridge chat [--config path] [--agent codex]

命令：
  run       启动桥接服务，连接通讯通道和 Agent
  chat      快捷方式：直接进入 CLI 交互模式（等同于 --channel cli）

示例：
  # 微信通道 + Codex
  agent-bridge run --channel weixin --agent codex

  # CLI 交互模式 + Claude
  agent-bridge chat --agent claude

  # CLI 交互模式 + Codebuddy
  agent-bridge chat --agent codebuddy

  # CLI 交互模式，自动路由到默认 Agent
  agent-bridge chat

说明：
  --config   指定配置文件，默认 ~/.agent-bridge/config.json
  --channel  指定通讯通道：weixin、feishu、cli
  --agent    指定默认 Agent：codex、claude、codebuddy、opencode 等
  -h, --help  显示帮助
  --version   显示版本
`);
}

async function main(): Promise<void> {
	const command = process.argv[2] ?? "help";
	if (command === "help" || command === "--help" || command === "-h") {
		printHelp();
		return;
	}
	if (command === "--version") {
		const pkgPath = new URL("../package.json", import.meta.url);
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
				version?: string;
			};
			console.log(`agent-bridge v${pkg.version ?? "unknown"}`);
		} catch {
			console.log("agent-bridge v0.1.0");
		}
		return;
	}
	if (command !== "run" && command !== "chat") {
		throw new Error(`未知命令：${command}\n可用命令：run, chat, help`);
	}

	const configPath = getArg("--config");
	const config = loadConfig(configPath);

	// `chat` is a shortcut for `run --channel cli`
	const channelName =
		command === "chat" ? "cli" : (getArg("--channel") ?? config.defaultChannel);
	const agentName = getArg("--agent") ?? config.defaultAgent;
	config.defaultChannel = channelName;
	config.defaultAgent = agentName;

	fs.mkdirSync(config.workspace, { recursive: true });

	const agents = createAgentRegistry(config);
	if (agents.size === 0) {
		console.error("错误：未配置任何 Agent。请在配置文件中添加 agents 配置。");
		process.exit(1);
	}
	if (!agents.has(agentName)) {
		console.error(
			`错误：未找到 Agent "${agentName}"。可用 Agent：${[...agents.keys()].join(", ")}`,
		);
		process.exit(1);
	}

	if (channelName === "weixin" && config.allowUsers.length === 0) {
		console.warn(
			"提示：allowUsers 为空。微信扫码登录成功后，会自动授权本次登录的用户 ID。",
		);
	} else if (channelName !== "cli" && config.allowUsers.length === 0) {
		console.warn(
			"警告：allowUsers 为空。当前不会执行任何真实用户消息，请先在配置中加入允许的用户 ID。",
		);
	}

	const channel = createChannel(channelName, config);
	const runtime = new BridgeRuntime(config, agents, channel, configPath);

	let shuttingDown = false;
	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log("\n正在退出...");
		await runtime.stop();
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	await runtime.start();
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
