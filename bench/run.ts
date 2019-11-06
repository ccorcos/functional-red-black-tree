import { performance } from "perf_hooks"
import * as _ from "lodash"
import * as level from "level"
import {
	RedBlackTree,
	defaultCompare,
	NodeStorage,
	NodeData,
} from "../src/rbtree"

// async function main() {
// 	var t = createTree<number, number>()

// 	var s = Date.now()
// 	for (var i = 0; i < 100000; ++i) {
// 		t = await t.insert(Math.random(), Math.random())
// 	}
// 	console.log(Date.now() - s)
// }

// (async function () {
//   // Same as normal level but with JSON parsing and only promises
//   await database.put('first', { foo: 'bar' });
//   await database.get('first'); // { foo: 'bar' }
//   await database.del('first');
// })();

interface LevelDb {
	put(key: string, value: string): Promise<void>
	get(key: string): Promise<string>
	del(key: string): Promise<void>
	batch(
		ops: Array<
			{ type: "del"; key: string } | { type: "put"; key: string; value: string }
		>
	): Promise<void>
}

class BetterLevelDb {
	db: LevelDb
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

// TODO: TreeStorage... IndexStorage... All different interfaces.
class LevelDbNodeStorage<K, V> implements NodeStorage<K, V> {
	constructor(private db: BetterLevelDb) {}

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

class TreeDb implements BenchDb {
	db = new BetterLevelDb("./chet.leveldb")
	nodeStorage = new LevelDbNodeStorage<string, string>(this.db)

	private tree: RedBlackTree<string, string> | undefined
	async getTree() {
		if (this.tree) {
			return this.tree
		}

		// Change the root key and you can have many trees!
		// const nodeId = await this.db.get("root")
		this.tree = new RedBlackTree<string, string>(
			{
				compare: defaultCompare,
				// rootId: nodeId,
				rootId: undefined,
			},
			this.nodeStorage
		)
		return this.tree
	}

	async get(key: string): Promise<string | undefined> {
		const tree = await this.getTree()
		const node = (await tree.find(key)).node
		if (node) {
			return node.value
		}
	}

	async set(key: string, value: string): Promise<void> {
		const tree = await this.getTree()
		this.tree = await tree.insert(key, JSON.stringify(value))
	}
}

interface BenchDb {
	get(key: string): Promise<string | undefined>
	// getBatch(keys: Array<string>): Promise<Array<string | undefined>>
	set(key: string, value: string): Promise<void>
	// setBatch(entries: Array<[string, string]>): Promise<void>
	// scan(lt: string, gt: string): Promise<Array<string>>
	// remove(key: string): Promise<void>
	// removeBatch(key: Array<string>): Promise<void>
}

function random() {
	return Math.random().toString()
}

class Timer {
	constructor(private label: string) {
		// this.start()
	}
	times: Array<number> = []
	t = performance.now()
	next() {
		const t2 = performance.now()
		this.times.push(t2 - this.t)
		this.t = t2
	}
	timer: NodeJS.Timeout | undefined
	start() {
		this.timer = setInterval(this.log, 1_000)
	}
	stop() {
		this.log()
		if (this.timer === undefined) {
			return
		}
		clearInterval(this.timer)
		this.timer = undefined
	}
	log = () => {
		if (this.times.length === 0) {
			return
		}
		console.log(this.label, {
			min: _.min(this.times).toFixed(3) + " ms",
			max: _.max(this.times).toFixed(3) + " ms",
			avg: (_.sum(this.times) / this.times.length).toFixed(3) + " ms",
		})
	}
}

const iterations = 10_000

async function benchmark(label: string, db: BenchDb) {
	const sets = new Timer(label + ": sets")
	const keys: Array<string> = []
	for (var i = 0; i < iterations; i++) {
		const key = random()
		keys.push(key)
		await db.set(key, random())
		sets.next()
	}
	sets.stop()

	const gets = new Timer(label + ": gets")
	for (var i = 0; i < iterations; i++) {
		await db.get(keys[i])
		gets.next()
	}
	gets.stop()
}

async function main() {
	console.log("starting")
	await benchmark("treedb", new TreeDb())
	console.log("done")
}

main()
