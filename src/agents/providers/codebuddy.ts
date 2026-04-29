import type { AgentConfig } from "../../config/schema.js";
import type {
	AgentProvider,
	AgentRequest,
	AgentResponse,
} from "../../core/types.js";
import { runCommand } from "../../util/command.js";
import { buildAgentPrompt } from "../prompt.js";

export function createCodebuddyProvider(
	config: AgentConfig = {},
): AgentProvider {
	return {
		name: "codebuddy",
		async ask(request: AgentRequest): Promise<AgentResponse> {
			const command = config.command ?? "codebuddy";
			const timeoutMs = config.timeoutMs ?? request.timeoutMs;

			const args = ["--print", "--output-format", "text"];

			if (config.permissionMode) {
				args.push("--permission-mode", config.permissionMode);
			}
			if (config.model) {
				args.push("--model", config.model);
			}
			if (request.sessionId) {
				args.push("--resume", request.sessionId);
			}
			if (config.extraArgs?.length) args.push(...config.extraArgs);

			const prompt = buildAgentPrompt(request);
			const result = await runCommand({
				command,
				args,
				cwd: request.cwd,
				timeoutMs,
				stdin: prompt,
			});

			let text = result.stdout.trim();
			if (result.timedOut) text = "Codebuddy 执行超时，已终止本次任务。";
			if (result.code !== 0 && !text) {
				text = `Codebuddy 执行失败：${result.stderr.trim() || `退出码 ${result.code}`}`;
			}

			return {
				text: text || "Codebuddy 没有返回内容。",
				meta: { code: result.code, stderr: result.stderr.slice(0, 2_000) },
			};
		},
	};
}
