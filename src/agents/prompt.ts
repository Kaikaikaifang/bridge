import type { AgentRequest } from "../core/types.js";

export function buildAgentPrompt(request: AgentRequest): string {
	return [
		"你正在通过微信/飞书等聊天软件被远程调用。",
		"请优先给出简洁、可执行的中文回复。",
		"如果你执行了本机操作，请说明关键结果；不要输出无关调试日志。",
		"",
		request.text,
	].join("\n");
}
