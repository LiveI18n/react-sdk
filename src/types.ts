export interface LiveTextOptions {
  tone?: string;
  context?: string;
  language?: string;
}

export interface LiveI18nConfig {
  apiKey: string;
  customerId: string;
  endpoint?: string;
  defaultLanguage?: string; // Global default language
  debug?: boolean; // Show debug console logs
  /** Enable request batching for better performance (default: true) */
  batch_requests?: boolean;
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

export interface QueuedTranslation {
  text: string;
  options?: LiveTextOptions;
  cacheKey: string;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

export interface BatchTranslationRequest {
  text: string;
  locale: string;
  tone: string;
  context: string;
  cache_key: string;
}

export interface BatchTranslationResponse {
  responses: Array<{
    cache_key: string;
    translated: string;
    cached: boolean;
    confidence: number;
  }>;
}
