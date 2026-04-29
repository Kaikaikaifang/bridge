import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handleBuiltinCommand } from "../src/core/commands.js";
import type { ChatMessage, AgentProvider } from "../src/core/types.js";
import type { BridgeConfig } from "../src/config/schema.js";
import { JsonStore } from "../src/storage/json-store.js";

import type { StateStore } from "../src/storage/state.js";

type ConversationState = {
  agent?: string;
  cwd?: string;
  sessions?: Record<string, string>;
  updatedAt?: string;
};

type BridgeState = {
  conversations: Record<string, ConversationState>;
  channelState: Record<string, unknown>;
};

function makeMessage(text: string, senderId = "user1"): ChatMessage {
  return {
    channel: "weixin",
    conversationId: senderId,
    senderId,
    text,
  };
}

const defaultConfig: BridgeConfig = {
  defaultChannel: "weixin",
  defaultAgent: "codex",
  workspace: "/workspace",
  allowUsers: ["user1"],
  allowedWorkspaceRoots: ["/workspace"],
  agents: { codex: {}, claude: {}, codebuddy: {} },
  channels: { weixin: {}, feishu: {} },
};

const mockAgents = new Map<string, AgentProvider>([
  ["codex", { name: "codex", ask: async () => ({ text: "" }) }],
  ["claude", { name: "claude", ask: async () => ({ text: "" }) }],
  ["codebuddy", { name: "codebuddy", ask: async () => ({ text: "" }) }],
]);

let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(
    os.tmpdir(),
    `agent-bridge-test-${process.pid}-${Date.now()}`,
  );
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createStateStore() {
  const store = new JsonStore<BridgeState>(path.join(tmpDir, "state.json"), {
    conversations: {},
    channelState: {},
  });

  const conversationKey = (channel: string, conversationId: string) =>
    `${channel}:${conversationId}`;

  const storeObj = {
    getConversation(
      channel: string,
      conversationId: string,
    ): ConversationState {
      return (
        store.read().conversations[conversationKey(channel, conversationId)] ??
        {}
      );
    },
    updateConversation(
      channel: string,
      conversationId: string,
      mutator: (state: ConversationState) => ConversationState,
    ): ConversationState {
      const key = conversationKey(channel, conversationId);
      let next: ConversationState = {};
      store.update((state) => {
        next = {
          ...mutator(state.conversations[key] ?? {}),
          updatedAt: new Date().toISOString(),
        };
        return {
          ...state,
          conversations: { ...state.conversations, [key]: next },
        };
      });
      return next;
    },
    setAgentSession(
      channel: string,
      conversationId: string,
      agent: string,
      sessionId: string,
    ): void {
      storeObj.updateConversation(channel, conversationId, (state: ConversationState) => ({
        ...state,
        sessions: { ...(state.sessions ?? {}), [agent]: sessionId },
      }));
    },
    resetConversation(channel: string, conversationId: string): void {
      const key = conversationKey(channel, conversationId);
      store.update((state) => {
        const conversations = { ...state.conversations };
        delete conversations[key];
        return { ...state, conversations };
      });
    },
  };
  return storeObj as unknown as StateStore;
}

describe("handleBuiltinCommand", () => {
  it("ignores non-command messages", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("hello"),
      config: defaultConfig,
      stateStore: createStateStore(),
    });
    expect(result.handled).toBe(false);
  });

  it("handles /status", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("/status"),
      config: defaultConfig,
      stateStore: createStateStore(),
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("weixin");
    expect(result.reply).toContain("codex");
  });

  it("handles /agent with valid name", () => {
    const store = createStateStore();
    const result = handleBuiltinCommand({
      message: makeMessage("/agent claude"),
      config: defaultConfig,
      stateStore: store,
      agents: mockAgents,
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("claude");
  });

  it("rejects /agent with unknown name and lists available", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("/agent gpt4"),
      config: defaultConfig,
      stateStore: createStateStore(),
      agents: mockAgents,
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("未知 Agent");
    expect(result.reply).toContain("codex");
  });

  it("handles /agent without argument", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("/agent"),
      config: defaultConfig,
      stateStore: createStateStore(),
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("用法");
  });

  it("handles /agents to list all agents", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("/agents"),
      config: defaultConfig,
      stateStore: createStateStore(),
      agents: mockAgents,
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("可用 Agent");
    expect(result.reply).toContain("codex");
    expect(result.reply).toContain("claude");
    expect(result.reply).toContain("codebuddy");
    expect(result.reply).toContain("*"); // current agent marker
  });

  it("handles /agents with no agents configured", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("/agents"),
      config: defaultConfig,
      stateStore: createStateStore(),
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("未配置任何 Agent");
  });

  it("handles /help", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("/help"),
      config: defaultConfig,
      stateStore: createStateStore(),
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("/status");
    expect(result.reply).toContain("/agents");
    expect(result.reply).toContain("/agent");
  });

  it("handles /reset", () => {
    const store = createStateStore();
    handleBuiltinCommand({
      message: makeMessage("/agent claude"),
      config: defaultConfig,
      stateStore: store,
      agents: mockAgents,
    });
    const result = handleBuiltinCommand({
      message: makeMessage("/reset"),
      config: defaultConfig,
      stateStore: store,
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("已清理");
  });

  it("returns unknown command with help hint", () => {
    const result = handleBuiltinCommand({
      message: makeMessage("/foo"),
      config: defaultConfig,
      stateStore: createStateStore(),
    });
    expect(result.handled).toBe(true);
    expect(result.reply).toContain("未知命令");
    expect(result.reply).toContain("/help");
  });
});
