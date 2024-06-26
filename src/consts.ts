import type { Terminology } from "./types";

export const TERMINOLOGY: Record<Terminology, string> = {
	hakka: "客家話",
	waitau: "圍頭話",
	swc: "書面語",
	lit: "文言",
	col: "口語材料",
};

export const NO_AUTO_FILL = {
	autoComplete: "off",
	autoCorrect: "off",
	autoCapitalize: "off",
	spellCheck: "false",
} as const;
