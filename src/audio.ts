import { cachedFetch } from "./cache";
import { AUDIO_PATH_PREFIX } from "./consts";
import { ServerError } from "./errors";

import type { AudioComponent, AudioVersion, Language, Voice } from "./types";

type Offset = [start: number, end?: number];

const offsetCache = new Map<string, Map<string, Offset>>();

export async function getOffsetMap(version: AudioVersion, language: Language, voice: Voice, component: AudioComponent) {
	const path = `${version}/${language}/${voice}/${component}`;
	let offsetMap = offsetCache.get(path);
	if (offsetMap) return offsetMap;
	let response: Response;
	try {
		response = await cachedFetch(`${AUDIO_PATH_PREFIX}@${path}.csv`);
		if (!response.ok) throw new ServerError("Failed to load audio data", await response.text());
	}
	catch (error) {
		throw error instanceof ServerError ? error : new ServerError("Failed to load audio data: network or server error", undefined, { cause: error });
	}
	const iter = (await response.text())[Symbol.iterator]();
	// Skip header
	for (const char of iter) {
		if (char === "\n") break;
	}
	offsetMap = new Map();
	let key = "";
	let value = "";
	let prev: Offset | undefined;
	let isKey = true;
	for (const char of iter) {
		if (isKey) {
			if (char === ",") isKey = false;
			else key += char;
		}
		else {
			if (char === "\n") {
				prev?.push(+value);
				offsetMap.set(key, prev = [+value]);
				key = "";
				value = "";
				isKey = true;
			}
			else value += char;
		}
	}
	offsetCache.set(path, offsetMap);
	return offsetMap;
}
