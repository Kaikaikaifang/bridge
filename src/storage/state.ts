import path from "node:path";
import { getStateDir } from "../config/load.js";
import type { AgentName, ConversationState } from "../core/types.js";
import { JsonStore } from "./json-store.js";

export type BridgeState = {
	conversations: Record<string, ConversationState>;
	channelState: Record<string, unknown>;
};

function conversationKey(channel: string, conversationId: string): string {
	return `${channel}:${conversationId}`;
}

export class StateStore {
	private readonly store = new JsonStore<BridgeState>(
		path.join(getStateDir(), "state.json"),
		{
			conversations: {},
			channelState: {},
		},
	);

	getConversation(channel: string, conversationId: string): ConversationState {
		const state = this.store.read();
		return state.conversations[conversationKey(channel, conversationId)] ?? {};
	}

	updateConversation(
		channel: string,
		conversationId: string,
		mutator: (state: ConversationState) => ConversationState,
	): ConversationState {
		const key = conversationKey(channel, conversationId);
		let nextConversation: ConversationState = {};
		this.store.update((state) => {
			nextConversation = {
				...mutator(state.conversations[key] ?? {}),
				updatedAt: new Date().toISOString(),
			};
			return {
				...state,
				conversations: {
					...state.conversations,
					[key]: nextConversation,
				},
			};
		});
		return nextConversation;
	}

	setAgentSession(
		channel: string,
		conversationId: string,
		agent: AgentName,
		sessionId: string,
	): void {
		this.updateConversation(channel, conversationId, (state) => ({
			...state,
			sessions: {
				...(state.sessions ?? {}),
				[agent]: sessionId,
			},
		}));
	}

	resetConversation(channel: string, conversationId: string): void {
		const key = conversationKey(channel, conversationId);
		this.store.update((state) => {
			const conversations = { ...state.conversations };
			delete conversations[key];
			return { ...state, conversations };
		});
	}
}
