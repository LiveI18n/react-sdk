export { LiveText, initializeLiveI18n, useLiveI18n, getLiveI18nInstance, updateDefaultLanguage, getDefaultLanguage, LiveI18nProvider } from './LiveText';
export type { LiveI18nProviderProps } from './LiveText';
export { LiveI18n } from './LiveI18n';
export { LRUCache } from './LRUCache';
export { LocalStorageCache } from './LocalStorageCache';
export { generateCacheKey } from './cacheKey';
export type { LiveTextOptions, LiveI18nConfig, TranslationResponse } from './types';
import type { LiveTextOptions } from './types';
export declare function translate(text: string, options?: LiveTextOptions): Promise<string>;
