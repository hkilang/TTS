import { useState, useRef, useReducer, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { CURRENT_AUDIO_VERSION, CURRENT_MODEL_VERSION } from "./version";
import { ALL_AUDIO_COMPONENTS, ALL_MODEL_COMPONENTS, DOWNLOAD_STATUS_LABEL, DOWNLOAD_STATUS_ACTION_LABEL, DOWNLOAD_STATUS_CLASS, DOWNLOAD_STATUS_ICON, TERMINOLOGY, VOICE_TO_ICON, MODEL_PATH_PREFIX, MODEL_COMPONENT_TO_N_CHUNKS, DOWNLOAD_TYPE_LABEL, AUDIO_PATH_PREFIX, AUDIO_COMPONENT_TO_N_CHUNKS } from "../consts";
import { DatabaseError } from "../errors";
import { fromLength } from "../utils";

import type { DownloadStatus, TTSDB, Language, DownloadComponent, Voice, SetDownloadStatus, AudioComponent, ModelComponent, OfflineInferenceMode } from "../types";
import type { IDBPDatabase } from "idb";

function getNumberOfChunks(inferenceMode: OfflineInferenceMode, component: DownloadComponent, language: Language) {
	return inferenceMode === "offline" ? MODEL_COMPONENT_TO_N_CHUNKS[component as ModelComponent] : AUDIO_COMPONENT_TO_N_CHUNKS[`${language}_${component as AudioComponent}`];
}

// This method is bounded per the spec
// eslint-disable-next-line @typescript-eslint/unbound-method
const formatPercentage = Intl.NumberFormat(undefined, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;

interface DownloadRowProps extends SetDownloadStatus {
	inferenceMode: OfflineInferenceMode;
	db: IDBPDatabase<TTSDB>;
	language: Language;
	voice: Voice;
}

export default function DownloadRow({ db, inferenceMode, language, voice, setDownloadState }: DownloadRowProps) {
	const { t } = useTranslation();
	const [status, setStatus] = useState<DownloadStatus>("gathering_info");
	const [missingComponents, setMissingComponents] = useState(new Set<DownloadComponent>());
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<Error>();
	const [retryCounter, retry] = useReducer((n: number) => n + 1, 0);
	const abortController = useRef<AbortController>();

	const store = inferenceMode === "offline" ? "models" : "audios";
	const extension = inferenceMode === "offline" ? "onnx" : "bin";
	const CURRENT_VERSION = inferenceMode === "offline" ? CURRENT_MODEL_VERSION : CURRENT_AUDIO_VERSION;
	const PATH_PREFIX = inferenceMode === "offline" ? MODEL_PATH_PREFIX : AUDIO_PATH_PREFIX;
	const ALL_COMPONENTS = inferenceMode === "offline" ? ALL_MODEL_COMPONENTS : ALL_AUDIO_COMPONENTS;

	useEffect(() => {
		async function getMissingComponents() {
			try {
				const fileStatus = await db.get(`${store}_status`, `${language}/${voice}`);
				const isComplete = fileStatus && !fileStatus.missingComponents.size;
				const status = fileStatus ? isComplete ? fileStatus.version === CURRENT_VERSION ? "latest" : "new_version_available" : "incomplete" : "available_for_download";
				setStatus(status);
				setDownloadState({ inferenceMode, language, voice, status });
				setMissingComponents(fileStatus?.version === CURRENT_VERSION ? fileStatus.missingComponents : new Set(ALL_COMPONENTS));
			}
			catch (error) {
				setError(new DatabaseError("Failed to get download status", { cause: error }));
			}
		}
		setError(undefined);
		void getMissingComponents();
		// Since the key of the component is `${inferenceMode}_${language}_${voice}`, it is safe to omit them
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [db, retryCounter]);

	async function startDownload() {
		if (!missingComponents.size) return;
		setError(undefined);
		setStatus("downloading");
		setProgress(0);

		const { signal } = abortController.current = new AbortController();
		const fetchFiles = [...missingComponents].flatMap(component => {
			const nChunks = getNumberOfChunks(inferenceMode, component, language);
			return nChunks === 1
				? [[component, component] as [DownloadComponent, string]]
				: fromLength(nChunks, i => [component, `${component}_chunk_${i}`] as [DownloadComponent, string]);
		});
		const fetchResults = await Promise.allSettled(fetchFiles.map(async ([component, file]) => {
			const { ok, headers, body } = await fetch(`${PATH_PREFIX}@${CURRENT_VERSION}/${language}/${voice}/${file}.${extension}`, { signal });
			if (!ok || !body) throw new Error("Network response was not OK");
			const reader = body.getReader();
			const length = headers.get("Content-Length");
			if (!length) throw new Error("Content-Length header is missing");
			const contentLength = +length;
			if (!contentLength || contentLength !== ~~contentLength) throw new Error("Content-Length header is invalid or zero");
			return { component, file, reader, contentLength };
		}));

		let totalLength = 0;
		const successFetches = new Map<DownloadComponent, ReadableStreamDefaultReader<Uint8Array>[]>();
		const errors: Error[] = [];

		for (const fetchResult of fetchResults) {
			if (fetchResult.status === "fulfilled") {
				const { component, reader, contentLength } = fetchResult.value;
				let readers = successFetches.get(component);
				if (!readers) successFetches.set(component, readers = []);
				readers.push(reader);
				totalLength += contentLength;
			}
			else {
				errors.push(fetchResult.reason as Error);
			}
		}

		let totalReceivedLength = 0;
		const saveResults = await Promise.allSettled(Array.from(successFetches, async ([component, readers]) => {
			if (readers.length !== getNumberOfChunks(inferenceMode, component, language)) {
				throw new Error(`Some chunks of "${component}" are missing`);
			}
			let receivedLength = 0;
			const chunks: Uint8Array[] = [];
			// Guaranteed to be in the same order as `fetchFiles`
			for (const reader of readers) {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					chunks.push(value);
					totalReceivedLength += value.length;
					receivedLength += value.length;
					setProgress(totalReceivedLength / totalLength);
				}
			}
			const fileData = new Uint8Array(receivedLength);
			let position = 0;
			for (const chunk of chunks) {
				fileData.set(chunk, position);
				position += chunk.length;
			}
			try {
				await db.put(store, {
					path: `${language}/${voice}/${component}`,
					language,
					voice,
					component,
					version: CURRENT_VERSION,
					file: fileData.buffer,
				} as never);
				return component;
			}
			catch (error) {
				throw new DatabaseError(`Failed to save "${component}"`, { cause: error });
			}
		}));

		const newMissingComponents = new Set(missingComponents);
		for (const saveResult of saveResults) {
			if (saveResult.status === "fulfilled") {
				newMissingComponents.delete(saveResult.value);
			}
			else {
				errors.push(saveResult.reason as Error);
			}
		}

		const hasDownloadedComponent = newMissingComponents.size !== ALL_COMPONENTS.length;
		setStatus(
			errors.length
				? signal.aborted
					? (hasDownloadedComponent ? "cancelled_incomplete" : "cancelled_not_downloaded")
					: errors.some(error => error instanceof DatabaseError)
					? (hasDownloadedComponent ? "save_incomplete" : "save_failed")
					: (hasDownloadedComponent ? "download_incomplete" : "download_failed")
				: "latest",
		);
		if (hasDownloadedComponent) {
			setDownloadState({ inferenceMode, language, voice, status: errors.length ? "incomplete" : "latest" });
			try {
				await db.put(`${store}_status`, {
					path: `${language}/${voice}`,
					language,
					voice,
					version: CURRENT_VERSION,
					missingComponents: newMissingComponents,
				} as never);
			}
			catch (error) {
				errors.push(new DatabaseError("Failed to save download status", { cause: error }));
			}
		}
		setError(errors.length ? errors.length === 1 ? errors[0] : new AggregateError(errors) : undefined);
		setMissingComponents(newMissingComponents);
	}

	function cancelDownload() {
		abortController.current?.abort(new Error("The download was cancelled by the user"));
	}

	const DOWNLOAD_STATUS_ACTION: Record<DownloadStatus, (() => void) | undefined> = {
		gathering_info: undefined,
		gather_failed: retry,
		available_for_download: startDownload,
		new_version_available: startDownload,
		incomplete: startDownload,
		downloading: cancelDownload,
		download_failed: startDownload,
		download_incomplete: startDownload,
		cancelled_not_downloaded: startDownload,
		cancelled_incomplete: startDownload,
		save_failed: startDownload,
		save_incomplete: startDownload,
		latest: undefined,
	};

	useEffect(() => {
		if (error) {
			if (error instanceof AggregateError) {
				console.error(...error.errors as Error[]);
			}
			else {
				console.error(error);
			}
		}
	}, [error]);

	// Items are stretched and paddings are intentionally moved to the icon for larger tooltip bounding box
	return <li className="contents">
		<button type="button" className={`flex items-stretch text-sm/4 text-left py-4 border-b border-b-slate-300 text-slate-700 ${DOWNLOAD_STATUS_ACTION[status] ? "transition-colors hover:bg-base-content hover:bg-opacity-10" : "pointer-events-none"}`} onClick={DOWNLOAD_STATUS_ACTION[status]}>
			<div className="text-2xl flex items-center pl-4 pr-2">{VOICE_TO_ICON[voice]}</div>
			<div className="flex-1 flex flex-col gap-0.5">
				<div className="text-xl font-medium">{t(TERMINOLOGY[language])} – {t(TERMINOLOGY[voice])}</div>
				{status === "downloading"
					? <div className="flex items-center gap-2">
						<progress className="progress progress-info" value={progress} />
						{formatPercentage(progress)}
					</div>
					: <div className={DOWNLOAD_STATUS_CLASS[status]}>{t(DOWNLOAD_STATUS_LABEL[status], { type: t(DOWNLOAD_TYPE_LABEL[inferenceMode]) })}</div>}
			</div>
			<div className="text-2xl flex items-center pl-2 pr-4 tooltip tooltip-left tooltip-primary before:text-lg" data-tip={DOWNLOAD_STATUS_ACTION_LABEL[status] ? t(DOWNLOAD_STATUS_ACTION_LABEL[status]) : null}>{DOWNLOAD_STATUS_ICON[status]}</div>
		</button>
	</li>;
}
