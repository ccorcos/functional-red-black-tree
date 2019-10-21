// function chain<A extends keyof M, B, M extends { [key: string]: any }>(
// 	args: [() => A, (arg: M[A]) => B]
// ) {
// 	return args
// }

class IO<I, O, N> {
	constructor(public input: I, public then: (o: O) => N) {}

	// This is helpful for type-level programming.
	public last: N extends IO<any, any, any> ? N["last"] : N
}

class DbGet<N> extends IO<{ type: "get"; id: string }, number, N> {}
class DbSet<N> extends IO<
	{ type: "set"; id: string; value: number },
	void,
	N
> {}

const x = new DbGet({ type: "get", id: "123" }, n => {
	return new DbSet({ type: "set", id: "123", value: n + 1 }, () => {
		return true
	})
})

type Language = DbGet<any> | DbSet<any>

function isLanguage(l: any): l is Language {
	return l instanceof DbGet || l instanceof DbSet
}

function evaluate<L extends IO<any, any, any>>(language: L): L["last"] {
	return {} as any
}

function evaluateDb<L extends Language>(language: L): L["last"] {
	while (true) {
		if (language instanceof DbGet) {
			language = language.then(1)
		} else if (language instanceof DbSet) {
			language = language.then()
		} else {
			return language
		}
	}
}
const y2 = evaluateDb(x)

// This works except for the final return
const y = evaluate(x)

// type Proc<A, B, C> = (a: A) => IO<B, C>
// type Proc2<A, B, C, D, E> = [Proc<A, B, C>, Proc<C, D, E>]

// type Procs<L extends IO<any, any>, A, B> = [(a: A) => Array<(arg: L["i"]) => L>]

// function chain2<A, B, C>(args: [() => IO<A, B>, (arg: B) => C]) {
// 	return args
// }
// const x = chain2([() => new DbGet({ type: "get", id: "a" }), n => false])

// function evaluate(args: Array)

// ChainResult<
// 	| IO<{type: "get", id: string}, object>
// 	| IO<{type: "set", id: string, value: any}, void>,
// 	undefined,
// 	void
// >

// chain([
// 	() => {
// 		return get(id)
// 	},
// 	(result: x) => {
// 		return set(id, {...x, color: 1})
// 	},
// ])

function chain3<L extends IO<any, any>, A, B>(
	args: [<T extends L>(a: A) => T]
) {}
