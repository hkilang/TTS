import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ALL_HAKKA_TONE_MODES, ALL_INFERENCE_MODES, ALL_LANGUAGES_OR_UNDEFINED, ALL_VOICES, DOWNLOAD_STATUS_PRIORITY } from "./consts";

import type { ActualDownloadStatus, DownloadState, HakkaToneMode, InferenceMode, LanguageOrUndefined, OfflineInferenceMode, QueryOptions, Voice } from "./types";

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

export function useQueryOptions(): QueryOptions {
	const [queryOptions, setQueryOptions] = useState(() => {
		const searchParams = new URLSearchParams(location.search);
		history.replaceState(null, document.title, location.pathname); // Remove query
		function parseOption<T>(key: string, allValues: readonly T[]) {
			return ([searchParams.get(key), localStorage.getItem(key)] as T[]).find(value => allValues.includes(value)) || allValues[0];
		}
		return {
			language: parseOption("language", ALL_LANGUAGES_OR_UNDEFINED),
			voice: parseOption("voice", ALL_VOICES),
			mode: ALL_INFERENCE_MODES.find(mode => searchParams.has(mode)) || parseOption("mode", ALL_INFERENCE_MODES),
			speed: +([searchParams.get("speed"), localStorage.getItem("speed")].find((speed): speed is string => !!speed && +speed >= 0.5 && +speed <= 2) || "1"),
			hakka_tones: parseOption("hakka_tones", ALL_HAKKA_TONE_MODES),
		};
	});
	useEffect(() => {
		Object.assign(localStorage, queryOptions);
	}, [queryOptions]);
	const { language, voice, mode: inferenceMode, speed: voiceSpeed, hakka_tones: hakkaToneMode } = queryOptions;
	return {
		language,
		voice,
		inferenceMode,
		voiceSpeed,
		hakkaToneMode,
		setLanguage: (language: LanguageOrUndefined) => setQueryOptions(oldOptions => ({ ...oldOptions, language })),
		setVoice: (voice: Voice) => setQueryOptions(oldOptions => ({ ...oldOptions, voice })),
		setInferenceMode: (inferenceMode: InferenceMode) => setQueryOptions(oldOptions => ({ ...oldOptions, mode: inferenceMode })),
		setVoiceSpeed: (voiceSpeed: number) => setQueryOptions(oldOptions => ({ ...oldOptions, speed: voiceSpeed })),
		setHakkaToneMode: (hakkaToneMode: HakkaToneMode) => setQueryOptions(oldOptions => ({ ...oldOptions, hakka_tones: hakkaToneMode })),
		get urlWithQuery() {
			return `${location.origin}${location.pathname}?${String(new URLSearchParams(queryOptions as unknown as Record<string, string>))}`; // This is fine: number is automatically coalesced to string
		},
	};
}

export function useCopyState() {
	const { t } = useTranslation();
	const [copyState, setCopyState] = useState<"copied" | "failed">();
	const prevCopyState = useRef<"copied" | "failed">();
	useEffect(() => {
		prevCopyState.current = copyState;
	}, [copyState]);
	const timeout = useRef<ReturnType<typeof setTimeout>>();
	const copy = useCallback(async (text: string) => {
		if (timeout.current) clearTimeout(timeout.current);
		setCopyState(undefined);
		try {
			await navigator.clipboard.writeText(text);
			setCopyState("copied");
		}
		catch {
			setCopyState("failed");
		}
		timeout.current = setTimeout(() => setCopyState(undefined), 2500);
	}, []);
	const displayCopyState = copyState || prevCopyState.current;
	return {
		copy,
		tooltipStyle: `tooltip tooltip-left ${displayCopyState === "copied" ? "tooltip-primary" : "tooltip-error"} ${copyState ? "tooltip-open" : "tooltip-close"} before:transition-opacity after:transition-opacity before:text-lg`,
		tooltipText: displayCopyState && (displayCopyState === "copied" ? t('clipboard.copied') : t('clipboard.failed')),
	};
}

export function useBindArgs<A extends unknown[], R>(f: (...args: A) => R, ...args: A): () => R {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useCallback(() => f(...args), [f, ...args]);
}
