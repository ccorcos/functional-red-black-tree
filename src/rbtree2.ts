class InMemoryKeyValueStore {
	private map: Record<string, string> = {}
	get(key: string): string | undefined {
		return this.map[key]
	}
	set(key: string, value: string): void {
		this.map[key] = value
	}
	delete(key: string): void {
		delete this.map[key]
	}
}

interface RBNodeData<K, V> {
	id: string
	color: 1 | 0
	key: K
	value: V
	leftId: string | undefined
	rightId: string | undefined
	count: number
}

class RBNodeDataStore<K, V> {
	constructor(private store: InMemoryKeyValueStore) {}
	get(id: string): RBNodeData<K, V> | undefined {
		const result = this.store.get(id)
		if (result !== undefined) {
			return JSON.parse(result)
		}
	}
	set(value: RBNodeData<K, V>): void {
		this.store.set(value.id, JSON.stringify(value))
	}
}

export class RBNode<K, V> {
	constructor(
		public readonly id: string,
		private store: RBNodeDataStore<K, V>
	) {}

	private get() {
		const result = this.store.get(this.id)
		// This is gross. Its a symptom of using mutable programming patterns.
		// However, this implementation is so non-trivial that I find it more
		// reasonable to go this direction than have a bunch of code that doesn't
		// work.
		if (result === undefined) {
			throw new Error(
				"Node value must be cached in the store before it is instantiated."
			)
		}
		return result
	}

	get color(): 1 | 0 {
		return this.get().color
	}
	get key(): K {
		return this.get().key
	}
	get value(): V {
		return this.get().value
	}
	get leftId(): string | undefined {
		return this.get().leftId
	}
	get rightId(): string | undefined {
		return this.get().rightId
	}
	get count(): number {
		return this.get().count
	}

	set color(value: 1 | 0) {
		this.store.set({
			...this.get(),
			color: value,
		})
	}
	set key(value: K) {
		this.store.set({
			...this.get(),
			key: value,
		})
	}
	set value(value: V) {
		this.store.set({
			...this.get(),
			value: value,
		})
	}
	set leftId(value: string | undefined) {
		this.store.set({
			...this.get(),
			leftId: value,
		})
	}
	set rightId(value: string | undefined) {
		this.store.set({
			...this.get(),
			rightId: value,
		})
	}
	set count(value: number) {
		this.store.set({
			...this.get(),
			count: value,
		})
	}
}
