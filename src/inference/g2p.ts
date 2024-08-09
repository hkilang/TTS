// dprint-ignore
const waitauSymbolToID: Record<string, number> = {
    "b": 11, "p": 50, "m": 39, "f": 24, "d": 13, "t": 52, "n": 40, "l": 38,
    "z": 61, "c": 12, "s": 51, "y": 60, "g": 25, "k": 36, "ng": 41, "h": 27,
    "gw": 26, "kw": 37, "w": 59, "": 1, // zero initial

    "a": 2, "ai": 3, "au": 10, "am": 5, "an": 6, "ang": 7, "ap": 8, "at": 9, "ak": 4,
    "ä": 62, "äi": 63, "äu": 71, "äm": 66, "än": 67, "äng": 68, "äp": 69, "ät": 70, "äk": 65, 
    "äing": 64, // final specific to Ping Shan
    "æ": 72, "æng": 75, "æk": 74,
    "æing": 73, // final specific to Ping Shan
    "e": 14, "ei": 15, "eu": 23, "em": 17, "en": 18, "eng": 19, "ep": 21, "et": 22, "ek": 16, 
    "i": 28, "iu": 35, "im": 30, "in": 31, "ing": 32, "ip": 33, "it": 34, "ik": 29, 
    "o": 42, "oi": 43, "ou": 49, "on": 46, "ong": 47, "ot": 48, "ok": 45, 
    "oing": 44, // final specific to Ping Shan
    "ö": 76, "öi": 77, "ön": 79, "öng": 80, "öt": 81, "ök": 78,
    "u": 53, "ui": 54, "un": 56, "ung": 57, "ut": 58, "uk": 55,
    "ü": 82, "ün": 84, "üng": 85, "üt": 86, "ük": 83,

    ".": 91, ",": 90, "!": 87, "?": 88, "…": 89, "'": 92, "-": 93,
};

// dprint-ignore
const hakkaSymbolToID: Record<string, number> = {
    "b": 20, "p": 63, "m": 50, "f": 35, "v": 75, "d": 22, "t": 68, "l": 49,
    "z": 81, "c": 21, "s": 64, "y": 77, "g": 36, "k": 47, "ng": 52, "h": 38, "": 1, // zero initial

	"∅": 91, // zero medial

    "a": 2, "ai": 12, "au": 19, "am": 14, "an": 15, "ang": 16, "ap": 17, "at": 18, "ak": 13,
    "e": 23, "ei": 24, "eu": 34, "em": 26, "en": 27, "eng": 28, "ep": 32, "et": 33, "ek": 25,
    "i": 39, "iu": 46, "im": 41, "in": 42, "ing": 43, "ip": 44, "it": 45, "ik": 40,
    "o": 53, "oi": 57, "ou": 62, "on": 59, "ong": 60, "ot": 61, "ok": 58,
    "u": 69, "ui": 70, "un": 72, "ung": 73, "ut": 74, "uk": 71,

    ".": 86, ",": 85, "!": 82, "?": 83, "…": 84, "'": 87, "-": 88,
};

export function waitau(syllables: readonly string[]) {
	const phones = [0, 0, 0];
	const tones = [0, 0, 0];

	for (const syllable of syllables) {
		if (syllable.length === 1) {
			phones.push(waitauSymbolToID[syllable], 0);
			tones.push(0, 0);
			continue;
		}

		const index = /[aeiouäöüæ]/.exec(syllable)?.index ?? 0;
		const initial = syllable.slice(0, index);
		const final = syllable.slice(index, -1);
		phones.push(waitauSymbolToID[initial], 0, waitauSymbolToID[final], 0);

		const tone = +syllable.slice(-1);
		tones.push(tone, 0, tone, 0);
	}

	phones.push(0, 0);
	tones.push(0, 0);

	return [phones, tones] as const;
}

export function hakka(syllables: readonly string[]) {
	const phones = [0, 0, 0];
	const tones = [0, 0, 0];

	for (const syllable of syllables) {
		if (syllable.length === 1) {
			phones.push(hakkaSymbolToID[syllable], 0);
			tones.push(0, 0);
			continue;
		}

		let index = /[aeiou]/.exec(syllable)?.index ?? 0;
		const initial = syllable.slice(0, index);
		const medial = syllable[index] === "i" && /[aeou]/.test(syllable[index + 1]) ? syllable[index++] : initial === "y" ? "i" : "∅";
		const final = syllable.slice(index, -1);
		phones.push(hakkaSymbolToID[initial], 0, hakkaSymbolToID[medial], 0, hakkaSymbolToID[final], 0);

		const tone = +syllable.slice(-1);
		tones.push(tone, 0, medial === "i" ? tone : 0, 0, tone, 0);
	}

	phones.push(0, 0);
	tones.push(0, 0);

	return [phones, tones] as const;
}
