/*

Game Plan:
- [x] convert to typescript.
- [ ] persist to a key-value map.
- [ ] persist to leveldb.

*/

class KeyValueStore<V> {
	map: Record<string, V> = {}
	get(key: string): V | undefined {
		return this.map[key]
	}
	set(key: string, value: V): void {
		this.map[key] = value
	}
	delete(key: string): void {
		delete this.map[key]
	}
}

function randomId() {
	return Math.round(Math.random() * 1e10).toString()
}

let RED = 0 as const
let BLACK = 1 as const

export class RBNode<K, V> {
	// TODO: make these all readonly
	// TODO: then sets can use the k/v store.

	public color: 1 | 0
	public key: K
	public value: V
	public left: RBNode<K, V> | undefined
	public right: RBNode<K, V> | undefined
	public count: number

	constructor(args: {
		color: 1 | 0
		key: K
		value: V
		left: RBNode<K, V> | undefined
		right: RBNode<K, V> | undefined
		count: number
	}) {
		this.color = args.color
		this.key = args.key
		this.value = args.value
		this.left = args.left
		this.right = args.right
		this.count = args.count
	}
}

function cloneNode<K, V>(node: RBNode<K, V>) {
	return new RBNode(node)
}

function repaint<K, V>(color: 1 | 0, node: RBNode<K, V>) {
	return new RBNode({ ...node, color })
}

function recount<K, V>(node: RBNode<K, V>) {
	node.count =
		1 + (node.left ? node.left.count : 0) + (node.right ? node.right.count : 0)
}

export class RedBlackTree<K, V> {
	public compare: (a: K, b: K) => number
	public root: RBNode<K, V> | undefined

	constructor(args: {
		compare: (a: K, b: K) => number
		root: RBNode<K, V> | undefined
	}) {
		this.compare = args.compare
		this.root = args.root
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

	// Returns the number of nodes in the tree
	get length() {
		if (this.root) {
			return this.root.count
		}
		return 0
	}

	// Insert a new item into the tree
	insert(key: K, value: V): RedBlackTree<K, V> {
		let cmp = this.compare
		// Find point to insert new node at
		let n = this.root
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
		n_stack.push(
			new RBNode({
				color: RED,
				key,
				value,
				left: undefined,
				right: undefined,
				count: 1,
			})
		)
		for (let s = n_stack.length - 2; s >= 0; --s) {
			let n = n_stack[s]
			if (d_stack[s] <= 0) {
				n_stack[s] = new RBNode({
					...n,
					left: n_stack[s + 1],
					count: n.count + 1,
				})
			} else {
				n_stack[s] = new RBNode({
					...n,
					right: n_stack[s + 1],
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
			if (pp.left === p) {
				if (p.left === n) {
					let y = pp.right
					if (y && y.color === RED) {
						//console.log("LLr")
						p.color = BLACK
						pp.right = repaint(BLACK, y)
						pp.color = RED
						s -= 1
					} else {
						//console.log("LLb")
						pp.color = RED
						pp.left = p.right
						p.color = BLACK
						p.right = pp
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						recount(pp)
						recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.left === pp) {
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
						p.color = BLACK
						pp.right = repaint(BLACK, y)
						pp.color = RED
						s -= 1
					} else {
						//console.log("LRb")
						p.right = n.left
						pp.color = RED
						pp.left = n.right
						n.color = BLACK
						n.left = p
						n.right = pp
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						recount(pp)
						recount(p)
						recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.left === pp) {
								ppp.left = n
							} else {
								ppp.right = n
							}
						}
						break
					}
				}
			} else {
				if (p.right === n) {
					let y = pp.left
					if (y && y.color === RED) {
						//console.log("RRr", y.key)
						p.color = BLACK
						pp.left = repaint(BLACK, y)
						pp.color = RED
						s -= 1
					} else {
						//console.log("RRb")
						pp.color = RED
						pp.right = p.left
						p.color = BLACK
						p.left = pp
						n_stack[s - 2] = p
						n_stack[s - 1] = n
						recount(pp)
						recount(p)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.right === pp) {
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
						p.color = BLACK
						pp.left = repaint(BLACK, y)
						pp.color = RED
						s -= 1
					} else {
						//console.log("RLb")
						p.left = n.right
						pp.color = RED
						pp.right = n.left
						n.color = BLACK
						n.right = p
						n.left = pp
						n_stack[s - 2] = n
						n_stack[s - 1] = p
						recount(pp)
						recount(p)
						recount(n)
						if (s >= 3) {
							let ppp = n_stack[s - 3]
							if (ppp.right === pp) {
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
		n_stack[0].color = BLACK
		return new RedBlackTree({ compare: cmp, root: n_stack[0] })
	}

	forEach<T>(fn: (key: K, value: V) => T, lo?: K, hi?: K): T | undefined {
		if (!this.root) {
			return
		}
		if (lo !== undefined) {
			if (hi !== undefined) {
				if (this.compare(lo, hi) >= 0) {
					return
				}
				return doVisit(lo, hi, this.compare, fn, this.root)
			} else {
				return doVisitHalf(lo, this.compare, fn, this.root)
			}
		} else {
			return doVisitFull(fn, this.root)
		}
	}

	//First item in list
	get begin(): RedBlackTreeIterator<K, V> {
		let stack: Array<RBNode<K, V>> = []
		let n = this.root
		while (n) {
			stack.push(n)
			n = n.left
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack })
	}

	//Last item in list
	get end(): RedBlackTreeIterator<K, V> {
		let stack: Array<RBNode<K, V>> = []
		let n = this.root
		while (n) {
			stack.push(n)
			n = n.right
		}
		return new RedBlackTreeIterator({ tree: this, stack: stack })
	}

	//Find the ith item in the tree
	at(idx: number): RedBlackTreeIterator<K, V> {
		if (idx < 0 || !this.root) {
			return new RedBlackTreeIterator({ tree: this, stack: [] })
		}
		let n = this.root
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
				return new RedBlackTreeIterator({ tree: this, stack: stack })
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
		return new RedBlackTreeIterator({ tree: this, stack: [] })
	}

	ge(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.root
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
		return new RedBlackTreeIterator({ tree: this, stack })
	}

	gt(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.root
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
		return new RedBlackTreeIterator({ tree: this, stack })
	}

	lt(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.root
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
		return new RedBlackTreeIterator({ tree: this, stack })
	}

	le(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.root
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
		return new RedBlackTreeIterator({ tree: this, stack })
	}

	//Finds the item with key if it exists
	find(key: K): RedBlackTreeIterator<K, V> {
		let cmp = this.compare
		let n = this.root
		let stack: Array<RBNode<K, V>> = []
		while (n) {
			let d = cmp(key, n.key)
			stack.push(n)
			if (d === 0) {
				return new RedBlackTreeIterator({ tree: this, stack })
			}
			if (d <= 0) {
				n = n.left
			} else {
				n = n.right
			}
		}
		return new RedBlackTreeIterator({ tree: this, stack: [] })
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
		let n = this.root
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

	constructor(args: { tree: RedBlackTree<K, V>; stack: Array<RBNode<K, V>> }) {
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
		return new RedBlackTreeIterator({
			tree: this.tree,
			stack: this.stack.slice(),
		})
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
		cstack[cstack.length - 1] = new RBNode(n)
		for (let i = stack.length - 2; i >= 0; --i) {
			let n = stack[i]
			if (n.left === stack[i + 1]) {
				cstack[i] = new RBNode({
					...n,
					left: cstack[i + 1],
				})
			} else {
				cstack[i] = new RBNode({
					...n,
					right: cstack[i + 1],
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
			cstack.push(new RBNode(n))
			cstack[split - 1].key = n.key
			cstack[split - 1].value = n.value

			//Fix up stack
			for (let i = cstack.length - 2; i >= split; --i) {
				n = cstack[i]
				cstack[i] = new RBNode({
					...n,
					right: cstack[i + 1],
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
			if (p.left === n) {
				p.left = undefined
			} else if (p.right === n) {
				p.right = undefined
			}
			cstack.pop()
			for (let i = 0; i < cstack.length; ++i) {
				cstack[i].count--
			}
			return new RedBlackTree({ compare: this.tree.compare, root: cstack[0] })
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
				n.color = BLACK
				for (let i = 0; i < cstack.length - 1; ++i) {
					cstack[i].count--
				}
				return new RedBlackTree({ compare: this.tree.compare, root: cstack[0] })
			} else if (cstack.length === 1) {
				//Third easy case: root
				//console.log("ROOT")
				return new RedBlackTree({ compare: this.tree.compare, root: undefined })
			} else {
				//Hard case: Repaint n, and then do some nasty stuff
				//console.log("BLACK leaf no children")
				for (let i = 0; i < cstack.length; ++i) {
					cstack[i].count--
				}
				let parent = cstack[cstack.length - 2]
				fixDoubleBlack(cstack)
				//Fix up links
				if (parent.left === n) {
					parent.left = undefined
				} else {
					parent.right = undefined
				}
			}
		}
		return new RedBlackTree({ compare: this.tree.compare, root: cstack[0] })
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
			let r = this.tree.root
			if (r) {
				return r.count
			}
			return 0
		} else if (stack[stack.length - 1].left) {
			idx = (stack[stack.length - 1].left as RBNode<K, V>).count
		}
		for (let s = stack.length - 2; s >= 0; --s) {
			if (stack[s + 1] === stack[s].right) {
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
			while (stack.length > 0 && stack[stack.length - 1].right === n) {
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
			if (stack[s - 1].left === stack[s]) {
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
			if (stack[s - 1].right === stack[s]) {
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
		cstack[cstack.length - 1] = new RBNode({
			...n,
			value,
		})
		for (let i = stack.length - 2; i >= 0; --i) {
			n = stack[i]
			if (n.left === stack[i + 1]) {
				cstack[i] = new RBNode({
					...n,
					left: cstack[i + 1],
				})
			} else {
				cstack[i] = new RBNode({
					...n,
					right: cstack[i + 1],
				})
			}
		}
		return new RedBlackTree({ compare: this.tree.compare, root: cstack[0] })
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
			while (stack.length > 0 && stack[stack.length - 1].left === n) {
				n = stack[stack.length - 1]
				stack.pop()
			}
		}
	}
}

//Swaps two nodes
function swapNode<K, V>(n: RBNode<K, V>, v: RBNode<K, V>) {
	n.key = v.key
	n.value = v.value
	n.left = v.left
	n.right = v.right
	n.color = v.color
	n.count = v.count
}

//Fix up a double black node in a tree
function fixDoubleBlack<K, V>(stack: Array<RBNode<K, V>>) {
	for (let i = stack.length - 1; i >= 0; --i) {
		let n = stack[i]
		if (i === 0) {
			n.color = BLACK
			return
		}
		//console.log("visit node:", n.key, i, stack[i].key, stack[i-1].key)
		let p = stack[i - 1]
		if (p.left === n) {
			//console.log("left child")
			let s = p.right
			if (!s) {
				throw new Error("This cannot happen")
			}
			if (s.right && s.right.color === RED) {
				//console.log("case 1: right sibling child red")
				s = p.right = cloneNode(s)
				let z = (s.right = cloneNode(s.right as RBNode<K, V>))
				p.right = s.left
				s.left = p
				s.right = z
				s.color = p.color
				n.color = BLACK
				p.color = BLACK
				z.color = BLACK
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.left === p) {
						pp.left = s
					} else {
						pp.right = s
					}
				}
				stack[i - 1] = s
				return
			} else if (s.left && s.left.color === RED) {
				//console.log("case 1: left sibling child red")
				s = p.right = cloneNode(s)
				let z = (s.left = cloneNode(s.left as RBNode<K, V>))
				p.right = z.left
				s.left = z.right
				z.left = p
				z.right = s
				z.color = p.color
				p.color = BLACK
				s.color = BLACK
				n.color = BLACK
				recount(p)
				recount(s)
				recount(z)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.left === p) {
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
					p.color = BLACK
					p.right = repaint(RED, s)
					return
				} else {
					//console.log("case 2: black sibling, black parent", p.right.value)
					p.right = repaint(RED, s)
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = cloneNode(s)
				p.right = s.left
				s.left = p
				s.color = p.color
				p.color = RED
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.left === p) {
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
				s = p.left = cloneNode(s)
				let z = (s.left = cloneNode(s.left as RBNode<K, V>))
				p.left = s.right
				s.right = p
				s.left = z
				s.color = p.color
				n.color = BLACK
				p.color = BLACK
				z.color = BLACK
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.right === p) {
						pp.right = s
					} else {
						pp.left = s
					}
				}
				stack[i - 1] = s
				return
			} else if (s.right && s.right.color === RED) {
				//console.log("case 1: right sibling child red")
				s = p.left = cloneNode(s)
				let z = (s.right = cloneNode(s.right as RBNode<K, V>))
				p.left = z.right
				s.right = z.left
				z.right = p
				z.left = s
				z.color = p.color
				p.color = BLACK
				s.color = BLACK
				n.color = BLACK
				recount(p)
				recount(s)
				recount(z)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.right === p) {
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
					p.color = BLACK
					p.left = repaint(RED, s)
					return
				} else {
					//console.log("case 2: black sibling, black parent")
					p.left = repaint(RED, s)
					continue
				}
			} else {
				//console.log("case 3: red sibling")
				s = cloneNode(s)
				p.left = s.right
				s.right = p
				s.color = p.color
				p.color = RED
				recount(p)
				recount(s)
				if (i > 1) {
					let pp = stack[i - 2]
					if (pp.right === p) {
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
function createRBTree<K, V>(compare?: (a: K, b: K) => number) {
	return new RedBlackTree<K, V>({
		compare: compare || defaultCompare,
		root: undefined,
	})
}

export default createRBTree
