# Benchmark Analysis

We should expect treedb reads to be log2(n) slower than leveldb.

> Math.log2(10_000)
13.287712379549449

> Math.log2(100_000)
16.609640474436812

> Math.log2(100_000_000_000)
36.541209043760986

```ts
iterations: 10_000

leveldb: sets { min: '0.016 ms', max: '22.536 ms', avg: '0.025 ms' }
leveldb: gets { min: '0.011 ms', max: '2.924 ms', avg: '0.019 ms' }

sqlite: sets { min: '0.429 ms', max: '12.129 ms', avg: '0.578 ms' }
sqlite: gets { min: '0.025 ms', max: '24.201 ms', avg: '0.038 ms' }

treedb: sets { min: '0.293 ms', max: '69.805 ms', avg: '0.818 ms' }
treedb: gets { min: '0.042 ms', max: '25.281 ms', avg: '0.276 ms' }
```

Observations:
- write: .025 * 13 = 0.325
	It looks like the overhead of Node.js and tree mangling is ~2.5x.
- read: .019 * 12 = 0.25
	Overhead of 1/3x

```ts
iterations: 100_000
```

To Do:
- try with a larger number of iterations.
- figure out why treedb crashes -- memory leak?

```sh
node --max_old_space_size=2048 -r ts-node/register

npm run build && node --inspect-brk build/bench/treedb.js

npm run build && node --trace-gc build/bench/treedb.js
```

https://stackoverflow.com/questions/33746184/what-is-meaning-of-node-js-trace-gc-output

Looks like it keeps up for a while...

```
[50675:0x103b26000]    12198 ms: Scavenge 23.5 (52.8) -> 9.2 (52.8) MB, 0.9 / 0.0 ms  (average mu = 0.990, current mu = 0.991) allocation failure
[50675:0x103b26000]    12258 ms: Scavenge 23.7 (52.8) -> 10.7 (52.8) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.991) allocation failure
[50675:0x103b26000]    12309 ms: Scavenge 25.3 (52.8) -> 12.2 (52.8) MB, 1.1 / 0.0 ms  (average mu = 0.990, current mu = 0.991) allocation failure
[50675:0x103b26000]    12365 ms: Scavenge 26.8 (52.8) -> 13.6 (52.8) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.991) allocation failure
[50675:0x103b26000]    12421 ms: Scavenge 28.2 (52.8) -> 15.1 (52.8) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.991) allocation failure
[50675:0x103b26000]    12476 ms: Scavenge 29.7 (52.8) -> 16.6 (52.8) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.991) allocation failure
[50675:0x103b26000]    12479 ms: Mark-sweep 16.6 (52.8) -> 7.2 (52.8) MB, 1.2 / 0.4 ms  (+ 2.4 ms in 4 steps since start of marking, biggest step 1.2 ms, walltime since start of marking 4 ms) (average mu = 0.990, current mu = 0.990) finalize incremental marking via task GC in old space requested
[50675:0x103b26000]    12539 ms: Scavenge 23.1 (52.8) -> 8.9 (52.8) MB, 0.9 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50675:0x103b26000]    12598 ms: Scavenge 23.6 (52.8) -> 10.6 (52.8) MB, 1.4 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50675:0x103b26000]    12654 ms: Scavenge 25.1 (52.8) -> 12.0 (52.8) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50675:0x103b26000]    12708 ms: Scavenge 26.6 (52.8) -> 13.5 (52.8) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50675:0x103b26000]    12759 ms: Scavenge 28.1 (52.8) -> 15.0 (52.8) MB, 0.9 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50675:0x103b26000]    12819 ms: Scavenge 29.5 (52.8) -> 16.4 (52.8) MB, 1.2 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50675:0x103b26000]    12873 ms: Mark-sweep 27.9 (52.8) -> 7.5 (51.8) MB, 1.9 / 0.6 ms  (+ 2.6 ms in 4 steps since start of marking, biggest step 1.0 ms, walltime since start of marking 5 ms) (average mu = 0.989, current mu = 0.989) finalize incremental marking via task GC in old space requested
```


```
[50675:0x103b26000]   101797 ms: Scavenge 23.5 (52.3) -> 9.2 (52.3) MB, 0.9 / 0.0 ms  (average mu = 0.989, current mu = 0.990) allocation failure
[50675:0x103b26000]   101856 ms: Scavenge 23.7 (52.3) -> 10.7 (52.3) MB, 1.1 / 0.0 ms  (average mu = 0.989, current mu = 0.990) allocation failure
[50675:0x103b26000]   101919 ms: Scavenge 25.3 (52.3) -> 12.2 (52.3) MB, 0.9 / 0.0 ms  (average mu = 0.989, current mu = 0.990) allocation failure
[50675:0x103b26000]   101980 ms: Scavenge 26.8 (52.3) -> 13.7 (52.3) MB, 1.0 / 0.0 ms  (average mu = 0.989, current mu = 0.990) allocation failure
[50675:0x103b26000]   102038 ms: Scavenge 28.3 (52.3) -> 15.2 (52.3) MB, 2.1 / 0.0 ms  (average mu = 0.989, current mu = 0.990) allocation failure
[50675:0x103b26000]   102111 ms: Scavenge 29.7 (52.3) -> 16.6 (52.3) MB, 1.3 / 0.0 ms  (average mu = 0.989, current mu = 0.990) allocation failure
[50675:0x103b26000]   102116 ms: Mark-sweep 16.7 (52.3) -> 7.2 (52.3) MB, 1.9 / 0.9 ms  (+ 2.5 ms in 4 steps since start of marking, biggest step 1.4 ms, walltime since start of marking 5 ms) (average mu = 0.989, current mu = 0.989) finalize incremental marking via task GC in old space requested
[50675:0x103b26000]   102200 ms: Scavenge 23.5 (52.3) -> 9.3 (52.3) MB, 1.4 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50675:0x103b26000]   102266 ms: Scavenge 23.7 (52.3) -> 10.7 (52.3) MB, 1.5 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50675:0x103b26000]   102341 ms: Scavenge 25.3 (52.3) -> 12.2 (52.3) MB, 2.6 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50675:0x103b26000]   102420 ms: Scavenge 26.8 (52.3) -> 13.7 (52.3) MB, 1.8 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50675:0x103b26000]   102485 ms: Scavenge 28.2 (52.3) -> 15.2 (52.3) MB, 2.1 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50675:0x103b26000]   102555 ms: Scavenge 29.7 (52.3) -> 16.7 (52.3) MB, 1.6 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50675:0x103b26000]   102560 ms: Mark-sweep 16.7 (52.3) -> 7.3 (52.3) MB, 1.5 / 0.5 ms  (+ 2.5 ms in 4 steps since start of marking, biggest step 1.2 ms, walltime since start of marking 4 ms) (average mu = 0.990, current mu = 0.991) finalize incremental marking via task GC in old space requested
```


At some point, it's all over... Not every time though.

```
[50801:0x103b26000]    65667 ms: Scavenge 21.7 (49.2) -> 7.5 (49.2) MB, 0.9 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50801:0x103b26000]    65734 ms: Scavenge 22.2 (49.2) -> 9.2 (49.2) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50801:0x103b26000]    65795 ms: Scavenge 23.8 (49.2) -> 10.7 (49.2) MB, 1.0 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50801:0x103b26000]    65853 ms: Scavenge 25.3 (49.2) -> 12.2 (49.2) MB, 1.2 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50801:0x103b26000]    65910 ms: Scavenge 26.7 (49.2) -> 13.7 (49.2) MB, 1.2 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50801:0x103b26000]    65966 ms: Scavenge 28.2 (49.2) -> 15.1 (49.7) MB, 1.3 / 0.0 ms  (average mu = 0.990, current mu = 0.990) allocation failure
[50801:0x103b26000]    65971 ms: Mark-sweep 15.1 (49.7) -> 5.6 (49.2) MB, 1.9 / 0.9 ms  (+ 2.1 ms in 4 steps since start of marking, biggest step 1.1 ms, walltime since start of marking 4 ms) (average mu = 0.989, current mu = 0.989) finalize incremental marking via task GC in old space requested
[50801:0x103b26000]    66036 ms: Scavenge 21.7 (49.2) -> 7.5 (49.2) MB, 1.2 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66094 ms: Scavenge 22.2 (49.2) -> 9.2 (49.2) MB, 1.3 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66149 ms: Scavenge 23.8 (49.2) -> 10.7 (49.2) MB, 1.0 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66208 ms: Scavenge 25.2 (49.2) -> 12.2 (49.2) MB, 1.0 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66266 ms: Scavenge 26.7 (49.2) -> 13.7 (49.2) MB, 1.0 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66325 ms: Scavenge 28.2 (49.2) -> 15.1 (49.7) MB, 2.4 / 0.1 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66330 ms: Mark-sweep 15.2 (49.7) -> 5.7 (49.2) MB, 1.4 / 0.5 ms  (+ 2.7 ms in 4 steps since start of marking, biggest step 1.2 ms, walltime since start of marking 5 ms) (average mu = 0.989, current mu = 0.989) finalize incremental marking via task GC in old space requested
[50801:0x103b26000]    66400 ms: Scavenge 21.7 (49.2) -> 7.5 (49.2) MB, 0.7 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66457 ms: Scavenge 22.2 (49.2) -> 9.2 (49.2) MB, 1.0 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66512 ms: Scavenge 23.8 (49.2) -> 10.7 (49.2) MB, 1.1 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66568 ms: Scavenge 25.3 (49.2) -> 12.2 (49.2) MB, 1.1 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66591 ms: Scavenge 26.7 (49.2) -> 13.4 (49.2) MB, 1.2 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66599 ms: Scavenge 28.0 (49.2) -> 14.6 (49.2) MB, 1.2 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66612 ms: Scavenge 29.0 (49.2) -> 15.6 (50.7) MB, 3.1 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66628 ms: Scavenge 31.4 (51.2) -> 17.8 (54.2) MB, 3.3 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66640 ms: Scavenge 33.3 (54.2) -> 19.4 (55.7) MB, 2.3 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66654 ms: Scavenge 34.4 (55.7) -> 20.6 (56.2) MB, 1.6 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66665 ms: Scavenge 36.8 (57.8) -> 23.0 (58.8) MB, 1.3 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66678 ms: Scavenge 38.0 (58.8) -> 23.8 (59.8) MB, 2.9 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66690 ms: Scavenge 38.8 (59.8) -> 25.3 (60.8) MB, 1.3 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66702 ms: Scavenge 41.2 (62.3) -> 27.5 (63.8) MB, 1.6 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66716 ms: Scavenge 42.6 (63.8) -> 28.4 (63.8) MB, 1.5 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66727 ms: Scavenge 43.4 (63.8) -> 30.0 (65.8) MB, 1.4 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66736 ms: Scavenge 44.3 (65.8) -> 30.8 (66.8) MB, 1.5 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66764 ms: Scavenge 48.9 (69.8) -> 34.7 (71.3) MB, 1.8 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66785 ms: Scavenge 49.7 (71.3) -> 35.6 (71.8) MB, 3.4 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66802 ms: Scavenge 50.6 (71.8) -> 36.4 (72.3) MB, 1.8 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66825 ms: Scavenge 52.4 (73.3) -> 38.3 (74.3) MB, 1.7 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66848 ms: Scavenge 57.5 (78.5) -> 43.4 (79.5) MB, 3.8 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66866 ms: Scavenge 58.4 (79.5) -> 44.2 (80.5) MB, 1.8 / 0.0 ms  (average mu = 0.989, current mu = 0.989) allocation failure
[50801:0x103b26000]    66869 ms: Mark-sweep 44.2 (80.5) -> 32.5 (79.3) MB, 2.5 / 0.8 ms  (+ 5.1 ms in 30 steps since start of marking, biggest step 1.0 ms, walltime since start of marking 133 ms) (average mu = 0.988, current mu = 0.987) finalize incremental marking via stack guard GC in old space requested
[50801:0x103b26000]    66886 ms: Scavenge 48.4 (79.3) -> 33.6 (79.3) MB, 2.3 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66899 ms: Scavenge 48.5 (79.3) -> 34.4 (79.3) MB, 1.3 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66909 ms: Scavenge 49.4 (79.3) -> 35.3 (79.3) MB, 1.3 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66924 ms: Scavenge 50.3 (79.3) -> 36.2 (81.3) MB, 3.5 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66935 ms: Scavenge 51.2 (81.3) -> 37.0 (83.8) MB, 1.3 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66946 ms: Scavenge 52.0 (83.8) -> 37.9 (86.3) MB, 1.9 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66964 ms: Scavenge 52.9 (86.3) -> 38.8 (88.8) MB, 1.6 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66984 ms: Scavenge 61.5 (96.6) -> 47.4 (99.1) MB, 1.6 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    66999 ms: Scavenge 62.4 (99.1) -> 48.3 (101.6) MB, 1.4 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67011 ms: Scavenge 63.3 (101.6) -> 49.2 (104.1) MB, 1.7 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67022 ms: Scavenge 64.2 (104.1) -> 50.0 (106.6) MB, 1.7 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67034 ms: Scavenge 65.0 (106.6) -> 50.9 (109.1) MB, 1.4 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67047 ms: Scavenge 65.9 (109.1) -> 51.8 (111.6) MB, 2.2 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67063 ms: Scavenge 66.8 (111.6) -> 52.6 (114.1) MB, 1.9 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67075 ms: Scavenge 67.6 (114.1) -> 53.5 (116.6) MB, 1.6 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67098 ms: Scavenge 74.5 (122.6) -> 60.4 (125.1) MB, 1.7 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67109 ms: Scavenge 75.4 (125.1) -> 61.3 (127.6) MB, 1.8 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67120 ms: Scavenge 76.3 (127.6) -> 62.1 (130.1) MB, 1.7 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67135 ms: Scavenge 77.1 (130.1) -> 63.0 (132.6) MB, 1.5 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67148 ms: Scavenge 80.6 (135.2) -> 66.5 (137.7) MB, 1.9 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67160 ms: Scavenge 81.5 (137.7) -> 67.4 (140.2) MB, 2.1 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67171 ms: Scavenge 82.4 (140.2) -> 68.3 (142.7) MB, 2.4 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67195 ms: Scavenge 85.3 (144.7) -> 71.1 (147.2) MB, 4.5 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67208 ms: Scavenge 86.1 (147.2) -> 72.0 (149.7) MB, 1.8 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67219 ms: Scavenge 87.0 (149.7) -> 72.9 (152.2) MB, 1.7 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67234 ms: Scavenge 87.9 (152.2) -> 73.8 (154.7) MB, 1.6 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67250 ms: Scavenge 88.8 (154.7) -> 74.6 (154.7) MB, 3.9 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67270 ms: Scavenge 89.6 (154.7) -> 75.5 (155.2) MB, 2.4 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67296 ms: Scavenge 90.5 (155.2) -> 76.4 (155.2) MB, 10.7 / 0.0 ms  (average mu = 0.988, current mu = 0.987) allocation failure
[50801:0x103b26000]    67334 ms: Mark-sweep 87.5 (155.2) -> 68.3 (117.9) MB, 7.7 / 0.0 ms  (+ 19.6 ms in 172 steps since start of marking, biggest step 0.6 ms, walltime since start of marking 100 ms) (average mu = 0.964, current mu = 0.942) finalize incremental marking via stack guard GC in old space requested
```



Testing with manual gc using `--expose-gc` flag

```
global.gc()
```

https://www.npmjs.com/package/v8-profiler


- [ ] visits are recursive and we don't have tail-call optimization


It even blows up with manual GC

```
[51030:0x103b26000]   291157 ms: Mark-sweep 5.3 (40.7) -> 4.9 (40.7) MB, 1.9 / 0.0 ms  (average mu = 0.599, current mu = 0.639) testing GC in old space requested
[51030:0x103b26000]   291162 ms: Mark-sweep 5.3 (40.7) -> 5.0 (40.7) MB, 2.2 / 0.0 ms  (average mu = 0.602, current mu = 0.605) testing GC in old space requested
[51030:0x103b26000]   291167 ms: Mark-sweep 5.3 (40.7) -> 4.9 (40.7) MB, 2.1 / 0.0 ms  (average mu = 0.582, current mu = 0.560) testing GC in old space requested
[51030:0x103b26000]   291174 ms: Mark-sweep 5.4 (40.7) -> 4.9 (40.7) MB, 3.9 / 0.0 ms  (average mu = 0.503, current mu = 0.446) testing GC in old space requested
[51030:0x103b26000]   291202 ms: Scavenge 20.8 (40.7) -> 6.3 (40.7) MB, 1.2 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291225 ms: Scavenge 20.9 (40.7) -> 7.5 (41.2) MB, 1.2 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291235 ms: Scavenge 21.9 (41.2) -> 8.6 (43.7) MB, 1.5 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291248 ms: Scavenge 24.1 (43.7) -> 10.5 (45.2) MB, 2.2 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291259 ms: Scavenge 26.0 (45.2) -> 12.0 (47.2) MB, 1.3 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291268 ms: Scavenge 27.1 (47.2) -> 13.3 (48.2) MB, 1.2 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291282 ms: Scavenge 29.4 (49.8) -> 15.7 (50.8) MB, 2.0 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291293 ms: Scavenge 30.6 (50.8) -> 17.2 (51.3) MB, 1.2 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291304 ms: Scavenge 33.0 (52.8) -> 19.3 (54.8) MB, 1.7 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291316 ms: Scavenge 34.8 (55.3) -> 20.7 (55.8) MB, 1.7 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291326 ms: Scavenge 35.7 (55.8) -> 21.5 (56.3) MB, 1.1 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291335 ms: Scavenge 36.5 (56.3) -> 23.1 (57.8) MB, 1.2 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291347 ms: Scavenge 37.4 (57.8) -> 23.9 (58.8) MB, 2.4 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291362 ms: Scavenge 42.0 (61.8) -> 27.8 (62.8) MB, 1.5 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291375 ms: Scavenge 42.8 (62.8) -> 28.7 (64.3) MB, 1.6 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291387 ms: Scavenge 43.7 (64.3) -> 29.6 (64.8) MB, 1.4 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291404 ms: Scavenge 44.6 (64.8) -> 30.5 (65.8) MB, 2.7 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291428 ms: Scavenge 49.6 (70.0) -> 35.5 (71.0) MB, 2.3 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291445 ms: Scavenge 50.5 (71.0) -> 36.4 (71.5) MB, 1.8 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291461 ms: Scavenge 51.4 (71.5) -> 37.3 (73.0) MB, 1.8 / 0.0 ms  (average mu = 0.503, current mu = 0.446) allocation failure
[51030:0x103b26000]   291463 ms: Mark-sweep 37.4 (73.0) -> 31.7 (72.0) MB, 1.3 / 0.0 ms  (+ 3.0 ms in 16 steps since start of marking, biggest step 1.1 ms, walltime since start of marking 76 ms) (average mu = 0.976, current mu = 0.986) finalize incremental marking via stack guard GC in old space requested
[51030:0x103b26000]   291474 ms: Scavenge 47.5 (72.0) -> 32.7 (72.0) MB, 1.5 / 0.0 ms  (average mu = 0.976, current mu = 0.986) allocation failure
[51030:0x103b26000]   291484 ms: Scavenge 47.6 (72.0) -> 33.5 (72.5) MB, 1.3 / 0.0 ms  (average mu = 0.976, current mu = 0.986) allocation failure
[51030:0x103b26000]   291496 ms: Scavenge 49.5 (73.5) -> 35.4 (76.0) MB, 1.3 / 0.0 ms  (average mu = 0.976, current mu = 0.986) allocation failure
[51030:0x103b26000]   291508 ms: Scavenge 50.4 (76.0) -> 36.3 (78.5) MB, 2.1 / 0.0 ms  (average mu = 0.976, current mu = 0.986) allocation failure
[51030:0x103b26000]   291520 ms: Scavenge 51.3 (78.5) -> 37.1 (81.0) MB, 1.5 / 0.0 ms  (average mu = 0.976, current mu = 0.986) allocation failure
```

- [ ] try memwatch https://www.npmjs.com/package/node-memwatch

Could try assembly script with better memory management features https://docs.assemblyscript.org/d

- try random things to make the GC happier.