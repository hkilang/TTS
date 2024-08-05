import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { MdPause, MdPlayArrow, MdRefresh, MdStop } from "react-icons/md";
import { WaveFile } from "wavefile";

import { NO_AUTO_FILL } from "./consts";
import API from "./inference/api";

import type { Language, Voice } from "./types";
import type { SyntheticEvent } from "react";

const audioCache: Record<Language, Map<string, string>> = { waitau: new Map(), hakka: new Map() };

export default function AudioPlayer({ language, voice, syllables }: { language: Language; voice: Voice; syllables: string[] }) {
	const [isReady, setIsReady] = useState(false);
	const [error, setError] = useState<Error>();
	const [retryCounter, retry] = useReducer((n: number) => n + 1, 0);
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

	const text = syllables.join(" ");
	useEffect(() => {
		const _isPlaying = isPlaying;
		async function generateAudio() {
			let url = audioCache[language].get(text);
			if (!url) {
				try {
					const wav = new WaveFile();
					wav.fromScratch(1, 44100, "32f", await API.infer(language, voice, syllables));
					audioCache[language].set(text, url = wav.toDataURI());
				}
				catch (error) {
					setError(error as Error);
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
		setError(undefined);
		setIsReady(false);
		void generateAudio();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [language, text, retryCounter]);

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

	return <div className="flex items-center mt-2 relative">
		<button
			type="button"
			className="btn btn-warning btn-square text-xl max-sm:size-10 max-sm:min-h-10"
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
			className="btn btn-warning btn-square text-xl max-sm:size-10 max-sm:min-h-10"
			onClick={stopAudio}
			aria-label="停止"
			tabIndex={isReady ? 0 : -1}>
			<MdStop />
		</button>
		{!isReady && <div className={`absolute inset-0 flex items-center justify-center ${error ? "bg-gray-300 bg-opacity-50" : "bg-gray-500 bg-opacity-20"} rounded-lg text-xl`}>
			{error
				? <div>
					<span className="font-bold">錯誤：</span>
					{error.name}
					{error.message && <>
						{": "}
						<code>{error.message}</code>
					</>}
					<button type="button" className="btn btn-info btn-sm text-lg text-neutral-content ml-2 gap-1" onClick={retry}>
						<MdRefresh />重試
					</button>
				</div>
				: <span className="loading loading-spinner max-sm:w-8 sm:loading-lg" />}
		</div>}
	</div>;
}
