import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentConfig } from "../../config/schema.js";
import type {
	AgentProvider,
	AgentRequest,
	AgentResponse,
} from "../../core/types.js";
import { runCommand } from "../../util/command.js";
import { buildAgentPrompt } from "../prompt.js";

export function createCodexProvider(config: AgentConfig = {}): AgentProvider {
	return {
		name: "codex",
		async ask(request: AgentRequest): Promise<AgentResponse> {
			const command = config.command ?? "codex";
			const timeoutMs = config.timeoutMs ?? request.timeoutMs;
			const outputPath = path.join(
				os.tmpdir(),
				`agent-bridge-codex-${crypto.randomUUID()}.txt`,
			);

			const args = [
				"exec",
				"--cd",
				request.cwd,
				"--sandbox",
				config.sandbox ?? "read-only",
				"--skip-git-repo-check",
				"--output-last-message",
				outputPath,
				"--color",
				"never",
			];
			if (config.model) args.push("--model", config.model);
			if (config.extraArgs?.length) args.push(...config.extraArgs);
			args.push("-");

			const result = await runCommand({
				command,
				args,
				cwd: request.cwd,
				stdin: buildAgentPrompt(request),
				timeoutMs,
			});

			let text = "";
			try {
				if (fs.existsSync(outputPath))
					text = fs.readFileSync(outputPath, "utf-8").trim();
			} finally {
				try {
					fs.unlinkSync(outputPath);
				} catch {}
			}

			if (!text) text = result.stdout.trim();
			if (result.timedOut) text = "Codex 执行超时，已终止本次任务。";
			if (result.code !== 0 && !text) {
				text = `Codex 执行失败：${result.stderr.trim() || `退出码 ${result.code}`}`;
			}

			return {
				text: text || "Codex 没有返回内容。",
				meta: { code: result.code, stderr: result.stderr.slice(0, 2_000) },
			};
		},
	};
}
