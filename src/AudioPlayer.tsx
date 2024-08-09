import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { MdErrorOutline, MdFileDownload, MdPause, MdPlayArrow, MdRefresh, MdStop } from "react-icons/md";
import { WaveFile } from "wavefile";

import { ALL_MODEL_COMPONENTS, DatabaseError, ModelNotDownloadedError, NO_AUTO_FILL } from "./consts";
import { useDB } from "./db/DBContext";
import API from "./inference/api";

import type { Language, ModelComponentToFile, Version, Voice } from "./types";
import type { SyntheticEvent } from "react";

const audioCache = new Map<string, Map<string, string>>();

export default function AudioPlayer({ language, voice, syllables, openModelManager }: { language: Language; voice: Voice; syllables: string[]; openModelManager: () => Promise<void> }) {
	const [isReady, setIsReady] = useState(false);
	const [isPlaying, setIsPlaying] = useState<boolean | null>(false);
	const [progress, setProgress] = useState(0);
	const animationId = useRef(0);
	const audio = useRef(new Audio());

	const playAudio = useCallback(async () => {
		await audio.current.play();
		audio.current.currentTime = progress * audio.current.duration;
		setIsPlaying(true);
	}, [progress]);

	const pauseAudio = useCallback(() => {
		audio.current.pause();
		setIsPlaying(false);
	}, []);

	const stopAudio = useCallback(() => {
		pauseAudio();
		setProgress(0);
	}, [pauseAudio]);

	const { db, error: dbInitError, retry: dbInitRetry } = useDB();
	const [modelError, setModelError] = useState<Error>();
	const [modelRetryCounter, modelRetry] = useReducer((n: number) => n + 1, 0);
	const [model, setModel] = useState<ModelComponentToFile>();
	useEffect(() => {
		if (!db || model) return;
		async function getModelComponents() {
			try {
				const availableFiles = await db!.getAllFromIndex("models", "language_voice", [language, voice]);
				if (availableFiles.length !== ALL_MODEL_COMPONENTS.length) {
					setModelError(new ModelNotDownloadedError(language, voice, !availableFiles.length));
					return;
				}
				const components = {} as ModelComponentToFile;
				const versions = new Set<Version>();
				for (const file of availableFiles) {
					components[file.component] = file;
					versions.add(file.version);
				}
				if (versions.size !== 1) {
					setModelError(new ModelNotDownloadedError(language, voice));
					return;
				}
				setModel(components);
			}
			catch (error) {
				setModelError(new DatabaseError("無法存取語音模型：資料庫出錯", { cause: error }));
			}
		}
		setModelError(undefined);
		setIsReady(false);
		void getModelComponents();
	}, [db, model, language, voice, modelRetryCounter]);

	const [generationError, setGenerationError] = useState<Error>();
	const [generationRetryCounter, generationRetry] = useReducer((n: number) => n + 1, 0);
	const text = syllables.join(" ");
	useEffect(() => {
		if (!model) return;
		const _isPlaying = isPlaying;
		async function generateAudio() {
			const key = `${Object.entries(model!)[0][1].version}/${language}/${voice}`;
			let textToURL = audioCache.get(key);
			if (!textToURL) audioCache.set(key, textToURL = new Map<string, string>());
			let url = textToURL.get(text);
			if (!url) {
				try {
					const wav = new WaveFile();
					wav.fromScratch(1, 44100, "32f", await API.infer(language, model!, syllables));
					textToURL.set(text, url = wav.toDataURI());
				}
				catch (error) {
					setGenerationError(error as Error);
				}
			}
			if (url) {
				audio.current.src = url;
				setIsReady(true);
				if (_isPlaying) await playAudio();
				else setIsPlaying(false);
			}
		}
		audio.current.pause();
		setGenerationError(undefined);
		setIsReady(false);
		void generateAudio();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [language, voice, model, text, generationRetryCounter]);

	useEffect(() => {
		if (!isReady || !isPlaying) return;
		function updateSeekBar() {
			if (Number.isFinite(audio.current.duration)) setProgress(audio.current.currentTime / audio.current.duration);
			animationId.current = requestAnimationFrame(updateSeekBar);
		}
		updateSeekBar();
		return () => cancelAnimationFrame(animationId.current);
	}, [isReady, isPlaying]);

	useEffect(() => {
		const element = audio.current;
		element.addEventListener("ended", stopAudio);
		return () => {
			element.removeEventListener("ended", stopAudio);
		};
	}, [stopAudio]);

	const seekBarDown = useCallback(() => {
		if (!isPlaying) return;
		audio.current.pause();
		setIsPlaying(null);
	}, [isPlaying]);

	const seekBarMove = useCallback((event: SyntheticEvent<HTMLInputElement>) => {
		setProgress(+event.currentTarget.value);
	}, []);

	const seekBarUp = useCallback((event: SyntheticEvent<HTMLInputElement>) => {
		audio.current.currentTime = +event.currentTarget.value * audio.current.duration;
		if (isPlaying === null) void playAudio();
	}, [isPlaying, playAudio]);

	const error = dbInitError || modelError || generationError;
	useEffect(() => {
		if (error) console.error(error);
	}, [error]);

	return <div className="flex items-center mt-2 relative">
		<button
			type="button"
			className="btn btn-warning btn-square text-3xl max-sm:size-10 max-sm:min-h-10"
			onClick={isPlaying === false ? playAudio : pauseAudio}
			aria-label={isPlaying === false ? "播放" : "暫停"}
			tabIndex={isReady ? 0 : -1}>
			{isPlaying === false ? <MdPlayArrow /> : <MdPause />}
		</button>
		<input
			type="range"
			className="range range-warning range-sm grow mx-3 sm:mx-4"
			min={0}
			max={1}
			value={progress}
			step="any"
			{...NO_AUTO_FILL}
			onMouseDown={seekBarDown}
			onTouchStart={seekBarDown}
			onChange={seekBarMove}
			onMouseUp={seekBarUp}
			onTouchEnd={seekBarUp}
			onTouchCancel={seekBarUp}
			tabIndex={isReady ? 0 : -1} />
		<button
			type="button"
			className="btn btn-warning btn-square text-3xl max-sm:size-10 max-sm:min-h-10"
			onClick={stopAudio}
			aria-label="停止"
			tabIndex={isReady ? 0 : -1}>
			<MdStop />
		</button>
		{(error || !isReady) && <div className={`absolute inset-0 flex items-center justify-center ${error ? "bg-gray-300 bg-opacity-50 text-error" : "bg-gray-500 bg-opacity-20"} rounded-lg text-xl`}>
			{error
				? <div>
					<MdErrorOutline size="1.1875em" className="inline align-middle mt-0.5 mr-1" />
					<span className="leading-8 align-middle">
						{error instanceof ModelNotDownloadedError || error instanceof DatabaseError ? <span className="font-medium">{error.message}</span> : <>
							<span className="font-bold">錯誤：</span>
							{error.name}
							{error.message && <>
								{": "}
								<code>{error.message}</code>
							</>}
						</>}
					</span>
					<button
						type="button"
						className="btn btn-info btn-sm text-lg text-neutral-content ml-2 pl-2 gap-1 align-middle"
						onClick={dbInitError
							? dbInitRetry
							: modelError
							? (modelError instanceof ModelNotDownloadedError ? () => openModelManager().then(modelRetry) : modelRetry)
							: generationError
							? generationRetry
							: undefined}>
						{error instanceof ModelNotDownloadedError
							? <>
								<MdFileDownload size="1.1875em" />下載模型
							</>
							: <>
								<MdRefresh size="1.1875em" />重試
							</>}
					</button>
				</div>
				: <div className="flex items-center gap-3 font-medium">
					{db ? model ? "正在生成語音，請稍候……" : "正在存取語音模型……" : "資料庫載入中……"}
					<span className="loading loading-spinner max-sm:w-8 sm:loading-lg" />
				</div>}
		</div>}
	</div>;
}
