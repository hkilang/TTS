import { useEffect, useState } from "react";

import { Client } from "@gradio/client";

import type { Language } from "./types";

let waitau: Client | undefined;
let hakka: Client | undefined;

async function getClient(language: Language) {
	switch (language) {
		case "waitau":
			return waitau ||= await Client.connect("Naozumi0512/WR");
		case "hakka":
			return hakka ||= await Client.connect("Naozumi0512/Hakka");
	}
}

const audioCache: Record<Language, Map<string, string>> = { waitau: new Map(), hakka: new Map() };

export function useTTS(language: Language, text: string) {
	const [url, setUrl] = useState<string | undefined>();

	useEffect(() => {
		async function fetchAudio() {
			let _url = audioCache[language].get(text);
			if (!_url) {
				_url = ((await (await getClient(language)).predict("/tts_fn", {
					text,
					reference_audio: null,
					style_text: null,
					x: null,
				})).data as { url: string }[] | undefined)?.[1]?.url;
				if (_url) audioCache[language].set(text, _url);
			}
			setUrl(_url);
		}
		setUrl(undefined);
		void fetchAudio();
	}, [text, language]);

	return url;
}
