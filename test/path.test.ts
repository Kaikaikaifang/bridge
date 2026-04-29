import { describe, it, expect } from "vitest";
import { expandHome, resolvePath, resolveWorkspacePath, isUnderAllowedRoots } from "../src/util/path.js";

describe("expandHome", () => {
  it("expands ~ to homedir", () => {
    expect(expandHome("~")).toMatch(/\/home|\/Users/);
  });

  it("expands ~/path to homedir/path", () => {
    const result = expandHome("~/foo/bar");
    expect(result).toContain("foo/bar");
    expect(result.startsWith("~")).toBe(false);
  });

  it("returns unchanged path without ~", () => {
    expect(expandHome("/absolute/path")).toBe("/absolute/path");
    expect(expandHome("relative/path")).toBe("relative/path");
  });
});

describe("resolvePath", () => {
  it("resolves ~ paths to absolute", () => {
    const result = resolvePath("~/projects");
    expect(result.startsWith("~")).toBe(false);
    expect(result).toMatch(/^\//);
  });

  it("resolves relative paths to absolute", () => {
    const result = resolvePath("foo/bar");
    expect(result).toMatch(/^\//);
  });
});

describe("resolveWorkspacePath", () => {
  it("resolves absolute paths as-is", () => {
    const result = resolveWorkspacePath("/tmp/project", "/workspace");
    expect(result).toBe("/tmp/project");
  });

  it("resolves ~ paths", () => {
    const result = resolveWorkspacePath("~/project", "/workspace");
    expect(result.startsWith("~")).toBe(false);
  });

  it("resolves relative paths against baseWorkspace", () => {
    const result = resolveWorkspacePath("subdir", "/workspace");
    expect(result).toBe("/workspace/subdir");
  });
});

describe("isUnderAllowedRoots", () => {
  const roots = ["/home/user/projects", "/tmp/workspace"];

  it("allows paths under a root", () => {
    expect(isUnderAllowedRoots("/home/user/projects/app", roots)).toBe(true);
    expect(isUnderAllowedRoots("/tmp/workspace", roots)).toBe(true);
  });

  it("rejects paths outside all roots", () => {
    expect(isUnderAllowedRoots("/etc/passwd", roots)).toBe(false);
    expect(isUnderAllowedRoots("/home/user/other", roots)).toBe(false);
  });

  it("rejects traversal attempts", () => {
    expect(isUnderAllowedRoots("/home/user/projects/../../etc", roots)).toBe(false);
  });
});
