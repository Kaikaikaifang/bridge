import { spawn } from "node:child_process";

export type CommandResult = {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
};

export type RunCommandOptions = {
	command: string;
	args: string[];
	cwd: string;
	stdin?: string;
	timeoutMs: number;
	env?: NodeJS.ProcessEnv;
};

/** 执行外部命令，并在超时后终止进程。所有 Agent CLI 都通过这里调用。 */
export function runCommand(options: RunCommandOptions): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(options.command, options.args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let settled = false;
		let timedOut = false;

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!settled) child.kill("SIGKILL");
			}, 3_000).unref();
		}, options.timeoutMs);

		child.stdout.setEncoding("utf-8");
		child.stderr.setEncoding("utf-8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", (err) => {
			clearTimeout(timer);
			settled = true;
			reject(err);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			settled = true;
			resolve({ code, stdout, stderr, timedOut });
		});

		if (options.stdin) child.stdin.write(options.stdin);
		child.stdin.end();
	});
}
