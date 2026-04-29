import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import qrcodeTerminal from "qrcode-terminal";
import { getStateDir } from "../../config/load.js";
import type { WeixinChannelConfig } from "../../config/schema.js";
import type {
	ChannelAdapter,
	ChannelRuntime,
	OutgoingMessage,
} from "../../core/types.js";
import { JsonStore } from "../../storage/json-store.js";
import { apiGet, apiPost } from "./api.js";
import type { GetUpdatesResp, WeixinMessage, WeixinSession } from "./types.js";

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const LONG_POLL_TIMEOUT_MS = 38_000;
const SEND_TIMEOUT_MS = 15_000;
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const LOGIN_POLL_INTERVAL_MS = 1_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_DELAY_MS = 30_000;
const RETRY_DELAY_MS = 2_000;
const SESSION_EXPIRED_ERRCODE = 200018;
const SESSION_PAUSE_DURATION_MS = 30 * 60_000;
const SEEN_MESSAGE_ID_TTL_MS = 60_000;

function extractText(message: WeixinMessage): string {
	for (const item of message.item_list ?? []) {
		if (item.type === 1 && item.text_item?.text) return item.text_item.text;
		if (item.type === 3 && item.voice_item?.text)
			return `[语音] ${item.voice_item.text}`;
		if (item.type === 2) return "[图片]";
		if (item.type === 4) return `[文件] ${item.file_item?.file_name ?? ""}`;
		if (item.type === 5) return "[视频]";
	}
	return "[空消息]";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(t);
				reject(new Error("aborted"));
			},
			{ once: true },
		);
	});
}

export class WeixinChannel implements ChannelAdapter {
	name = "weixin";
	private running = false;
	private abortController = new AbortController();
	private session?: WeixinSession;
	private readonly sessionStore = new JsonStore<
		WeixinSession | Record<string, never>
	>(path.join(getStateDir(), "weixin-session.json"), {});
	private readonly syncStore = new JsonStore<{ buf: string }>(
		path.join(getStateDir(), "weixin-sync.json"),
		{ buf: "" },
	);
	private readonly seenMessageIds = new Map<string, number>();

	constructor(private readonly config: WeixinChannelConfig = {}) {}

	async start(runtime: ChannelRuntime): Promise<void> {
		this.running = true;
		this.abortController = new AbortController();
		this.session = await this.loadOrLogin(runtime);
		runtime.log(`微信通道已启动，Bot：${this.session.accountId}`);

		await this.notifyStart(runtime);

		let consecutiveFailures = 0;

		while (this.running) {
			try {
				const sync = this.syncStore.read();
				const resp = await apiPost<GetUpdatesResp>({
					baseUrl: this.session.baseUrl,
					endpoint: "ilink/bot/getupdates",
					body: { get_updates_buf: sync.buf },
					token: this.session.token,
					channelVersion: this.config.channelVersion ?? "1.0.2",
					timeoutMs: LONG_POLL_TIMEOUT_MS,
					silentTimeout: true,
				});
				const next = resp ?? { ret: 0, msgs: [], get_updates_buf: sync.buf };
				if (next.get_updates_buf)
					this.syncStore.write({ buf: next.get_updates_buf });

				const isApiError =
					(next.errcode !== undefined && next.errcode !== 0) ||
					(next.ret !== undefined && next.ret !== 0);

				if (isApiError) {
					const isSessionExpired =
						next.errcode === SESSION_EXPIRED_ERRCODE ||
						next.ret === SESSION_EXPIRED_ERRCODE;

					if (isSessionExpired) {
						runtime.error(
							`微信 session 已过期 (errcode=${next.errcode})，暂停 ${SESSION_PAUSE_DURATION_MS / 60_000} 分钟后重新登录`,
						);
						this.clearSession();
						try {
							await sleep(
								SESSION_PAUSE_DURATION_MS,
								this.abortController.signal,
							);
						} catch {
							/* aborted */
						}
						if (!this.running) break;
						this.session = await this.loadOrLogin(runtime);
						await this.notifyStart(runtime);
						consecutiveFailures = 0;
						continue;
					}

					consecutiveFailures += 1;
					runtime.error(
						`微信 getupdates 失败：ret=${next.ret} errcode=${next.errcode} ${next.errmsg ?? ""} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`,
					);
					if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
						runtime.error(
							`连续 ${MAX_CONSECUTIVE_FAILURES} 次失败，等待 ${BACKOFF_DELAY_MS / 1000}s 后重试`,
						);
						consecutiveFailures = 0;
						try {
							await sleep(BACKOFF_DELAY_MS, this.abortController.signal);
						} catch {
							/* aborted */
						}
					} else {
						try {
							await sleep(RETRY_DELAY_MS, this.abortController.signal);
						} catch {
							/* aborted */
						}
					}
					continue;
				}

				consecutiveFailures = 0;

				for (const msg of next.msgs ?? []) {
					if (msg.message_type !== 1) continue;
					const senderId = msg.from_user_id ?? "";
					if (!senderId) continue;

					if (this.isDuplicateMessage(msg)) continue;

					const text = extractText(msg);
					console.log(
						[
							"收到微信用户消息：",
							`from=${senderId}`,
							`to=${msg.to_user_id ?? ""}`,
							`contextToken=${msg.context_token ? "有" : "无"}`,
							`text=${text}`,
						].join("\n"),
					);
					await runtime.onMessage({
						channel: this.name,
						conversationId: senderId,
						senderId,
						text,
						replyToken: msg.context_token,
						raw: msg,
					});
				}
			} catch (err) {
				if (!this.running) break;
				consecutiveFailures += 1;
				runtime.error(
					`微信轮询出错 (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})：${err instanceof Error ? err.message : String(err)}`,
				);
				if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
					runtime.error(
						`连续 ${MAX_CONSECUTIVE_FAILURES} 次失败，等待 ${BACKOFF_DELAY_MS / 1000}s 后重试`,
					);
					consecutiveFailures = 0;
					try {
						await sleep(BACKOFF_DELAY_MS, this.abortController.signal);
					} catch {
						/* aborted */
					}
				} else {
					try {
						await sleep(RETRY_DELAY_MS, this.abortController.signal);
					} catch {
						/* aborted */
					}
				}
			}
		}
	}

	async stop(): Promise<void> {
		this.running = false;
		this.abortController.abort();
		if (this.session?.token) {
			try {
				await apiPost({
					baseUrl: this.session.baseUrl,
					endpoint: "ilink/bot/msg/notifystop",
					body: {},
					token: this.session.token,
					channelVersion: this.config.channelVersion ?? "1.0.2",
					timeoutMs: SEND_TIMEOUT_MS,
				});
			} catch {
				/* best effort */
			}
		}
	}

	async send(message: OutgoingMessage): Promise<void> {
		if (!this.session) throw new Error("微信通道尚未登录");
		console.log(
			[
				"准备回复微信用户：",
				`to=${message.conversationId}`,
				`text=${message.text}`,
			].join("\n"),
		);
		await apiPost({
			baseUrl: this.session.baseUrl,
			endpoint: "ilink/bot/sendmessage",
			body: {
				msg: {
					from_user_id: "",
					to_user_id: message.conversationId,
					client_id: `bridge-${crypto.randomUUID()}`,
					message_type: 2,
					message_state: 2,
					context_token: message.replyToken,
					item_list: [{ type: 1, text_item: { text: message.text } }],
				},
			},
			token: this.session.token,
			channelVersion: this.config.channelVersion ?? "1.0.2",
			timeoutMs: SEND_TIMEOUT_MS,
		});
	}

	async sendTyping(_conversationId: string): Promise<void> {
		if (!this.session?.token) return;
		try {
			await apiPost({
				baseUrl: this.session.baseUrl,
				endpoint: "ilink/bot/sendtyping",
				body: {
					ilink_user_id: _conversationId,
					status: 1,
				},
				token: this.session.token,
				channelVersion: this.config.channelVersion ?? "1.0.2",
				timeoutMs: SEND_TIMEOUT_MS,
			});
		} catch {
			/* best effort */
		}
	}

	private isDuplicateMessage(msg: WeixinMessage): boolean {
		const msgId = msg.message_id ?? `${msg.from_user_id}:${msg.create_time_ms}`;
		if (!msgId) return false;
		const now = Date.now();
		if (this.seenMessageIds.has(msgId)) return true;
		this.seenMessageIds.set(msgId, now);
		this.pruneSeenMessages(now);
		return false;
	}

	private pruneSeenMessages(now: number): void {
		for (const [id, ts] of this.seenMessageIds) {
			if (now - ts > SEEN_MESSAGE_ID_TTL_MS) this.seenMessageIds.delete(id);
		}
	}

	private clearSession(): void {
		this.session = undefined;
		try {
			const sessionPath = path.join(getStateDir(), "weixin-session.json");
			if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
		} catch {
			/* ignore */
		}
	}

	private async notifyStart(runtime: ChannelRuntime): Promise<void> {
		if (!this.session?.token) return;
		try {
			await apiPost({
				baseUrl: this.session.baseUrl,
				endpoint: "ilink/bot/msg/notifystart",
				body: {},
				token: this.session.token,
				channelVersion: this.config.channelVersion ?? "1.0.2",
				timeoutMs: SEND_TIMEOUT_MS,
			});
		} catch (err) {
			runtime.error(
				`notifyStart 失败（已忽略）：${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	private async loadOrLogin(runtime: ChannelRuntime): Promise<WeixinSession> {
		const saved = this.sessionStore.read() as Partial<WeixinSession>;
		if (saved.token && saved.baseUrl && saved.accountId)
			return saved as WeixinSession;

		const baseUrl = this.config.baseUrl ?? DEFAULT_BASE_URL;
		const botType = this.config.botType ?? "3";
		runtime.log("开始微信扫码登录...");
		const qrResp = await apiGet<{
			qrcode: string;
			qrcode_img_content?: string;
		}>({
			baseUrl,
			endpoint: `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(botType)}`,
			timeoutMs: SEND_TIMEOUT_MS,
		});
		const qrText = qrResp.qrcode_img_content ?? qrResp.qrcode;
		qrcodeTerminal.generate(qrText, { small: true }, (qr) => console.log(qr));

		const deadline = Date.now() + LOGIN_TIMEOUT_MS;
		const currentQrcode = qrResp.qrcode;
		while (Date.now() < deadline) {
			const status = await apiGet<Record<string, string>>({
				baseUrl,
				endpoint: `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(currentQrcode)}`,
				timeoutMs: SEND_TIMEOUT_MS,
			});
			if (status.status === "confirmed") {
				const session: WeixinSession = {
					token: status.bot_token,
					baseUrl: status.baseurl || baseUrl,
					accountId: status.ilink_bot_id,
					userId: status.ilink_user_id,
					savedAt: new Date().toISOString(),
				};
				this.sessionStore.write(session);
				try {
					fs.chmodSync(path.join(getStateDir(), "weixin-session.json"), 0o600);
				} catch {}
				return session;
			}
			if (status.status === "scaned") runtime.log("已扫码，请在微信端确认...");
			if (status.status === "expired")
				throw new Error("二维码已过期，请重新启动登录");
			try {
				await sleep(LOGIN_POLL_INTERVAL_MS, this.abortController.signal);
			} catch {
				throw new Error("登录已取消");
			}
		}
		throw new Error("微信登录超时");
	}
}
