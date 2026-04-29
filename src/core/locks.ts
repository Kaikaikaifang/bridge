/** 按 key 串行执行任务，避免同一会话同时驱动多个 Agent。 */
export class KeyedQueue {
	private readonly tails = new Map<string, Promise<void>>();

	async run<T>(key: string, task: () => Promise<T>): Promise<T> {
		const previous = this.tails.get(key) ?? Promise.resolve();
		let release!: () => void;
		const current = new Promise<void>((resolve) => {
			release = resolve;
		});
		const chain = previous.then(() => current);
		this.tails.set(key, chain);

		await previous;
		try {
			return await task();
		} finally {
			release();
			if (this.tails.get(key) === chain) this.tails.delete(key);
		}
	}
}
