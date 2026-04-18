import { MdContentCopy } from "react-icons/md";
import { useTranslation } from "react-i18next";

import { useBindArgs, useCopyState } from "./hooks";

export default function SentenceCopy({ syllables, prons }: { syllables: string[]; prons: string[] }) {
	const { t } = useTranslation();
	const { copy, tooltipStyle, tooltipText } = useCopyState();
	const copySyllables = useBindArgs(copy, syllables.join(""));
	const copyProns = useBindArgs(copy, prons.join(" "));
	const copySyllablesAndProns = useBindArgs(copy, syllables.map((syllable, i) => syllable + (prons[i].length > 1 ? `(${prons[i]})` : "")).join(""));

	return <div className="absolute top-2 right-2 dropdown dropdown-hover dropdown-end group">
		{/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
		<div tabIndex={0} className={`p-4 text-slate-600 text-2xl group-hover:bg-base-content group-hover:bg-opacity-10 rounded-lg transition-colors ${tooltipStyle}`} data-tip={tooltipText}>
			<MdContentCopy />
		</div>
		{/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
		<ul tabIndex={0} className="dropdown-content menu z-10 p-0 gap-[0.5px] bg-[#f0e5da] shadow border border-base-200 text-lg rounded-xl overflow-hidden">
			<li className="contents">
				<button type="button" className="pl-3 pr-12 py-1 text-[#724022] bg-[#fffefd] hover:bg-[#faf5ec] transition-colors rounded-none whitespace-nowrap" onClick={copySyllables}>{t('sentenceCopy.copySentence')}</button>
			</li>
			<li className="contents">
				<button type="button" className="pl-3 pr-12 py-1 text-[#724022] bg-[#fffefd] hover:bg-[#faf5ec] transition-colors rounded-none whitespace-nowrap" onClick={copyProns}>{t('sentenceCopy.copyPronunciation')}</button>
			</li>
			<li className="contents">
				<button type="button" className="pl-3 pr-12 py-1 text-[#724022] bg-[#fffefd] hover:bg-[#faf5ec] transition-colors rounded-none whitespace-nowrap" onClick={copySyllablesAndProns}>{t('sentenceCopy.copySentenceAndPronunciation')}</button>
			</li>
		</ul>
	</div>;
}
