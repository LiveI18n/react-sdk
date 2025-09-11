import type { LiveI18nConfig, LiveTextOptions } from './types';
export declare class TranslationError extends Error {
    statusCode: number;
    constructor(message: string, code: number);
}
export declare class LiveI18n {
    private apiKey;
    private customerId;
    private cache;
    private endpoint;
    private defaultLanguage?;
    private debug;
    private batchRequests;
    private languageChangeListeners;
    private translationQueue;
    private queueTimer;
    constructor(config: LiveI18nConfig);
    private createCache;
    /**
     * Sleep for a given number of milliseconds
     */
    private sleep;
    /**
     * Make a single translation request attempt
     */
    private makeTranslationRequest;
    private debugLog;
    /**
     * Translate text using the LiveI18n API with retry logic
     * Generates cache key and sends it to backend to eliminate drift
     * Retries up to 5 times with exponential backoff, max 5 seconds total
     */
    translate(text: string, options?: LiveTextOptions, onRetry?: (attempt: number) => void): Promise<string>;
    /**
     * Make individual translation (existing logic moved here)
     */
    private makeIndividualTranslation;
    /**
     * Add translation request to batch queue
     */
    private addToQueue;
    /**
     * Flush the translation queue
     */
    private flushQueue;
    /**
     * Make batch translation request with retry logic
     * Never throws - always returns results array (original text for failures)
     */
    private translateBatchWithRetry;
    /**
     * Make batch translation request to API
     */
    private translateBatch;
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
     * Add a listener for default language changes
     * Returns an unsubscribe function
     */
    addLanguageChangeListener(listener: (language?: string) => void): () => void;
    /**
     * Detect browser locale
     */
    private detectLocale;
}
