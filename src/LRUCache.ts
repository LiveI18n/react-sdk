interface CacheItem<V> {
  value: V;
  timestamp: number;
}

export const DEFAULT_CACHE_SIZE = 500;

export class LRUCache<K, V> {
  private cache: Map<K, CacheItem<V>>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = DEFAULT_CACHE_SIZE, ttlHours: number = 1) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlHours * 60 * 60 * 1000; // Convert to milliseconds
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check if item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V, onEvict?: (evictedKey: K) => void): void {
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        // Notify about eviction
        if (onEvict) {
          onEvict(firstKey);
        }
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Get the cache TTL in milliseconds
   */
  getTtl(): number {
    return this.ttl;
  }
}