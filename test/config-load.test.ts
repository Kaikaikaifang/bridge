import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addAllowUserToConfig } from "../src/config/load.js";

const tmpDir = path.join(os.tmpdir(), "agent-bridge-config-load-test");

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("addAllowUserToConfig", () => {
  it("creates config file with allowUsers", () => {
    const filePath = path.join(tmpDir, `create-${Date.now()}.json`);

    expect(addAllowUserToConfig("user1", filePath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(filePath, "utf-8"))).toEqual({
      allowUsers: ["user1"],
    });
  });

  it("appends user without duplicating existing entries", () => {
    const filePath = path.join(tmpDir, `append-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({ defaultChannel: "weixin", allowUsers: ["user1"] }),
      "utf-8",
    );

    expect(addAllowUserToConfig("user2", filePath)).toBe(true);
    expect(addAllowUserToConfig("user2", filePath)).toBe(false);
    expect(JSON.parse(fs.readFileSync(filePath, "utf-8"))).toEqual({
      defaultChannel: "weixin",
      allowUsers: ["user1", "user2"],
    });
  });
});
