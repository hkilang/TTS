export function fromLength<T>(length: number, callback: (index: number) => T) {
	return Array.from({ length }, (_, i) => callback(i));
}
