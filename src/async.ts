/*

- How does Promise.all work?
	Create a DbBatch command!
- How do we avoid the pyramid of doom?

*/

class IO<I, O, N> {
	constructor(public input: I, public mapper: (o: O) => N) {}

	public map<T>(fn: (n: N) => T) {
		const { input, mapper } = this
		return new IO<I, O, T>(input, i => fn(mapper(i)))
	}

	// This is helpful for type-level programming.
	public last: N extends IO<any, any, any> ? N["last"] : N
}

class DbGet<N> extends IO<{ type: "get"; id: string }, number, N> {
	constructor(id: string, then: (n: number) => N) {
		super({ type: "get", id }, then)
	}
}

class DbSet<N> extends IO<{ type: "set"; id: string; value: number }, void, N> {
	constructor(id: string, value: number, then: () => N) {
		super({ type: "set", id, value }, then)
	}
}

type Language<O = any> = DbGet<O> | DbSet<O>

// function chain<A extends Language, B extends Language>(
// 	args: [A, (arg: A["last"]) => B]
// ): B["last"] {
// 	return {} as any
// }

const x = new DbGet("123", n => {
	return new DbSet("123", n + 1, () => {
		return true
	})
})

function evaluateDb<L extends Language>(language: L): L["last"] {
	while (true) {
		if (language instanceof DbGet) {
			language = language.mapper(1)
		} else if (language instanceof DbSet) {
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
