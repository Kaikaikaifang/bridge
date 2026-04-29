import fs from "node:fs";
import path from "node:path";

/** 极简 JSON 文件存储。写入使用临时文件替换，降低半写入概率。 */
export class JsonStore<T extends object> {
	constructor(
		private readonly filePath: string,
		private readonly fallback: T,
	) {}

	read(): T {
		try {
			if (!fs.existsSync(this.filePath)) return structuredClone(this.fallback);
			return JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as T;
		} catch {
			return structuredClone(this.fallback);
		}
	}

	write(value: T): void {
		fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
		const tempPath = `${this.filePath}.${process.pid}.tmp`;
		fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf-8");
		fs.renameSync(tempPath, this.filePath);
	}

	update(mutator: (value: T) => T): T {
		const next = mutator(this.read());
		this.write(next);
		return next;
	}
}
