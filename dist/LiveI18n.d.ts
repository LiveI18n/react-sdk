import type { LiveI18nConfig, LiveTextOptions } from './types';
export declare class LiveI18n {
    private apiKey;
    private customerId;
    private cache;
    private endpoint;
    private defaultLanguage?;
    constructor(config: LiveI18nConfig);
    /**
     * Translate text using the LiveI18n API
     * Generates cache key and sends it to backend to eliminate drift
     */
    translate(text: string, options?: LiveTextOptions): Promise<string>;
    /**
     * Submit feedback for a translation
     */
    submitFeedback(originalText: string, translatedText: string, locale: string, rating: number, correction?: string): Promise<boolean>;
    /**
     * Clear local cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
    };
    /**
     * Update the default language without re-initializing
     */
    updateDefaultLanguage(language?: string): void;
    /**
     * Get the current default language
     */
    getDefaultLanguage(): string | undefined;
    /**
     * Detect browser locale
     */
    private detectLocale;
}
