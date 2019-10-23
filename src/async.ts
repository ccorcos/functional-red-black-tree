/*

- How does Promise.all work?
	Create a DbBatch command!
- How do we avoid the pyramid of doom?

*/

type DbGet2<T> = { type: "get"; id: string; next: (value: string) => T }
type DbSet2<T> = { type: "set"; id: string; value: string; next: () => T }
type DbAll2<O extends Array<Lang2<any>>, T> = {
	type: "all"
	args: O
	next: (args: Array<ReturnType<O[number]["next"]>>) => T
}
type Lang2<O> = DbGet2<O> | DbSet2<O> | DbAll2<Array<Lang2<any>>, O>

function get(id: string): DbGet2<void> {
	return { type: "get", id, next: () => {} }
}

// a map function isnt going to work without higher-kinded types.
// However, this does kind of work...
// Maybe try using interfaces and put the map functions on there. Similar
// to how a class would work, but just plain objects. Any different?

class IO<I, O, N> {
	constructor(public input: I, public mapper: (o: O) => N) {}

	public map<T>(fn: (n: N) => T) {
		const { input, mapper } = this
		return new IO<I, O, T>(input, i => fn(mapper(i)))
	}

	// This is helpful for type-level programming.
	public last: N extends IO<any, any, any> ? N["last"] : N

	// All generic.
	static all<A extends IO<any, any, any>, B extends IO<any, any, any>>(
		args: [A, B]
	): IOAll<[A, B], [A["last"], B["last"]]>
	static all<
		A extends IO<any, any, any>,
		B extends IO<any, any, any>,
		C extends IO<any, any, any>
	>(args: [A, B, C]): IOAll<[A, B, C], [A["last"], B["last"], C["last"]]>
	static all<
		A extends IO<any, any, any>,
		B extends IO<any, any, any>,
		C extends IO<any, any, any>,
		D extends IO<any, any, any>
	>(
		args: [A, B, C, D]
	): IOAll<[A, B, C, D], [A["last"], B["last"], C["last"], D["last"]]>
	static all<
		A extends IO<any, any, any>,
		B extends IO<any, any, any>,
		C extends IO<any, any, any>,
		D extends IO<any, any, any>,
		E extends IO<any, any, any>
	>(
		args: [A, B, C, D, E]
	): IOAll<
		[A, B, C, D, E],
		[A["last"], B["last"], C["last"], D["last"], E["last"]]
	>
	static all<T extends Array<IO<any, any, any>>>(
		args: T
	): IOAll<T, Array<T[number]["last"]>> {
		return new IOAll(args, identity as any)
	}
}

class IOAll<I extends Array<IO<any, any, any>>, N> extends IO<
	I,
	I[number]["last"],
	N
> {
	constructor(public input: I, public mapper: (o: I) => N) {
		super(input, mapper)
	}

	public map<T>(fn: (n: N) => T) {
		const { input, mapper } = this
		return new IOAll(input, i => fn(mapper(i)))
	}
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

// TODO: ideally this would work: `IOAll<Array<Language<any>>, O>`.
type Language<O = any> = DbGet<O> | DbSet<O> | IOAll<any, O>

const x = new DbGet("123").map(value => {
	return new DbSet("234", value).map(() => true)
})

const a = IO.all([
	new DbGet("123"),
	new DbSet("234", "something").map(() => true),
]).map(() => "dope" as const)

function evaluateDb<L extends Language>(language: L): L["last"] {
	let result: any = language
	while (true) {
		if (result instanceof DbGet) {
			result = result.mapper("result")
		} else if (result instanceof DbSet) {
			result = result.mapper()
		} else if (result instanceof IOAll) {
			result = result.mapper([])
		} else {
			return result
		}
	}
}
const y2 = evaluateDb(x)
const y3 = evaluateDb(a)

function identity<X>(x: X): X {
	return x
}
