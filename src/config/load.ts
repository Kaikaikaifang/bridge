import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandHome, resolvePath } from "../util/path.js";
import type { BridgeConfig } from "./schema.js";
import { BridgeConfigSchema } from "./schema.js";

const DEFAULT_CONFIG: BridgeConfig = {
	defaultChannel: "cli",
	defaultAgent: "codex",
	workspace: "~/agent-bridge-workspace",
	allowUsers: [],
	allowedWorkspaceRoots: ["~/projects", "~/agent-bridge-workspace"],
	agents: {
		codex: {
			command: "codex",
			sandbox: "read-only",
			approval: "never",
			model: null,
			timeoutMs: 300_000,
		},
		claude: {
			command: "claude",
			model: "sonnet",
			permissionMode: "dontAsk",
			tools: "default",
			timeoutMs: 300_000,
		},
		codebuddy: {
			command: "codebuddy",
			permissionMode: "dontAsk",
			timeoutMs: 300_000,
		},
		opencode: {
			command: "opencode",
			timeoutMs: 300_000,
		},
	},
	channels: {
		weixin: {
			baseUrl: "https://ilinkai.weixin.qq.com",
			botType: "3",
			channelVersion: "1.0.2",
		},
		feishu: {
			enabled: false,
			port: 8787,
		},
		cli: {
			prompt: "bridge> ",
			history: true,
		},
	},
};

function deepMerge<T extends Record<string, unknown>>(
	base: T,
	patch: Record<string, unknown>,
): T {
	const output: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(patch)) {
		const current = output[key];
		if (
			value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			current &&
			typeof current === "object" &&
			!Array.isArray(current)
		) {
			output[key] = deepMerge(
				current as Record<string, unknown>,
				value as Record<string, unknown>,
			);
		} else {
			output[key] = value;
		}
	}
	return output as T;
}

export function getStateDir(): string {
	const envDir = process.env.AGENT_BRIDGE_HOME?.trim();
	return envDir
		? resolvePath(envDir)
		: path.join(os.homedir(), ".agent-bridge");
}

export function getDefaultConfigPath(): string {
	return path.join(getStateDir(), "config.json");
}

export function resolveConfigPath(
	configPath = process.env.AGENT_BRIDGE_CONFIG || getDefaultConfigPath(),
): string {
	return expandHome(configPath);
}

export function loadConfig(
	configPath = process.env.AGENT_BRIDGE_CONFIG || getDefaultConfigPath(),
): BridgeConfig {
	const resolvedConfigPath = resolveConfigPath(configPath);
	let userConfig: Record<string, unknown> = {};
	if (fs.existsSync(resolvedConfigPath)) {
		try {
			userConfig = JSON.parse(
				fs.readFileSync(resolvedConfigPath, "utf-8"),
			) as Record<string, unknown>;
		} catch (err) {
			throw new Error(
				`配置文件解析失败 (${resolvedConfigPath}): ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	const merged = deepMerge(
		DEFAULT_CONFIG as unknown as Record<string, unknown>,
		userConfig,
	);
	const config = BridgeConfigSchema.parse(merged);

	config.workspace = resolvePath(config.workspace);
	config.allowedWorkspaceRoots = config.allowedWorkspaceRoots.map(resolvePath);

	return config;
}

export function addAllowUserToConfig(userId: string, configPath?: string): boolean {
	const resolvedConfigPath = resolveConfigPath(configPath);
	let userConfig: Record<string, unknown> = {};
	if (fs.existsSync(resolvedConfigPath)) {
		userConfig = JSON.parse(
			fs.readFileSync(resolvedConfigPath, "utf-8"),
		) as Record<string, unknown>;
	}

	const currentAllowUsers = Array.isArray(userConfig.allowUsers)
		? userConfig.allowUsers.filter(
				(value): value is string => typeof value === "string",
			)
		: [];
	if (currentAllowUsers.includes(userId)) return false;

	fs.mkdirSync(path.dirname(resolvedConfigPath), { recursive: true });
	const nextConfig = {
		...userConfig,
		allowUsers: [...currentAllowUsers, userId],
	};
	fs.writeFileSync(
		resolvedConfigPath,
		`${JSON.stringify(nextConfig, null, 2)}\n`,
		"utf-8",
	);
	try {
		fs.chmodSync(resolvedConfigPath, 0o600);
	} catch {
		/* ignore */
	}
	return true;
}

export function resolveProjectRoot(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}
