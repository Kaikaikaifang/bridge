import { describe, it, expect } from "vitest";
import { createAgentRegistry } from "../src/agents/index.js";
import type { BridgeConfig } from "../src/config/schema.js";

const baseConfig: BridgeConfig = {
  defaultChannel: "cli",
  defaultAgent: "codex",
  workspace: "/workspace",
  allowUsers: [],
  allowedWorkspaceRoots: ["/workspace"],
  agents: {},
  channels: {},
};

describe("createAgentRegistry", () => {
  it("creates codex provider from key name inference", () => {
    const config: BridgeConfig = {
      ...baseConfig,
      agents: { codex: { command: "codex", sandbox: "read-only" } },
    };
    const registry = createAgentRegistry(config);
    expect(registry.has("codex")).toBe(true);
    expect(registry.get("codex")?.name).toBe("codex");
  });

  it("creates claude provider from key name inference", () => {
    const config: BridgeConfig = {
      ...baseConfig,
      agents: { claude: { command: "claude", permissionMode: "dontAsk" } },
    };
    const registry = createAgentRegistry(config);
    expect(registry.has("claude")).toBe(true);
    expect(registry.get("claude")?.name).toBe("claude");
  });

  it("creates codebuddy provider from key name inference", () => {
    const config: BridgeConfig = {
      ...baseConfig,
      agents: { codebuddy: { command: "codebuddy" } },
    };
    const registry = createAgentRegistry(config);
    expect(registry.has("codebuddy")).toBe(true);
    expect(registry.get("codebuddy")?.name).toBe("codebuddy");
  });

  it("creates opencode provider from key name inference", () => {
    const config: BridgeConfig = {
      ...baseConfig,
      agents: { opencode: { command: "opencode" } },
    };
    const registry = createAgentRegistry(config);
    expect(registry.has("opencode")).toBe(true);
    expect(registry.get("opencode")?.name).toBe("opencode");
  });

  it("creates generic provider for unknown key names", () => {
    const config: BridgeConfig = {
      ...baseConfig,
      agents: { mytool: { type: "generic", command: "my-tool" } },
    };
    const registry = createAgentRegistry(config);
    expect(registry.has("mytool")).toBe(true);
    expect(registry.get("mytool")?.name).toBe("generic");
  });

  it("skips disabled agents", () => {
    const config: BridgeConfig = {
      ...baseConfig,
      agents: { codex: { command: "codex", enabled: false } },
    };
    const registry = createAgentRegistry(config);
    expect(registry.has("codex")).toBe(false);
  });

  it("supports multiple agents simultaneously", () => {
    const config: BridgeConfig = {
      ...baseConfig,
      agents: {
        codex: { command: "codex" },
        claude: { command: "claude" },
        codebuddy: { command: "codebuddy" },
        opencode: { command: "opencode" },
        custom: { type: "generic", command: "custom-cli" },
      },
    };
    const registry = createAgentRegistry(config);
    expect(registry.size).toBe(5);
    expect([...registry.keys()]).toEqual(["codex", "claude", "codebuddy", "opencode", "custom"]);
  });

  it("returns empty map when no agents configured", () => {
    const registry = createAgentRegistry(baseConfig);
    expect(registry.size).toBe(0);
  });
});
