import { RedBlackTree, NodeStorage } from "./rbtree"

// TODO: need some kind of storage for the tree pointer.
export class TreeDb<K, V> {
	private storage: NodeStorage<K, V>
	private compare: (a: K, b: K) => number
	constructor(args: {
		storage: NodeStorage<K, V>
		compare: (a: K, b: K) => number
	}) {
		this.storage = args.storage
		this.compare = args.compare
	}

	private tree: RedBlackTree<K, V> | undefined
	async getTree() {
		if (this.tree) {
			return this.tree
		}

		// Change the root key and you can have many trees!
		// const nodeId = await this.db.get("root")
		this.tree = new RedBlackTree<K, V>(
			{
				compare: this.compare,
				// rootId: nodeId,
				rootId: undefined,
			},
			this.storage
		)
		return this.tree
	}

	async get(key: K): Promise<V | undefined> {
		const tree = await this.getTree()
		const node = (await tree.find(key)).node
		if (node) {
			return node.value
		}
	}

	async set(key: K, value: V): Promise<void> {
		const tree = await this.getTree()
		this.tree = await tree.insert(key, value)
	}
}
