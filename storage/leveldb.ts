import * as level from "level"
import { NodeData, NodeStorage } from "../src/rbtree"

interface LevelUp {
	put(key: string, value: string): Promise<void>
	get(key: string): Promise<string>
	del(key: string): Promise<void>
	batch(
		ops: Array<
			{ type: "del"; key: string } | { type: "put"; key: string; value: string }
		>
	): Promise<void>
}

/**
 * A wrapper around LevelUp with better semantics.
 */
export class LevelDb {
	db: LevelUp
	constructor(dbPath: string) {
		this.db = new level<string>(dbPath)
	}

	async get(id: string): Promise<string | undefined> {
		try {
			const result = await this.db.get(id)
			if (result === undefined) {
				return
			}
			return result
		} catch (error) {
			if (error.notFound) {
				return
			} else {
				throw error
			}
		}
	}

	async put(key: string, value: string): Promise<void> {
		await this.db.put(key, value)
	}

	async del(id: string): Promise<void> {
		try {
			await this.db.del(id)
		} catch (error) {
			if (error.notFound) {
				return
			} else {
				throw error
			}
		}
	}
}

export class LevelDbNodeStorage<K, V> implements NodeStorage<K, V> {
	constructor(private db: LevelDb) {}

	async get(id: string): Promise<NodeData<K, V> | undefined> {
		const result = await this.db.get(id)
		if (result === undefined) {
			return
		}
		return JSON.parse(result)
	}

	async set(node: NodeData<K, V>): Promise<void> {
		await this.db.put(node.id, JSON.stringify(node))
	}

	async delete(id: string): Promise<void> {
		await this.db.del(id)
	}
}
