import { forwardRef, useEffect } from "react";

import { MdClose, MdOutlineDownloadForOffline, MdSettings, MdSpeed, MdRefresh, MdError, MdArrowBack, MdShowChart } from "react-icons/md";

import { ALL_INFERENCE_MODES, DOWNLOAD_TYPE_LABEL, INFERENCE_MODE_TO_DESCRIPTION, INFERENCE_MODE_TO_ICON, INFERENCE_MODE_TO_LABEL, NO_AUTO_FILL, ALL_LANGUAGES, ALL_VOICES, DOWNLOAD_STATUS_INDICATOR_CLASS } from "./consts";
import CopyURLRow from "./CopyURLRow";
import { useDB } from "./db/DBContext";
import DownloadRow from "./db/DownloadRow";
import Radio from "./Radio";

import type { SetDownloadStatus, SettingsDialogState, OfflineInferenceMode, ActualDownloadStatus, QueryOptions } from "./types";

interface SettingDialogProps extends SetDownloadStatus, SettingsDialogState {
	queryOptions: QueryOptions;
	downloadState: Map<OfflineInferenceMode, ActualDownloadStatus>;
}

// This method is bounded per the spec
// eslint-disable-next-line @typescript-eslint/unbound-method
const formatNumber = Intl.NumberFormat("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;

const SettingsDialog = forwardRef<HTMLDialogElement, SettingDialogProps>(function SettingsDialog({
	currSettingsDialogPage,
	setCurrSettingsDialogPage,
	queryOptions: {
		inferenceMode,
		setInferenceMode,
		voiceSpeed,
		setVoiceSpeed,
		hakkaToneMode,
		setHakkaToneMode,
		urlWithQuery,
	},
	downloadState,
	setDownloadState,
}, ref) {
	const { db, error, retry } = useDB();
	useEffect(() => {
		if (error) console.error(error);
	}, [error]);

	const downloadManagerInferenceMode = currSettingsDialogPage?.slice(0, -15) as OfflineInferenceMode;

	return <dialog ref={ref} className="modal modal-bottom sm:modal-middle">
		<div className="modal-box p-0 flex flex-col sm:max-w-3xl h-[calc(100%-5rem)] overflow-hidden">
			<form method="dialog">
				<button type="submit" className="btn btn-ghost w-14 h-14 min-h-14 text-4.5xl absolute right-3 top-3 text-slate-500 hover:bg-opacity-10" aria-label="關閉">
					<span>
						<MdClose />
					</span>
				</button>
			</form>
			{currSettingsDialogPage && <h3 className="flex items-center gap-2 mx-6 mt-5.5 mb-5">
				{currSettingsDialogPage === "settings"
					? <>
						<MdSettings size="1.125em" className="mt-1" />設定
					</>
					: <>
						<button type="button" className="btn btn-ghost w-14 h-14 min-h-14 text-4.5xl -ml-3 -mr-2.5 -my-7 text-slate-500 hover:bg-opacity-10" aria-label="返回" onClick={() => setCurrSettingsDialogPage("settings")}>
							<span>
								<MdArrowBack />
							</span>
						</button>
						<MdOutlineDownloadForOffline size="1.125em" />
						{DOWNLOAD_TYPE_LABEL[downloadManagerInferenceMode]}下載
					</>}
			</h3>}
			<hr />
			{currSettingsDialogPage && <div className={`flex-1 overflow-x-hidden overflow-y-auto${currSettingsDialogPage === "settings" || db ? "" : " flex items-center justify-center"}`}>
				{currSettingsDialogPage === "settings"
					? <>
						<h4 className="px-4 py-2 border-b">模式</h4>
						<ul>
							{ALL_INFERENCE_MODES.map(mode => {
								const currModeDownloadState = downloadState.get(mode as OfflineInferenceMode)!;
								return <li key={mode} className="relative">
									<label className="flex items-center text-sm/4 pl-2 pr-4 py-4 border-b border-b-slate-300 text-slate-700 cursor-pointer transition-colors hover:bg-base-content hover:bg-opacity-10">
										<div className="text-2xl flex items-center px-2">{INFERENCE_MODE_TO_ICON[mode]}</div>
										<div className="flex-1 flex flex-col">
											<div className="text-xl font-medium">{INFERENCE_MODE_TO_LABEL[mode]}</div>
											<div className="text-sm text-slate-500">{INFERENCE_MODE_TO_DESCRIPTION[mode]}</div>
										</div>
										{mode !== "online" && <div className="w-36"></div>}
										<input
											type="radio"
											className="radio radio-primary ml-3"
											name="inferenceMode"
											value={mode}
											{...NO_AUTO_FILL}
											checked={mode === inferenceMode}
											onChange={() => setInferenceMode(mode)} />
									</label>
									{mode !== "online" && <div className="absolute right-11 top-1/2 -translate-y-1/2 mx-3">
										{currModeDownloadState !== "latest" && <MdError size="1.5em" className={`absolute -top-2 -right-2 bg-base-100 rounded-full z-20 ${DOWNLOAD_STATUS_INDICATOR_CLASS[currModeDownloadState]}`} />}
										<button type="button" className="btn btn-primary gap-1 text-lg px-3" onClick={() => setCurrSettingsDialogPage(`${mode}_mode_downloads`)}>
											<MdOutlineDownloadForOffline size="1.625em" />
											{DOWNLOAD_TYPE_LABEL[mode]}下載
										</button>
									</div>}
								</li>;
							})}
						</ul>
						<h4 className="px-4 py-2 border-b">選項</h4>
						<ul>
							<li className="flex items-center pl-2 pr-4 py-4 border-b border-b-slate-300 text-slate-700">
								<div className="text-2xl flex items-center px-2">
									<MdSpeed size="1.25em" />
								</div>
								<div className="flex-1 flex flex-col gap-1">
									<div className="text-xl font-medium">語音速度</div>
									<div className="flex items-center gap-2">
										<input
											type="range"
											className="range range-primary range-sm sm:range-xs grow"
											min={0.5}
											max={2}
											value={voiceSpeed}
											step={0.01}
											{...NO_AUTO_FILL}
											onChange={event => setVoiceSpeed(+event.target.value)} />
										{formatNumber(voiceSpeed)}×
									</div>
								</div>
							</li>
							<li className="flex items-center pl-2 pr-4 py-4 border-b border-b-slate-300 text-slate-700">
								<div className="text-2xl flex items-center px-2">
									<MdShowChart size="1.25em" />
								</div>
								<div className="flex-1 flex flex-col gap-1 text-xl font-medium">客家話標調方式</div>
								<div className="join" role="group">
									<Radio
										name="hakkaToneMode"
										className="btn join-item btn-primary text-base/tight h-11 min-h-11 pb-[1px]"
										nonActiveClassName="btn-outline"
										state={hakkaToneMode}
										setState={setHakkaToneMode}
										value="diacritics" />
									<Radio
										name="hakkaToneMode"
										className="btn join-item btn-primary text-base/tight h-11 min-h-11 pb-[1px]"
										nonActiveClassName="btn-outline"
										state={hakkaToneMode}
										setState={setHakkaToneMode}
										value="digits" />
								</div>
							</li>
							<CopyURLRow urlWithQuery={urlWithQuery} />
						</ul>
					</>
					: error
					? <div className="text-center">
						<h4>資料庫載入失敗</h4>
						<div className="mt-2 mb-3">
							{error.name}
							{error.message && <>
								{": "}
								<code>{error.message}</code>
							</>}
						</div>
						<button type="button" className="btn btn-primary text-xl text-neutral-content" onClick={retry}>
							<MdRefresh size="1.25em" />重試
						</button>
					</div>
					: db
					? <ul className="flex flex-col">
						{ALL_LANGUAGES.flatMap(language =>
							ALL_VOICES.map(voice =>
								<DownloadRow
									key={`${downloadManagerInferenceMode}_${language}_${voice}`}
									db={db}
									inferenceMode={downloadManagerInferenceMode}
									language={language}
									voice={voice}
									setDownloadState={setDownloadState} />
							)
						)}
					</ul>
					: <h4>資料庫載入中……</h4>}
			</div>}
		</div>
	</dialog>;
});

export default SettingsDialog;
