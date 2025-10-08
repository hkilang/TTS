import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zh from './locales/zh.json';

// Get language from localStorage or default to 'zh'
const savedLanguage = localStorage.getItem('uiLanguage') || 'zh';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    lng: savedLanguage, // Use saved language or default to 'zh'
    fallbackLng: 'zh', // Change fallback to 'zh' as well
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;