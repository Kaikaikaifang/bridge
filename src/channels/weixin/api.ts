import crypto from "node:crypto";

function randomWechatUin(): string {
	const uint32 = crypto.randomBytes(4).readUInt32BE(0);
	return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function buildHeaders(
	token: string | undefined,
	body?: unknown,
): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		AuthorizationType: "ilink_bot_token",
		"X-WECHAT-UIN": randomWechatUin(),
	};
	if (body !== undefined)
		headers["Content-Length"] = String(
			Buffer.byteLength(JSON.stringify(body), "utf-8"),
		);
	if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;
	return headers;
}

export async function apiGet<T>(params: {
	baseUrl: string;
	endpoint: string;
	timeoutMs?: number;
}): Promise<T> {
	const url = `${params.baseUrl.replace(/\/$/, "")}/${params.endpoint}`;
	const controller = new AbortController();
	const timer = params.timeoutMs
		? setTimeout(() => controller.abort(), params.timeoutMs)
		: undefined;
	try {
		const res = await fetch(url, {
			signal: controller.signal,
		});
		if (timer) clearTimeout(timer);
		const text = await res.text();
		if (!res.ok)
			throw new Error(`GET ${params.endpoint} ${res.status}: ${text}`);
		return JSON.parse(text) as T;
	} catch (err) {
		if (timer) clearTimeout(timer);
		throw err;
	}
}

export type ApiPostOptions = {
	baseUrl: string;
	endpoint: string;
	body: Record<string, unknown>;
	token?: string;
	channelVersion: string;
	timeoutMs: number;
	/** When true, client-side timeout (AbortError) returns null instead of throwing.
	 *  Use this for long-polling endpoints like getUpdates. */
	silentTimeout?: boolean;
};

export async function apiPost<T>(params: ApiPostOptions): Promise<T | null> {
	const url = `${params.baseUrl.replace(/\/$/, "")}/${params.endpoint}`;
	const payload = {
		...params.body,
		base_info: { channel_version: params.channelVersion },
	};
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), params.timeoutMs);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: buildHeaders(params.token, payload),
			body: JSON.stringify(payload),
			signal: controller.signal,
		});
		clearTimeout(timer);
		const text = await res.text();
		if (!res.ok)
			throw new Error(`POST ${params.endpoint} ${res.status}: ${text}`);
		return JSON.parse(text) as T;
	} catch (err) {
		clearTimeout(timer);
		if (err instanceof Error && err.name === "AbortError") {
			if (params.silentTimeout) return null;
			throw new Error(
				`POST ${params.endpoint} timed out after ${params.timeoutMs}ms`,
			);
		}
		throw err;
	}
}
