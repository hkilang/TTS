import { eastAsianWidth } from "eastasianwidth";

import Chars from "./res/chars.csv";
import HakkaWords from "./res/hakka_words.csv";
import WaitauWords from "./res/waitau_words.csv";
import Resource from "./Resource";

import type { Language, PronNoteArray } from "./types";

const resources: Record<Language, Resource> = {
	waitau: new Resource(WaitauWords),
	hakka: new Resource(HakkaWords),
};
for (const { char, waitau, hakka, notes } of Chars) {
	if (waitau) resources.waitau.set(char, new Map([[waitau, notes]]));
	if (hakka) resources.hakka.set(char, new Map([[hakka, notes]]));
}

function segment(text: string) {
	const result: string[] = [];
	let curr = "";
	for (const c of text) {
		if (c.trim()) {
			const width = eastAsianWidth(c);
			if (width === "W" || width === "F") {
				if (curr) result.push(curr);
				result.push(c);
				curr = "";
			}
			else {
				curr += c;
			}
		}
		else {
			if (curr) result.push(curr);
			curr = "";
		}
	}
	if (curr) result.push(curr);
	return result;
}

export default function parse(language: Language, text: string): [string, PronNoteArray][] {
	return resources[language].get(segment(text)).map(([char, pronToNoteMap]) => [char, Array.from(pronToNoteMap)]);
}

const normalizedPunctuations: Record<string, string | undefined> = {
	"!": "!",
	'"': "'",
	"$": ".",
	"'": "'",
	"(": "'",
	")": "'",
	",": ",",
	"-": "-",
	".": ".",
	"...": "…",
	"......": "…",
	":": ",",
	";": ",",
	"?": "?",
	"[": "'",
	"]": "'",
	"~": "-",
	"·": ",",
	"—": "-",
	"——": "-",
	"‘": "'",
	"’": "'",
	"“": "'",
	"”": "'",
	"…": "…",
	"……": "…",
	"⋯": "…",
	"⋯⋯": "…",
	"、": ",",
	"。": ".",
	"《": "'",
	"》": "'",
	"「": "'",
	"」": "'",
	"【": "'",
	"】": "'",
};

export function normalizePauses(char: string) {
	return normalizedPunctuations[char.normalize("NFKC")] || ".";
}
