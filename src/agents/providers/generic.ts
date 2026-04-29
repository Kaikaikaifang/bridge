import type { AgentConfig } from "../../config/schema.js";
import type {
	AgentProvider,
	AgentRequest,
	AgentResponse,
} from "../../core/types.js";
import { runCommand } from "../../util/command.js";
import { buildAgentPrompt } from "../prompt.js";

export function createGenericProvider(config: AgentConfig): AgentProvider {
	return {
		name: "generic",
		async ask(request: AgentRequest): Promise<AgentResponse> {
			const command = config.command;
			if (!command) throw new Error("generic agent requires a `command` field");

			const timeoutMs = config.timeoutMs ?? request.timeoutMs;
			const prompt = buildAgentPrompt(request);

			const args: string[] = [];

			// Working directory flag
			if (config.cwdArg) {
				args.push(config.cwdArg, request.cwd);
			}

			// Model flag
			if (config.modelArg && config.model) {
				args.push(config.modelArg, config.model);
			}

			if (config.extraArgs?.length) args.push(...config.extraArgs);

			// Prompt: either as stdin or as a positional/flag argument
			let stdin: string | undefined;
			if (config.stdinPrompt) {
				stdin = prompt;
			} else if (config.promptArg) {
				args.push(config.promptArg, prompt);
			} else {
				// Default: prompt as trailing positional argument
				args.push(prompt);
			}

			const result = await runCommand({
				command,
				args,
				cwd: request.cwd,
				stdin,
				timeoutMs,
			});

			let text = result.stdout.trim();

			// Apply output pattern if configured
			if (config.outputPattern && text) {
				try {
					const regex = new RegExp(config.outputPattern, "s");
					const match = regex.exec(text);
					if (match?.[1]) text = match[1].trim();
				} catch {
					// Invalid regex, use full output
				}
			}

			if (result.timedOut) text = `${command} 执行超时，已终止本次任务。`;
			if (result.code !== 0 && !text) {
				text = `${command} 执行失败：${result.stderr.trim() || `退出码 ${result.code}`}`;
			}

			return {
				text: text || `${command} 没有返回内容。`,
				meta: { code: result.code, stderr: result.stderr.slice(0, 2_000) },
			};
		},
	};
}
