declare module "*chars.csv" {
	type CharsFile = import("./types").CharsFile;
	const CharsFile: CharsFile;
	export default CharsFile;
}

declare module "*words.csv" {
	type WordsFile = import("./types").WordsFile;
	const WordsFile: WordsFile;
	export default WordsFile;
}

declare module "vega-statistics" {
	export function setRandom(randFunc: () => number): void;
	export function sampleNormal(mean?: number, stdev?: number): number;
}

declare module "lamejs" {
	export class Mp3Encoder {
		constructor(channels: number, sampleRate: number, kbps: number);
		encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array;
		flush(): Uint8Array;
	}
}
