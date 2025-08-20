import type { LiveI18nConfig, LiveTextOptions } from './types';
export declare class LiveI18n {
    private apiKey;
    private customerId;
    private cache;
    private endpoint;
    private defaultLanguage?;
    constructor(config: LiveI18nConfig);
    /**
     * Sleep for a given number of milliseconds
     */
    private sleep;
    /**
     * Make a single translation request attempt
     */
    private makeTranslationRequest;
    /**
     * Translate text using the LiveI18n API with retry logic
     * Generates cache key and sends it to backend to eliminate drift
     * Retries up to 5 times with exponential backoff, max 5 seconds total
     */
    translate(text: string, options?: LiveTextOptions, onRetry?: (attempt: number) => void): Promise<string>;
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
