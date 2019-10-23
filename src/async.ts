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

class DbGet<N = string> extends IO<{ type: "get"; id: string }, string, N> {
	constructor(id: string) {
		super({ type: "get", id }, identity as any)
	}
	public map<T>(fn: (n: N) => T) {
		const { input, mapper } = this
		const next = new DbGet<T>(input.id)
		next.mapper = i => fn(mapper(i))
		return next
	}
}

class DbSet<N = void> extends IO<
	{ type: "set"; id: string; value: string },
	void,
	N
> {
	constructor(id: string, value: string) {
		super({ type: "set", id, value }, identity as any)
	}

	public map<T>(fn: (n: N) => T) {
		const { input, mapper } = this
		const next = new DbSet<T>(input.id, input.value)
		next.mapper = i => fn(mapper(i))
		return next
	}
}
type Language<O = any> = DbGet<O> | DbSet<O>

const x = new DbGet("123").map(value => {
	return new DbSet("234", value).map(() => true)
})

function evaluateDb<L extends Language>(language: L): L["last"] {
	while (true) {
		if (language instanceof DbGet) {
			language = language.mapper("result")
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
