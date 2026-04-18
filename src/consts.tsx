import { MdCancel, MdEject, MdEnergySavingsLeaf, MdFileDownload, MdFileDownloadDone, MdFlight, MdHourglassBottom, MdLanguage, MdMan, MdRefresh, MdWoman } from "react-icons/md";

import type { ActualDownloadStatus, InferenceMode, Language, ModelComponent, DownloadStatus, Terminology, Voice, OfflineInferenceMode, AudioComponent, HakkaToneMode, LanguageOrUndefined } from "./types";

export const TERMINOLOGY: Record<Terminology, string> = {
	waitau: "terminology.waitau",
	hakka: "terminology.hakka",
	male: "terminology.male",
	female: "terminology.female",
	diacritics: "terminology.diacritics",
	digits: "terminology.digits",
};

export const LANGUAGE_TO_TEXT_COLOR_CLASS: Record<Language, string> = {
	waitau: "text-[#c73350]",
	hakka: "text-[#9c31b7]",
};

export const VOICE_TO_ICON: Record<Voice, JSX.Element> = {
	male: <MdMan size="1.375em" className="-mx-1" />,
	female: <MdWoman size="1.375em" className="-mx-1" />,
};

export const INFERENCE_MODE_TO_LABEL: Record<InferenceMode, string> = {
	online: "inferenceModes.online",
	offline: "inferenceModes.offline",
	lightweight: "inferenceModes.lightweight",
};

export const INFERENCE_MODE_TO_DESCRIPTION: Record<InferenceMode, string> = {
	online: "inferenceModes.onlineDescription",
	offline: "inferenceModes.offlineDescription",
	lightweight: "inferenceModes.lightweightDescription",
};

export const INFERENCE_MODE_TO_ICON: Record<InferenceMode, JSX.Element> = {
	online: <MdLanguage size="1.25em" />,
	offline: <MdFlight size="1.25em" />,
	lightweight: <MdEnergySavingsLeaf size="1.25em" />,
};

export const ALL_LANGUAGES: readonly Language[] = ["waitau", "hakka"];
export const ALL_VOICES: readonly Voice[] = ["male", "female"];
export const ALL_INFERENCE_MODES: readonly InferenceMode[] = ["online", "offline", "lightweight"];
export { ALL_MODEL_COMPONENTS } from "./inference/infer";
export const ALL_AUDIO_COMPONENTS: readonly AudioComponent[] = ["chars", "words"];
export const ALL_HAKKA_TONE_MODES: readonly HakkaToneMode[] = ["diacritics", "digits"];

export const ALL_LANGUAGES_OR_UNDEFINED: readonly LanguageOrUndefined[] = [undefined, "waitau", "hakka"];

export const MODEL_COMPONENT_TO_N_CHUNKS: Record<ModelComponent, number> = {
	enc: 2,
	emb: 1,
	sdp: 1,
	flow: 7,
	dec: 3,
};

export const MODEL_PATH_PREFIX = "https://cdn.jsdelivr.net/gh/hkilang/TTS-models";

export const DOWNLOAD_TYPE_LABEL: Record<OfflineInferenceMode, string> = {
	offline: "downloadType.model",
	lightweight: "downloadType.data",
};

export const DOWNLOAD_STATUS_LABEL: Record<DownloadStatus, string> = {
	gathering_info: "downloadStatus.gatheringInfo",
	gather_failed: "downloadStatus.gatherFailed",
	available_for_download: "downloadStatus.availableForDownload",
	new_version_available: "downloadStatus.newVersionAvailable",
	incomplete: "downloadStatus.incomplete",
	downloading: "downloadStatus.downloading",
	download_failed: "downloadStatus.downloadFailed",
	download_incomplete: "downloadStatus.downloadIncomplete",
	cancelled_not_downloaded: "downloadStatus.cancelledNotDownloaded",
	cancelled_incomplete: "downloadStatus.cancelledIncomplete",
	save_failed: "downloadStatus.saveFailed",
	save_incomplete: "downloadStatus.saveIncomplete",
	latest: "downloadStatus.latest",
};

export const DOWNLOAD_STATUS_CLASS: Record<DownloadStatus, string> = {
	gathering_info: "text-info",
	gather_failed: "text-error",
	available_for_download: "text-info",
	new_version_available: "text-info",
	incomplete: "text-error",
	downloading: "text-info",
	download_failed: "text-error",
	download_incomplete: "text-error",
	cancelled_not_downloaded: "text-error",
	cancelled_incomplete: "text-error",
	save_failed: "text-error",
	save_incomplete: "text-error",
	latest: "text-success",
};

export const DOWNLOAD_STATUS_ICON: Record<DownloadStatus, JSX.Element> = {
	gathering_info: <MdHourglassBottom />,
	gather_failed: <MdRefresh />,
	available_for_download: <MdFileDownload />,
	new_version_available: <MdFileDownload />,
	incomplete: <MdEject className="rotate-90" />,
	downloading: <MdCancel />,
	download_failed: <MdRefresh />,
	download_incomplete: <MdRefresh />,
	cancelled_not_downloaded: <MdFileDownload />,
	cancelled_incomplete: <MdEject className="rotate-90" />,
	save_failed: <MdRefresh />,
	save_incomplete: <MdRefresh />,
	latest: <MdFileDownloadDone />,
};

export const DOWNLOAD_STATUS_ACTION_LABEL: Record<DownloadStatus, string | null> = {
	gathering_info: null,
	gather_failed: "downloadAction.retry",
	available_for_download: "downloadAction.download",
	new_version_available: "downloadAction.download",
	incomplete: "downloadAction.continueDownload",
	downloading: "downloadAction.cancelDownload",
	download_failed: "downloadAction.retry",
	download_incomplete: "downloadAction.retry",
	cancelled_not_downloaded: "downloadAction.download",
	cancelled_incomplete: "downloadAction.continueDownload",
	save_failed: "downloadAction.retry",
	save_incomplete: "downloadAction.retry",
	latest: null,
};

export const DOWNLOAD_STATUS_PRIORITY: readonly ActualDownloadStatus[] = ["incomplete", "available_for_download", "new_version_available", "latest"];

export const DOWNLOAD_STATUS_INDICATOR_CLASS: Record<Exclude<ActualDownloadStatus, "latest">, string> = {
	available_for_download: "text-info",
	new_version_available: "text-warning",
	incomplete: "text-error",
};

export const AUDIO_COMPONENT_TO_N_CHUNKS: Record<`${Language}_${AudioComponent}`, number> = {
	waitau_chars: 1,
	waitau_words: 3,
	hakka_chars: 1,
	hakka_words: 4,
};

export const AUDIO_PATH_PREFIX = "https://cdn.jsdelivr.net/gh/hkilang/TTS-audios";

export const NO_AUTO_FILL = {
	autoComplete: "off",
	autoCorrect: "off",
	autoCapitalize: "off",
	spellCheck: "false",
} as const;
