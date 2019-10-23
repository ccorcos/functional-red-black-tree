/*

- How does Promise.all work?
	Create a DbBatch command!
- How do we avoid the pyramid of doom?

*/

class IO<I, O, N> {
	constructor(public input: I, public mapper: (o: O) => N) {}

	map<T>(fn: (i: N) => T) {
		const { input, mapper } = this
		return new IO<I, O, T>(input, o => fn(mapper(o)))
	}

	// This is helpful for type-level programming.
	public last: N extends IO<any, any, any> ? N["last"] : N
}

interface DbGet {
	type: "get"
	id: string
}

interface DbSet {
	type: "set"
	id: string
	value: string
}

const db = {
	get(id: string) {
		return new IO<DbGet, string, string>({ type: "get", id }, identity)
	},
	set(id: string, value: string) {
		return new IO<DbSet, void, void>({ type: "set", id, value }, identity)
	},
}

const x2 = db.get("asdf")
const x3 = x2.map(record => db.set("asdf2", record))

type Language<N = any> = IO<DbGet, string, N> | IO<DbSet, string, N>

const x = db.get("123").map(value => {
	return db.set("234", value).map(() => {
		return true
	})
})

function evaluateDb<L extends Language>(language: L): L["last"] {
	while (true) {
		if (language.input.type === "get") {
			language = language.mapper("asdf")
		} else if (language.input.type === "set") {
			language = language.mapper()
		} else {
			return language
		}
	}
}
const y2 = evaluateDb(x)

function identity<X>(x: X): X {
	return x
}
