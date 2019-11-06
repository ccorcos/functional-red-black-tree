# Benchmark Analysis

We should expect treedb reads to be log2(n) slower than leveldb.

> Math.log2(100_000)
16.609640474436812

> Math.log2(100_000_000_000)
36.541209043760986

iterations: 100_000

leveldb: sets { min: '0.016 ms', max: '22.536 ms', avg: '0.025 ms' }
leveldb: gets { min: '0.011 ms', max: '2.924 ms', avg: '0.019 ms' }

sqlite: sets { min: '0.429 ms', max: '12.129 ms', avg: '0.578 ms' }
sqlite: gets { min: '0.025 ms', max: '24.201 ms', avg: '0.038 ms' }

treedb: sets { min: '0.293 ms', max: '69.805 ms', avg: '0.818 ms' }
treedb: gets { min: '0.042 ms', max: '25.281 ms', avg: '0.276 ms' }

Observations:
- write: .025 * 16 = 0.4
	It looks like the overhead of Node.js and tree mangling is ~2x.
- read: .019 * 16 = 0.3
	Pretty much as we might expect.

To Do:
- try with a larger number of iterations.