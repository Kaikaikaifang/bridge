import type { AgentConfig } from "../../config/schema.js";
import type {
	AgentProvider,
	AgentRequest,
	AgentResponse,
} from "../../core/types.js";
import { runCommand } from "../../util/command.js";
import { buildAgentPrompt } from "../prompt.js";

export function createOpenCodeProvider(
	config: AgentConfig = {},
): AgentProvider {
	return {
		name: "opencode",
		async ask(request: AgentRequest): Promise<AgentResponse> {
			const command = config.command ?? "opencode";
			const timeoutMs = config.timeoutMs ?? request.timeoutMs;

			const args: string[] = ["run"];

			if (config.provider) {
				args.push("--provider", config.provider);
			}
			if (config.model) {
				args.push("--model", config.model);
			}
			if (request.sessionId) {
				args.push("--session", request.sessionId);
			}
			if (config.extraArgs?.length) args.push(...config.extraArgs);

			// Pass prompt via stdin; opencode run reads it as the message
			const prompt = buildAgentPrompt(request);
			const result = await runCommand({
				command,
				args,
				cwd: request.cwd,
				stdin: prompt,
				timeoutMs,
			});

			let text = result.stdout.trim();
			if (result.timedOut) text = "OpenCode 执行超时，已终止本次任务。";
			if (result.code !== 0 && !text) {
				text = `OpenCode 执行失败：${result.stderr.trim() || `退出码 ${result.code}`}`;
			}

			return {
				text: text || "OpenCode 没有返回内容。",
				meta: { code: result.code, stderr: result.stderr.slice(0, 2_000) },
			};
		},
	};
}
