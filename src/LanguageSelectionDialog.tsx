import { forwardRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { MdLanguage } from "react-icons/md";

import Radio from "./Radio";

import type { Language, QueryOptions } from "./types";
import type { RefObject } from "react";

interface LanguageSelectionDialogProps {
	queryOptions: QueryOptions;
}

const LanguageSelectionDialog = forwardRef<HTMLDialogElement, LanguageSelectionDialogProps>(function LanguageSelectionDialog({
	queryOptions: {
		language,
		setLanguage,
	},
}, ref) {
	const { t } = useTranslation();
	const setLanguageAndCloseDialog = useCallback((language: Language) => {
		setLanguage(language);
		(ref as RefObject<HTMLDialogElement>).current?.close();
	}, [setLanguage, ref]);

	useEffect(() => {
		function preventDialogCloseOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape" && (ref as RefObject<HTMLDialogElement>).current?.open) event.preventDefault();
		}
		document.addEventListener("keydown", preventDialogCloseOnEscape);
		return () => document.removeEventListener("keydown", preventDialogCloseOnEscape);
	}, [ref]);

	return <dialog ref={ref} className="modal modal-bottom sm:modal-middle">
		<div className="modal-box p-0 flex flex-col sm:max-w-3xl h-[24rem] overflow-hidden">
			<h3 className="flex items-center gap-2 mx-6 mt-5.5 mb-5">
				<MdLanguage size="1.125em" className="mt-1" />{t('languageSelection.title')}
			</h3>
			<hr />
			<p className="text-xl xs:text-1.5xl mx-6 mt-4.5 mb-1.5" dangerouslySetInnerHTML={{ __html: t('languageSelection.welcome') }} />
			<p className="text-xl xs:text-1.5xl mx-6">{t('languageSelection.instruction')}</p>
			<div className="flex-1 grid place-items-stretch p-6 md:p-8">
				<div className="flex items-center justify-center gap-6 md:gap-8">
					<Radio
						name="btnlanguage"
						className="btn text-base-100 flex-1 w-full max-w-72 h-full max-h-72 bg-[#f94267] hover:bg-[#c73350] border-none text-3xl md:text-4xl"
						state={language!}
						setState={setLanguageAndCloseDialog}
						value="waitau" />
					<Radio
						name="btnlanguage"
						className="btn text-base-100 flex-1 w-full max-w-72 h-full max-h-72 bg-[#cf45f1] hover:bg-[#9c31b7] border-none text-3xl md:text-4xl"
						state={language!}
						setState={setLanguageAndCloseDialog}
						value="hakka" />
				</div>
			</div>
		</div>
	</dialog>;
});

export default LanguageSelectionDialog;
