import { useState, useRef, useReducer, useEffect } from "react";

import { CURRENT_MODEL_VERSION } from "./version";
import { ALL_MODEL_COMPONENTS, DatabaseError, MODEL_STATUS_LABEL, MODEL_STATUS_ACTION_LABEL, MODEL_STATUS_CLASS, MODEL_STATUS_ICON, TERMINOLOGY, VOICE_TO_ICON, MODEL_PATH_PREFIX, MODEL_COMPONENT_TO_N_CHUNKS } from "../consts";
import { fromLength } from "../utils";

import type { ModelStatus, TTSDB, Language, ModelComponent, Voice, ModelComponentToFile, Version } from "../types";
import type { IDBPDatabase } from "idb";

// This method is bounded per the spec
// eslint-disable-next-line @typescript-eslint/unbound-method
const formatPercentage = Intl.NumberFormat("zh-HK", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;

export default function ModelRow({ db, language, voice }: { db: IDBPDatabase<TTSDB>; language: Language; voice: Voice }) {
	const [status, setStatus] = useState<ModelStatus>("gathering_info");
	const [missingComponents, setMissingComponents] = useState<ModelComponent[]>([]);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<Error>();
	const [retryCounter, retry] = useReducer((n: number) => n + 1, 0);
	const abortController = useRef<AbortController>();

	useEffect(() => {
		async function getMissingComponents() {
			try {
				const availableFiles = await db.getAllFromIndex("models", "language_voice", [language, voice]);
				const components: Partial<ModelComponentToFile> = {};
				const versions = new Set<Version>();
				for (const file of availableFiles) {
					components[file.component] = file;
					versions.add(file.version);
				}
				const newMissingComponents: ModelComponent[] = [];
				let isIncomplete = versions.size !== 1;
				let hasNewVersion = false;
				for (const component of ALL_MODEL_COMPONENTS) {
					if (!components[component]) {
						isIncomplete = true;
						newMissingComponents.push(component);
					}
					else if (components[component].version !== CURRENT_MODEL_VERSION) {
						hasNewVersion = true;
						newMissingComponents.push(component);
					}
				}
				setStatus(
					isIncomplete
						? newMissingComponents.length === ALL_MODEL_COMPONENTS.length ? "available_for_download" : "incomplete"
						: hasNewVersion
						? "new_version_available"
						: "latest",
				);
				setMissingComponents(newMissingComponents);
			}
			catch (error) {
				setError(new DatabaseError("Failed to get entries", { cause: error }));
			}
		}
		setError(undefined);
		void getMissingComponents();
	}, [db, language, voice, retryCounter]);

	async function downloadModel() {
		if (!missingComponents.length) return;
		setError(undefined);
		setStatus("downloading");
		setProgress(0);

		const { signal } = abortController.current = new AbortController();
		const fetchFiles = missingComponents.flatMap(component =>
			MODEL_COMPONENT_TO_N_CHUNKS[component] === 1
				? [[component, component] as [ModelComponent, string]]
				: fromLength(MODEL_COMPONENT_TO_N_CHUNKS[component], i => [component, `${component}_chunk_${i}`] as [ModelComponent, string])
		);
		const fetchResults = await Promise.allSettled(fetchFiles.map(async ([component, file]) => {
			const { ok, headers, body } = await fetch(`${MODEL_PATH_PREFIX}@${CURRENT_MODEL_VERSION}/${language}/${voice}/${file}.onnx`, { signal });
			if (!ok || !body) throw new Error("Network response was not OK");
			const reader = body.getReader();
			const length = headers.get("Content-Length");
			if (!length) throw new Error("Content-Length header is missing");
			const contentLength = +length;
			if (!contentLength || contentLength !== ~~contentLength) throw new Error("Content-Length header is invalid or zero");
			return { component, file, reader, contentLength };
		}));

		let totalLength = 0;
		const successFetches = new Map<ModelComponent, ReadableStreamDefaultReader<Uint8Array>[]>();
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
			if (readers.length !== MODEL_COMPONENT_TO_N_CHUNKS[component]) {
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
				await db.put("models", {
					path: `${language}/${voice}/${component}`,
					language,
					voice,
					component,
					version: CURRENT_MODEL_VERSION,
					file: fileData.buffer,
				});
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

		const hasDownloadedComponent = newMissingComponents.size !== ALL_MODEL_COMPONENTS.length;
		setStatus(
			errors.length
				? signal.aborted
					? (hasDownloadedComponent ? "cancelled_incomplete" : "cancelled_not_downloaded")
					: errors.some(error => error instanceof DatabaseError)
					? (hasDownloadedComponent ? "save_incomplete" : "save_failed")
					: (hasDownloadedComponent ? "download_incomplete" : "download_failed")
				: "latest",
		);
		setError(errors.length ? errors.length === 1 ? errors[0] : new AggregateError(errors) : undefined);
		setMissingComponents([...newMissingComponents]);
	}

	function cancelDownload() {
		abortController.current?.abort(new Error("The download was cancelled by the user"));
	}

	const MODEL_STATUS_ACTION: Record<ModelStatus, (() => void) | undefined> = {
		gathering_info: undefined,
		gather_failed: retry,
		available_for_download: downloadModel,
		new_version_available: downloadModel,
		incomplete: downloadModel,
		downloading: cancelDownload,
		download_failed: downloadModel,
		download_incomplete: downloadModel,
		cancelled_not_downloaded: downloadModel,
		cancelled_incomplete: downloadModel,
		save_failed: downloadModel,
		save_incomplete: downloadModel,
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
		<button type="button" className={`btn btn-ghost gap-0 items-stretch rounded-none text-left font-normal px-0 py-4 h-auto min-h-0 border-0 border-b border-b-slate-300 text-slate-700 hover:border-b hover:bg-opacity-10${MODEL_STATUS_ACTION[status] ? "" : " pointer-events-none"}`} onClick={MODEL_STATUS_ACTION[status]}>
			<div className="text-2xl flex items-center pl-4 pr-2">{VOICE_TO_ICON[voice]}</div>
			<div className="flex-1 flex flex-col gap-1">
				<div className="text-xl font-medium">{TERMINOLOGY[language]} – {TERMINOLOGY[voice]}</div>
				{status === "downloading"
					? <div className="flex items-center gap-2">
						<progress className="progress progress-info" value={progress} />
						{formatPercentage(progress)}
					</div>
					: <div className={MODEL_STATUS_CLASS[status]}>{MODEL_STATUS_LABEL[status]}</div>}
			</div>
			<div className="text-2xl flex items-center pl-2 pr-4 tooltip tooltip-left tooltip-primary before:text-lg before" data-tip={MODEL_STATUS_ACTION_LABEL[status]}>{MODEL_STATUS_ICON[status]}</div>
		</button>
	</li>;
}
