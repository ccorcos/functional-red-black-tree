// TODO: use UUID!
export function randomId() {
	return Math.round(Math.random() * 1e10).toString()
}

export function compare<K>(a: K, b: K) {
	if (a < b) {
		return -1
	}
	if (a > b) {
		return 1
	}
	return 0
}
