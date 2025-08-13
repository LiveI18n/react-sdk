export declare class LRUCache<K, V> {
    private cache;
    private maxSize;
    private ttl;
    constructor(maxSize?: number, ttlHours?: number);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    clear(): void;
    size(): number;
}
