/**
 * Hybrid cache that combines fast in-memory LRU cache with localStorage persistence
 * Optimized for React web applications that support localStorage
 */
export declare class LocalStorageCache {
    private memoryCache;
    private localStorage;
    private ttl;
    private storagePrefix;
    constructor(maxMemorySize?: number, ttlHours?: number);
    /**
     * Reusable eviction handler to keep localStorage in sync with memory cache
     */
    private onEvict;
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    clear(): void;
    size(): number;
    /**
     * Get statistics about both cache layers
     */
    getCacheStats(): {
        memory: number;
        persistent: boolean;
        localStorageAvailable: boolean;
    };
    /**
     * Preload cache from localStorage
     * Call this during app initialization for better performance
     */
    preloadCache(maxItems?: number): Promise<void>;
    /**
     * Clear expired items from localStorage to free up space
     */
    private clearExpiredItems;
    /**
     * Get the cache TTL in milliseconds
     */
    getTtl(): number;
}
