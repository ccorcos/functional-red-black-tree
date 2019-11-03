/*

Game Plan:

- Separate `insert`, `update`, and `remove` from the rest of
	the code. That's the only part that requires a transaction.

- Two classes of RBNode. Only get a writable node from a transaction.

- Simplify ReadOnlyNode.


# Architecture

RedBlackTree
	-> RedBlackNode
	-> RedBlackIterator

insert()
update()
remove()


- [ ] convert everything to async
- [ ] async key-value-store
- [ ] write transactionally
- [ ] persist to leveldb.
- [ ] generators to run sync or async

- how to we persist to async storage with the same api?

*/

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

class RBNodeDataStore<K, V> {
	constructor(private store: InMemoryKeyValueStore) {}
	async get(id: string): Promise<RBNodeData<K, V> | undefined> {
		const result = this.store.get(id)
		if (result) {
			return JSON.parse(result)
		}
	}
	async set(value: RBNodeData<K, V>): Promise<void> {
		this.store.set(value.id, JSON.stringify(value))
	}
}

class RBNodeTransaction<K, V> {
	constructor(private store: RBNodeDataStore<K, V>) {}
	private cache: Record<string, RBNodeData<K, V>> = {}
	private writes: Record<string, RBNodeData<K, V>> = {}

	async get(id: string): Promise<WritableNode<K, V> | undefined> {
		if (this.writes[id] || this.cache[id]) {
			return new WritableNode(() => {
				if (this.writes[id]) {
					return this.writes[id]
				} else {
					return this.cache[id]
				}
			}, this)
		}
		const data = await this.store.get(id)
		if (data) {
			this.cache[id] = data
			return new WritableNode(() => {
				if (this.writes[id]) {
					return this.writes[id]
				} else {
					return this.cache[id]
				}
			}, this)
		}
	}

	set(value: RBNodeData<K, V>): WritableNode<K, V> {
		const id = value.id
		this.cache[id] = value
		this.writes[id] = value
		return new WritableNode(() => {
			if (this.writes[id]) {
				return this.writes[id]
			} else {
				return this.cache[id]
			}
		}, this)
	}

	clone(node: ReadOnlyNode<K, V>): WritableNode<K, V> {
		const newNode = {
			id: randomId(),
			color: node.color,
			key: node.key,
			value: node.value,
			leftId: node.leftId,
			rightId: node.rightId,
			count: node.count,
		}
		return this.set(newNode)
	}

	from(node: ReadOnlyNode<K, V>): WritableNode<K, V> {
		const id = node.id
		this.cache[id] = {
			id: node.id,
			color: node.color,
			key: node.key,
			value: node.value,
			leftId: node.leftId,
			rightId: node.rightId,
			count: node.count,
		}
		return new WritableNode(() => {
			if (this.writes[id]) {
				return this.writes[id]
			} else {
				return this.cache[id]
			}
		}, this)
	}

	async commit() {
		for (const node of Object.values(this.writes)) {
			await this.store.set(node)
		}
		this.writes = {}
	}
}

function randomId() {
	return Math.round(Math.random() * 1e10).toString()
}

let RED = 0 as const
let BLACK = 1 as const

interface RBNodeData<K, V> {
	readonly id: string
	readonly color: 1 | 0
	readonly key: K
	readonly value: V
	readonly leftId: string | undefined
	readonly rightId: string | undefined
	readonly count: number
}

export class ReadOnlyNode<K, V> {
	readonly id: string
	readonly color: 1 | 0
	readonly key: K
	readonly value: V
	readonly leftId: string | undefined
	readonly rightId: string | undefined
	readonly count: number

	constructor(data: RBNodeData<K, V>, private store: RBNodeDataStore<K, V>) {
		this.id = data.id
		this.color = data.color
		this.key = data.key
		this.value = data.value
		this.leftId = data.leftId
		this.rightId = data.rightId
		this.count = data.count
	}

	async getLeft(): Promise<ReadOnlyNode<K, V> | undefined> {
		const leftId = this.leftId
		if (leftId) {
			const data = await this.store.get(leftId)
			if (data) {
				return new ReadOnlyNode(data, this.store)
			}
		}
	}

	async getRight(): Promise<ReadOnlyNode<K, V> | undefined> {
		const rightId = this.rightId
		if (rightId) {
			const data = await this.store.get(rightId)
			if (data) {
				return new ReadOnlyNode(data, this.store)
			}
		}
	}
}

export class WritableNode<K, V> {
	constructor(
		private get: () => RBNodeData<K, V>,
		private store: RBNodeTransaction<K, V>
	) {}

	get id() {
		return this.get().id
	}

	get color() {
		return this.get().color
	}

	get key() {
		return this.get().key
	}

	get value() {
		return this.get().value
	}

	get count() {
		return this.get().count
	}

	get leftId() {
		return this.get().leftId
	}

	get rightId() {
		return this.get().rightId
	}

	setColor(x: 0 | 1) {
		this.store.set({
			...this.get(),
			color: x,
		})
	}

	setKey(x: K) {
		this.store.set({
			...this.get(),
			key: x,
		})
	}

	setValue(x: V) {
		this.store.set({
			...this.get(),
			value: x,
		})
	}

	setCount(x: number) {
		this.store.set({
			...this.get(),
			count: x,
		})
	}

	async getLeft(): Promise<WritableNode<K, V> | undefined> {
		const leftId = this.get().leftId
		if (leftId) {
			return this.store.get(leftId)
		}
	}

	setLeftId(x: string | undefined) {
		this.store.set({
			...this.get(),
			leftId: x,
		})
	}

	async getRight(): Promise<WritableNode<K, V> | undefined> {
		const rightId = this.get().rightId
		if (rightId) {
			return this.store.get(rightId)
		}
	}

	setRightId(x: string | undefined) {
		this.store.set({
			...this.get(),
			rightId: x,
		})
	}

	clone(args?: Partial<RBNodeData<K, V>>): WritableNode<K, V> {
		const newNode = {
			...this.get(),
			id: randomId(),
			...args,
		}
		return this.store.set(newNode)
	}

	repaint(color: 1 | 0) {
		return this.clone({ color })
	}
}

async function recount<K, V>(node: WritableNode<K, V>) {
	const left = await node.getLeft()
	const right = await node.getRight()
	node.setCount(1 + (left ? left.count : 0) + (right ? right.count : 0))
}

// ========================================================
// RedBlackTree
// ========================================================

export class RedBlackTree<K, V> {
	public compare: (a: K, b: K) => number
	public rootId: string | undefined

	constructor(
		args: {
			compare: (a: K, b: K) => number
			rootId: string | undefined
		},
		private store: RBNodeDataStore<K, V>
	) {
		this.compare = args.compare
		this.rootId = args.rootId
	}

	clone(rootId: string | undefined) {
		return new RedBlackTree({ ...this, rootId: rootId }, this.store)
	}

	async keys() {
		let result: Array<K> = []
		await this.forEach(function(k, v) {
			result.push(k)
		})
		return result
	}

	async values() {
		let result: Array<V> = []
		await this.forEach(function(k, v) {
			result.push(v)
		})
		return result
	}

	async getRoot() {
		if (this.rootId) {
			const data = await this.store.get(this.rootId)
			if (data) {
				return new ReadOnlyNode(data, this.store)
			}
		}
	}

	// Returns the number of nodes in the tree
	async length() {
		const root = await this.getRoot()
		if (root) {
			return root.count
		}
		return 0
	}

	// Insert a new item into the tree
	async insert(key: K, value: V): Promise<RedBlackTree<K, V>> {
		const transaction = new RBNodeTransaction(this.store)

		let cmp = this.compare
		// Find point to insert new node at
		const root = await this.getRoot()
		let n = root ? transaction.from(root) : undefined
		let n_stack: Array<WritableNode<K, V>> = []
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
		const newNode = transaction.set({
			id: randomId(),
			color: RED,
			key,
			value,
			leftId: undefined,
			rightId: undefined,
			count: 1,
		})
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
					let y = await pp.getRight()
					if (y && y.color === RED) {
						//
						//      (pp)
						//      /  \
						//    (p)  (y)
						//    /
						//  (n)
						//

						//console.log("LLr")
						p.setColor(BLACK)
						pp.setRightId(y.repaint(BLACK).id)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("LLb")
						pp.setColor(RED)
						pp.setLeftId(p.rightId)
						p.setColor(BLACK)
						p.setRightId(pp.id)
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						await recount(pp)
						await recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.setLeftId(p.id)
							} else {
								ppp.setRightId(p.id)
							}
						}
						break
					}
				} else {
					let y = await pp.getRight()
					if (y && y.color === RED) {
						//console.log("LRr")
						p.setColor(BLACK)
						pp.setRightId(y.repaint(BLACK).id)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("LRb")
						p.setRightId(n.leftId)
						pp.setColor(RED)
						pp.setLeftId(n.rightId)
						n.setColor(BLACK)
						n.setLeftId(p.id)
						n.setRightId(pp.id)
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						await recount(pp)
						await recount(p)
						await recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.leftId === pp.id) {
								ppp.setLeftId(n.id)
							} else {
								ppp.setRightId(n.id)
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
						p.setColor(BLACK)
						pp.setLeftId(y.repaint(BLACK).id)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("RRb")
						pp.setColor(RED)
						pp.setRightId(p.leftId)
						p.setColor(BLACK)
						p.setLeftId(pp.id)
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						await recount(pp)
						await recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.setRightId(p.id)
							} else {
								ppp.setLeftId(p.id)
							}
						}
						break
					}
				} else {
					let y = await pp.getLeft()
					if (y && y.color === RED) {
						//console.log("RLr")
						p.setColor(BLACK)
						pp.setLeftId(y.repaint(BLACK).id)
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("RLb")
						p.setLeftId(n.rightId)
						pp.setColor(RED)
						pp.setRightId(n.leftId)
						n.setColor(BLACK)
						n.setRightId(p.id)
						n.setLeftId(pp.id)
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						await recount(pp)
						await recount(p)
						await recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.rightId === pp.id) {
								ppp.setRightId(n.id)
							} else {
								ppp.setLeftId(n.id)
							}
						}
						break
					}
				}
			}
		}
		//Return new tree
		n_stack[0].setColor(BLACK)
		await transaction.commit()
		return new RedBlackTree({ compare: cmp, rootId: n_stack[0].id }, this.store)
	}

	async forEach<T>(
		fn: (key: K, value: V) => T,
		lo?: K,
		hi?: K
	): Promise<T | undefined> {
		const root = await this.getRoot()
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
	async begin(): Promise<RedBlackTreeIterator<K, V>> {
		let stack: Array<ReadOnlyNode<K, V>> = []
		let n = await this.getRoot()
		while (n) {
			stack.push(n)
			n = await n.getLeft()
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Last item in list
	async end(): Promise<RedBlackTreeIterator<K, V>> {
		let stack: Array<ReadOnlyNode<K, V>> = []
		let n = await this.getRoot()
		while (n) {
			stack.push(n)
			n = await n.getRight()
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Find the ith item in the tree
	async at(idx: number): Promise<RedBlackTreeIterator<K, V>> {
		const root = await this.getRoot()
		if (idx < 0 || !root) {
			return new RedBlackTreeIterator({ tree: this, stack: [] }, this.store)
		}
		let n = root
		let stack: Array<ReadOnlyNode<K, V>> = []
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
		let n = await this.getRoot()
		let stack: Array<ReadOnlyNode<K, V>> = []
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
		let n = await this.getRoot()
		let stack: Array<ReadOnlyNode<K, V>> = []
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
		let n = await this.getRoot()
		let stack: Array<ReadOnlyNode<K, V>> = []
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
		let n = await this.getRoot()
		let stack: Array<ReadOnlyNode<K, V>> = []
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
		let n = await this.getRoot()
		let stack: Array<ReadOnlyNode<K, V>> = []
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
	async get(key: K): Promise<V | undefined> {
		let cmp = this.compare
		let n = await this.getRoot()
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
	node: ReadOnlyNode<K, V>
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
	node: ReadOnlyNode<K, V>
): Promise<T | undefined> {
	let l = compare(lo, node.key)
	if (l <= 0) {
		const left = await node.getLeft()
		if (left) {
			let v = await doVisitHalf(lo, compare, fn, left)
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
	node: ReadOnlyNode<K, V>
): Promise<T | undefined> {
	let l = compare(lo, node.key)
	let h = compare(hi, node.key)
	let v
	if (l <= 0) {
		const left = await node.getLeft()
		if (left) {
			v = await doVisit(lo, hi, compare, fn, left)
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

// ========================================================
// RedBlackTreeIterator
// ========================================================

//Iterator for red black tree
export class RedBlackTreeIterator<K, V> {
	public tree: RedBlackTree<K, V>
	public stack: Array<ReadOnlyNode<K, V>>

	constructor(
		args: { tree: RedBlackTree<K, V>; stack: Array<ReadOnlyNode<K, V>> },
		private store: RBNodeDataStore<K, V>
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
		const transaction = new RBNodeTransaction(this.store)
		let stack = this.stack.map(node => transaction.from(node))
		if (stack.length === 0) {
			return this.tree
		}
		//First copy path to node
		let cstack: Array<WritableNode<K, V>> = new Array(stack.length)
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
		const left = await n.getLeft()
		let right = await n.getRight()
		if (left && right) {
			//console.log("moving to leaf")

			//First walk to previous leaf
			let split = cstack.length
			n = left
			while ((right = await n.getRight())) {
				cstack.push(n)
				n = right
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
			cstack[split - 1].setLeftId(cstack[split].id)
		}
		//console.log("stack=", cstack.map(function(v) { return v.value }))

		//Remove leaf node
		n = cstack[cstack.length - 1]
		if (n.color === RED) {
			//Easy case: removing red leaf
			//console.log("RED leaf")
			let p = cstack[cstack.length - 2]
			if (p.leftId === n.id) {
				p.setLeftId(undefined)
			} else if (p.rightId === n.id) {
				p.setRightId(undefined)
			}
			cstack.pop()
			for (let i = 0; i < cstack.length; ++i) {
				cstack[i].setCount(cstack[i].count - 1)
			}
			await transaction.commit()
			return this.tree.clone(cstack[0].id)
		} else {
			const left = await n.getLeft()
			const right = await n.getRight()
			if (left || right) {
				//Second easy case:  Single child black parent
				//console.log("BLACK single child")
				if (left) {
					swapNode(n, left)
				} else if (right) {
					swapNode(n, right)
				}
				//Child must be red, so repaint it black to balance color
				n.setColor(BLACK)
				for (let i = 0; i < cstack.length - 1; ++i) {
					cstack[i].setCount(cstack[i].count - 1)
				}
				await transaction.commit()
				return this.tree.clone(cstack[0].id)
			} else if (cstack.length === 1) {
				//Third easy case: root
				//console.log("ROOT")
				await transaction.commit()
				return this.tree.clone(undefined)
			} else {
				//Hard case: Repaint n, and then do some nasty stuff
				//console.log("BLACK leaf no children")
				for (let i = 0; i < cstack.length; ++i) {
					cstack[i].setCount(cstack[i].count - 1)
				}
				let parent = cstack[cstack.length - 2]
				await fixDoubleBlack(cstack)
				//Fix up links
				if (parent.leftId === n.id) {
					parent.setLeftId(undefined)
				} else {
					parent.setRightId(undefined)
				}
			}
		}
		await transaction.commit()
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
	async index() {
		let idx = 0
		let stack = this.stack
		if (stack.length === 0) {
			let r = await this.tree.getRoot()
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
		let n: ReadOnlyNode<K, V> | undefined = stack[stack.length - 1]
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
	get hasNext() {
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
	async update(value: V) {
		const transaction = new RBNodeTransaction(this.store)
		let stack = this.stack.map(node => transaction.from(node))
		if (stack.length === 0) {
			throw new Error("Can't update empty node!")
		}
		let cstack: Array<WritableNode<K, V>> = new Array(stack.length)
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
		await transaction.commit()
		return this.tree.clone(cstack[0].id)
	}

	//Moves iterator backward one element
	async prev() {
		let stack = this.stack
		if (stack.length === 0) {
			return
		}
		let n: ReadOnlyNode<K, V> | undefined = stack[stack.length - 1]
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
function swapNode<K, V>(n: WritableNode<K, V>, v: WritableNode<K, V>) {
	n.setKey(v.key)
	n.setValue(v.value)
	n.setLeftId(v.leftId)
	n.setRightId(v.rightId)
	n.setColor(v.color)
	n.setCount(v.count)
}

//Fix up a double black node in a tree
async function fixDoubleBlack<K, V>(stack: Array<WritableNode<K, V>>) {
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
			let s = await p.getRight()
			if (!s) {
				throw new Error("This cannot happen")
			}
			const right = await s.getRight()
			if (right && right.color === RED) {
				//console.log("case 1: right sibling child red")
				s = s.clone()
				p.setRightId(s.id)
				let z = right.clone()
				s.setRightId(z.id)
				p.setRightId(s.leftId)
				s.setLeftId(p.id)
				s.setRightId(z.id)
				s.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.setLeftId(s.id)
					} else {
						pp.setRightId(s.id)
					}
				}
				stack[i - 1] = s
				return
			} else {
				const left = await s.getLeft()
				if (left && left.color === RED) {
					//console.log("case 1: left sibling child red")
					s = s.clone()
					p.setRightId(s.id)
					let z = left.clone()
					s.setLeftId(z.id)
					p.setRightId(z.leftId)
					s.setLeftId(z.rightId)
					z.setLeftId(p.id)
					z.setRightId(s.id)
					z.setColor(p.color)
					p.setColor(BLACK)
					s.setColor(BLACK)
					n.setColor(BLACK)
					await recount(p)
					await recount(s)
					await recount(z)
					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.leftId === p.id) {
							pp.setLeftId(z.id)
						} else {
							pp.setRightId(z.id)
						}
					}
					stack[i - 1] = z
					return
				}
			}
			if (s.color === BLACK) {
				if (p.color === RED) {
					//console.log("case 2: black sibling, red parent", p.right.value)
					p.setColor(BLACK)
					p.setRightId(s.repaint(RED).id)
					return
				} else {
					//console.log("case 2: black sibling, black parent", p.right.value)
					p.setRightId(s.repaint(RED).id)
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = s.clone()
				p.setRightId(s.leftId)
				s.setLeftId(p.id)
				s.setColor(p.color)
				p.setColor(RED)
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.setLeftId(s.id)
					} else {
						pp.setRightId(s.id)
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
				p.setLeftId(s.id)
				let z = left.clone()
				s.setLeftId(z.id)
				p.setLeftId(s.rightId)
				s.setRightId(p.id)
				s.setLeftId(z.id)
				s.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.setRightId(s.id)
					} else {
						pp.setLeftId(s.id)
					}
				}
				stack[i - 1] = s
				return
			} else {
				const right = await s.getRight()
				if (right && right.color === RED) {
					//console.log("case 1: right sibling child red")
					s = s.clone()
					p.setLeftId(s.id)
					let z = right.clone()
					s.setRightId(z.id)
					p.setLeftId(z.rightId)
					s.setRightId(z.leftId)
					z.setRightId(p.id)
					z.setLeftId(s.id)
					z.setColor(p.color)
					p.setColor(BLACK)
					s.setColor(BLACK)
					n.setColor(BLACK)
					await recount(p)
					await recount(s)
					await recount(z)
					if (i > 1) {
						let pp = stack[i - 2]
						if (pp.rightId === p.id) {
							pp.setRightId(z.id)
						} else {
							pp.setLeftId(z.id)
						}
					}
					stack[i - 1] = z
					return
				}
			}
			if (s.color === BLACK) {
				if (p.color === RED) {
					//console.log("case 2: black sibling, red parent")
					p.setColor(BLACK)
					p.setLeftId(s.repaint(RED).id)
					return
				} else {
					//console.log("case 2: black sibling, black parent")
					p.setLeftId(s.repaint(RED).id)
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = s.clone()
				p.setLeftId(s.rightId)
				s.setRightId(p.id)
				s.setColor(p.color)
				p.setColor(RED)
				await recount(p)
				await recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.setRightId(s.id)
					} else {
						pp.setLeftId(s.id)
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
