import { useCallback } from 'react';
import { LOCALE, translate, type T } from '@/lib/i18n';
import { useStore } from './store';

/** `t(text, vars)` in the farmer's chosen language. Re-renders when the language changes. */
export function useT(): T {
  const language = useStore((s) => s.language);
  return useCallback<T>((text, vars) => translate(language, text, vars), [language]);
}

/** Locale for `toLocaleDateString` in the chosen language. */
export function useLocale(): string {
  return LOCALE[useStore((s) => s.language)];
}

/** For code outside React (store actions, toasts). */
export const tNow: T = (text, vars) => translate(useStore.getState().language, text, vars);
