import { describe, it, expect } from "vitest";
import { buildAgentPrompt } from "../src/agents/prompt.js";

describe("buildAgentPrompt", () => {
  it("includes the user text", () => {
    const prompt = buildAgentPrompt({ text: "帮我写个函数", userId: "u1", conversationId: "c1", cwd: "/tmp", timeoutMs: 1000 });
    expect(prompt).toContain("帮我写个函数");
  });

  it("includes system instructions", () => {
    const prompt = buildAgentPrompt({ text: "hi", userId: "u1", conversationId: "c1", cwd: "/tmp", timeoutMs: 1000 });
    expect(prompt).toContain("聊天软件");
    expect(prompt).toContain("简洁");
  });
});
