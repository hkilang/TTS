import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh.json";

// Get language from localStorage or default to 'zh'
const savedLanguage = typeof localStorage !== "undefined"
	? localStorage.getItem("uiLanguage") || "zh"
	: "zh";

i18n
	.use(initReactI18next)
	.init({
		resources: {
			en: { translation: en },
			zh: { translation: zh },
		},
		lng: savedLanguage, // Use saved language or default to 'zh'
		fallbackLng: "zh", // Change fallback to 'zh' as well
		interpolation: {
			escapeValue: false,
		},
		react: {
			useSuspense: false, // Prevent blank screen while loading
		},
	})
	.catch(error => {
		console.error("i18n initialization error:", error);
	});

export default i18n;
