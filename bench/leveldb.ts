import { LevelDb } from "../storage/leveldb"
import { benchmark, BenchDb } from "./benchmark"

class LevelDbBench implements BenchDb {
	private db = new LevelDb("./test.leveldb")
	get(key: string): Promise<string | undefined> {
		return this.db.get(key)
	}

	set(key: string, value: string): Promise<void> {
		return this.db.put(key, value)
	}
}

async function main() {
	console.log("starting")
	await benchmark("leveldb", new LevelDbBench())
	console.log("done")
}

main()
