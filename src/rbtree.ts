/*

Game Plan:

- Separate `insert`, `update`, and `remove` from the rest of
	the code. That's the only part that requires a transaction.

- Two classes of RBNode. Only get a writable node from a transaction.


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

// class RBNodeDataCache<K, V> {
// 	private cache: Record<string, RBNodeData<K, V>> = {}
// 	constructor(private store: RBNodeDataStore<K, V>) {}
// 	get(key: string): RBNodeData<K, V> | undefined {
// 		const value = this.store.get(key)
// 		if (value !== undefined) {
// 			this.cache[key] = value
// 		}
// 		return value
// 	}
// 	set(key: string, value: RBNodeData<K, V>): void {
// 		this.store.set(key, value)
// 		this.cache[key] = value
// 	}
// }

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
		private store: RBNodeDataStore<K, V>
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

	get leftId() {
		return this.args.leftId
	}

	get rightId() {
		return this.args.rightId
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

	getLeft(): RBNode<K, V> | undefined {
		if (this.args.leftId) {
			const args = this.store.get(this.args.leftId)
			if (args) {
				return new RBNode(args, this.store)
			}
		}
	}

	setLeft(x: RBNode<K, V> | undefined) {
		if (x) {
			this.args.leftId = x.id
		} else {
			this.args.leftId = undefined
		}
		this.save()
	}

	getRight(): RBNode<K, V> | undefined {
		if (this.args.rightId) {
			const args = this.store.get(this.args.rightId)
			if (args) {
				return new RBNode(args, this.store)
			}
		}
	}

	setRight(x: RBNode<K, V> | undefined) {
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
	const left = node.getLeft()
	const right = node.getRight()
	node.setCount(1 + (left ? left.count : 0) + (right ? right.count : 0))
}

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
				n = n.getLeft()
			} else {
				n = n.getRight()
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
					let y = pp.getRight()
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
						pp.setRight(y.repaint(BLACK))
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("LLb")
						pp.setColor(RED)
						pp.setLeft(p.getRight())
						p.setColor(BLACK)
						p.setRight(pp)
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						recount(pp)
						recount(p)
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
					let y = pp.getRight()
					if (y && y.color === RED) {
						//console.log("LRr")
						p.setColor(BLACK)
						pp.setRight(y.repaint(BLACK))
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("LRb")
						p.setRight(n.getLeft())
						pp.setColor(RED)
						pp.setLeft(n.getRight())
						n.setColor(BLACK)
						n.setLeft(p)
						n.setRight(pp)
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						recount(pp)
						recount(p)
						recount(n)
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
					let y = pp.getLeft()
					if (y && y.color === RED) {
						//console.log("RRr", y.key)
						p.setColor(BLACK)
						pp.setLeft(y.repaint(BLACK))
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("RRb")
						pp.setColor(RED)
						pp.setRight(p.getLeft())
						p.setColor(BLACK)
						p.setLeft(pp)
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						recount(pp)
						recount(p)
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
					let y = pp.getLeft()
					if (y && y.color === RED) {
						//console.log("RLr")
						p.setColor(BLACK)
						pp.setLeft(y.repaint(BLACK))
						pp.setColor(RED)
						s -= 1
					} else {
						//console.log("RLb")
						p.setLeft(n.getRight())
						pp.setColor(RED)
						pp.setRight(n.getLeft())
						n.setColor(BLACK)
						n.setRight(p)
						n.setLeft(pp)
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						recount(pp)
						recount(p)
						recount(n)
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
			n = n.getLeft()
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack }, this.store)
	}

	//Last item in list
	get end(): RedBlackTreeIterator<K, V> {
		let stack: Array<RBNode<K, V>> = []
		let n = this.getRoot()
		while (n) {
			stack.push(n)
			n = n.getRight()
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
			const left = n.getLeft()
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
			const right = n.getRight()
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
		let stack: Array<RBNode<K, V>> = []
		let last_ptr = 0
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d <= 0) {
				last_ptr = stack.length
			}
			if (d <= 0) {
				n = n.getLeft()
			} else {
				n = n.getRight()
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
				n = n.getLeft()
			} else {
				n = n.getRight()
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
				n = n.getLeft()
			} else {
				n = n.getRight()
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
				n = n.getLeft()
			} else {
				n = n.getRight()
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
				n = n.getLeft()
			} else {
				n = n.getRight()
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
				n = n.getLeft()
			} else {
				n = n.getRight()
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
	const left = node.getLeft()
	if (left) {
		let v = doVisitFull(fn, left)
		if (v) {
			return v
		}
	}
	let v = fn(node.key, node.value)
	if (v) {
		return v
	}
	const right = node.getRight()
	if (right) {
		return doVisitFull(fn, right)
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
		const left = node.getLeft()
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
	const right = node.getRight()
	if (right) {
		return doVisitHalf(lo, compare, fn, right)
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
		const left = node.getLeft()
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
		const right = node.getRight()
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
		const left = n.getLeft()
		let right = n.getRight()
		if (left && right) {
			//console.log("moving to leaf")

			//First walk to previous leaf
			let split = cstack.length
			n = left
			while ((right = n.getRight())) {
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
				cstack[i].setCount(cstack[i].count - 1)
			}
			return this.tree.clone(cstack[0].id)
		} else {
			const left = n.getLeft()
			const right = n.getRight()
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
					parent.setLeft(undefined)
				} else {
					parent.setRight(undefined)
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
		} else {
			const left = stack[stack.length - 1].getLeft()
			if (left) {
				idx = left.count
			}
		}
		for (let s = stack.length - 2; s >= 0; --s) {
			if (stack[s + 1].id === stack[s].rightId) {
				++idx
				const left = stack[s].getLeft()
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
		let n: RBNode<K, V> | undefined = stack[stack.length - 1]
		const right = n.getRight()
		if (right) {
			n = right
			while (n) {
				stack.push(n)
				n = n.getLeft()
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
		if (stack[stack.length - 1].getRight()) {
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
		if (stack[stack.length - 1].getLeft()) {
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
		const left = n.getLeft()
		if (left) {
			n = left
			while (n) {
				stack.push(n)
				n = n.getRight()
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
	n.setLeft(v.getLeft())
	n.setRight(v.getRight())
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
			let s = p.getRight()
			if (!s) {
				throw new Error("This cannot happen")
			}
			const right = s.getRight()
			if (right && right.color === RED) {
				//console.log("case 1: right sibling child red")
				s = s.clone()
				p.setRight(s)
				let z = right.clone()
				s.setRight(z)
				p.setRight(s.getLeft())
				s.setLeft(p)
				s.setRight(z)
				s.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				recount(p)
				recount(s)
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
				const left = s.getLeft()
				if (left && left.color === RED) {
					//console.log("case 1: left sibling child red")
					s = s.clone()
					p.setRight(s)
					let z = left.clone()
					s.setLeft(z)
					p.setRight(z.getLeft())
					s.setLeft(z.getRight())
					z.setLeft(p)
					z.setRight(s)
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
					p.setColor(BLACK)
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
				p.setRight(s.getLeft())
				s.setLeft(p)
				s.setColor(p.color)
				p.setColor(RED)
				recount(p)
				recount(s)
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
			let s = p.getLeft()
			if (!s) {
				throw new Error("This cannot happen")
			}
			const left = s.getLeft()
			if (left && left.color === RED) {
				//console.log("case 1: left sibling child red", p.value, p._color)
				s = s.clone()
				p.setLeft(s)
				let z = left.clone()
				s.setLeft(z)
				p.setLeft(s.getRight())
				s.setRight(p)
				s.setLeft(z)
				s.setColor(p.color)
				n.setColor(BLACK)
				p.setColor(BLACK)
				z.setColor(BLACK)
				recount(p)
				recount(s)
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
				const right = s.getRight()
				if (right && right.color === RED) {
					//console.log("case 1: right sibling child red")
					s = s.clone()
					p.setLeft(s)
					let z = right.clone()
					s.setRight(z)
					p.setLeft(z.getRight())
					s.setRight(z.getLeft())
					z.setRight(p)
					z.setLeft(s)
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
					p.setColor(BLACK)
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
				p.setLeft(s.getRight())
				s.setRight(p)
				s.setColor(p.color)
				p.setColor(RED)
				recount(p)
				recount(s)
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
