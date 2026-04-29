import { z } from "zod";

// --- Agent config ---
// All agent types share a common base. Provider-specific fields are all optional.
// The `type` field is optional — when absent, the provider is inferred from
// the config key name (e.g. `codex: {…}` → codex provider).

const AgentConfigSchema = z.object({
	/** Provider type: determines which adapter to use. Inferred from key name if absent. */
	type: z
		.enum(["codex", "claude", "codebuddy", "opencode", "generic"])
		.optional(),
	/** CLI command name or full path. */
	command: z.string().optional(),
	/** Model identifier passed to the CLI. */
	model: z.string().nullable().optional(),
	/** Execution timeout in milliseconds. */
	timeoutMs: z.number().int().positive().optional(),
	/** Extra CLI arguments appended after provider-specific flags. */
	extraArgs: z.array(z.string()).optional(),
	/** Whether this agent is enabled. */
	enabled: z.boolean().optional(),

	// Codex-specific
	sandbox: z
		.enum(["read-only", "workspace-write", "danger-full-access"])
		.optional(),
	approval: z
		.enum(["untrusted", "on-request", "never", "on-failure"])
		.optional(),

	// Claude / Codebuddy-specific
	permissionMode: z
		.enum([
			"default",
			"acceptEdits",
			"bypassPermissions",
			"dontAsk",
			"plan",
			"auto",
		])
		.optional(),
	tools: z.string().optional(),

	// OpenCode-specific
	provider: z.string().optional(),

	// Generic-specific
	/** Flag to pass the prompt as a positional argument. */
	promptArg: z.string().optional(),
	/** Flag to pass the working directory. */
	cwdArg: z.string().optional(),
	/** Flag to pass the model. */
	modelArg: z.string().optional(),
	/** Read prompt from stdin instead of CLI arg. */
	stdinPrompt: z.boolean().optional(),
	/** Regex to extract text from stdout. Full stdout used if absent. */
	outputPattern: z.string().optional(),
});

// --- Channel configs ---
const WeixinChannelConfigSchema = z.object({
	baseUrl: z.string().url().optional(),
	botType: z.string().optional(),
	channelVersion: z.string().optional(),
});

const FeishuChannelConfigSchema = z.object({
	enabled: z.boolean().optional(),
	appId: z.string().optional(),
	appSecret: z.string().optional(),
	encryptKey: z.string().optional(),
	verificationToken: z.string().optional(),
	port: z.number().int().positive().optional(),
});

const CliChannelConfigSchema = z.object({
	/** Prompt string displayed before input. */
	prompt: z.string().optional(),
	/** Whether to use readline history. */
	history: z.boolean().optional(),
});

export const BridgeConfigSchema = z.object({
	defaultChannel: z.string().min(1),
	defaultAgent: z.string().min(1),
	workspace: z.string().min(1),
	allowUsers: z.array(z.string()),
	allowedWorkspaceRoots: z.array(z.string()),
	agents: z.record(z.string(), AgentConfigSchema),
	channels: z
		.object({
			weixin: WeixinChannelConfigSchema.optional(),
			feishu: FeishuChannelConfigSchema.optional(),
			cli: CliChannelConfigSchema.optional(),
		})
		.passthrough(),
});

export type AgentProviderType =
	| "codex"
	| "claude"
	| "codebuddy"
	| "opencode"
	| "generic";

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type WeixinChannelConfig = z.infer<typeof WeixinChannelConfigSchema>;
export type FeishuChannelConfig = z.infer<typeof FeishuChannelConfigSchema>;
export type CliChannelConfig = z.infer<typeof CliChannelConfigSchema>;
export type BridgeConfig = z.infer<typeof BridgeConfigSchema>;
