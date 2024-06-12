import { useCallback, useEffect, useRef, useState } from "react";

import { NO_AUTO_FILL } from "./consts";
import { useTTS } from "./hooks";

import type { Language } from "./types";
import type { SyntheticEvent } from "react";

export default function AudioPlayer({ syllables, language }: { syllables: string[]; language: Language }) {
	const [isReady, setIsReady] = useState(false);
	const [isPlaying, setIsPlaying] = useState<boolean | null>(false);
	const [progress, setProgress] = useState(0);
	const animationId = useRef(0);
	const audio = useRef(new Audio());

	const playAudio = useCallback(async () => {
		await audio.current.play();
		setIsPlaying(true);
	}, []);

	const pauseAudio = useCallback(() => {
		audio.current.pause();
		setIsPlaying(false);
	}, []);

	const stopAudio = useCallback(() => {
		pauseAudio();
		setProgress(0);
	}, [pauseAudio]);

	const url = useTTS(language, syllables.join(" "));

	useEffect(() => {
		const _isPlaying = isPlaying;
		async function setAudio() {
			if (url) {
				audio.current.src = url;
				await audio.current.play();
				audio.current.pause();
				audio.current.currentTime = progress * audio.current.duration;
				setIsReady(true);
				if (_isPlaying) await audio.current.play();
				setIsPlaying(_isPlaying);
			}
			else {
				audio.current.pause();
				setIsReady(false);
			}
		}
		void setAudio();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url, pauseAudio]);

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
			className="btn btn-warning btn-square text-xl font-symbol"
			onClick={isPlaying === false ? playAudio : pauseAudio}
			aria-label={isPlaying === false ? "播放" : "暫停"}
			tabIndex={isReady ? 0 : -1}>
			{isPlaying === false ? "▶︎" : "⏸︎"}
		</button>
		<input
			type="range"
			className="range range-warning range-sm grow mx-4"
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
			className="btn btn-warning btn-square text-xl font-symbol"
			onClick={stopAudio}
			aria-label="停止"
			tabIndex={isReady ? 0 : -1}>
			⏹︎
		</button>
		{!isReady && <div className="absolute inset-0 flex items-center justify-center bg-base-content bg-opacity-10 rounded-lg">
			<span className="loading loading-spinner loading-lg" />
		</div>}
	</div>;
}
