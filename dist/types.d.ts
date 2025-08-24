export interface LiveTextOptions {
    tone?: string;
    context?: string;
    language?: string;
}
export interface LiveI18nConfig {
    apiKey: string;
    customerId: string;
    endpoint?: string;
    defaultLanguage?: string;
    cache?: {
        /** Use persistent localStorage cache */
        persistent?: boolean;
        /** Number of cache entries (default: 500) */
        entrySize?: number;
        /** Cache TTL in hours (default: 1) */
        ttlHours?: number;
        /** Preload cache on initialization (default: true) */
        preload?: boolean;
    };
}
export interface TranslationResponse {
    translated: string;
    locale: string;
    cached: boolean;
    confidence: number;
}
