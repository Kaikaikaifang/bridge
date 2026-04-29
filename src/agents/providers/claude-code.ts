import type { AgentConfig } from "../../config/schema.js";
import type {
	AgentProvider,
	AgentRequest,
	AgentResponse,
} from "../../core/types.js";
import { runCommand } from "../../util/command.js";
import { buildAgentPrompt } from "../prompt.js";

function parseClaudeJson(
	stdout: string,
): { text: string; sessionId?: string } | null {
	try {
		const parsed = JSON.parse(stdout) as Record<string, unknown>;
		const text =
			typeof parsed.result === "string"
				? parsed.result
				: typeof parsed.message === "string"
					? parsed.message
					: "";
		const sessionId =
			typeof parsed.session_id === "string" ? parsed.session_id : undefined;
		return { text, sessionId };
	} catch {
		return null;
	}
}

export function createClaudeCodeProvider(
	config: AgentConfig = {},
): AgentProvider {
	return {
		name: "claude",
		async ask(request: AgentRequest): Promise<AgentResponse> {
			const command = config.command ?? "claude";
			const timeoutMs = config.timeoutMs ?? request.timeoutMs;
			const args = [
				"--print",
				"--output-format",
				"json",
				"--permission-mode",
				config.permissionMode ?? "dontAsk",
			];

			if (config.model) args.push("--model", config.model);
			if (config.tools !== undefined) args.push("--tools", config.tools);
			if (request.sessionId) args.push("--resume", request.sessionId);
			if (config.extraArgs?.length) args.push(...config.extraArgs);

			const prompt = buildAgentPrompt(request);
			const result = await runCommand({
				command,
				args,
				cwd: request.cwd,
				timeoutMs,
				stdin: prompt,
			});

			const parsed = parseClaudeJson(result.stdout);
			let text = parsed?.text?.trim() || result.stdout.trim();
			if (result.timedOut) text = "Claude Code 执行超时，已终止本次任务。";
			if (result.code !== 0 && !text) {
				text = `Claude Code 执行失败：${result.stderr.trim() || `退出码 ${result.code}`}`;
			}

			return {
				text: text || "Claude Code 没有返回内容。",
				sessionId: parsed?.sessionId,
				meta: { code: result.code, stderr: result.stderr.slice(0, 2_000) },
			};
		},
	};
}
