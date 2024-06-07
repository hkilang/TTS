import { useEffect, useRef, useState } from "react";

import { NO_AUTO_FILL } from "./consts";

import type { Language } from "./types";
import type { ChangeEvent } from "react";

export default function AudioPlayer({ syllables, language }: { syllables: string[]; language: Language }) {
	const [isReady, setIsReady] = useState(false);
	const [isPlaying, setIsPlaying] = useState<boolean | null>(false);
	const [startTime, setStartTime] = useState(0);
	const [progress, setProgress] = useState(0);
	const animationId = useRef(0);
	const audio = useRef(new Audio());

	useEffect(() => {
		async function fetchAudio() {
			const response = await fetch(`./${language}/${encodeURIComponent(syllables.join("+"))}`);
			if (response.ok) {
				audio.current.src = URL.createObjectURL(await response.blob());
				setIsReady(true);
			}
		}
		pauseAudio();
		setIsReady(false);
		void fetchAudio();
	}, [syllables, language]);

	useEffect(() => {
		function updateSeekBar() {
			if (isReady && isPlaying) {
				const _progress = (audio.current.currentTime - startTime) / audio.current.duration;
				setProgress(_progress);
				if (_progress >= 1) stopAudio();
			}
			animationId.current = requestAnimationFrame(updateSeekBar);
		}
		if (isReady && isPlaying) updateSeekBar();
		return () => cancelAnimationFrame(animationId.current);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isReady, isPlaying]);

	async function playAudio() {
		if (isPlaying || !isReady) return;
		await audio.current.play();
		setIsPlaying(true);
		setStartTime(audio.current.currentTime - progress * audio.current.duration);
	}
	function pauseAudio() {
		setIsPlaying(false);
		audio.current.pause();
	}
	function stopAudio() {
		pauseAudio();
		setProgress(0);
		setStartTime(audio.current.currentTime);
	}
	function seekBarDown() {
		if (!isPlaying) return;
		pauseAudio();
		setIsPlaying(null);
	}
	function seekBarMove(event: ChangeEvent<HTMLInputElement>) {
		const _progress = +event.target.value;
		setProgress(_progress);
		if (isReady) setStartTime(audio.current.currentTime - _progress * audio.current.duration);
	}
	function seekBarUp() {
		if (isPlaying === null) void playAudio();
	}
	return <div className="flex items-center mt-2 relative">
		<button
			type="button"
			className="btn btn-warning btn-square text-xl font-symbol"
			onClick={isPlaying === false ? playAudio : pauseAudio}
			aria-label={isPlaying === false ? "播放" : "暫停"}>
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
			onTouchCancel={seekBarUp} />
		<button
			type="button"
			className="btn btn-warning btn-square text-xl font-symbol"
			onClick={stopAudio}
			aria-label="停止">
			⏹︎
		</button>
		{!isReady && <div className="absolute inset-0 flex items-center justify-center bg-base-content bg-opacity-10 rounded-lg">
			<span className="loading loading-spinner loading-lg" />
		</div>}
	</div>;
}
