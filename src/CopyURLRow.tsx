import { MdContentCopy, MdLink } from "react-icons/md";
import { useTranslation } from "react-i18next";

import { useBindArgs, useCopyState } from "./hooks";

export default function CopyURLRow({ urlWithQuery }: { urlWithQuery: string }) {
    const { t } = useTranslation();
    const { copy, tooltipStyle, tooltipText } = useCopyState();
    const onClick = useBindArgs(copy, urlWithQuery);

    return <li className="contents">
        <button type="button" className="flex items-center text-left pl-2 pr-4 py-4 border-b border-b-slate-300 text-slate-700 transition-colors hover:bg-base-content hover:bg-opacity-10" onClick={onClick}>
            <div className="text-2xl flex items-center px-2">
                <MdLink size="1.25em" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
                <div className="text-xl font-medium">{t('copyURLRow.title')}</div>
                <div className="text-sm text-slate-500 break-all">{urlWithQuery}</div>
            </div>
            <div className={`text-2xl flex items-center px-2 ${tooltipStyle}`} data-tip={tooltipText}>
                <MdContentCopy size="1.25em" />
            </div>
        </button>
    </li>;
}
