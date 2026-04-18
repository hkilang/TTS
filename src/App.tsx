import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Converter } from "opencc-js";
import { MdClose, MdError, MdInfoOutline, MdLanguage, MdPlayArrow, MdRecordVoiceOver, MdSettings, MdSwapHoriz } from "react-icons/md";

import { DOWNLOAD_STATUS_INDICATOR_CLASS, LANGUAGE_TO_TEXT_COLOR_CLASS, NO_AUTO_FILL, TERMINOLOGY } from "./consts";
import { DBProvider } from "./db/DBContext";
import { useDownloadState, useQueryOptions } from "./hooks";
import LanguageSelectionDialog from "./LanguageSelectionDialog";
import { segment } from "./parse";
import Radio from "./Radio";
import SentenceCard from "./SentenceCard";
import SettingsDialog from "./SettingsDialog";

import type { SettingsDialogPage, Sentence } from "./types";

// TODO: Some glyphs need to be normalised, e.g. 爲 → 為
const convertSimpToTrad = Converter({ from: "cn", to: "t" });

export default function App() {
	const { t, i18n } = useTranslation();
	const queryOptions = useQueryOptions();
	const { language, voice, inferenceMode, voiceSpeed, hakkaToneMode, setLanguage, setVoice } = queryOptions;
	const [sentences, setSentences] = useState<Sentence[]>([]);

	const textArea = useRef<HTMLTextAreaElement>(null);
	const btnAddSentence = useRef<HTMLButtonElement>(null);

	const resizeElements = useCallback(() => {
		if (textArea.current && btnAddSentence.current) {
			const height = textArea.current.style.height;
			textArea.current.style.setProperty("height", "");
			textArea.current.style.setProperty("min-height", "");
			btnAddSentence.current.style.setProperty("min-height", "");
			const scrollHeight = textArea.current.scrollHeight;
			textArea.current.style.setProperty("height", height, "important");
			textArea.current.style.setProperty("min-height", `${scrollHeight}px`, "important");
			btnAddSentence.current.style.setProperty("min-height", `${Math.max(parseInt(height) || 0, scrollHeight)}px`, "important");
		}
	}, [textArea, btnAddSentence]);

	const addSentence = useCallback(() => {
		if (!textArea.current || !language) return;
		setSentences([
			...textArea.current.value.split("\n").flatMap((text: string) => (text.trim() ? [{ language, voice, inferenceMode, voiceSpeed, syllables: segment(convertSimpToTrad(text)) }] : [])),
			...sentences,
		]);
		textArea.current.value = "";
		resizeElements();
	}, [textArea, language, voice, inferenceMode, voiceSpeed, sentences, resizeElements]);

	useEffect(() => {
		if (!textArea.current) return;
		const currTextArea = textArea.current;
		const observer = new ResizeObserver(resizeElements);
		observer.observe(currTextArea);
		return () => observer.unobserve(currTextArea);
	}, [textArea, resizeElements]);

	const languageSelectionDialog = useRef<HTMLDialogElement>(null);
	const showLanguageSelectionDialog = useCallback(() => {
		const { current: dialog } = languageSelectionDialog;
		if (dialog && !dialog.open) {
			setLanguage(undefined);
			dialog.inert = true;
			dialog.showModal();
			dialog.inert = false;
		}
	}, [setLanguage]);
	useEffect(() => {
		if (!language) showLanguageSelectionDialog();
	}, [language, showLanguageSelectionDialog]);

	const [currSettingsDialogPage, setCurrSettingsDialogPage] = useState<SettingsDialogPage>(null);
	const settingsDialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const { current: dialog } = settingsDialog;
		if (dialog && !dialog.open && currSettingsDialogPage) {
			dialog.inert = true;
			dialog.showModal();
			dialog.inert = false;
			dialog.addEventListener("close", () => setCurrSettingsDialogPage(null), { once: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settingsDialog.current, currSettingsDialogPage, setCurrSettingsDialogPage]);

	const [downloadState, setDownloadState] = useDownloadState();
	const currInferenceModeDownloadState = inferenceMode === "online" ? "latest" : downloadState.get(inferenceMode)!;

	const aboutDialog = useRef<HTMLDialogElement>(null);
	const showAboutDialog = useCallback(() => {
		aboutDialog.current?.showModal();
	}, []);

	// Update page title and HTML lang attribute when language changes
	useEffect(() => {
		document.title = t("app.title");
		document.documentElement.lang = i18n.language === "en" ? "en" : "zh-HK";
	}, [t, i18n.language]);

	return (
		<DBProvider>
			<div className="fixed inset-0 overflow-y-auto overscroll-contain">
				<div className="[@media(pointer:coarse)]:min-h-[calc(100%+1px)] m-auto p-4 xs:p-6 sm:p-8 max-w-7xl">
					<header className="grid items-center grid-cols-[1fr_auto] xs:grid-cols-[auto_1fr_auto] w-full">
						<img className="row-span-2 w-16 mr-4 mb-2 max-xs:hidden" srcSet="./assets/favicon-64x64.png, ./assets/favicon-128x128.png 2x, ./assets/favicon-192x192.png 3x" alt={t("app.logoAlt")} />
						<h1 className="col-start-1 xs:col-start-2 !whitespace-normal leading-tight min-w-0 overflow-hidden line-clamp-2 break-words !text-2xl xs:!text-3xl">{t("app.title")}</h1>
						<div className="flex my-2 min-w-0 col-start-1 xs:col-start-2">
							<a className="text-slate-500 inline-flex items-center group min-w-0" href="https://hkilang.org" target="_blank">
								<img className="w-8 rounded-sm border border-slate-500 border-opacity-50 mr-2 shrink-0 group-hover:brightness-[0.96875] transition-[filter]" src="./assets/hkilang-logo.svg" alt={t("app.hkilangLogoAlt")} />
								<h2 className="!whitespace-normal group-hover:text-slate-700 group-hover:text-opacity-90 transition-[color] min-w-0" dangerouslySetInnerHTML={{ __html: t("app.hkilangTitle") }} />
							</a>
						</div>
						<button onClick={showAboutDialog} type="button" className="btn btn-ghost gap-1.5 font-[650] hover:bg-opacity-10 col-start-2 row-start-1 row-end-3 xs:col-start-3 sm:btn-lg sm:text-1.5xl sm:text-slate-500">
							<span className="icon-info mt-0.5"></span>
							{t("about.buttonText")}
						</button>
					</header>
					<main>
						<div>
							{/* UI Language toggle - mobile only (compact, right-aligned) */}
							<div className="flex items-center justify-end gap-2 mb-2 sm:hidden">
								<div className="flex items-center gap-1 text-slate-600 text-sm font-semibold">
									<MdLanguage size="1em" />
									<span>{t("uiLanguage")}</span>
								</div>
								<div className="join" role="group" aria-label={t("uiLanguage")}>
									<button
										type="button"
										className={`btn join-item btn-xs text-sm ${i18n.language === "zh" ? "btn-primary" : "btn-outline"}`}
										onClick={() => {
											i18n.changeLanguage("zh");
											localStorage.setItem("uiLanguage", "zh");
										}}>
										中文
									</button>
									<button
										type="button"
										className={`btn join-item btn-xs text-sm ${i18n.language === "en" ? "btn-primary" : "btn-outline"}`}
										onClick={() => {
											i18n.changeLanguage("en");
											localStorage.setItem("uiLanguage", "en");
										}}>
										EN
									</button>
								</div>
							</div>
							<div className="flex flex-wrap items-top gap-2 xs:gap-3 mb-4">
								<div className="min-w-0">
									<div className="flex items-center gap-1 text-slate-700 text-base xs:text-lg font-semibold mb-1 tracking-wide xs:tracking-widest truncate">
										<MdLanguage className="relative top-[1px] shrink-0" />
										{t("language")}
									</div>
									<div className={`flex flex-col items-center justify-center h-10 xs:h-12 text-base xs:text-xl/tight font-semibold ${language ? LANGUAGE_TO_TEXT_COLOR_CLASS[language] : "text-[#318ab6]"}`}>
										<div className="truncate max-w-full">{language ? t(TERMINOLOGY[language]) : t("unselected")}</div>
										<div className={language ? "text-[65%] truncate max-w-full" : "text-[55%]"}>{language ? i18n.getFixedT(i18n.language === "en" ? "zh" : "en")(TERMINOLOGY[language]) : t("unselected")}</div>
									</div>
								</div>
								<div>
									<button type="button" className="btn btn-ghost btn-sm xs:btn-md max-xs:px-1.5 relative flex-col flex-nowrap gap-0 text-base xs:text-lg whitespace-nowrap h-16 min-h-16 xs:h-20 xs:min-h-20 text-slate-500 font-extrabold hover:bg-opacity-10" onClick={showLanguageSelectionDialog}>
										<MdSwapHoriz size="1.75em" className="xs:text-[2em]" />
										<span className="text-xs truncate max-w-full">{language ? t("changeLanguage") : t("selectLanguage")}</span>
										{createPortal(
											<LanguageSelectionDialog ref={languageSelectionDialog} queryOptions={queryOptions} />,
											document.body,
										)}
									</button>
								</div>
								<div className="flex items-end gap-2 xs:gap-3">
									<div className="min-w-0">
										<div className="flex items-center gap-1 text-slate-700 text-base xs:text-lg font-semibold ms-0.5 mb-0.5 tracking-wide xs:tracking-widest truncate">
											<MdRecordVoiceOver className="shrink-0" />
											{t("voice")}
										</div>
										<div className="join flex min-w-[8.5rem] xs:min-w-[10rem]" role="group" aria-label={t("app.selectVoice")}>
											<Radio
												name="btnvoice"
												className="btn join-item flex-1 text-xs xs:text-sm/tight border-[#2189f1] hover:bg-[#126fcb] hover:border-[#126fcb] hover:text-base-100 border-r-0 max-xs:btn-sm max-xs:px-1.5 min-w-0"
												activeClassName="bg-[#2189f1] text-base-100"
												nonActiveClassName="btn-outline bg-white text-[#126fcb]"
												state={voice}
												setState={setVoice}
												value="male" />
											<Radio
												name="btnvoice"
												className="btn join-item flex-1 text-xs xs:text-sm/tight border-[#f553a3] hover:bg-[#d13f87] hover:border-[#d13f87] hover:text-base-100 border-l-0 max-xs:btn-sm max-xs:px-1.5 min-w-0"
												activeClassName="bg-[#f553a3] text-base-100"
												nonActiveClassName="btn-outline bg-white text-[#d13f87]"
												state={voice}
												setState={setVoice}
												value="female" />
										</div>
									</div>
									<div>
										<button type="button" className="btn btn-ghost btn-sm xs:btn-md max-xs:px-1.5 relative flex-col flex-nowrap gap-0 text-sm xs:text-base whitespace-nowrap h-10 min-h-10 xs:h-12 xs:min-h-12 text-slate-500 font-extrabold hover:bg-opacity-10" onClick={() => setCurrSettingsDialogPage("settings")}>
											{currInferenceModeDownloadState !== "latest" && <MdError size="1.5em" className={`absolute -top-1 -right-1 ${DOWNLOAD_STATUS_INDICATOR_CLASS[currInferenceModeDownloadState]}`} />}
											<MdSettings size="1.5em" className="xs:text-[1.75em]" />
											<span className="text-[0.6rem] xs:text-xs truncate max-w-full">{t("settings")}</span>
										</button>
										{createPortal(
											<SettingsDialog
												ref={settingsDialog}
												currSettingsDialogPage={currSettingsDialogPage}
												setCurrSettingsDialogPage={setCurrSettingsDialogPage}
												queryOptions={queryOptions}
												downloadState={downloadState}
												setDownloadState={setDownloadState} />,
											document.body,
										)}
									</div>
								</div>
								{/* UI Language toggle - desktop only (hidden on mobile, shown above instead) */}
								<div className="hidden sm:block sm:ml-auto">
									<div className="flex items-center gap-1 text-slate-700 text-lg font-semibold ms-0.5 mb-0.5 tracking-widest">
										<MdLanguage />
										<span>{t("uiLanguage")}</span>
									</div>
									<div className="join" role="group" aria-label={t("uiLanguage")}>
										<button
											type="button"
											className={`btn join-item text-base ${i18n.language === "zh" ? "btn-primary" : "btn-outline"}`}
											onClick={() => {
												i18n.changeLanguage("zh");
												localStorage.setItem("uiLanguage", "zh");
											}}>
											中文
										</button>
										<button
											type="button"
											className={`btn join-item text-base ${i18n.language === "en" ? "btn-primary" : "btn-outline"}`}
											onClick={() => {
												i18n.changeLanguage("en");
												localStorage.setItem("uiLanguage", "en");
											}}>
											English
										</button>
									</div>
								</div>
							</div>
							<div className="join w-full">
								<textarea
									className="textarea textarea-accent text-lg h-0 min-h-0 max-sm:py-2.5 sm:textarea-lg sm:text-xl flex-grow join-item overflow-hidden"
									placeholder={t("inputPlaceholder")}
									rows={1}
									{...NO_AUTO_FILL}
									ref={textArea}
									onChange={resizeElements} />
								<button
									type="button"
									className="btn btn-accent h-0 min-h-0 max-sm:text-base sm:btn-lg join-item"
									ref={btnAddSentence}
									onClick={addSentence}>
									{t("addSentence")}
								</button>
							</div>
						</div>
						<div className="mt-5">
							{sentences.map((sentence: Sentence, i: number) => (
								<SentenceCard
									key={sentences.length - i}
									sentence={sentence}
									hakkaToneMode={hakkaToneMode}
									setDownloadState={setDownloadState}
									currSettingsDialogPage={currSettingsDialogPage}
									setCurrSettingsDialogPage={setCurrSettingsDialogPage} />
							))}
						</div>
					</main>
				</div>
			</div>

			<dialog ref={aboutDialog} className="modal modal-bottom sm:modal-middle">
				<div className="modal-box p-0 flex flex-col sm:max-w-3xl h-[calc(100%-5rem)] overflow-hidden">
					<form method="dialog">
						<button type="submit" className="btn btn-ghost w-14 h-14 min-h-14 text-4.5xl absolute right-3 top-3 hover:bg-opacity-10" aria-label={t("about.close")}>
							<MdClose className="text-slate-500" />
						</button>
					</form>
					<h3 className="flex items-center gap-2 mx-6 mt-5.5 mb-5">
						<MdInfoOutline size="1.125em" className="mt-1" />
						{t("about.title")}
					</h3>
					<hr />
					<div className="flex-1 overflow-x-hidden overflow-y-auto">
						<p dangerouslySetInnerHTML={{ __html: t("about.intro") }} />
						<p dangerouslySetInnerHTML={{ __html: t("about.heritage") }} />
						<p dangerouslySetInnerHTML={{ __html: t("about.purpose") }} />
						<hr />
						<p>{t("about.instructions.intro")}</p>
						<ol className="list-[circled-decimal] marker:text-slate-400 ml-13">
							<li>{t("about.instructions.step1")}</li>
							<li>{t("about.instructions.step2")}</li>
							<li>{t("about.instructions.step3")}</li>
							<li>
								<span className="inline-flex items-center gap-1">
									{t("about.instructions.step4")}
									<span className="btn btn-accent btn-xs text-lg/none pointer-events-none">{t("addSentence")}</span>
								</span>
							</li>
							<li>
								<span className="inline-flex items-center gap-1">
									{t("about.instructions.step5")}
									<span className="btn btn-warning btn-square btn-xs pointer-events-none flex items-center justify-center">
										<MdPlayArrow size="1.5em" />
									</span>
								</span>
							</li>
						</ol>
						<hr />
						<p dangerouslySetInnerHTML={{ __html: t("about.credits") }} />
						<p dangerouslySetInnerHTML={{ __html: t("about.technical") }} />
						<p dangerouslySetInnerHTML={{ __html: t("about.contact") }} />
						<p>{t("about.fundingTitle")}</p>
						<img src="./assets/credit-logos.svg" alt={t("about.creditLogosAlt")} title={t("about.creditLogosTitle")} />
						<ol className="list-[squared-decimal] text-slate-400 text-sm ml-11">
							<li id="vits2" dangerouslySetInnerHTML={{ __html: t("about.citation") }} />
						</ol>
					</div>
				</div>
			</dialog>
		</DBProvider>
	);
}
