import { useCallback } from "react";

import { Mp3Encoder } from "lamejs";
import { MdDownload } from "react-icons/md";

function saveBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function encodeMp3(buffer: AudioBuffer) {
	const encoder = new Mp3Encoder(1, buffer.sampleRate, 192);
	const samples = buffer.getChannelData(0);
	const mp3: Uint8Array[] = [];
	for (let offset = 0; offset < samples.length; offset += 1152) {
		const end = Math.min(offset + 1152, samples.length);
		const chunk = new Int16Array(end - offset);
		for (let i = offset; i < end; i++) {
			const sample = Math.max(-1, Math.min(1, samples[i]));
			chunk[i - offset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
		}
		const encoded = encoder.encodeBuffer(chunk);
		if (encoded.length) mp3.push(encoded);
	}
	const tail = encoder.flush();
	if (tail.length) mp3.push(tail);
	return new Blob(mp3, { type: "audio/mpeg" });
}

export default function SentenceDownload({ syllables, buffer }: { syllables: string[]; buffer: AudioBuffer | undefined }) {
	const downloadAudio = useCallback(() => {
		if (buffer) saveBlob(encodeMp3(buffer), `${syllables.join("") || "sentence"}.mp3`);
	}, [buffer, syllables]);

	return <button
		type="button"
		className="px-4 text-slate-600 text-2xl hover:bg-base-content hover:bg-opacity-10 rounded-lg transition-colors disabled:opacity-40 tooltip before:text-lg"
		data-tip="下載 MP3"
		onClick={downloadAudio}
		disabled={!buffer}
		aria-label="下載 MP3">
		<MdDownload size="1.125em" />
	</button>;
}
