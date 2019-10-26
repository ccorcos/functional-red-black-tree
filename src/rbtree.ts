/*

Game Plan:
- [x] convert to typescript.
- [x] persist to a key-value map.
	- [ ] write transactionally
- [ ] persist to leveldb.
	- [ ] generators to run sync or async


- [ ] finish migrating everything to async using transactions




- how to we persist to async storage with the same api?
	Lets just do async... Maybe React suspense will become our best friend.

*/

// class Task<I> {
// 	constructor(public i: I) {}

// 	static chain<
// 		A extends keyof OutputMap,
// 		B,
// 		OutputMap extends { [type: string]: any }
// 	>(args: [() => Task<A>, (arg: OutputMap[A]) => B]): B {}
// }

interface KeyValueStore<K, V> {
	get(key: K): Promise<V | undefined>
	set(key: K, value: V): Promise<void>
	delete(key: K): Promise<void>
}

// Going to serialize to simulate a real backend.
class InMemoryKeyValueStore implements KeyValueStore<string, string> {
	private map: Record<string, string> = {}
	async get(key: string): Promise<string | undefined> {
		return this.map[key]
	}
	async set(key: string, value: string): Promise<void> {
		this.map[key] = value
	}
	async delete(key: string): Promise<void> {
		delete this.map[key]
	}
}

class RBNodeDataStore<K, V> {
	constructor(private store: InMemoryKeyValueStore) {}
	async get(key: string): Promise<RBNodeData<K, V> | undefined> {
		const result = await this.store.get(key)
		if (result) {
			return JSON.parse(result)
		}
	}
	async batch(operations: Array<Operation<K, V>>) {
		for (const op of operations) {
			if (op.type === "set") {
				const node = op.value
				await this.store.set(node.id, JSON.stringify(node))
			} else {
				await this.store.delete(op.id)
			}
		}
	}
}

// class RBNodeCache<K, V> implements KeyValueStore<string, RBNode<K, V>> {
// 	private cache: Record<string, RBNode<K, V>> = {}
// 	constructor(private store: KeyValueStore<string, RBNode<K, V>>) {}

// 	get(key: string): RBNode<K, V> | undefined {
// 		const value = this.store.get(key)
// 		if (value !== undefined) {
// 			this.cache[key] = value
// 		}
// 		return value
// 	}
// 	set(key: string, value: RBNode<K, V>): void {
// 		this.store.set(key, value)
// 		this.cache[key] = value
// 	}
// 	delete(key: string): void {
// 		this.store.delete(key)
// 		delete this.cache[key]
// 	}
// }

type Operation<K, V> =
	| { type: "delete"; id: string }
	| {
			type: "set"
			id: string
			value: RBNodeData<K, V>
	  }

class RBNodeTransaction<K, V> {
	constructor(private store: RBNodeDataStore<K, V>) {}

	cache: Record<string, RBNodeData<K, V> | undefined> = {}

	changes: Record<string, Operation<K, V>> = {}

	async get(nodeId: string): Promise<RBNode<K, V> | undefined> {
		if (nodeId in this.cache) {
			const data = this.cache[nodeId]
			if (data !== undefined) {
				return new RBNode(data, this)
			}
		}
		const data = await this.store.get(nodeId)
		this.cache[nodeId] = data
		if (data !== undefined) {
			return new RBNode(data, this)
		}
	}

	set(value: RBNodeData<K, V>): void {
		this.cache[value.id] = value
		this.changes[value.id] = { type: "set", id: value.id, value }
	}

	delete(nodeId: string): void {
		this.cache[nodeId] = undefined
		this.changes[nodeId] = { type: "delete", id: nodeId }
	}

	async commit() {
		const ops = Object.values(this.changes)
		await this.store.batch(ops)
	}
}

function randomId() {
	return Math.round(Math.random() * 1e10).toString()
}

let RED = 0 as const
let BLACK = 1 as const

interface RBNodeData<K, V> {
	type: "data" // use this to distinguish type from RBNode
	id: string
	color: 1 | 0
	key: K
	value: V
	leftId: string | undefined
	rightId: string | undefined
	count: number
}

// TODO remove this class in favor of helper functions?
export class RBNode<K, V> {
	public readonly id: string

	constructor(
		private args: RBNodeData<K, V>,
		private txn: RBNodeTransaction<K, V>
	) {
		this.id = args.id
	}

	save() {
		this.txn.set(this.args)
	}

	get color() {
		return this.args.color
	}

	set color(x: 0 | 1) {
		if (this.args.color === x) {
			return
		}
		// TODO: don't mutate
		this.args.color = x
		this.save()
	}

	get key() {
		return this.args.key
	}

	set key(x: K) {
		if (this.args.key === x) {
			return
		}
		this.args.key = x
		this.save()
	}

	get value() {
		return this.args.value
	}

	set value(x: V) {
		if (this.args.value === x) {
			return
		}
		this.args.value = x
		this.save()
	}

	get count() {
		return this.args.count
	}

	set count(x: number) {
		if (this.args.count === x) {
			return
		}
		this.args.count = x
		this.save()
	}

	get leftId() {
		return this.args.leftId
	}

	set leftId(x: string | undefined) {
		if (this.args.leftId === x) {
			return
		}
		this.args.leftId = x
		this.save()
	}

	get rightId() {
		return this.args.rightId
	}

	set rightId(x: string | undefined) {
		if (this.args.rightId === x) {
			return
		}
		this.args.rightId = x
		this.save()
	}

	async getLeft(): Promise<RBNode<K, V> | undefined> {
		if (this.args.leftId) {
			return this.txn.get(this.args.leftId)
		}
	}

	setLeft(x: RBNode<K, V> | undefined) {
		if (x) {
			if (this.args.leftId === x.id) {
				return
			}
			this.args.leftId = x.id
			this.save()
		} else {
			if (this.args.leftId === undefined) {
				return
			}
			this.args.leftId = undefined
			this.save()
		}
	}

	async getRight(): Promise<RBNode<K, V> | undefined> {
		if (this.args.rightId) {
			return this.txn.get(this.args.rightId)
		}
	}

	// TODO: consolidate with this.rightId =
	setRight(x: RBNode<K, V> | undefined) {
		if (x) {
			if (this.args.rightId === x.id) {
				return
			}
			this.args.rightId = x.id
			this.save()
		} else {
			if (this.args.rightId === undefined) {
				return
			}
			this.args.rightId = undefined
			this.save()
		}
	}

	clone(args?: Partial<RBNodeData<K, V>>): RBNode<K, V> {
		const newNode = new RBNode(
			{
				...this.args,
				id: randomId(),
				...args,
			},
			this.txn
		)
		newNode.save()
		return newNode
	}

	repaint(color: 1 | 0) {
		return this.clone({ color })
	}
}

async function recount<K, V>(node: RBNode<K, V>) {
	const [left, right] = await Promise.all([node.getLeft(), node.getRight()])
	node.count = 1 + (left ? left.count : 0) + (right ? right.count : 0)
}

export class RedBlackTree<K, V> {
	public compare: (a: K, b: K) => number
	public rootId: string | undefined

	constructor(
		args: {
			compare: (a: K, b: K) => number
			rootId: string | undefined
		},
		private store: RBNodeTransaction<K, V>
	) {
		this.compare = args.compare
		this.rootId = args.rootId
	}

	clone(root: RBNode<K, V> | undefined) {
		return new RedBlackTree({ ...this, root }, this.store)
	}

	async keys() {
		let result: Array<K> = []
		await this.forEach(async function(k, v) {
			result.push(k)
		})
		return result
	}

	async values() {
		let result: Array<V> = []
		await this.forEach(async function(k, v) {
			result.push(v)
		})
		return result
	}

	// Returns the number of nodes in the tree
	async length() {
		if (this.rootId) {
			const root = await this.store.get(this.rootId)
			if (root) {
				return root.count
			}
		}
		return 0
	}

	async getRoot() {
		if (this.rootId) {
			return this.store.get(this.rootId)
		}
	}

	// Insert a new item into the tree
	async insert(key: K, value: V): Promise<RedBlackTree<K, V>> {
		let cmp = this.compare
		// Find point to insert new node at
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		let n_stack: Array<RBNode<K, V>> = []
		let d_stack: Array<number> = []
		while (n) {
			let d = cmp(key, n.key)
			n_stack.push(n)
			d_stack.push(d)
			if (d <= 0) {
				n = await n.getLeft()
			} else {
				n = await n.getRight()
			}
		}
		//Rebuild path to leaf node
		const newNode = new RBNode(
			{
				type: "data",
				id: randomId(),
				color: RED,
				key,
				value,
				leftId: undefined,
				rightId: undefined,
				count: 1,
			},
			this.store
		)
		newNode.save()
		n_stack.push(newNode)
		for (let s = n_stack.length - 2; s >= 0; --s) {
			let n = n_stack[s]
			if (d_stack[s] <= 0) {
				n_stack[s] = n.clone({
					leftId: n_stack[s + 1] ? n_stack[s + 1].id : undefined,
					count: n.count + 1,
				})
			} else {
				n_stack[s] = n.clone({
					rightId: n_stack[s + 1] ? n_stack[s + 1].id : undefined,
					count: n.count + 1,
				})
			}
		}
		//Rebalance tree using rotations
		//console.log("start insert", key, d_stack)
		for (let s = n_stack.length - 1; s > 1; --s) {
			let p = n_stack[s - 1]
			let n = n_stack[s]
			if (p.color === BLACK || n.color === BLACK) {
				break
			}
			let pp = n_stack[s - 2]
			if (pp.leftId === p.id) {
				if (p.leftId === n.id) {
					let y = await pp.getRight()
					if (y && y.color === RED) {
						//console.log("LLr")
						p.color = BLACK
						pp.setRight(y.repaint(BLACK))
						pp.color = RED
						s -= 1
					} else {
						//console.log("LLb")
						pp.color = RED
						pp.setLeft(await p.getRight())
						p.color = BLACK
						p.setRight(pp)
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						await recount(pp)
						await recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.setLeft(p)
							} else {
								ppp.setRight(p)
							}
						}
						break
					}
				} else {
					let y = await pp.getRight()
					if (y && y.color === RED) {
						//console.log("LRr")
						p.color = BLACK
						pp.setRight(y.repaint(BLACK))
						pp.color = RED
						s -= 1
					} else {
						//console.log("LRb")
						p.setRight(await n.getLeft())
						pp.color = RED
						pp.setLeft(await n.getRight())
						n.color = BLACK
						n.setLeft(p)
						n.setRight(pp)
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						await recount(pp)
						await recount(p)
						await recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.setLeft(n)
							} else {
								ppp.setRight(n)
							}
						}
						break
					}
				}
			} else {
				if (p.rightId === n.id) {
					let y = await pp.getLeft()
					if (y && y.color === RED) {
						//console.log("RRr", y.key)
						p.color = BLACK
						pp.setLeft(y.repaint(BLACK))
						pp.color = RED
						s -= 1
					} else {
						//console.log("RRb")
						pp.color = RED
						pp.setRight(await p.getLeft())
						p.color = BLACK
						p.setRight(pp)
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						await recount(pp)
						await recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.setRight(p)
							} else {
								ppp.setLeft(p)
							}
						}
						break
					}
				} else {
					let y = await pp.getLeft()
					if (y && y.color === RED) {
						//console.log("RLr")
						p.color = BLACK
						pp.setLeft(y.repaint(BLACK))
						pp.color = RED
						s -= 1
					} else {
						//console.log("RLb")
						p.setLeft(await n.getRight())
						pp.color = RED
						pp.setRight(await n.getLeft())
						n.color = BLACK
						n.setRight(p)
						n.setLeft(pp)
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						await recount(pp)
						await recount(p)
						await recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.setRight(n)
							} else {
								ppp.setLeft(n)
							}
						}
						break
					}
				}
			}
		}
		//Return new tree
		n_stack[0].color = BLACK

		return new RedBlackTree({ compare: cmp, rootId: n_stack[0].id }, this.store)
	}

	async forEach<T>(
		fn: (key: K, value: V) => Promise<T>,
		lo?: K,
		hi?: K
	): Promise<T | undefined> {
		if (!this.rootId) {
			return
		}
		const root = await this.store.get(this.rootId)
		if (!root) {
			return
		}

		if (lo !== undefined) {
			if (hi !== undefined) {
				if (this.compare(lo, hi) >= 0) {
					return
				}
				const result = await doVisit(lo, hi, this.compare, fn, root)
				return result
			} else {
				const result = await doVisitHalf(lo, this.compare, fn, root)
				return result
			}
		} else {
			const result = await doVisitFull(fn, root)
			return result
		}
	}

	//First item in list
	async begin(): Promise<RedBlackTreeIterator<K, V>> {
		let stack: Array<RBNode<K, V>> = []
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		while (n) {
			stack.push(n)
			n = await n.getLeft()
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Last item in list
	async end(): Promise<RedBlackTreeIterator<K, V>> {
		let stack: Array<RBNode<K, V>> = []
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		while (n) {
			stack.push(n)
			n = await n.getRight()
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Find the ith item in the tree
	async at(idx: number): Promise<RedBlackTreeIterator<K, V>> {
		if (idx < 0 || !this.rootId) {
			return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
		}
		const root = this.rootId ? await this.store.get(this.rootId) : undefined
		if (!root) {
			return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
		}

		let n = root
		let stack: Array<RBNode<K, V>> = []
		while (true) {
			stack.push(n)
			const left = await n.getLeft()
			if (left) {
				if (idx < left.count) {
					n = left
					continue
				}
				idx -= left.count
			}
			if (!idx) {
				return new RedBlackTreeIterator(
					{ tree: this, stack: stack },
					this.store
				)
			}
			idx -= 1
			const right = await n.getRight()
			if (right) {
				if (idx >= right.count) {
					break
				}
				n = right
			} else {
				break
			}
		}
		return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
	}

	async ge(key: K): Promise<RedBlackTreeIterator<K, V>> {
		let cmp = this.compare
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d <= 0) {
				last_ptr = stack.length
			}
			if (d <= 0) {
				n = await n.getLeft()
			} else {
				n = await n.getRight()
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	async gt(key: K): Promise<RedBlackTreeIterator<K, V>> {
		let cmp = this.compare
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d < 0) {
				last_ptr = stack.length
			}
			if (d < 0) {
				n = await n.getLeft()
			} else {
				n = await n.getRight()
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	async lt(key: K): Promise<RedBlackTreeIterator<K, V>> {
		let cmp = this.compare
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d > 0) {
				last_ptr = stack.length
			}
			if (d <= 0) {
				n = await n.getLeft()
			} else {
				n = await n.getRight()
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	async le(key: K): Promise<RedBlackTreeIterator<K, V>> {
		let cmp = this.compare
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d >= 0) {
				last_ptr = stack.length
			}
			if (d < 0) {
				n = await n.getLeft()
			} else {
				n = await n.getRight()
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	//Finds the item with key if it exists
	async find(key: K): Promise<RedBlackTreeIterator<K, V>> {
		let cmp = this.compare
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		let stack: Array<RBNode<K, V>> = []
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d === 0) {
				return new RedBlackTreeIterator({ tree: this, stack }, this.store)
			}
			if (d <= 0) {
				n = await n.getLeft()
			} else {
				n = await n.getRight()
			}
		}
		return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
	}

	//Removes item with key from tree
	async remove(key: K): Promise<RedBlackTree<K, V>> {
		let iter = await this.find(key)
		if (iter) {
			return iter.remove()
		}
		return this
	}

	//Returns the item at `key`
	async get(key: K) {
		let cmp = this.compare
		let n = this.rootId ? await this.store.get(this.rootId) : undefined
		while (n) {
			let d = cmp(key, n.key)
			if (d === 0) {
				return n.value
			}
			if (d <= 0) {
				n = await n.getLeft()
			} else {
				n = await n.getRight()
			}
		}
		return
	}
}

// Visit all nodes inorder
async function doVisitFull<K, V, T>(
	fn: (key: K, value: V) => T,
	node: RBNode<K, V>
): Promise<T | undefined> {
	const left = await node.getLeft()
	if (left) {
		let v = await doVisitFull(fn, left)
		if (v) {
			return v
		}
	}
	let v = fn(node.key, node.value)
	if (v) {
		return v
	}
	const right = await node.getRight()
	if (right) {
		return doVisitFull(fn, right)
	}
}

// Visit half nodes in order
async function doVisitHalf<K, V, T>(
	lo: K,
	compare: (a: K, b: K) => number,
	fn: (key: K, value: V) => T,
	node: RBNode<K, V>
): Promise<T | undefined> {
	let l = compare(lo, node.key)
	if (l <= 0) {
		const left = await node.getLeft()
		if (left) {
			let v = doVisitHalf(lo, compare, fn, left)
			if (v) {
				return v
			}
		}
		let v = fn(node.key, node.value)
		if (v) {
			return v
		}
	}
	const right = await node.getRight()
	if (right) {
		return doVisitHalf(lo, compare, fn, right)
	}
}

//Visit all nodes within a range
async function doVisit<K, V, T>(
	lo: K,
	hi: K,
	compare: (a: K, b: K) => number,
	fn: (key: K, value: V) => T,
	node: RBNode<K, V>
): Promise<T | undefined> {
	let l = compare(lo, node.key)
	let h = compare(hi, node.key)
	let v
	if (l <= 0) {
		const left = await node.getLeft()
		if (left) {
			v = doVisit(lo, hi, compare, fn, left)
			if (v) {
				return v
			}
		}
		if (h > 0) {
			v = fn(node.key, node.value)
			if (v) {
				return v
			}
		}
	}
	if (h > 0) {
		const right = await node.getRight()
		if (right) {
			return doVisit(lo, hi, compare, fn, right)
		}
	}
}

//Iterator for red black tree
export class RedBlackTreeIterator<K, V> {
	public tree: RedBlackTree<K, V>
	public stack: Array<RBNode<K, V>>

	constructor(
		args: { tree: RedBlackTree<K, V>; stack: Array<RBNode<K, V>> },
		private store: RBNodeTransaction<K, V>
	) {
		this.tree = args.tree
		this.stack = args.stack
	}

	//Test if iterator is valid
	get valid() {
		return this.stack.length > 0
	}

	//Node of the iterator
	// NODE: enumerable
	get node() {
		if (this.stack.length > 0) {
			return this.stack[this.stack.length - 1]
		}
		return undefined
	}

	//Makes a copy of an iterator
	clone(): RedBlackTreeIterator<K, V> {
		return new RedBlackTreeIterator(
			{
				tree: this.tree,
				stack: this.stack.slice(),
			},
			this.store
		)
	}

	//Removes item at iterator from tree
	async remove(): Promise<RedBlackTree<K, V>> {
		let stack = this.stack
		if (stack.length === 0) {
			return this.tree
		}
		//First copy path to node
		let cstack: Array<RBNode<K, V>> = new Array(stack.length)
		let n = stack[stack.length - 1]
		cstack[cstack.length - 1] = n.clone()
		for (let i = stack.length - 2; i >= 0; --i) {
			let n = stack[i]
			if (n.leftId === stack[i + 1].id) {
				cstack[i] = n.clone({
					leftId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				})
			} else {
				cstack[i] = n.clone({
					rightId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				})
			}
		}

		//Get node
		n = cstack[cstack.length - 1]
		//console.log("start remove: ", n.value)

		const [left, right] = await Promise.all([n.getLeft(), n.getRight()])

		//If not leaf, then swap with previous node
		if (left && right) {
			//console.log("moving to leaf")

			//First walk to previous leaf
			let split = cstack.length
			n = left
			while (right) {
				cstack.push(n)
				n = right
			}
			//Copy path to leaf
			let v = cstack[split - 1]
			cstack.push(n.clone())
			cstack[split - 1].key = n.key
			cstack[split - 1].value = n.value

			//Fix up stack
			for (let i = cstack.length - 2; i >= split; --i) {
				n = cstack[i]
				cstack[i] = n.clone({
					rightId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				})
			}
			cstack[split - 1].setLeft(cstack[split])
		}
		//console.log("stack=", cstack.map(function(v) { return v.value }))

		//Remove leaf node
		n = cstack[cstack.length - 1]
		if (n.color === RED) {
			//Easy case: removing red leaf
			//console.log("RED leaf")
			let p = cstack[cstack.length - 2]
			if (p.leftId === n.id) {
				p.setLeft(undefined)
			} else if (p.rightId === n.id) {
				p.setRight(undefined)
			}
			cstack.pop()
			for (let i = 0; i < cstack.length; ++i) {
				cstack[i].count--
			}
			return this.tree.clone(cstack[0])
		} else {
			const [left, right] = await Promise.all([n.getLeft(), n.getRight()])

			if (left || right) {
				//Second easy case:  Single child black parent
				//console.log("BLACK single child")
				if (left) {
					await swapNode(n, left)
				} else if (right) {
					await swapNode(n, right)
				}
				//Child must be red, so repaint it black to balance color
				n.color = BLACK
				for (let i = 0; i < cstack.length - 1; ++i) {
					cstack[i].count--
				}
				return this.tree.clone(cstack[0])
			} else if (cstack.length === 1) {
				//Third easy case: root
				//console.log("ROOT")
				return this.tree.clone(undefined)
			} else {
				//Hard case: Repaint n, and then do some nasty stuff
				//console.log("BLACK leaf no children")
				for (let i = 0; i < cstack.length; ++i) {
					cstack[i].count--
				}
				let parent = cstack[cstack.length - 2]
				await fixDoubleBlack(cstack)
				//Fix up links
				if (parent.leftId === n.id) {
					parent.setLeft(undefined)
				} else {
					parent.setRight(undefined)
				}
			}
		}
		return this.tree.clone(cstack[0])
	}

	//Returns key
	get key() {
		if (this.stack.length > 0) {
			return this.stack[this.stack.length - 1].key
		}
		return
	}

	//Returns value
	get value() {
		if (this.stack.length > 0) {
			return this.stack[this.stack.length - 1].value
		}
		return
	}

	//Returns the position of this iterator in the sorted list
	async index() {
		let idx = 0
		let stack = this.stack
		if (stack.length === 0) {
			let r = this.tree.rootId
				? await this.store.get(this.tree.rootId)
				: undefined

			if (r) {
				return r.count
			}
			return 0
		} else {
			const left = await stack[stack.length - 1].getLeft()
			if (left) {
				idx = left.count
			}
		}

		for (let s = stack.length - 2; s >= 0; --s) {
			if (stack[s + 1].id === stack[s].rightId) {
				++idx
				const left = await stack[s].getLeft()
				if (left) {
					idx += left.count
				}
			}
		}
		return idx
	}

	//Advances iterator to next element in list
	async next() {
		let stack = this.stack
		if (stack.length === 0) {
			return
		}
		let n: RBNode<K, V> | undefined = stack[stack.length - 1]
		const right = await n.getRight()
		if (right) {
			n = right
			while (n) {
				stack.push(n)
				n = await n.getLeft()
			}
		} else {
			stack.pop()
			while (stack.length > 0 && stack[stack.length - 1].rightId === n.id) {
				n = stack[stack.length - 1]
				stack.pop()
			}
		}
	}

	//Checks if iterator is at end of tree
	hasNext() {
		let stack = this.stack
		if (stack.length === 0) {
			return false
		}
		if (stack[stack.length - 1].rightId) {
			return true
		}
		for (let s = stack.length - 1; s > 0; --s) {
			if (stack[s - 1].leftId === stack[s].id) {
				return true
			}
		}
		return false
	}

	//Checks if iterator is at start of tree
	get hasPrev() {
		let stack = this.stack
		if (stack.length === 0) {
			return false
		}
		if (stack[stack.length - 1].leftId) {
			return true
		}
		for (let s = stack.length - 1; s > 0; --s) {
			if (stack[s - 1].rightId === stack[s].id) {
				return true
			}
		}
		return false
	}

	//Update value
	update(value: V) {
		let stack = this.stack
		if (stack.length === 0) {
			throw new Error("Can't update empty node!")
		}
		let cstack: Array<RBNode<K, V>> = new Array(stack.length)
		let n = stack[stack.length - 1]
		cstack[cstack.length - 1] = n.clone({
			value,
		})
		for (let i = stack.length - 2; i >= 0; --i) {
			n = stack[i]
			if (n.leftId === stack[i + 1].id) {
				cstack[i] = n.clone({
					leftId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				})
			} else {
				cstack[i] = n.clone({
					rightId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				})
			}
		}
		return this.tree.clone(cstack[0])
	}

	//Moves iterator backward one element
	async prev() {
		let stack = this.stack
		if (stack.length === 0) {
			return
		}
		let n: RBNode<K, V> | undefined = stack[stack.length - 1]
		const left = await n.getLeft()
		if (left) {
			n = left
			while (n) {
				stack.push(n)
				n = await n.getRight()
			}
		} else {
			stack.pop()
			while (stack.length > 0 && stack[stack.length - 1].leftId === n.id) {
				n = stack[stack.length - 1]
				stack.pop()
			}
		}
	}
}

//Swaps two nodes
async function swapNode<K, V>(n: RBNode<K, V>, v: RBNode<K, V>) {
	n.key = v.key
	n.value = v.value
	n.setLeft(await v.getLeft())
	n.setRight(await v.getRight())
	n.color = v.color
	n.count = v.count
}

//Fix up a double black node in a tree
async function fixDoubleBlack<K, V>(stack: Array<RBNode<K, V>>) {
	for (let i = stack.length - 1; i >= 0; --i) {
		let n = stack[i]
		if (i === 0) {
			n.color = BLACK
			return
		}
		//console.log("visit node:", n.key, i, stack[i].key, stack[i-1].key)
		let p = stack[i - 1]
		if (p.leftId === n.id) {
			//console.log("left child")
			let s = await p.getRight()
			if (!s) {
				throw new Error("This cannot happen")
			}
			const right = await s.getRight()
			if (right && right.color === RED) {
				//console.log("case 1: right sibling child red")
				s = s.clone()
				p.setRight(s)

				// TODO: could probably clean things up here.
				let z = right.clone()
				s.setRight(z)
				s.rightId = s.leftId
				s.setLeft(p)
				s.setRight(z)
				s.color = p.color
				n.color = BLACK
				p.color = BLACK
				z.color = BLACK
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.setLeft(s)
					} else {
						pp.setRight(s)
					}
				}
				stack[i - 1] = s
				return
			} else {
				const left = await s.getLeft()
				if (left && left.color === RED) {
					//console.log("case 1: left sibling child red")
					s = s.clone()
					p.setRight(s)

					let z = left.clone()
					s.setLeft(z)
					p.rightId = z.leftId
					s.leftId = z.rightId
					z.setLeft(p)
					z.setRight(s)
					z.color = p.color
					p.color = BLACK
					s.color = BLACK
					n.color = BLACK
					await recount(p)
					await recount(s)
					await recount(z)
					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.leftId === p.id) {
							pp.setLeft(z)
						} else {
							pp.setRight(z)
						}
					}
					stack[i - 1] = z
					return
				}
			}
			if (s.color === BLACK) {
				if (p.color === RED) {
					//console.log("case 2: black sibling, red parent", p.right.value)
					p.color = BLACK
					p.setRight(s.repaint(RED))
					return
				} else {
					//console.log("case 2: black sibling, black parent", p.right.value)
					p.setRight(s.repaint(RED))
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = s.clone()
				p.rightId = s.leftId
				s.setLeft(p)
				s.color = p.color
				p.color = RED
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.setLeft(s)
					} else {
						pp.setRight(s)
					}
				}
				stack[i - 1] = s
				stack[i] = p
				if (i + 1 < stack.length) {
					stack[i + 1] = n
				} else {
					stack.push(n)
				}
				i = i + 2
			}
		} else {
			//console.log("right child")
			let s = await p.getLeft()
			if (!s) {
				throw new Error("This cannot happen")
			}
			const left = await s.getLeft()
			if (left && left.color === RED) {
				//console.log("case 1: left sibling child red", p.value, p._color)
				s = s.clone()
				p.setLeft(s)

				let z = left.clone()
				s.setLeft(z)

				p.leftId = s.rightId
				s.setRight(p)
				s.setLeft(z)
				s.color = p.color
				n.color = BLACK
				p.color = BLACK
				z.color = BLACK
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.setRight(s)
					} else {
						pp.setLeft(s)
					}
				}
				stack[i - 1] = s
				return
			} else {
				const right = await s.getRight()
				if (right && right.color === RED) {
					//console.log("case 1: right sibling child red")
					s = s.clone()
					p.setLeft(s)

					let z = right.clone()
					s.setRight(z)

					p.leftId = z.rightId
					s.rightId = z.leftId
					z.setRight(p)
					z.setLeft(s)
					z.color = p.color
					p.color = BLACK
					s.color = BLACK
					n.color = BLACK
					await recount(p)
					await recount(s)
					await recount(z)
					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.rightId === p.id) {
							pp.setRight(z)
						} else {
							pp.setLeft(z)
						}
					}
					stack[i - 1] = z
					return
				}
			}
			if (s.color === BLACK) {
				if (p.color === RED) {
					//console.log("case 2: black sibling, red parent")
					p.color = BLACK
					p.setLeft(s.repaint(RED))
					return
				} else {
					//console.log("case 2: black sibling, black parent")
					p.setLeft(s.repaint(RED))
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = s.clone()
				p.leftId = s.rightId
				s.setRight(p)
				s.color = p.color
				p.color = RED
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.setRight(s)
					} else {
						pp.setLeft(s)
					}
				}
				stack[i - 1] = s
				stack[i] = p
				if (i + 1 < stack.length) {
					stack[i + 1] = n
				} else {
					stack.push(n)
				}
				i = i + 2
			}
		}
	}
}

//Default comparison function
function defaultCompare<K>(a: K, b: K) {
	if (a < b) {
		return -1
	}
	if (a > b) {
		return 1
	}
	return 0
}

//Build a tree

const store = new InMemoryKeyValueStore()
const nodeStore = new RBNodeDataStore<any, any>(store)
// TODO: need to think harder about how to pass this through and commit transactions.
const txn = new RBNodeTransaction(nodeStore)

function createRBTree<K, V>(compare?: (a: K, b: K) => number) {
	return new RedBlackTree<K, V>(
		{
			compare: compare || defaultCompare,
			rootId: undefined,
		},
		txn
	)
}

export default createRBTree
