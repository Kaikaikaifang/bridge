export type WeixinSession = {
	token: string;
	baseUrl: string;
	accountId: string;
	userId?: string;
	savedAt: string;
};

export type WeixinMessage = {
	message_id?: string;
	from_user_id?: string;
	to_user_id?: string;
	message_type?: number;
	context_token?: string;
	create_time_ms?: number;
	item_list?: Array<{
		type?: number;
		text_item?: { text?: string };
		voice_item?: { text?: string };
		file_item?: { file_name?: string };
	}>;
};

export type GetUpdatesResp = {
	ret?: number;
	errcode?: number;
	errmsg?: string;
	msgs?: WeixinMessage[];
	get_updates_buf?: string;
	longpolling_timeout_ms?: number;
};
