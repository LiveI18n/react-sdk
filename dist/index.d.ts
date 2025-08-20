export { LiveText, initializeLiveI18n, useLiveI18n, getLiveI18nInstance, updateDefaultLanguage, getDefaultLanguage } from './LiveText';
export { LiveI18n } from './LiveI18n';
export type { LiveTextOptions, LiveI18nConfig } from './types';
import type { LiveTextOptions } from './types';
export declare function translate(text: string, options?: LiveTextOptions): Promise<string>;
