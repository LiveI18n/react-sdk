import { LRUCache, DEFAULT_CACHE_SIZE } from './LRUCache';

interface CacheItem {
  value: string;
  timestamp: number;
}

/**
 * Hybrid cache that combines fast in-memory LRU cache with localStorage persistence
 * Optimized for React web applications that support localStorage
 */
export class LocalStorageCache {
  private memoryCache: LRUCache<string, string>;
  private localStorage: Storage | null;
  private ttl: number;
  private storagePrefix = 'livei18n_cache_';

  constructor(maxMemorySize: number = DEFAULT_CACHE_SIZE, ttlHours: number = 1) {
    this.ttl = ttlHours * 60 * 60 * 1000; // Convert to milliseconds
    this.memoryCache = new LRUCache(maxMemorySize, ttlHours);
    
    try {
      // Check if localStorage is available
      if (typeof window !== 'undefined' && window.localStorage) {
        this.localStorage = window.localStorage;
        console.log('LiveI18n: localStorage persistent cache initialized');
      } else {
        this.localStorage = null;
        console.warn('LiveI18n: localStorage not available, falling back to memory-only cache');
      }
    } catch (error) {
      console.warn('LiveI18n: localStorage access failed, falling back to memory-only cache');
      this.localStorage = null;
    }
  }

  /**
   * Reusable eviction handler to keep localStorage in sync with memory cache
   */
  private onEvict = (evictedKey: string): void => {
    if (this.localStorage) {
      try {
        this.localStorage.removeItem(this.storagePrefix + evictedKey);
      } catch (error) {
        console.warn('LiveI18n: Error removing evicted key from localStorage:', error);
      }
    }
  };

  get(key: string): string | undefined {
    // First, try memory cache (fastest) - LRUCache handles TTL internally
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult) {
      return memoryResult;
    }

    // Try localStorage (synchronous in browsers)
    if (this.localStorage) {
      try {
        const persistentData = this.localStorage.getItem(this.storagePrefix + key);
        if (persistentData) {
          const item: CacheItem = JSON.parse(persistentData);
          
          // Check if item has expired
          if (Date.now() - item.timestamp > this.ttl) {
            this.localStorage.removeItem(this.storagePrefix + key);
            return undefined;
          }

          // Put in memory cache for faster future access - LRUCache handles its own TTL
          this.memoryCache.set(key, item.value, this.onEvict);
          return item.value;
        }
      } catch (error) {
        console.warn('LiveI18n: Error reading from localStorage cache:', error);
      }
    }

    return undefined;
  }

  set(key: string, value: string): void {
    // Store in memory cache with eviction callback to keep localStorage in sync
    this.memoryCache.set(key, value, this.onEvict);

    // Also store in localStorage for persistence with our own TTL management
    if (this.localStorage) {
      try {
        const item: CacheItem = {
          value,
          timestamp: Date.now()
        };
        this.localStorage.setItem(this.storagePrefix + key, JSON.stringify(item));
      } catch (error) {
        console.warn('LiveI18n: Error writing to localStorage cache:', error);
        
        // If quota exceeded, try to clear some old items
        if (error instanceof DOMException && error.code === DOMException.QUOTA_EXCEEDED_ERR) {
          this.clearExpiredItems();
        }
      }
    }
  }

  clear(): void {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear localStorage
    if (this.localStorage) {
      try {
        const keys = Object.keys(this.localStorage);
        const cacheKeys = keys.filter(key => key.startsWith(this.storagePrefix));
        cacheKeys.forEach(key => this.localStorage!.removeItem(key));
      } catch (error) {
        console.warn('LiveI18n: Error clearing localStorage cache:', error);
      }
    }
  }

  size(): number {
    // Return memory cache size (localStorage doesn't provide easy size calculation)
    return this.memoryCache.size();
  }

  /**
   * Get statistics about both cache layers
   */
  getCacheStats(): { memory: number; persistent: boolean; localStorageAvailable: boolean } {
    return {
      memory: this.memoryCache.size(),
      persistent: this.localStorage !== null,
      localStorageAvailable: this.localStorage !== null
    };
  }

  /**
   * Preload cache from localStorage
   * Call this during app initialization for better performance
   */
  async preloadCache(maxItems: number = 50): Promise<void> {
    if (!this.localStorage) return;

    try {
      const keys = Object.keys(this.localStorage);
      const cacheKeys = keys
        .filter(key => key.startsWith(this.storagePrefix))
        .slice(0, maxItems); // Limit to prevent memory issues

      if (cacheKeys.length > 0) {
        const now = Date.now();
        let loaded = 0;

        for (const fullKey of cacheKeys) {
          try {
            const data = this.localStorage.getItem(fullKey);
            if (data) {
              const item: CacheItem = JSON.parse(data);
              const key = fullKey.replace(this.storagePrefix, '');
              
              // Check if item has expired
              if (now - item.timestamp <= this.ttl) {
                this.memoryCache.set(key, item.value, this.onEvict);
                loaded++;
              } else {
                // Remove expired item
                this.localStorage.removeItem(fullKey);
              }
            }
          } catch (error) {
            // Invalid data, remove it
            this.localStorage.removeItem(fullKey);
          }
        }

        if (loaded > 0) {
          console.log(`LiveI18n: Preloaded ${loaded} cache entries from localStorage`);
        }
      }
    } catch (error) {
      console.warn('LiveI18n: Error preloading cache from localStorage:', error);
    }
  }

  /**
   * Clear expired items from localStorage to free up space
   */
  private clearExpiredItems(): void {
    if (!this.localStorage) return;

    try {
      const keys = Object.keys(this.localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(this.storagePrefix));
      const now = Date.now();
      let cleared = 0;

      for (const fullKey of cacheKeys) {
        try {
          const data = this.localStorage.getItem(fullKey);
          if (data) {
            const item: CacheItem = JSON.parse(data);
            if (now - item.timestamp > this.ttl) {
              this.localStorage.removeItem(fullKey);
              cleared++;
            }
          }
        } catch (error) {
          // Invalid data, remove it
          this.localStorage.removeItem(fullKey);
          cleared++;
        }
      }

      if (cleared > 0) {
        console.log(`LiveI18n: Cleared ${cleared} expired cache entries from localStorage`);
      }
    } catch (error) {
      console.warn('LiveI18n: Error clearing expired cache items:', error);
    }
  }

  /**
   * Get the cache TTL in milliseconds
   */
  getTtl(): number {
    return this.ttl;
  }
}