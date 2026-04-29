import os from "node:os";
import path from "node:path";

/** 展开用户目录写法，方便配置里使用 `~`。 */
export function expandHome(input: string): string {
	if (input === "~") return os.homedir();
	if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
	return input;
}

/** 规范化工作目录，避免后续命令接收到相对路径。 */
export function resolvePath(input: string): string {
	return path.resolve(expandHome(input));
}

/**
 * 解析用户在聊天里输入的工作目录。
 *
 * - 绝对路径：按原样规范化。
 * - `~` 路径：展开到用户 Home。
 * - 相对路径：基于配置里的默认 workspace，而不是基于启动命令所在目录。
 */
export function resolveWorkspacePath(
	input: string,
	baseWorkspace: string,
): string {
	if (input === "~" || input.startsWith("~/") || path.isAbsolute(input)) {
		return resolvePath(input);
	}
	return path.resolve(resolvePath(baseWorkspace), input);
}

/** 判断目标目录是否位于允许的根目录之下。 */
export function isUnderAllowedRoots(target: string, roots: string[]): boolean {
	const resolvedTarget = resolvePath(target);
	return roots.some((root) => {
		const resolvedRoot = resolvePath(root);
		const relative = path.relative(resolvedRoot, resolvedTarget);
		return (
			relative === "" ||
			(!relative.startsWith("..") && !path.isAbsolute(relative))
		);
	});
}
