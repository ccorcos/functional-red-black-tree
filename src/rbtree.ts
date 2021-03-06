/*

	Durable-Persistent Red-Black Tree

	Resources:
	https://en.wikipedia.org/wiki/Red%E2%80%93black_tree
	https://www.geeksforgeeks.org/red-black-tree-set-1-introduction-2/

	Adopted from https://github.com/mikolalysenko/functional-red-black-tree
	and modified to be async and persist to disk.

*/

import { randomId } from "./utils"

const RED = 0 as const
const BLACK = 1 as const

export interface NodeData<K, V> {
	readonly id: string
	readonly color: 1 | 0
	readonly key: K
	readonly value: V
	readonly leftId: string | undefined
	readonly rightId: string | undefined
	readonly count: number
}

export interface NodeStorage<K, V> {
	get(id: string): Promise<NodeData<K, V> | undefined>
	set(node: NodeData<K, V>): Promise<void>
	delete(id: string): Promise<void>
}

interface ReadOnlyNodeStorage<K, V> {
	get(id: string): Promise<NodeData<K, V> | undefined>
}

/**
 * Encapsulates `NodeData` and `NodeStorage` to make it easier to traverse
 * the node tree by calling `getLeft()` and `getRight()`.
 */
export class ReadOnlyNode<K, V> {
	readonly id: string
	readonly color: 1 | 0
	readonly key: K
	readonly value: V
	readonly leftId: string | undefined
	readonly rightId: string | undefined
	readonly count: number

	constructor(data: NodeData<K, V>, private store: ReadOnlyNodeStorage<K, V>) {
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

/**
 * Holds tree modification operations to be committed all at once when finished.
 */
class NodeTransaction<K, V> {
	constructor(private store: NodeStorage<K, V>) {}
	private cache: Record<string, NodeData<K, V> | undefined> = {}
	private writes: Record<string, NodeData<K, V>> = {}

	// Transactions have a caching layer to improve performance and also
	// return data that is queued to be written.
	async get(id: string): Promise<NodeData<K, V> | undefined> {
		if (id in this.writes) {
			return this.writes[id]
		}
		if (id in this.cache) {
			return this.cache[id]
		}
		const data = await this.store.get(id)
		this.cache[id] = data
		return data
	}

	set(value: NodeData<K, V>): WritableNode<K, V> {
		const id = value.id
		this.cache[id] = value
		this.writes[id] = value
		return new WritableNode(() => {
			if (this.writes[id]) {
				return this.writes[id]
			} else {
				throw new Error(
					"Cannot access a WritableNode after the transaction has been commited."
				)
			}
		}, this)
	}

	clone(node: undefined): undefined
	clone(node: ReadOnlyNode<K, V>): WritableNode<K, V>
	clone(node: ReadOnlyNode<K, V> | undefined): WritableNode<K, V> | undefined
	clone(node: ReadOnlyNode<K, V> | undefined): WritableNode<K, V> | undefined {
		if (node === undefined) {
			return undefined
		}
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

	async commit() {
		for (const node of Object.values(this.writes)) {
			await this.store.set(node)
		}
		// Writable nodes can no longer be accessed after the transaction is written.
		this.writes = {}
		// Let the garbage collector clean up the cache.
		this.cache = {}
	}
}

/**
 * Encapsulates `NodeData` and `NodeTransaction` and provides a mutable interface
 * for editing the tree. All mutations must be commited with `NodeTransaction.commit()`
 * for the mutations to persist. Also provides a convenient interface for traversing
 * the tree, similar to `ReadOnlyNode`.
 */
export class WritableNode<K, V> {
	constructor(
		private get: () => NodeData<K, V>,
		private store: NodeTransaction<K, V>
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

	async getLeft(): Promise<ReadOnlyNode<K, V> | undefined> {
		const leftId = this.get().leftId
		if (leftId) {
			const data = await this.store.get(leftId)
			if (data) {
				return new ReadOnlyNode(data, this.store)
			}
		}
	}

	setLeftId(x: string | undefined) {
		this.store.set({
			...this.get(),
			leftId: x,
		})
	}

	async getRight(): Promise<ReadOnlyNode<K, V> | undefined> {
		const rightId = this.get().rightId
		if (rightId) {
			const data = await this.store.get(rightId)
			if (data) {
				return new ReadOnlyNode(data, this.store)
			}
		}
	}

	setRightId(x: string | undefined) {
		this.store.set({
			...this.get(),
			rightId: x,
		})
	}
}

/**
 * Provides an abstraction for traversing and manipulating the tree.
 */
export class RedBlackTree<K, V> {
	public compare: (a: K, b: K) => number
	public rootId: string | undefined

	constructor(
		args: {
			/** Similar to Array.sort() */
			compare: (a: K, b: K) => number
			rootId: string | undefined
		},
		private store: NodeStorage<K, V>
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
		const transaction = new NodeTransaction(this.store)

		// Find point to insert new node at
		let n = transaction.clone(await this.getRoot())
		let n_stack: Array<WritableNode<K, V>> = []
		let d_stack: Array<number> = []
		while (n) {
			let d = this.compare(key, n.key)
			n_stack.push(n)
			d_stack.push(d)
			if (d <= 0) {
				n = transaction.clone(await n.getLeft())
			} else {
				n = transaction.clone(await n.getRight())
			}
		}

		// Rebuild path to leaf node
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
				n.setLeftId(n_stack[s + 1] ? n_stack[s + 1].id : undefined)
				n.setCount(n.count + 1)
			} else {
				n.setRightId(n_stack[s + 1] ? n_stack[s + 1].id : undefined)
				n.setCount(n.count + 1)
			}
		}

		// 8 types of rotations.
		// Rebalance tree using rotations
		// console.log("start insert", key, d_stack)
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
						// console.log("LLr")
						p.setColor(BLACK)
						const yy = transaction.clone(y)
						yy.setColor(BLACK)
						pp.setRightId(yy.id)
						pp.setColor(RED)
						s -= 1
					} else {
						// console.log("LLb")
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
						// console.log("LRr")
						p.setColor(BLACK)
						const yy = transaction.clone(y)
						yy.setColor(BLACK)
						pp.setRightId(yy.id)
						pp.setColor(RED)
						s -= 1
					} else {
						// console.log("LRb")
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
						// console.log("RRr", y.key)
						p.setColor(BLACK)
						const yy = transaction.clone(y)
						yy.setColor(BLACK)
						pp.setLeftId(yy.id)
						pp.setColor(RED)
						s -= 1
					} else {
						// console.log("RRb")
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
						// console.log("RLr")
						p.setColor(BLACK)
						const yy = transaction.clone(y)
						yy.setColor(BLACK)
						pp.setLeftId(yy.id)
						pp.setColor(RED)
						s -= 1
					} else {
						// console.log("RLb")
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
		// Return new tree
		n_stack[0].setColor(BLACK)
		const newRootId = n_stack[0].id
		await transaction.commit()
		return new RedBlackTree(
			{ compare: this.compare, rootId: newRootId },
			this.store
		)
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

	/**
	 * First item in list.
	 */
	async begin(): Promise<RedBlackTreeIterator<K, V>> {
		let stack: Array<ReadOnlyNode<K, V>> = []
		let n = await this.getRoot()
		while (n) {
			stack.push(n)
			n = await n.getLeft()
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	/**
	 * Last item in list.
	 */
	async end(): Promise<RedBlackTreeIterator<K, V>> {
		let stack: Array<ReadOnlyNode<K, V>> = []
		let n = await this.getRoot()
		while (n) {
			stack.push(n)
			n = await n.getRight()
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	/**
	 * Find the nth item in the tree.
	 */
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

	/**
	 * Finds the item with key if it exists.
	 */
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

	/**
	 * Removes item with `key` from tree.
	 */
	async remove(key: K): Promise<RedBlackTree<K, V>> {
		let iter = await this.find(key)
		if (iter) {
			return iter.remove()
		}
		return this
	}

	/**
	 * Returns the item at `key`.
	 */
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

/**
 * Visit all nodes inorder.
 */
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

/**
 * Visit half nodes in order.
 */
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

/**
 * Visit all nodes within a range
 */
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

/**
 * Represents a path into a `RedBlackTree` with helpful methods for
 * traversing the tree.
 */
export class RedBlackTreeIterator<K, V> {
	public tree: RedBlackTree<K, V>
	public stack: Array<ReadOnlyNode<K, V>>

	constructor(
		args: { tree: RedBlackTree<K, V>; stack: Array<ReadOnlyNode<K, V>> },
		private store: NodeStorage<K, V>
	) {
		this.tree = args.tree
		this.stack = args.stack
	}

	/**
	 * Test if iterator is valid.
	 */
	get valid() {
		return this.stack.length > 0
	}

	/**
	 * Node that the iterator is pointing to.
	 */
	get node() {
		if (this.stack.length > 0) {
			return this.stack[this.stack.length - 1]
		}
		return undefined
	}

	/**
	 * Makes a copy of an iterator.
	 */
	clone(): RedBlackTreeIterator<K, V> {
		return new RedBlackTreeIterator(
			{
				tree: this.tree,
				stack: this.stack.slice(),
			},
			this.store
		)
	}

	/**
	 * Removes node that the iterator is pointing to from tree.
	 */
	async remove(): Promise<RedBlackTree<K, V>> {
		const transaction = new NodeTransaction(this.store)
		let stack = this.stack
		if (stack.length === 0) {
			return this.tree
		}
		// First copy path to node
		let cstack: Array<WritableNode<K, V>> = new Array(stack.length)
		cstack[cstack.length - 1] = transaction.clone(stack[stack.length - 1])
		for (let i = stack.length - 2; i >= 0; --i) {
			let n = stack[i]
			if (n.leftId === stack[i + 1].id) {
				cstack[i] = transaction.clone(n)
				cstack[i].setLeftId(cstack[i + 1] ? cstack[i + 1].id : undefined)
			} else {
				cstack[i] = transaction.clone(n)
				cstack[i].setRightId(cstack[i + 1] ? cstack[i + 1].id : undefined)
			}
		}

		// Get node
		let n = cstack[cstack.length - 1]
		// console.log("start remove: ", n.value)

		// If not leaf, then swap with previous node
		const left = await n.getLeft()
		let right = await n.getRight()
		if (left && right) {
			// console.log("moving to leaf")
			// First walk to previous leaf
			let split = cstack.length
			let z = left
			while ((right = await z.getRight())) {
				cstack.push(transaction.clone(z))
				z = right
			}

			// Copy path to leaf
			cstack.push(transaction.clone(z))
			cstack[split - 1].setKey(n.key)
			cstack[split - 1].setValue(n.value)

			// Fix up stack
			for (let i = cstack.length - 2; i >= split; --i) {
				cstack[i].setRightId(cstack[i + 1] ? cstack[i + 1].id : undefined)
			}
			cstack[split - 1].setLeftId(cstack[split].id)
		}
		// console.log("stack=", cstack.map(function(v) { return v.value }))

		// Remove leaf node
		n = cstack[cstack.length - 1]
		if (n.color === RED) {
			// Easy case: removing red leaf
			// console.log("RED leaf")
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
			const newRootId = cstack[0].id
			await transaction.commit()
			return this.tree.clone(newRootId)
		} else {
			const left = await n.getLeft()
			const right = await n.getRight()
			if (left || right) {
				// Second easy case: Single child black parent
				// console.log("BLACK single child")
				if (left) {
					swapNode(n, left)
				} else if (right) {
					swapNode(n, right)
				}
				// Child must be red, so repaint it black to balance color
				n.setColor(BLACK)
				for (let i = 0; i < cstack.length - 1; ++i) {
					cstack[i].setCount(cstack[i].count - 1)
				}
				const newRootId = cstack[0].id
				await transaction.commit()
				return this.tree.clone(newRootId)
			} else if (cstack.length === 1) {
				// Third easy case: root
				// console.log("ROOT")
				await transaction.commit()
				return this.tree.clone(undefined)
			} else {
				// Hard case: Repaint n, and then do some nasty stuff
				// console.log("BLACK leaf no children")
				for (let i = 0; i < cstack.length; ++i) {
					cstack[i].setCount(cstack[i].count - 1)
				}
				let parent = cstack[cstack.length - 2]
				await fixDoubleBlack(cstack, transaction)
				// Fix up links
				if (parent.leftId === n.id) {
					parent.setLeftId(undefined)
				} else {
					parent.setRightId(undefined)
				}
			}
		}
		const newRootId = cstack[0].id
		await transaction.commit()
		return this.tree.clone(newRootId)
	}

	/**
	 * Returns the key of the node this iterator is pointing to.
	 */
	get key() {
		if (this.stack.length > 0) {
			return this.stack[this.stack.length - 1].key
		}
		return
	}

	/**
	 * Returns the value of the node this iterator is pointing to.
	 */
	get value() {
		if (this.stack.length > 0) {
			return this.stack[this.stack.length - 1].value
		}
		return
	}

	/**
	 * Returns the position of the node this iterator is point to in the sorted list.
	 */
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

	/**
	 * Advances iterator to next element in list.
	 */
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

	/**
	 * Checks if iterator is at end of tree.
	 */
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

	/**
	 * Checks if iterator is at start of tree.
	 */
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

	/**
	 * Updates the value of the the node that the iterator is pointing to.
	 */
	async update(value: V) {
		const transaction = new NodeTransaction(this.store)
		let stack = this.stack
		if (stack.length === 0) {
			throw new Error("Can't update empty node!")
		}
		let cstack: Array<WritableNode<K, V>> = new Array(stack.length)
		let n = transaction.clone(stack[stack.length - 1])
		n.setValue(value)
		cstack[cstack.length - 1] = n
		for (let i = stack.length - 2; i >= 0; --i) {
			n = transaction.clone(stack[i])
			if (n.leftId === stack[i + 1].id) {
				n.setLeftId(cstack[i + 1] ? cstack[i + 1].id : undefined)
				cstack[i] = n
			} else {
				n.setRightId(cstack[i + 1] ? cstack[i + 1].id : undefined)
				cstack[i] = n
			}
		}
		const newRootId = cstack[0].id
		await transaction.commit()
		return this.tree.clone(newRootId)
	}

	/**
	 * Moves iterator backward one element.
	 */
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

/**
 * Swaps two nodes.
 */
function swapNode<K, V>(n: WritableNode<K, V>, v: ReadOnlyNode<K, V>) {
	n.setKey(v.key)
	n.setValue(v.value)
	n.setLeftId(v.leftId)
	n.setRightId(v.rightId)
	n.setColor(v.color)
	n.setCount(v.count)
}

/**
 * Recounts the items beneath a node.
 */
async function recount<K, V>(node: WritableNode<K, V>) {
	const left = await node.getLeft()
	const right = await node.getRight()
	node.setCount(1 + (left ? left.count : 0) + (right ? right.count : 0))
}

/**
 * Fix up a double black node in a tree.
 */
async function fixDoubleBlack<K, V>(
	stack: Array<WritableNode<K, V>>,
	transaction: NodeTransaction<K, V>
) {
	for (let i = stack.length - 1; i >= 0; --i) {
		const n = stack[i]
		if (i === 0) {
			n.setColor(BLACK)
			return
		}
		// console.log("visit node:", n.key, i, stack[i].key, stack[i-1].key)
		const p = stack[i - 1]
		if (p.leftId === n.id) {
			// console.log("left child")
			const s = await p.getRight()
			if (!s) {
				throw new Error("This cannot happen")
			}
			const right = await s.getRight()
			if (right && right.color === RED) {
				// console.log("case 1: right sibling child red")
				const ss = transaction.clone(s)
				p.setRightId(ss.id)
				const z = transaction.clone(right)
				ss.setRightId(z.id)
				p.setRightId(ss.leftId)
				ss.setLeftId(p.id)
				ss.setRightId(z.id)
				ss.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				await recount(p)
				await recount(ss)
				if (i > 1) {
					const pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.setLeftId(ss.id)
					} else {
						pp.setRightId(ss.id)
					}
				}
				stack[i - 1] = ss
				return
			} else {
				const left = await s.getLeft()
				if (left && left.color === RED) {
					// console.log("case 1: left sibling child red")
					const ss = transaction.clone(s)
					p.setRightId(ss.id)
					const z = transaction.clone(left)
					ss.setLeftId(z.id)
					p.setRightId(z.leftId)
					ss.setLeftId(z.rightId)
					z.setLeftId(p.id)
					z.setRightId(ss.id)
					z.setColor(p.color)
					p.setColor(BLACK)
					ss.setColor(BLACK)
					n.setColor(BLACK)
					await recount(p)
					await recount(ss)
					await recount(z)
					if (i > 1) {
						const pp = stack[i - 2]
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
					// console.log("case 2: black sibling, red parent", p.right.value)
					p.setColor(BLACK)
					const ss = transaction.clone(s)
					ss.setColor(RED)
					p.setRightId(ss.id)
					return
				} else {
					// console.log("case 2: black sibling, black parent", p.right.value)
					const ss = transaction.clone(s)
					ss.setColor(RED)
					p.setRightId(ss.id)
					continue
				}
			} else {
				// console.log("case 3: red sibling")
				const ss = transaction.clone(s)
				p.setRightId(ss.leftId)
				ss.setLeftId(p.id)
				ss.setColor(p.color)
				p.setColor(RED)
				await recount(p)
				await recount(ss)
				if (i > 1) {
					const pp = stack[i - 2]
					if (pp.leftId === p.id) {
						pp.setLeftId(ss.id)
					} else {
						pp.setRightId(ss.id)
					}
				}
				stack[i - 1] = ss
				stack[i] = p
				if (i + 1 < stack.length) {
					stack[i + 1] = n
				} else {
					stack.push(n)
				}
				i = i + 2
			}
		} else {
			// console.log("right child")
			const s = await p.getLeft()
			if (!s) {
				throw new Error("This cannot happen")
			}
			const left = await s.getLeft()
			if (left && left.color === RED) {
				// console.log("case 1: left sibling child red", p.value, p._color)
				const ss = transaction.clone(s)
				p.setLeftId(ss.id)
				const z = transaction.clone(left)
				ss.setLeftId(z.id)
				p.setLeftId(ss.rightId)
				ss.setRightId(p.id)
				ss.setLeftId(z.id)
				ss.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				await recount(p)
				await recount(ss)
				if (i > 1) {
					const pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.setRightId(ss.id)
					} else {
						pp.setLeftId(ss.id)
					}
				}
				stack[i - 1] = ss
				return
			} else {
				const right = await s.getRight()
				if (right && right.color === RED) {
					// console.log("case 1: right sibling child red")
					const ss = transaction.clone(s)
					p.setLeftId(ss.id)
					const z = transaction.clone(right)
					ss.setRightId(z.id)
					p.setLeftId(z.rightId)
					ss.setRightId(z.leftId)
					z.setRightId(p.id)
					z.setLeftId(ss.id)
					z.setColor(p.color)
					p.setColor(BLACK)
					ss.setColor(BLACK)
					n.setColor(BLACK)
					await recount(p)
					await recount(ss)
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
					// console.log("case 2: black sibling, red parent")
					p.setColor(BLACK)
					const ss = transaction.clone(s)
					ss.setColor(RED)
					p.setLeftId(ss.id)
					return
				} else {
					// console.log("case 2: black sibling, black parent")
					const ss = transaction.clone(s)
					ss.setColor(RED)
					p.setLeftId(ss.id)
					continue
				}
			} else {
				// console.log("case 3: red sibling")
				const ss = transaction.clone(s)
				p.setLeftId(ss.rightId)
				ss.setRightId(p.id)
				ss.setColor(p.color)
				p.setColor(RED)
				await recount(p)
				await recount(ss)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.rightId === p.id) {
						pp.setRightId(ss.id)
					} else {
						pp.setLeftId(ss.id)
					}
				}
				stack[i - 1] = ss
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
