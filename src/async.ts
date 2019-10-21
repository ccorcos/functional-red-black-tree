function chain<A extends keyof M, B, M extends { [key: string]: any }>(
	args: [() => A, (arg: M[A]) => B]
) {
	return args
}

class IO<I, O> {
	constructor(public i: I) {}
	public o: O | undefined
}

class DbGet extends IO<{ type: "get"; id: string }, number> {}
class DbSet extends IO<{ type: "set"; id: string; value: number }, void> {}

// Need to be able to compose chains together!
class Chain<I, O> {}

function chain2<A, B, C>(args: [() => IO<A, B>, (arg: B) => C]) {
	return args
}
const x = chain2([() => new DbGet({ type: "get", id: "a" }), n => false])

// function evaluate(args: Array)
