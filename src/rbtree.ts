/*

Game Plan:
- [x] convert to typescript.
- [x] persist to a key-value map.
- [ ] convert everything to async
	- [ ] no more setters and getters
	- [ ] just async key-value-store
	- [ ] eliminate RBNode and just use plain functions.


- [ ] write transactionally
- [ ] persist to leveldb.
- [ ] generators to run sync or async

- how to we persist to async storage with the same api?

*/

/*


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

*/

interface KeyValueStore<K, V> {
	get(key: K): V | undefined
	set(key: K, value: V): void
	delete(key: K): void
}

// Going to serialize to simulate a real backend.
class InMemoryKeyValueStore implements KeyValueStore<string, string> {
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

class RBNodeDataStore<K, V> implements KeyValueStore<string, RBNodeData<K, V>> {
	constructor(private store: InMemoryKeyValueStore) {}
	get(key: string): RBNodeData<K, V> | undefined {
		const result = this.store.get(key)
		if (result) {
			return JSON.parse(result)
		}
	}
	set(key: string, value: RBNodeData<K, V>): void {
		this.store.set(key, JSON.stringify(value))
	}
	delete(key: string): void {
		this.store.delete(key)
	}
}

function randomId() {
	return Math.round(Math.random() * 1e10).toString()
}

let RED = 0 as const
let BLACK = 1 as const

interface RBNodeData<K, V> {
	id: string
	color: 1 | 0
	key: K
	value: V
	leftId: string | undefined
	rightId: string | undefined
	count: number
}

export class RBNode<K, V> {
	public readonly id: string

	constructor(
		private args: RBNodeData<K, V>,
		private store: KeyValueStore<string, RBNodeData<K, V>>
	) {
		this.id = args.id
	}

	save() {
		this.store.set(this.args.id, this.args)
	}

	get color() {
		return this.args.color
	}

	get key() {
		return this.args.key
	}

	get value() {
		return this.args.value
	}

	get count() {
		return this.args.count
	}

	// TODO: make these all immutable!
	setColor(x: 0 | 1) {
		// TODO: only save if it changed.
		this.args.color = x
		this.save()
	}

	setKey(x: K) {
		this.args.key = x
		this.save()
	}

	setValue(x: V) {
		this.args.value = x
		this.save()
	}

	setCount(x: number) {
		this.args.count = x
		this.save()
	}

	get leftId() {
		return this.args.leftId
	}

	get rightId() {
		return this.args.rightId
	}

	get left(): RBNode<K, V> | undefined {
		if (this.args.leftId) {
			const args = this.store.get(this.args.leftId)
			if (args) {
				return new RBNode(args, this.store)
			}
		}
	}

	set left(x: RBNode<K, V> | undefined) {
		if (x) {
			this.args.leftId = x.id
		} else {
			this.args.leftId = undefined
		}
		this.save()
	}

	get right(): RBNode<K, V> | undefined {
		if (this.args.rightId) {
			const args = this.store.get(this.args.rightId)
			if (args) {
				return new RBNode(args, this.store)
			}
		}
	}

	set right(x: RBNode<K, V> | undefined) {
		if (x) {
			this.args.rightId = x.id
		} else {
			this.args.rightId = undefined
		}
		this.save()
	}

	clone(args?: Partial<RBNodeData<K, V>>): RBNode<K, V> {
		const newNode = new RBNode(
			{
				...this.args,
				id: randomId(),
				...args,
			},
			this.store
		)
		newNode.save()
		return newNode
	}

	repaint(color: 1 | 0) {
		return this.clone({ color })
	}
}

function recount<K, V>(node: RBNode<K, V>) {
	node.setCount(
		1 + (node.left ? node.left.count : 0) + (node.right ? node.right.count : 0)
	)
}

export class RedBlackTree<K, V> {
	public compare: (a: K, b: K) => number
	public rootId: string | undefined

	constructor(
		args: {
			compare: (a: K, b: K) => number
			rootId: string | undefined
		},
		private store: KeyValueStore<string, RBNodeData<K, V>>
	) {
		this.compare = args.compare
		this.rootId = args.rootId
	}

	clone(rootId: string | undefined) {
		return new RedBlackTree({ ...this, rootId: rootId }, this.store)
	}

	get keys() {
		let result: Array<K> = []
		this.forEach(function(k, v) {
			result.push(k)
		})
		return result
	}

	get values() {
		let result: Array<V> = []
		this.forEach(function(k, v) {
			result.push(v)
		})
		return result
	}

	getRoot() {
		if (this.rootId) {
			const data = this.store.get(this.rootId)
			if (data) {
				return new RBNode(data, this.store)
			}
		}
	}

	// Returns the number of nodes in the tree
	get length() {
		const root = this.getRoot()
		if (root) {
			return root.count
		}
		return 0
	}

	// Insert a new item into the tree
	insert(key: K, value: V): RedBlackTree<K, V> {
		let cmp = this.compare
		// Find point to insert new node at
		let n = this.getRoot()
		let n_stack: Array<RBNode<K, V>> = []
		let d_stack: Array<number> = []
		while (n) {
			let d = cmp(key, n.key)
			n_stack.push(n)
			d_stack.push(d)
			if (d <= 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		//Rebuild path to leaf node
		const newNode = new RBNode(
			{
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
					let y = pp.right
					if (y && y.color === RED) {
						//console.log("LLr")
						p.setColor(BLACK)
						pp.right = y.repaint(BLACK)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("LLb")
						pp.setColor(RED)
						pp.left = p.right
						p.setColor(BLACK)
						p.right = pp
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						recount(pp)
						recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.left = p
							} else {
								ppp.right = p
							}
						}
						break
					}
				} else {
					let y = pp.right
					if (y && y.color === RED) {
						//console.log("LRr")
						p.setColor(BLACK)
						pp.right = y.repaint(BLACK)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("LRb")
						p.right = n.left
						pp.setColor(RED)
						pp.left = n.right
						n.setColor(BLACK)
						n.left = p
						n.right = pp
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						recount(pp)
						recount(p)
						recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.left = n
							} else {
								ppp.right = n
							}
						}
						break
					}
				}
			} else {
				if (p.rightId === n.id) {
					let y = pp.left
					if (y && y.color === RED) {
						//console.log("RRr", y.key)
						p.setColor(BLACK)
						pp.left = y.repaint(BLACK)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("RRb")
						pp.setColor(RED)
						pp.right = p.left
						p.setColor(BLACK)
						p.left = pp
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						recount(pp)
						recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.right = p
							} else {
								ppp.left = p
							}
						}
						break
					}
				} else {
					let y = pp.left
					if (y && y.color === RED) {
						//console.log("RLr")
						p.setColor(BLACK)
						pp.left = y.repaint(BLACK)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("RLb")
						p.left = n.right
						pp.setColor(RED)
						pp.right = n.left
						n.setColor(BLACK)
						n.right = p
						n.left = pp
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						recount(pp)
						recount(p)
						recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.right = n
							} else {
								ppp.left = n
							}
						}
						break
					}
				}
			}
		}
		//Return new tree
		n_stack[0].setColor(BLACK)
		return new RedBlackTree({ compare: cmp, rootId: n_stack[0].id }, this.store)
	}

	forEach<T>(fn: (key: K, value: V) => T, lo?: K, hi?: K): T | undefined {
		const root = this.getRoot()
		if (!root) {
			return
		}
		if (lo !== undefined) {
			if (hi !== undefined) {
				if (this.compare(lo, hi) >= 0) {
					return
				}
				return doVisit(lo, hi, this.compare, fn, root)
			} else {
				return doVisitHalf(lo, this.compare, fn, root)
			}
		} else {
			return doVisitFull(fn, root)
		}
	}

	//First item in list
	get begin(): RedBlackTreeIterator<K, V> {
		let stack: Array<RBNode<K, V>> = []
		let n = this.getRoot()
		while (n) {
			stack.push(n)
			n = n.left
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Last item in list
	get end(): RedBlackTreeIterator<K, V> {
		let stack: Array<RBNode<K, V>> = []
		let n = this.getRoot()
		while (n) {
			stack.push(n)
			n = n.right
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Find the ith item in the tree
	at(idx: number): RedBlackTreeIterator<K, V> {
		const root = this.getRoot()
		if (idx < 0 || !root) {
			return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
		}
		let n = root
		let stack: Array<RBNode<K, V>> = []
		while (true) {
			stack.push(n)
			if (n.left) {
				if (idx < n.left.count) {
					n = n.left
					continue
				}
				idx -= n.left.count
			}
			if (!idx) {
				return new RedBlackTreeIterator(
					{ tree: this, stack: stack },
					this.store
				)
			}
			idx -= 1
			if (n.right) {
				if (idx >= n.right.count) {
					break
				}
				n = n.right
			} else {
				break
			}
		}
		return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
	}

	ge(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d <= 0) {
				last_ptr = stack.length
			}
			if (d <= 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	gt(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d < 0) {
				last_ptr = stack.length
			}
			if (d < 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	lt(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d > 0) {
				last_ptr = stack.length
			}
			if (d <= 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	le(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d >= 0) {
				last_ptr = stack.length
			}
			if (d < 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	//Finds the item with key if it exists
	find(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNode<K, V>> = []
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d === 0) {
				return new RedBlackTreeIterator({ tree: this, stack }, this.store)
			}
			if (d <= 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
	}

	//Removes item with key from tree
	remove(key: K): RedBlackTree<K, V> {
		let iter = this.find(key)
		if (iter) {
			return iter.remove()
		}
		return this
	}

	//Returns the item at `key`
	get(key: K) {
		let cmp = this.compare
		let n = this.getRoot()
		while (n) {
			let d = cmp(key, n.key)
			if (d === 0) {
				return n.value
			}
			if (d <= 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		return
	}
}

// Visit all nodes inorder
function doVisitFull<K, V, T>(
	fn: (key: K, value: V) => T,
	node: RBNode<K, V>
): T | undefined {
	if (node.left) {
		let v = doVisitFull(fn, node.left)
		if (v) {
			return v
		}
	}
	let v = fn(node.key, node.value)
	if (v) {
		return v
	}
	if (node.right) {
		return doVisitFull(fn, node.right)
	}
}

// Visit half nodes in order
function doVisitHalf<K, V, T>(
	lo: K,
	compare: (a: K, b: K) => number,
	fn: (key: K, value: V) => T,
	node: RBNode<K, V>
): T | undefined {
	let l = compare(lo, node.key)
	if (l <= 0) {
		if (node.left) {
			let v = doVisitHalf(lo, compare, fn, node.left)
			if (v) {
				return v
			}
		}
		let v = fn(node.key, node.value)
		if (v) {
			return v
		}
	}
	if (node.right) {
		return doVisitHalf(lo, compare, fn, node.right)
	}
}

//Visit all nodes within a range
function doVisit<K, V, T>(
	lo: K,
	hi: K,
	compare: (a: K, b: K) => number,
	fn: (key: K, value: V) => T,
	node: RBNode<K, V>
): T | undefined {
	let l = compare(lo, node.key)
	let h = compare(hi, node.key)
	let v
	if (l <= 0) {
		if (node.left) {
			v = doVisit(lo, hi, compare, fn, node.left)
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
	if (h > 0 && node.right) {
		return doVisit(lo, hi, compare, fn, node.right)
	}
}

//Iterator for red black tree
export class RedBlackTreeIterator<K, V> {
	public tree: RedBlackTree<K, V>
	public stack: Array<RBNode<K, V>>

	constructor(
		args: { tree: RedBlackTree<K, V>; stack: Array<RBNode<K, V>> },
		private store: KeyValueStore<string, RBNodeData<K, V>>
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
	remove(): RedBlackTree<K, V> {
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

		//If not leaf, then swap with previous node
		if (n.left && n.right) {
			//console.log("moving to leaf")

			//First walk to previous leaf
			let split = cstack.length
			n = n.left
			while (n.right) {
				cstack.push(n)
				n = n.right
			}
			//Copy path to leaf
			let v = cstack[split - 1]
			cstack.push(n.clone())
			cstack[split - 1].setKey(n.key)
			cstack[split - 1].setValue(n.value)

			//Fix up stack
			for (let i = cstack.length - 2; i >= split; --i) {
				n = cstack[i]
				cstack[i] = n.clone({
					rightId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				})
			}
			cstack[split - 1].left = cstack[split]
		}
		//console.log("stack=", cstack.map(function(v) { return v.value }))

		//Remove leaf node
		n = cstack[cstack.length - 1]
		if (n.color === RED) {
			//Easy case: removing red leaf
			//console.log("RED leaf")
			let p = cstack[cstack.length - 2]
			if (p.leftId === n.id) {
				p.left = undefined
			} else if (p.rightId === n.id) {
				p.right = undefined
			}
			cstack.pop()
			for (let i = 0; i < cstack.length; ++i) {
				cstack[i].setCount(cstack[i].count - 1)
			}
			return this.tree.clone(cstack[0].id)
		} else {
			if (n.left || n.right) {
				//Second easy case:  Single child black parent
				//console.log("BLACK single child")
				if (n.left) {
					swapNode(n, n.left)
				} else if (n.right) {
					swapNode(n, n.right)
				}
				//Child must be red, so repaint it black to balance color
				n.setColor(BLACK)
				for (let i = 0; i < cstack.length - 1; ++i) {
					cstack[i].setCount(cstack[i].count - 1)
				}
				return this.tree.clone(cstack[0].id)
			} else if (cstack.length === 1) {
				//Third easy case: root
				//console.log("ROOT")
				return this.tree.clone(undefined)
			} else {
				//Hard case: Repaint n, and then do some nasty stuff
				//console.log("BLACK leaf no children")
				for (let i = 0; i < cstack.length; ++i) {
					cstack[i].setCount(cstack[i].count - 1)
				}
				let parent = cstack[cstack.length - 2]
				fixDoubleBlack(cstack)
				//Fix up links
				if (parent.leftId === n.id) {
					parent.left = undefined
				} else {
					parent.right = undefined
				}
			}
		}
		return this.tree.clone(cstack[0].id)
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
	get index() {
		let idx = 0
		let stack = this.stack
		if (stack.length === 0) {
			let r = this.tree.getRoot()
			if (r) {
				return r.count
			}
			return 0
		} else if (stack[stack.length - 1].left) {
			idx = (stack[stack.length - 1].left as RBNode<K, V>).count
		}
		for (let s = stack.length - 2; s >= 0; --s) {
			if (stack[s + 1].id === stack[s].rightId) {
				++idx
				if (stack[s].left) {
					idx += (stack[s].left as RBNode<K, V>).count
				}
			}
		}
		return idx
	}

	//Advances iterator to next element in list
	next() {
		let stack = this.stack
		if (stack.length === 0) {
			return
		}
		let n: RBNode<K, V> | undefined = stack[stack.length - 1]
		if (n.right) {
			n = n.right
			while (n) {
				stack.push(n)
				n = n.left
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
	get hasNext() {
		let stack = this.stack
		if (stack.length === 0) {
			return false
		}
		if (stack[stack.length - 1].right) {
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
		if (stack[stack.length - 1].left) {
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
		return this.tree.clone(cstack[0].id)
	}

	//Moves iterator backward one element
	prev() {
		let stack = this.stack
		if (stack.length === 0) {
			return
		}
		let n: RBNode<K, V> | undefined = stack[stack.length - 1]
		if (n.left) {
			n = n.left
			while (n) {
				stack.push(n)
				n = n.right
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
function swapNode<K, V>(n: RBNode<K, V>, v: RBNode<K, V>) {
	n.setKey(v.key)
	n.setValue(v.value)
	n.left = v.left
	n.right = v.right
	n.setColor(v.color)
	n.setCount(v.count)
}

//Fix up a double black node in a tree
function fixDoubleBlack<K, V>(stack: Array<RBNode<K, V>>) {
	for (let i = stack.length - 1; i >= 0; --i) {
		let n = stack[i]
		if (i === 0) {
			n.setColor(BLACK)
			return
		}
		//console.log("visit node:", n.key, i, stack[i].key, stack[i-1].key)
		let p = stack[i - 1]
		if (p.leftId === n.id) {
			//console.log("left child")
			let s = p.right
			if (!s) {
				throw new Error("This cannot happen")
			}
			if (s.right && s.right.color === RED) {
				//console.log("case 1: right sibling child red")
				s = p.right = s.clone()
				let z = (s.right = (s.right as RBNode<K, V>).clone())
				p.right = s.left
				s.left = p
				s.right = z
				s.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.left = s
					} else {
						pp.right = s
					}
				}
				stack[i - 1] = s
				return
			} else if (s.left && s.left.color === RED) {
				//console.log("case 1: left sibling child red")
				s = p.right = s.clone()
				let z = (s.left = (s.left as RBNode<K, V>).clone())
				p.right = z.left
				s.left = z.right
				z.left = p
				z.right = s
				z.setColor(p.color)
				p.setColor(BLACK)
				s.setColor(BLACK)
				n.setColor(BLACK)
				recount(p)
				recount(s)
				recount(z)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.left = z
					} else {
						pp.right = z
					}
				}
				stack[i - 1] = z
				return
			}
			if (s.color === BLACK) {
				if (p.color === RED) {
					//console.log("case 2: black sibling, red parent", p.right.value)
					p.setColor(BLACK)
					p.right = s.repaint(RED)
					return
				} else {
					//console.log("case 2: black sibling, black parent", p.right.value)
					p.right = s.repaint(RED)
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = s.clone()
				p.right = s.left
				s.left = p
				s.setColor(p.color)
				p.setColor(RED)
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.left = s
					} else {
						pp.right = s
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
			let s = p.left
			if (!s) {
				throw new Error("This cannot happen")
			}
			if (s.left && s.left.color === RED) {
				//console.log("case 1: left sibling child red", p.value, p._color)
				s = p.left = s.clone()
				let z = (s.left = (s.left as RBNode<K, V>).clone())
				p.left = s.right
				s.right = p
				s.left = z
				s.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.right = s
					} else {
						pp.left = s
					}
				}
				stack[i - 1] = s
				return
			} else if (s.right && s.right.color === RED) {
				//console.log("case 1: right sibling child red")
				s = p.left = s.clone()
				let z = (s.right = (s.right as RBNode<K, V>).clone())
				p.left = z.right
				s.right = z.left
				z.right = p
				z.left = s
				z.setColor(p.color)
				p.setColor(BLACK)
				s.setColor(BLACK)
				n.setColor(BLACK)
				recount(p)
				recount(s)
				recount(z)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.right = z
					} else {
						pp.left = z
					}
				}
				stack[i - 1] = z
				return
			}
			if (s.color === BLACK) {
				if (p.color === RED) {
					//console.log("case 2: black sibling, red parent")
					p.setColor(BLACK)
					p.left = s.repaint(RED)
					return
				} else {
					//console.log("case 2: black sibling, black parent")
					p.left = s.repaint(RED)
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = s.clone()
				p.left = s.right
				s.right = p
				s.setColor(p.color)
				p.setColor(RED)
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.right = s
					} else {
						pp.left = s
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
function createRBTree<K, V>(compare?: (a: K, b: K) => number) {
	return new RedBlackTree<K, V>(
		{
			compare: compare || defaultCompare,
			rootId: undefined,
		},
		nodeStore
	)
}

export default createRBTree
