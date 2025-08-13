/**
 * CANONICAL Cache Key Generation Algorithm
 *
 * CRITICAL: This is the single source of truth for cache key generation.
 * The backend does NOT generate cache keys - it uses the key provided by this SDK.
 * This eliminates any risk of cache key drift between frontend and backend.
 */
export declare function generateCacheKey(customerId: string, text: string, locale: string, context?: string, tone?: string): string;
