import { useTranslation } from "react-i18next";

import { NO_AUTO_FILL, TERMINOLOGY, VOICE_TO_ICON } from "./consts";

import type { Terminology, Voice } from "./types";
import type { Dispatch } from "react";

export default function Radio<T extends Terminology>({
	name,
	className,
	activeClassName = "",
	nonActiveClassName = "",
	state,
	setState,
	value,
}: {
	name: string;
	className: string;
	activeClassName?: string;
	nonActiveClassName?: string;
	state: T;
	setState: Dispatch<T>;
	value: T;
}) {
	const { t, i18n } = useTranslation();
	const tOther = i18n.getFixedT(i18n.language === 'en' ? 'zh' : 'en');
	return <label className={`${className} ${state === value ? activeClassName : nonActiveClassName}`}>
		<input
			type="radio"
			className="sr-only"
			name={name}
			value={value}
			{...NO_AUTO_FILL}
			checked={state === value}
			onChange={() => setState(value)} />
		<span className="flex flex-row flex-nowrap items-center gap-1 min-w-0">
			<span className="shrink-0">{VOICE_TO_ICON[value as Voice]}</span>
			<span className="min-w-0">
				<div>{t(TERMINOLOGY[value])}</div>
				<div className="text-[65%]">{tOther(TERMINOLOGY[value])}</div>
			</span>
		</span>
	</label>;
}
