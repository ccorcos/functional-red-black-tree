import { TreeDb } from "../src/treedb"
import { LevelDb, LevelDbNodeStorage } from "../storage/leveldb"
import { compare } from "../src/utils"
import { benchmark } from "./benchmark"

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
