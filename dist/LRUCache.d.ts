export declare const DEFAULT_CACHE_SIZE = 500;
export declare class LRUCache<K, V> {
    private cache;
    private maxSize;
    private ttl;
    constructor(maxSize?: number, ttlHours?: number);
    get(key: K): V | undefined;
    set(key: K, value: V, onEvict?: (evictedKey: K) => void): void;
    clear(): void;
    size(): number;
    /**
     * Get the cache TTL in milliseconds
     */
    getTtl(): number;
}
