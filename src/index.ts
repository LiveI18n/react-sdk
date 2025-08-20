export { LiveText, initializeLiveI18n, useLiveI18n, getLiveI18nInstance, updateDefaultLanguage, getDefaultLanguage } from './LiveText';
export { LiveI18n } from './LiveI18n';
export type { LiveTextOptions, LiveI18nConfig } from './types';

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