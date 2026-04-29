import type {
	AgentConfig,
	AgentProviderType,
	BridgeConfig,
} from "../config/schema.js";
import type { AgentName, AgentProvider } from "../core/types.js";
import { createClaudeCodeProvider } from "./providers/claude-code.js";
import { createCodebuddyProvider } from "./providers/codebuddy.js";
import { createCodexProvider } from "./providers/codex.js";
import { createGenericProvider } from "./providers/generic.js";
import { createOpenCodeProvider } from "./providers/opencode.js";

/** Known key-name → type mapping for backward compatibility. */
const KEY_TYPE_MAP: Record<string, AgentProviderType> = {
	codex: "codex",
	claude: "claude",
	codebuddy: "codebuddy",
	opencode: "opencode",
};

/** Infer provider type from config key name when `type` field is absent. */
function inferType(key: string, config: AgentConfig): AgentProviderType {
	if (config.type) return config.type;
	return KEY_TYPE_MAP[key] ?? "generic";
}

function createProvider(
	key: string,
	config: AgentConfig,
): AgentProvider | null {
	if (config.enabled === false) return null;

	const type = inferType(key, config);

	switch (type) {
		case "codex":
			return createCodexProvider(config);
		case "claude":
			return createClaudeCodeProvider(config);
		case "codebuddy":
			return createCodebuddyProvider(config);
		case "opencode":
			return createOpenCodeProvider(config);
		case "generic":
			return createGenericProvider(config);
		default:
			return null;
	}
}

export function createAgentRegistry(
	config: BridgeConfig,
): Map<AgentName, AgentProvider> {
	const registry = new Map<AgentName, AgentProvider>();

	for (const [key, agentConfig] of Object.entries(config.agents)) {
		const provider = createProvider(key, agentConfig);
		if (provider) {
			registry.set(key, provider);
		}
	}

	return registry;
}
