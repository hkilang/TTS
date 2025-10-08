import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Converter } from "opencc-js";
import { MdError, MdLanguage, MdRecordVoiceOver, MdSettings, MdSwapHoriz } from "react-icons/md";

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

    // Update page title when language changes
    useEffect(() => {
        document.title = t('app.title');
    }, [t, i18n.language]);

    return (
        <DBProvider>
            <div className="fixed inset-0 overflow-y-auto overscroll-contain">
                <div className="[@media(pointer:coarse)]:min-h-[calc(100%+1px)] m-auto p-8 max-w-7xl">
                    <header className="grid items-center justify-center grid-cols-1 xs:grid-cols-[auto_1fr_auto] max-sm:max-w-fit">
                        <img className="row-span-2 w-16 mr-4 mb-2 max-xs:hidden" srcSet="./assets/favicon-64x64.png, ./assets/favicon-128x128.png 2x, ./assets/favicon-192x192.png 3x" alt={t('app.logoAlt')} />
                        <h1 className="max-sm:col-span-2">{t('app.title')}</h1>
                        <div className="flex my-2">
                            <a className="text-slate-500 inline-flex items-center group" href="https://hkilang.org" target="_blank">
                                <img className="w-8 rounded-sm border border-slate-500 border-opacity-50 mr-2 group-hover:brightness-[0.96875] transition-[filter]" src="./assets/hkilang-logo.svg" alt={t('app.hkilangLogoAlt')} />
                                <h2 className="group-hover:text-slate-700 group-hover:text-opacity-90 transition-[color]" dangerouslySetInnerHTML={{ __html: t('app.hkilangTitle') }} />
                            </a>
                        </div>
                        <button onClick={showAboutDialog} type="button" className="btn btn-ghost gap-1.5 font-[650] hover:bg-opacity-10 max-sm:text-xl max-sm:font-normal max-sm:relative max-sm:left-4 sm:btn-lg sm:text-1.5xl sm:text-slate-500 sm:col-start-3 sm:row-start-1 sm:row-end-3">
                            <span className="icon-info mt-0.5"></span>{t('about.buttonText')}
                        </button>
                    </header>
                    <main>
                        <div>
                            <div className="flex flex-wrap items-top gap-3 mb-4">
                                <div>
                                    <div className="flex items-center gap-1 text-slate-700 text-lg font-semibold mb-1 tracking-widest">
                                        <MdLanguage className="relative top-[1px]" />
                                        {t('language')}
                                    </div>
                                    <div className={`flex flex-col items-center justify-center h-12 text-2xl/tight font-semibold ${language ? LANGUAGE_TO_TEXT_COLOR_CLASS[language] : "text-[#318ab6]"}`}>
                                        <div>{TERMINOLOGY[language!] || t('unselected')}</div>
                                        <div className={language ? "text-[60%]" : "text-[50%]"}>{language ? language[0].toUpperCase() + language.slice(1) : t('unselected')}</div>
                                    </div>
                                </div>
                                <div>
                                    <button type="button" className="btn btn-ghost max-sm:btn-sm max-sm:px-2.5 relative flex-col flex-nowrap gap-0 text-lg whitespace-nowrap h-20 min-h-20 text-slate-500 font-extrabold hover:bg-opacity-10" onClick={showLanguageSelectionDialog}>
                                        <MdSwapHoriz size="2em" />
                                        <span className="max-sm:text-xs">{language ? t('changeLanguage') : t('selectLanguage')}</span>
                                        {createPortal(
                                            <LanguageSelectionDialog ref={languageSelectionDialog} queryOptions={queryOptions} />,
                                            document.body,
                                        )}
                                    </button>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-slate-700 text-lg font-semibold ms-0.5 mb-0.5 tracking-widest">
                                        <MdRecordVoiceOver />
                                        {t('voice')}
                                    </div>
                                    <div className="join" role="group" aria-label="選擇聲線">
                                        <Radio
                                            name="btnvoice"
                                            className="btn join-item text-base/tight border-[#2189f1] hover:bg-[#126fcb] hover:border-[#126fcb] hover:text-base-100 border-r-0"
                                            activeClassName="bg-[#2189f1] text-base-100"
                                            nonActiveClassName="btn-outline bg-white text-[#126fcb]"
                                            state={voice}
                                            setState={setVoice}
                                            value="male" />
                                        <Radio
                                            name="btnvoice"
                                            className="btn join-item text-base/tight border-[#f553a3] hover:bg-[#d13f87] hover:border-[#d13f87] hover:text-base-100 border-l-0"
                                            activeClassName="bg-[#f553a3] text-base-100"
                                            nonActiveClassName="btn-outline bg-white text-[#d13f87]"
                                            state={voice}
                                            setState={setVoice}
                                            value="female" />
                                    </div>
                                </div>
                                <div>
                                    <button type="button" className="btn btn-ghost max-sm:btn-sm max-sm:px-2.5 relative flex-col flex-nowrap gap-0 text-base whitespace-nowrap h-20 min-h-20 text-slate-500 font-extrabold hover:bg-opacity-10" onClick={() => setCurrSettingsDialogPage("settings")}>
                                        {currInferenceModeDownloadState !== "latest" && <MdError size="1.5em" className={`absolute -top-1 -right-1 ${DOWNLOAD_STATUS_INDICATOR_CLASS[currInferenceModeDownloadState]}`} />}
                                        <MdSettings size="2em" />
                                        <span className="max-sm:text-xs">{t('settings')}</span>
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
                                <div className="sm:ml-auto">
                                    <div className="flex items-center gap-1 text-slate-700 text-lg font-semibold ms-0.5 mb-0.5 tracking-widest">
                                        <MdLanguage />
                                        <span className="max-sm:text-base">{t('uiLanguage')}</span>
                                    </div>
                                    <div className="join" role="group" aria-label={t('uiLanguage')}>
                                        <button
                                            type="button"
                                            className={`btn join-item text-base max-sm:btn-sm ${i18n.language === 'zh' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => {
                                                i18n.changeLanguage('zh');
                                                localStorage.setItem('uiLanguage', 'zh');
                                            }}>
                                            中文
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn join-item text-base max-sm:btn-sm ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => {
                                                i18n.changeLanguage('en');
                                                localStorage.setItem('uiLanguage', 'en');
                                            }}>
                                            English
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="join w-full">
                                <textarea
                                    className="textarea textarea-accent text-lg h-0 min-h-0 max-sm:py-2.5 sm:textarea-lg sm:text-xl flex-grow join-item overflow-hidden"
                                    placeholder={t('inputPlaceholder')}
                                    rows={1}
                                    {...NO_AUTO_FILL}
                                    ref={textArea}
                                    onChange={resizeElements} />
                                <button
                                    type="button"
                                    className="btn btn-accent h-0 min-h-0 max-sm:text-base sm:btn-lg join-item"
                                    ref={btnAddSentence}
                                    onClick={addSentence}>
                                    {t('addSentence')}
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
                        <button type="submit" className="btn btn-ghost w-14 h-14 min-h-14 text-4.5xl absolute right-3 top-3 text-slate-500 hover:bg-opacity-10" aria-label={t('about.close')}>
                            <span className="icon-close"></span>
                        </button>
                    </form>
                    <h3 className="flex items-center gap-2 mx-6 mt-5.5 mb-5">
                        <span className="icon-info mt-1"></span>{t('about.title')}
                    </h3>
                    <hr />
                    <div className="flex-1 overflow-x-hidden overflow-y-auto">
                        <p dangerouslySetInnerHTML={{ __html: t('about.intro') }} />
                        <p dangerouslySetInnerHTML={{ __html: t('about.heritage') }} />
                        <p dangerouslySetInnerHTML={{ __html: t('about.purpose') }} />
                        <hr />
                        <p>{t('about.instructions.intro')}</p>
                        <ol className="list-[circled-decimal] marker:text-slate-400 ml-13">
                            <li>{t('about.instructions.step1')}</li>
                            <li>{t('about.instructions.step2')}</li>
                            <li>{t('about.instructions.step3')}</li>
                            <li dangerouslySetInnerHTML={{ __html: t('about.instructions.step4') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('about.instructions.step5') }} />
                        </ol>
                        <hr />
                        <p dangerouslySetInnerHTML={{ __html: t('about.credits') }} />
                        <p dangerouslySetInnerHTML={{ __html: t('about.technical') }} />
                        <p dangerouslySetInnerHTML={{ __html: t('about.contact') }} />
                        <p>{t('about.fundingTitle')}</p>
                        <img src="./assets/credit-logos.svg" alt={t('about.creditLogosAlt')} title={t('about.creditLogosTitle')} />
                        <ol className="list-[squared-decimal] text-slate-400 text-sm ml-11">
                            <li id="vits2" dangerouslySetInnerHTML={{ __html: t('about.citation') }} />
                        </ol>
                    </div>
                </div>
            </dialog>
        </DBProvider>
    );
}
