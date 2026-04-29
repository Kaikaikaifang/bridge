type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

let currentLevel: LogLevel =
	(process.env.AGENT_BRIDGE_LOG_LEVEL?.trim().toLowerCase() as LogLevel) ||
	"info";

export function setLogLevel(level: LogLevel): void {
	currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
	return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(
	level: LogLevel,
	context: string | undefined,
	message: string,
): string {
	const ts = new Date().toISOString();
	const prefix = context ? `[${context}]` : "";
	return `${ts} ${level.toUpperCase().padEnd(5)} ${prefix} ${message}`;
}

export const logger = {
	debug(message: string, context?: string): void {
		if (shouldLog("debug"))
			console.debug(formatMessage("debug", context, message));
	},
	info(message: string, context?: string): void {
		if (shouldLog("info")) console.log(formatMessage("info", context, message));
	},
	warn(message: string, context?: string): void {
		if (shouldLog("warn"))
			console.warn(formatMessage("warn", context, message));
	},
	error(message: string, context?: string): void {
		if (shouldLog("error"))
			console.error(formatMessage("error", context, message));
	},
};
