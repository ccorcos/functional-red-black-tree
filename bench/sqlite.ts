import { SqliteKeyValueStore } from "../storage/sqlite"
import { benchmark } from "./benchmark"

async function main() {
	console.log("starting")
	await benchmark("sqlite", new SqliteKeyValueStore("./test.sqlite"))
	console.log("done")
}

main()
