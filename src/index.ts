export { LiveText, initializeLiveI18n, useLiveI18n, getLiveI18nInstance, updateDefaultLanguage, getDefaultLanguage, LiveI18nProvider } from './LiveText';
export type { LiveI18nProviderProps } from './LiveText';
export { useLiveText } from './useLiveText';
export { LiveI18n } from './LiveI18n';
export { LRUCache } from './LRUCache';
export { LocalStorageCache } from './LocalStorageCache';
export { generateCacheKey } from './cacheKey';
export { generateLoadingText } from './loadingIndicator';
export type { LoadingPattern } from './loadingIndicator';
export type { LiveTextOptions, LiveI18nConfig, TranslationResponse, SupportedLanguage, SupportedLanguagesResponse } from './types';

import type { LiveTextOptions } from './types';

// Direct translate function for convenience
export async function translate(text: string, options?: LiveTextOptions): Promise<string> {
  const { getLiveI18nInstance } = await import('./LiveText');
  const instance = getLiveI18nInstance();
  if (!instance) {
    console.warn('LiveI18n not initialized, returning original text');
    return text;
  }
  return instance.translate(text, options);
}
