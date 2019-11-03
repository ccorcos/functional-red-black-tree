import makeTree, {
	RedBlackTree,
	ReadOnlyNode,
	RedBlackTreeIterator,
} from "../src/rbtree"
import * as tape from "tape"
import * as util from "util"
const iota = require("iota-array") as (n: number) => Array<number>

var COLORS = ["r", "b", "bb"]

async function printTree<K, V>(
	tree: ReadOnlyNode<K, V> | undefined
): Promise<any> {
	if (!tree) {
		return []
	}
	return [
		COLORS[tree.color],
		tree.key,
		printTree(await tree.getLeft()),
		printTree(await tree.getRight()),
	]
}

async function print<K, V>(t: RedBlackTree<K, V>) {
	console.log(util.inspect(await printTree(await t.getRoot()), { depth: 12 }))
}

//Ensures the red black axioms are satisfied by tree
async function checkTree<K, V>(tree: RedBlackTree<K, V>, t: tape.Test) {
	const root = await tree.getRoot()
	if (!root) {
		return
	}
	t.equals(root.color, 1, "root is black")
	async function checkNode(
		node: ReadOnlyNode<K, V> | undefined
	): Promise<[number, number]> {
		if (!node) {
			return [1, 0]
		}
		const left = await node.getLeft()
		const right = await node.getRight()
		if (node.color === 0) {
			t.assert(!left || left.color === 1, "children of red node must be black")
			t.assert(
				!right || right.color === 1,
				"children of red node must be black"
			)
		} else {
			t.equals(node.color, 1, "node color must be red or black")
		}
		if (left) {
			t.assert(
				tree.compare(left.key, node.key) <= 0,
				"left tree order invariant"
			)
		}
		if (right) {
			t.assert(
				tree.compare(right.key, node.key) >= 0,
				"right tree order invariant"
			)
		}
		var cl = await checkNode(left)
		var cr = await checkNode(right)
		t.equals(
			cl[0],
			cr[0],
			"number of black nodes along all paths to root must be constant"
		)
		t.equals(cl[1] + cr[1] + 1, node.count, "item count consistency")
		return [cl[0] + node.color, cl[1] + cr[1] + 1]
	}
	var r = await checkNode(await tree.getRoot())
	t.equals(r[1], await tree.length(), "tree length")
}

tape("insert()", async function(t) {
	var t1 = makeTree<number, boolean>()

	var u = t1
	var arr: Array<number> = []
	for (var i = 20; i >= 0; --i) {
		var x = i
		var next = await u.insert(x, true)
		await checkTree(u, t)
		await checkTree(next, t)
		t.equals(await u.length(), arr.length)
		arr.push(x)
		u = next
	}
	for (var i = -20; i < 0; ++i) {
		var x = i
		var next = await u.insert(x, true)
		await checkTree(u, t)
		await checkTree(next, t)
		arr.sort(function(a, b) {
			return a - b
		})
		var ptr = 0
		await u.forEach(function(k, v) {
			t.equals(k, arr[ptr++])
		})
		t.equals(ptr, arr.length)
		arr.push(x)
		u = next
	}

	var start = await u.begin()
	for (var i = -20, j = 0; j <= 40; ++i, ++j) {
		t.equals((await u.at(j)).key, i, "checking at()")
		t.equals(start.key, i, "checking iter")
		t.equals(await start.index(), j, "checking index")
		t.assert(start.valid, "checking valid")
		if (j < 40) {
			t.assert(start.hasNext, "hasNext()")
		} else {
			t.assert(!start.hasNext, "eof hasNext()")
		}
		await start.next()
	}
	t.assert(!start.valid, "invalid eof iterator")
	t.assert(!start.hasNext, "hasNext() at eof fail")
	t.equals(await start.index(), 41, "eof index")

	t.end()
})

tape("foreach", async function(t) {
	var u = await iota(31).reduce(async function(u, k, v) {
		return (await u).insert(k, v)
	}, Promise.resolve(makeTree<number, number>()))

	//Check basic foreach
	var visit_keys: Array<number> = []
	var visit_vals: Array<number> = []
	await u.forEach(function(k, v) {
		visit_keys.push(k)
		visit_vals.push(v)
	})
	t.same(visit_keys, await u.keys())
	t.same(visit_vals, await u.values())

	//Check foreach with termination
	visit_keys = []
	visit_vals = []
	t.equals(
		await u.forEach(function(k, v) {
			if (k === 5) {
				return 1000
			}
			visit_keys.push(k)
			visit_vals.push(v)
		}),
		1000
	)
	t.same(visit_keys, (await u.keys()).slice(0, 5))
	t.same(visit_vals, (await u.values()).slice(0, 5))

	//Check half interval foreach
	visit_keys = []
	visit_vals = []
	await u.forEach(function(k, v) {
		visit_keys.push(k)
		visit_vals.push(v)
	}, 3)
	t.same(visit_keys, (await u.keys()).slice(3))
	t.same(visit_vals, (await u.values()).slice(3))

	//Check half interval foreach with termination
	visit_keys = []
	visit_vals = []
	t.equals(
		await u.forEach(function(k, v) {
			if (k === 12) {
				return 1000
			}
			visit_keys.push(k)
			visit_vals.push(v)
		}, 3),
		1000
	)
	t.same(visit_keys, (await u.keys()).slice(3, 12))
	t.same(visit_vals, (await u.values()).slice(3, 12))

	//Check interval foreach
	visit_keys = []
	visit_vals = []
	await u.forEach(
		function(k, v) {
			visit_keys.push(k)
			visit_vals.push(v)
		},
		3,
		15
	)
	t.same(visit_keys, (await u.keys()).slice(3, 15))
	t.same(visit_vals, (await u.values()).slice(3, 15))

	//Check interval foreach with termination
	visit_keys = []
	visit_vals = []
	t.equals(
		await u.forEach(
			function(k, v) {
				if (k === 12) {
					return 1000
				}
				visit_keys.push(k)
				visit_vals.push(v)
			},
			3,
			15
		),
		1000
	)
	t.same(visit_keys, (await u.keys()).slice(3, 12))
	t.same(visit_vals, (await u.values()).slice(3, 12))

	t.end()
})

async function compareIterators<K, V>(
	a: RedBlackTreeIterator<K, V>,
	b: RedBlackTreeIterator<K, V>,
	t: tape.Test
) {
	t.equals(a.tree, b.tree, "iter trees")
	t.equals(a.valid, b.valid, "iter validity")
	if (!b.valid) {
		return
	}
	t.equals(
		a.node ? a.node.id : undefined,
		b.node ? b.node.id : undefined,
		"iter node"
	)
	t.equals(a.key, b.key, "iter key")
	t.equals(a.value, b.value, "iter value")
	t.equals(await a.index(), await b.index(), "iter index")
}

tape("iterators", async function(t) {
	var u = await iota(20).reduce(async function(u, k, v) {
		return (await u).insert(k, v)
	}, Promise.resolve(makeTree<number, number>()))

	//Try walking forward
	var iter = await u.begin()
	var c = iter.clone()
	t.ok(iter.hasNext, "must have next at beginneing")
	t.ok(!iter.hasPrev, "must not have predecessor")
	for (var i = 0; i < 20; ++i) {
		var v = await u.at(i)
		await compareIterators(iter, v, t)
		t.equals(await iter.index(), i)
		await iter.next()
	}
	t.ok(!iter.valid, "must be eof iterator")

	//Check if the clone worked
	await compareIterators(c, await u.begin(), t)

	//Try walking backward
	var iter = await u.end()
	t.ok(!iter.hasNext, "must not have next")
	t.ok(iter.hasPrev, "must have predecessor")
	for (var i = 19; i >= 0; --i) {
		var v = await u.at(i)
		await compareIterators(iter, v, t)
		t.equals(await iter.index(), i)
		await iter.prev()
	}
	t.ok(!iter.valid, "must be eof iterator")

	t.end()
})

tape("remove()", async function(t) {
	var sz = [1, 2, 10, 20, 23, 31, 32, 33]
	for (var n = 0; n < sz.length; ++n) {
		var c = sz[n]
		var u = await iota(c).reduce(async function(u, k, v) {
			return (await u).insert(k, v)
		}, Promise.resolve(makeTree<number, number>()))
		for (var i = 0; i < c; ++i) {
			await checkTree(await u.remove(i), t)
		}
	}

	t.end()
})

tape("update()", async function(t) {
	var arr = [0, 1, 2, 3, 4, 5, 6]
	var u = await arr.reduce(async function(u, k, v) {
		return (await u).insert(k, v)
	}, Promise.resolve(makeTree<number, number>()))
	for (var iter = await u.begin(); iter.hasNext; await iter.next()) {
		var p = iter.value
		var updated = await iter.update(1000)
		t.equals(iter.value, iter.key, "ensure no mutation")
		t.equals(
			(await updated.find(iter.key as number)).value,
			1000,
			"ensure update applied"
		)
		await checkTree(updated, t)
		await checkTree(u, t)
	}
	t.end()
})

tape("keys and values", async function(t) {
	var original_keys = [
		"potato",
		"sock",
		"foot",
		"apple",
		"newspaper",
		"gameboy",
	]
	var original_values: Array<any> = [42, 10, false, "!!!", {}, null]

	var u = makeTree<string, any>()
	for (var i = 0; i < original_keys.length; ++i) {
		u = await u.insert(original_keys[i], original_values[i])
	}

	var zipped = iota(6).map(function(i) {
		return [original_keys[i], original_values[i]]
	})

	zipped.sort(function(a, b) {
		if (a[0] < b[0]) {
			return -1
		}
		if (a[0] > b[0]) {
			return 1
		}
		return 0
	})

	var keys = zipped.map(function(v) {
		return v[0]
	})
	var values = zipped.map(function(v) {
		return v[1]
	})

	t.same(await u.keys(), keys)
	t.same(await u.values(), values)

	t.end()
})

tape("searching", async function(t) {
	var arr = [0, 1, 1, 1, 1, 2, 3, 4, 5, 6, 6]
	var u = await arr.reduce(async function(u, k, v) {
		return (await u).insert(k, v)
	}, Promise.resolve(makeTree<number, number>()))

	for (var i = 0; i < arr.length; ++i) {
		if (arr[i] !== arr[i - 1] && arr[i] !== arr[i + 1]) {
			t.equals(await u.get(arr[i]), i, "get " + arr[i])
		}
	}
	t.equals(await u.get(-1), undefined, "get missing")

	t.equals(await (await u.ge(3)).index(), 6, "ge simple")
	t.equals(await (await u.ge(0.9)).index(), 1, "ge run start")
	t.equals(await (await u.ge(1)).index(), 1, "ge run mid")
	t.equals(await (await u.ge(1.1)).index(), 5, "ge run end")
	t.equals(await (await u.ge(0)).index(), 0, "ge first")
	t.equals(await (await u.ge(6)).index(), 9, "ge last")
	t.equals((await u.ge(100)).valid, false, "ge big")
	t.equals(await (await u.ge(-1)).index(), 0, "ge small")

	t.equals(await (await u.gt(3)).index(), 7, "gt simple")
	t.equals(await (await u.gt(0.9)).index(), 1, "gt run start")
	t.equals(await (await u.gt(1)).index(), 5, "gt run mid")
	t.equals(await (await u.gt(1.1)).index(), 5, "gt run end")
	t.equals(await (await u.gt(0)).index(), 1, "gt first")
	t.equals((await u.gt(6)).valid, false, "gt last")
	t.equals((await u.gt(100)).valid, false, "gt big")
	t.equals(await (await u.gt(-1)).index(), 0, "ge small")

	t.equals(await (await u.le(3)).index(), 6, "le simple")
	t.equals(await (await u.le(0.9)).index(), 0, "le run start")
	t.equals(await (await u.le(1)).index(), 4, "le run mid")
	t.equals(await (await u.le(1.1)).index(), 4, "le run end")
	t.equals(await (await u.le(0)).index(), 0, "le first")
	t.equals(await (await u.le(6)).index(), 10, "le last")
	t.equals(await (await u.le(100)).index(), 10, "le big")
	t.equals((await u.le(-1)).valid, false, "le small")

	t.equals(await (await u.lt(3)).index(), 5, "lt simple")
	t.equals(await (await u.lt(0.9)).index(), 0, "lt run start")
	t.equals(await (await u.lt(1)).index(), 0, "lt run mid")
	t.equals(await (await u.lt(1.1)).index(), 4, "lt run end")
	t.equals((await u.lt(0)).valid, false, "lt first")
	t.equals(await (await u.lt(6)).index(), 8, "lt last")
	t.equals(await (await u.lt(100)).index(), 10, "lt big")
	t.equals((await u.lt(-1)).valid, false, "lt small")

	t.equals((await u.find(-1)).valid, false, "find missing small")
	t.equals((await u.find(10000)).valid, false, "find missing big")
	t.equals(await (await u.find(3)).index(), 6, "find simple")
	t.ok((await (await u.find(1)).index()) > 0, "find repeat")
	t.ok((await (await u.find(1)).index()) < 5, "find repeat")

	for (var i = 0; i < arr.length; ++i) {
		t.equals((await u.find(arr[i])).key, arr[i], "find " + i)
	}

	for (var i = 0; i < arr.length; ++i) {
		t.equals((await u.at(i)).key, arr[i], "at " + i)
	}
	t.equals((await u.at(-1)).valid, false, "at missing small")
	t.equals((await u.at(1000)).valid, false, "at missing big")

	t.end()
})

tape("slab-sequence", async function(t) {
	var tree = makeTree<number, number>()

	tree = await tree.insert(0, 0)
	await checkTree(tree, t)
	t.same(await tree.values(), [0])

	tree = await tree.insert(1, 1)
	await checkTree(tree, t)
	t.same(await tree.values(), [0, 1])

	tree = await tree.insert(0.5, 2)
	await checkTree(tree, t)
	t.same(await tree.values(), [0, 2, 1])

	tree = await tree.insert(0.25, 3)
	await checkTree(tree, t)
	t.same(await tree.values(), [0, 3, 2, 1])

	tree = await tree.remove(0)
	await checkTree(tree, t)
	t.same(await tree.values(), [3, 2, 1])

	tree = await tree.insert(0.375, 4)
	await checkTree(tree, t)
	t.same(await tree.values(), [3, 4, 2, 1])

	tree = await tree.remove(1)
	await checkTree(tree, t)
	t.same(await tree.values(), [3, 4, 2])

	tree = await tree.remove(0.5)
	await checkTree(tree, t)
	t.same(await tree.values(), [3, 4])

	tree = await tree.remove(0.375)
	await checkTree(tree, t)
	t.same(await tree.values(), [3])

	tree = await tree.remove(0.25)
	await checkTree(tree, t)
	t.same(await tree.values(), [])

	t.end()
})

tape("slab-sequence-2", async function(t) {
	var u = makeTree<number, number>()

	u = await u.insert(12, 22)
	u = await u.insert(11, 3)
	u = await u.insert(10, 28)
	u = await u.insert(13, 16)
	u = await u.insert(9, 9)
	u = await u.insert(14, 10)
	u = await u.insert(8, 15)
	u = await u.insert(15, 29)
	u = await u.insert(16, 4)
	u = await u.insert(7, 21)
	u = await u.insert(17, 23)
	u = await u.insert(6, 2)
	u = await u.insert(5, 27)
	u = await u.insert(18, 17)
	u = await u.insert(4, 8)
	u = await u.insert(31, 11)
	u = await u.insert(30, 30)
	u = await u.insert(29, 5)
	u = await u.insert(28, 24)
	u = await u.insert(27, 18)
	u = await u.insert(26, 12)
	u = await u.insert(25, 31)
	u = await u.insert(24, 6)
	u = await u.insert(23, 25)
	u = await u.insert(19, 7)
	u = await u.insert(20, 13)
	u = await u.insert(1, 20)
	u = await u.insert(0, 14)
	u = await u.insert(22, 0)
	u = await u.insert(2, 1)
	u = await u.insert(3, 26)
	u = await u.insert(21, 19)
	u = await u.remove(18)
	u = await u.remove(17)
	u = await u.remove(16)
	u = await u.remove(15)
	u = await u.remove(14)
	u = await u.remove(13)
	u = await u.remove(12)
	u = await u.remove(6)
	u = await u.remove(7)
	u = await u.remove(8)
	u = await u.remove(11)
	u = await u.remove(4)
	u = await u.remove(9)
	u = await u.remove(10)
	u = await u.remove(5)
	u = await u.remove(31)
	u = await u.remove(0)
	u = await u.remove(30)
	u = await u.remove(29)
	u = await u.remove(1)
	u = await u.remove(28)
	u = await u.remove(2)
	u = await u.remove(3)
	u = await u.remove(27)
	u = await u.remove(19)
	u = await u.remove(26)
	u = await u.remove(20)
	u = await u.remove(25)
	u = await u.remove(24)
	u = await u.remove(21)
	u = await u.remove(23)
	u = await u.remove(22)

	t.end()
})
