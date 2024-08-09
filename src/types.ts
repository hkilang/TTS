import type { DBSchema } from "idb";

export type CharsFile = { [P in "char" | "waitau" | "hakka" | "notes"]: string }[];
export type WordsFile = { [P in "char" | "pron"]: string }[];

export type Language = "waitau" | "hakka";
export type Voice = "male" | "female";
export type Terminology = Language | Voice;

export type PronToNoteMap = Map<string, string>;
export type PronNoteArray = [string, string][];
export interface Sentence {
	language: Language;
	voice: Voice;
	sentence: [string, PronNoteArray][];
}

export type ModelComponent = "enc" | "emb" | "sdp" | "flow" | "dec";

export type ModelComponentToFile = Record<ModelComponent, ModelFile>;

export interface Actions {
	infer(language: Language, model: ModelComponentToFile, syllables: string[]): Promise<Float32Array>;
}

export type Version = string & { readonly brand: unique symbol };

export interface ModelFile {
	path: `${Language}/${Voice}/${ModelComponent}`;
	language: Language;
	voice: Voice;
	component: ModelComponent;
	version: Version;
	file: ArrayBuffer;
}

export interface TTSDB extends DBSchema {
	models: {
		key: ModelFile["path"];
		value: ModelFile;
		indexes: {
			language_voice: [Language, Voice];
		};
	};
}

export type ModelStatus =
	| "gathering_info"
	| "gather_failed"
	| "available_for_download"
	| "new_version_available"
	| "incomplete"
	| "downloading"
	| "download_failed"
	| "download_incomplete"
	| "cancelled_not_downloaded"
	| "cancelled_incomplete"
	| "save_failed"
	| "save_incomplete"
	| "latest";

interface NamedMessage<K extends keyof Actions> {
	name: K;
	args: Parameters<Actions[K]>;
	resolve: (value: ReturnType<Actions[K]>) => void;
	reject: (reason: unknown) => void;
}

export type Message = NamedMessage<keyof Actions>;
