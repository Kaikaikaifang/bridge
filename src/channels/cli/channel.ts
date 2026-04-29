import readline from "node:readline";
import type { CliChannelConfig } from "../../config/schema.js";
import type {
	ChannelAdapter,
	ChannelRuntime,
	OutgoingMessage,
} from "../../core/types.js";

const DEFAULT_PROMPT = "bridge> ";

export class CliChannel implements ChannelAdapter {
	name = "cli";
	private running = false;
	private rl?: readline.Interface;

	constructor(private readonly config: CliChannelConfig = {}) {}

	async start(runtime: ChannelRuntime): Promise<void> {
		this.running = true;
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: this.config.prompt ?? DEFAULT_PROMPT,
			historySize: this.config.history !== false ? 100 : 0,
		});

		this.rl.on("line", async (line) => {
			const text = line.trim();
			if (!text) {
				this.rl?.prompt();
				return;
			}

			try {
				await runtime.onMessage({
					channel: this.name,
					conversationId: "cli:local",
					senderId: "cli:user",
					text,
				});
			} catch (err) {
				runtime.error(
					`CLI 消息处理失败：${err instanceof Error ? err.message : String(err)}`,
				);
			}

			if (this.running) this.rl?.prompt();
		});

		this.rl.on("close", () => {
			if (this.running) {
				this.running = false;
				runtime.log("CLI 输入关闭");
			}
		});

		console.log("Agent Bridge CLI 模式已启动。输入消息或 /help 查看命令。");
		this.rl.prompt();
	}

	async stop(): Promise<void> {
		this.running = false;
		this.rl?.close();
	}

	async send(message: OutgoingMessage): Promise<void> {
		// Insert a blank line before response for visual separation
		process.stdout.write("\n");
		// Split long messages into lines with proper indentation
		for (const line of message.text.split("\n")) {
			process.stdout.write(`  ${line}\n`);
		}
		process.stdout.write("\n");
		// Re-display the prompt after response
		this.rl?.prompt();
	}
}
