import { performance } from "perf_hooks"
import * as _ from "lodash"

const iterations = 100_000

export interface BenchDb {
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

	min = 0
	max = 0
	sum = 0
	count = 0

	t = performance.now()
	next() {
		const t2 = performance.now()
		const dt = t2 - this.t
		this.min = Math.min(this.min, dt)
		this.max = Math.max(this.max, dt)
		this.sum = this.sum + dt
		this.count = this.count + 1
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
		if (this.count === 0) {
			return
		}
		console.log(this.label, {
			min: this.min.toFixed(3) + " ms",
			max: this.max.toFixed(3) + " ms",
			avg: (this.sum / this.count).toFixed(3) + " ms",
		})
	}
}

export async function benchmark(label: string, db: BenchDb) {
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
