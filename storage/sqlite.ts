import * as sqlite from "better-sqlite3"

// TODO: pretty weird this is synchronous...
export class SqliteKeyValueStore {
	db: sqlite.Database
	init: Promise<void>

	constructor(dbPath: string) {
		this.db = sqlite(dbPath)
		this.db
			.prepare(
				"CREATE TABLE IF NOT EXISTS key_value (key TEXT PRIMARY KEY, value TEXT)"
			)
			.run()
	}

	async get(key: string) {
		const row = this.db
			.prepare("SELECT value FROM key_value WHERE key=?")
			.get(key)
		return row.value
	}

	async set(key: string, value: string) {
		this.db
			.prepare("INSERT OR REPLACE INTO key_value (key, value) VALUES (?, ?)")
			.run(key, value)
	}

	async delete(key: string) {
		this.db.prepare("SELETE FROM key_value WHERE key=?").run(key)
	}
}
