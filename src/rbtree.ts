/*

Game Plan:
- [x] convert to typescript.
- [x] persist to a key-value map.
- [ ] convert everything to async
	- [x] no more setters and getters
	- [ ] immuable RBNodes, readonly properties.
		- [ ] no more RBNode.store, save outside of setters.
	- [ ] async key-value-store


- [ ] write transactionally
- [ ] persist to leveldb.
- [ ] generators to run sync or async

- how to we persist to async storage with the same api?

*/

/*

https://www.geeksforgeeks.org/red-black-tree-set-2-insert/


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

export interface KeyValueStore<K, V> {
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

export interface RBNodeData<K, V> {
	id: string
	color: 1 | 0
	key: K
	value: V
	leftId: string | undefined
	rightId: string | undefined
	count: number
}

export class RedBlackTree<K, V> {
	public compare: (a: K, b: K) => number
	public rootId: string | undefined

	constructor(
		args: {
			compare: (a: K, b: K) => number
			rootId: string | undefined
		},
		public store: KeyValueStore<string, RBNodeData<K, V>>
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
			return this.store.get(this.rootId)
		}
	}

	getLeft(n: RBNodeData<K, V>): RBNodeData<K, V> | undefined {
		if (n.leftId) {
			return this.store.get(n.leftId)
		}
	}

	getRight(n: RBNodeData<K, V>): RBNodeData<K, V> | undefined {
		if (n.rightId) {
			return this.store.get(n.rightId)
		}
	}

	recount(n: RBNodeData<K, V>) {
		const left = this.getLeft(n)
		const right = this.getRight(n)
		n.count = 1 + (left ? left.count : 0) + (right ? right.count : 0)
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
		let n_stack: Array<RBNodeData<K, V>> = []
		let d_stack: Array<number> = []
		while (n) {
			let d = cmp(key, n.key)
			n_stack.push(n)
			d_stack.push(d)
			if (d <= 0) {
				n = this.getLeft(n)
			} else {
				n = this.getRight(n)
			}
		}
		//Rebuild path to leaf node
		const newNode: RBNodeData<K, V> = {
			id: randomId(),
			color: RED,
			key,
			value,
			leftId: undefined,
			rightId: undefined,
			count: 1,
		}
		// newNode.save()
		n_stack.push(newNode)

		for (let s = n_stack.length - 2; s >= 0; --s) {
			let n = n_stack[s]
			if (d_stack[s] <= 0) {
				n_stack[s] = {
					...n,
					id: randomId(),
					leftId: n_stack[s + 1] ? n_stack[s + 1].id : undefined,
					count: n.count + 1,
				}
			} else {
				n_stack[s] = {
					...n,
					id: randomId(),
					rightId: n_stack[s + 1] ? n_stack[s + 1].id : undefined,
					count: n.count + 1,
				}
			}
		}

		// 8 types of rotations.
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
					let y = this.getRight(pp)
					if (y && y.color === RED) {
						//
						//      (pp)
						//      /  \
						//    (p)  (y)
						//    /
						//  (n)
						//

						//console.log("LLr")
						p.color = BLACK

						const newUncle: RBNodeData<K, V> = {
							...y,
							id: randomId(),
							color: BLACK,
						}
						this.store.set(newUncle.id, newUncle)
						pp.rightId = newUncle.id

						pp.color = RED
						s -= 1
					} else {
						//console.log("LLb")
						pp.color = RED
						pp.leftId = p.rightId
						p.color = BLACK
						p.rightId = pp.id
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						this.recount(pp)
						this.recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.leftId = p.id
							} else {
								ppp.rightId = p.id
							}
						}
						break
					}
				} else {
					let y = this.getRight(pp)
					if (y && y.color === RED) {
						//console.log("LRr")
						p.color = BLACK

						const newUncle: RBNodeData<K, V> = {
							...y,
							id: randomId(),
							color: BLACK,
						}
						this.store.set(newUncle.id, newUncle)
						pp.rightId = newUncle.id

						pp.color = RED
						s -= 1
					} else {
						//console.log("LRb")
						p.rightId = n.leftId
						pp.color = RED
						pp.leftId = n.rightId
						n.color = BLACK
						n.leftId = p.id
						n.rightId = pp.id
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						this.recount(pp)
						this.recount(p)
						this.recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.leftId = n.id
							} else {
								ppp.rightId = n.id
							}
						}
						break
					}
				}
			} else {
				if (p.rightId === n.id) {
					let y = this.getLeft(pp)
					if (y && y.color === RED) {
						//console.log("RRr", y.key)
						p.color = BLACK

						const newUncle: RBNodeData<K, V> = {
							...y,
							id: randomId(),
							color: BLACK,
						}
						this.store.set(newUncle.id, newUncle)
						pp.leftId = newUncle.id

						pp.color = RED
						s -= 1
					} else {
						//console.log("RRb")
						pp.color = RED
						pp.rightId = p.leftId
						p.color = BLACK
						p.leftId = pp.id
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						this.recount(pp)
						this.recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.rightId = p.id
							} else {
								ppp.leftId = p.id
							}
						}
						break
					}
				} else {
					let y = this.getLeft(pp)
					if (y && y.color === RED) {
						//console.log("RLr")
						p.color = BLACK

						const newUncle: RBNodeData<K, V> = {
							...y,
							id: randomId(),
							color: BLACK,
						}
						this.store.set(newUncle.id, newUncle)
						pp.leftId = newUncle.id

						pp.color = RED
						s -= 1
					} else {
						//console.log("RLb")
						p.leftId = n.rightId
						pp.color = RED
						pp.rightId = n.leftId
						n.color = BLACK
						n.rightId = p.id
						n.leftId = pp.id
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						this.recount(pp)
						this.recount(p)
						this.recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.rightId = n.id
							} else {
								ppp.leftId = n.id
							}
						}
						break
					}
				}
			}
		}
		//Return new tree
		n_stack[0].color = BLACK

		// Save the whole stack
		for (const node of n_stack) {
			this.store.set(node.id, node)
		}

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
				return this.doVisit(lo, hi, this.compare, fn, root)
			} else {
				return this.doVisitHalf(lo, this.compare, fn, root)
			}
		} else {
			return this.doVisitFull(fn, root)
		}
	}

	//Visit all nodes within a range
	doVisit<T>(
		lo: K,
		hi: K,
		compare: (a: K, b: K) => number,
		fn: (key: K, value: V) => T,
		node: RBNodeData<K, V>
	): T | undefined {
		let l = compare(lo, node.key)
		let h = compare(hi, node.key)
		let v
		if (l <= 0) {
			const left = this.getLeft(node)
			if (left) {
				v = this.doVisit(lo, hi, compare, fn, left)
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
			const right = this.getRight(node)
			if (right) {
				return this.doVisit(lo, hi, compare, fn, right)
			}
		}
	}

	// Visit all nodes inorder
	doVisitFull<T>(
		fn: (key: K, value: V) => T,
		node: RBNodeData<K, V>
	): T | undefined {
		const left = this.getLeft(node)
		if (left) {
			let v = this.doVisitFull(fn, left)
			if (v) {
				return v
			}
		}
		let v = fn(node.key, node.value)
		if (v) {
			return v
		}
		const right = this.getRight(node)
		if (right) {
			return this.doVisitFull(fn, right)
		}
	}

	// Visit half nodes in order
	doVisitHalf<T>(
		lo: K,
		compare: (a: K, b: K) => number,
		fn: (key: K, value: V) => T,
		node: RBNodeData<K, V>
	): T | undefined {
		let l = compare(lo, node.key)
		if (l <= 0) {
			const left = this.getLeft(node)
			if (left) {
				let v = this.doVisitHalf(lo, compare, fn, left)
				if (v) {
					return v
				}
			}
			let v = fn(node.key, node.value)
			if (v) {
				return v
			}
		}
		const right = this.getRight(node)
		if (right) {
			return this.doVisitHalf(lo, compare, fn, right)
		}
	}

	//First item in list
	get begin(): RedBlackTreeIterator<K, V> {
		let stack: Array<RBNodeData<K, V>> = []
		let n = this.getRoot()
		while (n) {
			stack.push(n)
			n = this.getLeft(n)
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Last item in list
	get end(): RedBlackTreeIterator<K, V> {
		let stack: Array<RBNodeData<K, V>> = []
		let n = this.getRoot()
		while (n) {
			stack.push(n)
			n = this.getRight(n)
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
		let stack: Array<RBNodeData<K, V>> = []
		while (true) {
			stack.push(n)
			const left = this.getLeft(n)
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
			const right = this.getRight(n)
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

	ge(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNodeData<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d <= 0) {
				last_ptr = stack.length
			}
			if (d <= 0) {
				n = this.getLeft(n)
			} else {
				n = this.getRight(n)
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	gt(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNodeData<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d < 0) {
				last_ptr = stack.length
			}
			if (d < 0) {
				n = this.getLeft(n)
			} else {
				n = this.getRight(n)
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	lt(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNodeData<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d > 0) {
				last_ptr = stack.length
			}
			if (d <= 0) {
				n = this.getLeft(n)
			} else {
				n = this.getRight(n)
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	le(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNodeData<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d >= 0) {
				last_ptr = stack.length
			}
			if (d < 0) {
				n = this.getLeft(n)
			} else {
				n = this.getRight(n)
			}
		}
		stack.length = last_ptr
		return new RedBlackTreeIterator({ tree: this, stack }, this.store)
	}

	//Finds the item with key if it exists
	find(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.getRoot()
		let stack: Array<RBNodeData<K, V>> = []
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d === 0) {
				return new RedBlackTreeIterator({ tree: this, stack }, this.store)
			}
			if (d <= 0) {
				n = this.getLeft(n)
			} else {
				n = this.getRight(n)
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
				n = this.getLeft(n)
			} else {
				n = this.getRight(n)
			}
		}
		return
	}
}

//Iterator for red black tree
export class RedBlackTreeIterator<K, V> {
	public tree: RedBlackTree<K, V>
	public stack: Array<RBNodeData<K, V>>

	constructor(
		args: { tree: RedBlackTree<K, V>; stack: Array<RBNodeData<K, V>> },
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

	getLeft(n: RBNodeData<K, V>): RBNodeData<K, V> | undefined {
		if (n.leftId) {
			return this.store.get(n.leftId)
		}
	}

	getRight(n: RBNodeData<K, V>): RBNodeData<K, V> | undefined {
		if (n.rightId) {
			return this.store.get(n.rightId)
		}
	}

	recount(n: RBNodeData<K, V>) {
		const left = this.getLeft(n)
		const right = this.getRight(n)
		n.count = 1 + (left ? left.count : 0) + (right ? right.count : 0)
	}

	//Removes item at iterator from tree
	remove(): RedBlackTree<K, V> {
		let stack = this.stack
		if (stack.length === 0) {
			return this.tree
		}
		//First copy path to node
		let cstack: Array<RBNodeData<K, V>> = new Array(stack.length)
		let n = stack[stack.length - 1]
		cstack[cstack.length - 1] = {
			...n,
			id: randomId(),
		}
		for (let i = stack.length - 2; i >= 0; --i) {
			let n = stack[i]
			if (n.leftId === stack[i + 1].id) {
				cstack[i] = {
					...n,
					id: randomId(),
					leftId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				}
			} else {
				cstack[i] = {
					...n,
					id: randomId(),
					rightId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				}
			}
		}

		//Get node
		n = cstack[cstack.length - 1]
		//console.log("start remove: ", n.value)

		//If not leaf, then swap with previous node
		const left = this.getLeft(n)
		let right = this.getRight(n)
		if (left && right) {
			//console.log("moving to leaf")

			//First walk to previous leaf
			let split = cstack.length
			n = left
			while ((right = this.getRight(n))) {
				cstack.push(n)
				n = right
			}
			//Copy path to leaf
			let v = cstack[split - 1]
			cstack.push({ ...n, id: randomId() })
			cstack[split - 1].key = n.key
			cstack[split - 1].value = n.value

			//Fix up stack
			for (let i = cstack.length - 2; i >= split; --i) {
				n = cstack[i]
				cstack[i] = {
					...n,
					id: randomId(),
					rightId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				}
			}
			cstack[split - 1].leftId = cstack[split].id
		}
		//console.log("stack=", cstack.map(function(v) { return v.value }))

		//Remove leaf node
		n = cstack[cstack.length - 1]
		if (n.color === RED) {
			//Easy case: removing red leaf
			//console.log("RED leaf")
			let p = cstack[cstack.length - 2]
			if (p.leftId === n.id) {
				p.leftId = undefined
			} else if (p.rightId === n.id) {
				p.rightId = undefined
			}
			cstack.pop()
			for (let i = 0; i < cstack.length; ++i) {
				cstack[i].count = cstack[i].count - 1
			}
			for (const node of cstack) {
				this.store.set(node.id, node)
			}
			return this.tree.clone(cstack[0].id)
		} else {
			const left = this.getLeft(n)
			const right = this.getRight(n)
			if (left || right) {
				//Second easy case:  Single child black parent
				//console.log("BLACK single child")
				if (left) {
					swapNode(n, left)
				} else if (right) {
					swapNode(n, right)
				}
				//Child must be red, so repaint it black to balance color
				n.color = BLACK
				for (let i = 0; i < cstack.length - 1; ++i) {
					cstack[i].count = cstack[i].count - 1
				}
				for (const node of cstack) {
					this.store.set(node.id, node)
				}
				return this.tree.clone(cstack[0].id)
			} else if (cstack.length === 1) {
				//Third easy case: root
				//console.log("ROOT")
				for (const node of cstack) {
					this.store.set(node.id, node)
				}
				return this.tree.clone(undefined)
			} else {
				//Hard case: Repaint n, and then do some nasty stuff
				//console.log("BLACK leaf no children")
				for (let i = 0; i < cstack.length; ++i) {
					cstack[i].count = cstack[i].count - 1
				}
				let parent = cstack[cstack.length - 2]
				this.fixDoubleBlack(cstack)
				//Fix up links
				if (parent.leftId === n.id) {
					parent.leftId = undefined
				} else {
					parent.rightId = undefined
				}
			}
		}
		for (const node of cstack) {
			this.store.set(node.id, node)
		}
		return this.tree.clone(cstack[0].id)
	}

	//Fix up a double black node in a tree
	fixDoubleBlack(stack: Array<RBNodeData<K, V>>) {
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
				let s = this.getRight(p)
				if (!s) {
					throw new Error("This cannot happen")
				}
				const right = this.getRight(s)
				if (right && right.color === RED) {
					//console.log("case 1: right sibling child red")
					s = { ...s, id: randomId() }
					p.rightId = s.id
					let z = { ...right, id: randomId() }
					s.rightId = z.id
					p.rightId = s.leftId
					s.leftId = p.id
					s.rightId = z.id
					s.color = p.color
					n.color = BLACK
					p.color = BLACK
					z.color = BLACK
					this.recount(p)
					this.recount(s)

					this.store.set(z.id, z)

					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.leftId === p.id) {
							pp.leftId = s.id
						} else {
							pp.rightId = s.id
						}
					}
					stack[i - 1] = s
					return
				} else {
					const left = this.getLeft(s)
					if (left && left.color === RED) {
						//console.log("case 1: left sibling child red")
						s = { ...s, id: randomId() }
						p.rightId = s.id
						let z = { ...left, id: randomId() }
						s.leftId = z.id
						p.rightId = z.leftId
						s.leftId = z.rightId
						z.leftId = p.id
						z.rightId = s.id
						z.color = p.color
						p.color = BLACK
						s.color = BLACK
						n.color = BLACK
						this.recount(p)
						this.recount(s)
						this.recount(z)
						this.store.set(z.id, z)
						if (i > 1) {
							let pp = stack[i - 2]
							if (pp.leftId === p.id) {
								pp.leftId = z.id
							} else {
								pp.rightId = z.id
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
						const newS: RBNodeData<K, V> = {
							...s,
							id: randomId(),
							color: RED,
						}
						this.store.set(newS.id, newS)
						// TODO: save newS?
						p.rightId = newS.id
						return
					} else {
						//console.log("case 2: black sibling, black parent", p.right.value)
						const newS: RBNodeData<K, V> = {
							...s,
							id: randomId(),
							color: RED,
						}
						this.store.set(newS.id, newS)
						p.rightId = newS.id
						continue
					}
				} else {
					//console.log("case 3: red sibling")
					s = { ...s, id: randomId() }
					p.rightId = s.leftId
					s.leftId = p.id
					s.color = p.color
					p.color = RED
					this.recount(p)
					this.recount(s)
					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.leftId === p.id) {
							pp.leftId = s.id
						} else {
							pp.rightId = s.id
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
				let s = this.getLeft(p)
				if (!s) {
					throw new Error("This cannot happen")
				}
				const left = this.getLeft(s)
				if (left && left.color === RED) {
					//console.log("case 1: left sibling child red", p.value, p._color)
					s = { ...s, id: randomId() }
					p.leftId = s.id
					let z = { ...left, id: randomId() }
					s.leftId = z.id
					p.leftId = s.rightId
					s.rightId = p.id
					s.leftId = z.id
					s.color = p.color
					n.color = BLACK
					p.color = BLACK
					z.color = BLACK
					this.recount(p)
					this.recount(s)
					this.store.set(z.id, z)
					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.rightId === p.id) {
							pp.rightId = s.id
						} else {
							pp.leftId = s.id
						}
					}
					stack[i - 1] = s
					return
				} else {
					const right = this.getRight(s)
					if (right && right.color === RED) {
						//console.log("case 1: right sibling child red")
						s = { ...s, id: randomId() }
						p.leftId = s.id
						let z = { ...right, id: randomId() }
						s.rightId = z.id
						p.leftId = z.rightId
						s.rightId = z.leftId
						z.rightId = p.id
						z.leftId = s.id
						z.color = p.color
						p.color = BLACK
						s.color = BLACK
						n.color = BLACK
						this.recount(p)
						this.recount(s)
						this.recount(z)
						this.store.set(z.id, z)
						if (i > 1) {
							let pp = stack[i - 2]
							if (pp.rightId === p.id) {
								pp.rightId = z.id
							} else {
								pp.leftId = z.id
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
						const newS: RBNodeData<K, V> = { ...s, id: randomId(), color: RED }
						this.store.set(newS.id, newS)
						p.leftId = newS.id
						return
					} else {
						//console.log("case 2: black sibling, black parent")
						const newS: RBNodeData<K, V> = { ...s, id: randomId(), color: RED }
						this.store.set(newS.id, newS)
						p.leftId = newS.id
						continue
					}
				} else {
					//console.log("case 3: red sibling")
					s = { ...s, id: randomId() }
					p.leftId = s.rightId
					s.rightId = p.id
					s.color = p.color
					p.color = RED
					this.recount(p)
					this.recount(s)
					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.rightId === p.id) {
							pp.rightId = s.id
						} else {
							pp.leftId = s.id
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
		} else {
			const left = this.getLeft(stack[stack.length - 1])
			if (left) {
				idx = left.count
			}
		}
		for (let s = stack.length - 2; s >= 0; --s) {
			if (stack[s + 1].id === stack[s].rightId) {
				++idx
				const left = this.getLeft(stack[s])
				if (left) {
					idx += left.count
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
		let n: RBNodeData<K, V> | undefined = stack[stack.length - 1]
		const right = this.getRight(n)
		if (right) {
			n = right
			while (n) {
				stack.push(n)
				n = this.getLeft(n)
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
		if (this.getRight(stack[stack.length - 1])) {
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
		if (this.getLeft(stack[stack.length - 1])) {
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
		let cstack: Array<RBNodeData<K, V>> = new Array(stack.length)
		let n = stack[stack.length - 1]
		cstack[cstack.length - 1] = {
			...n,
			id: randomId(),
			value,
		}
		for (let i = stack.length - 2; i >= 0; --i) {
			n = stack[i]
			if (n.leftId === stack[i + 1].id) {
				cstack[i] = {
					...n,
					id: randomId(),
					leftId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				}
			} else {
				cstack[i] = {
					...n,
					id: randomId(),
					rightId: cstack[i + 1] ? cstack[i + 1].id : undefined,
				}
			}
		}
		for (const node of cstack) {
			this.store.set(node.id, node)
		}
		return this.tree.clone(cstack[0].id)
	}

	//Moves iterator backward one element
	prev() {
		let stack = this.stack
		if (stack.length === 0) {
			return
		}
		let n: RBNodeData<K, V> | undefined = stack[stack.length - 1]
		const left = this.getLeft(n)
		if (left) {
			n = left
			while (n) {
				stack.push(n)
				n = this.getRight(n)
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
function swapNode<K, V>(n: RBNodeData<K, V>, v: RBNodeData<K, V>) {
	n.key = v.key
	n.value = v.value
	n.leftId = v.leftId
	n.rightId = v.rightId
	n.color = v.color
	n.count = v.count
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
