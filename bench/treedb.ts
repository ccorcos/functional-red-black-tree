import { performance } from "perf_hooks"
import * as _ from "lodash"
import { TreeDb } from "../src/treedb"
import { LevelDb, LevelDbNodeStorage } from "../storage/leveldb"
import { compare } from "../src/utils"

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
	await benchmark(
		"treedb",
		new TreeDb<string, string>({
			storage: new LevelDbNodeStorage(new LevelDb("./chet.leveldb")),
			compare: compare,
		})
	)
	console.log("done")
}

main()
