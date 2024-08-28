import { useEffect, useReducer, useState } from "react";

import { ALL_HAKKA_TONE_MODES, ALL_INFERENCE_MODES, ALL_LANGUAGES, ALL_VOICES, DOWNLOAD_STATUS_PRIORITY } from "./consts";

import type { ActualDownloadStatus, DownloadState, HakkaToneMode, InferenceMode, Language, OfflineInferenceMode, Voice } from "./types";

const currentDownloadStates = new Map<OfflineInferenceMode, Map<string, ActualDownloadStatus>>();

function downloadStateReducer(inferenceModeToStatus: Map<OfflineInferenceMode, ActualDownloadStatus>, { inferenceMode, language, voice, status }: DownloadState) {
	let downloadStates = currentDownloadStates.get(inferenceMode);
	if (!downloadStates) currentDownloadStates.set(inferenceMode, downloadStates = new Map<string, ActualDownloadStatus>());
	downloadStates.set(`${language}_${voice}`, status);
	const allStatus = new Set(downloadStates.values());
	const newStatus = new Map(inferenceModeToStatus);
	newStatus.set(inferenceMode, DOWNLOAD_STATUS_PRIORITY.find(status => allStatus.has(status)) || "latest");
	return newStatus;
}

export function useDownloadState() {
	return useReducer(downloadStateReducer, new Map<OfflineInferenceMode, ActualDownloadStatus>([["offline", "latest"], ["lightweight", "latest"]]));
}

export function useQueryOptions() {
	const [queryOptions, setQueryOptions] = useState(() => {
		const searchParams = new URLSearchParams(location.search);
		function parseOption<T>(key: string, allValues: readonly T[]) {
			return ([searchParams.get(key), localStorage.getItem(key)] as T[]).find(value => allValues.includes(value)) || allValues[0];
		}
		return {
			language: parseOption("language", ALL_LANGUAGES),
			voice: parseOption("voice", ALL_VOICES),
			mode: ALL_INFERENCE_MODES.find(mode => searchParams.has(mode)) || parseOption("mode", ALL_INFERENCE_MODES),
			speed: +([searchParams.get("speed"), localStorage.getItem("speed")].find((speed): speed is string => !!speed && +speed >= 0.5 && +speed <= 2) || "1"),
			hakka_tones: parseOption("hakka_tones", ALL_HAKKA_TONE_MODES),
		};
	});
	useEffect(() => {
		history.replaceState(null, document.title, `?${String(new URLSearchParams(queryOptions as unknown as Record<string, string>))}`); // This is fine: number is automatically coalesced to string
		Object.assign(localStorage, queryOptions);
	}, [queryOptions]);
	const { language, voice, mode: inferenceMode, speed: voiceSpeed, hakka_tones: hakkaToneMode } = queryOptions;
	return {
		language,
		voice,
		inferenceMode,
		voiceSpeed,
		hakkaToneMode,
		setLanguage: (language: Language) => setQueryOptions(oldOptions => ({ ...oldOptions, language })),
		setVoice: (voice: Voice) => setQueryOptions(oldOptions => ({ ...oldOptions, voice })),
		setInferenceMode: (inferenceMode: InferenceMode) => setQueryOptions(oldOptions => ({ ...oldOptions, mode: inferenceMode })),
		setVoiceSpeed: (voiceSpeed: number) => setQueryOptions(oldOptions => ({ ...oldOptions, speed: voiceSpeed })),
		setHakkaToneMode: (hakkaToneMode: HakkaToneMode) => setQueryOptions(oldOptions => ({ ...oldOptions, hakka_tones: hakkaToneMode })),
	};
}