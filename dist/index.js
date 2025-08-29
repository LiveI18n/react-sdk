import { jsx, Fragment } from 'react/jsx-runtime';
import { createContext, useState, useContext, useEffect, useCallback } from 'react';

const DEFAULT_CACHE_SIZE = 500;
class LRUCache {
    constructor(maxSize = DEFAULT_CACHE_SIZE, ttlHours = 1) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttlHours * 60 * 60 * 1000; // Convert to milliseconds
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return undefined;
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
    set(key, value, onEvict) {
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
    clear() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
}

/**
 * Hybrid cache that combines fast in-memory LRU cache with localStorage persistence
 * Optimized for React web applications that support localStorage
 */
class LocalStorageCache {
    constructor(maxMemorySize = DEFAULT_CACHE_SIZE, ttlHours = 1) {
        this.storagePrefix = 'livei18n_cache_';
        /**
         * Reusable eviction handler to keep localStorage in sync with memory cache
         */
        this.onEvict = (evictedKey) => {
            if (this.localStorage) {
                try {
                    this.localStorage.removeItem(this.storagePrefix + evictedKey);
                }
                catch (error) {
                    console.warn('LiveI18n: Error removing evicted key from localStorage:', error);
                }
            }
        };
        this.ttl = ttlHours * 60 * 60 * 1000; // Convert to milliseconds
        this.memoryCache = new LRUCache(maxMemorySize, ttlHours);
        try {
            // Check if localStorage is available
            if (typeof window !== 'undefined' && window.localStorage) {
                this.localStorage = window.localStorage;
                console.log('LiveI18n: localStorage persistent cache initialized');
            }
            else {
                this.localStorage = null;
                console.warn('LiveI18n: localStorage not available, falling back to memory-only cache');
            }
        }
        catch (error) {
            console.warn('LiveI18n: localStorage access failed, falling back to memory-only cache');
            this.localStorage = null;
        }
    }
    get(key) {
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
                    const item = JSON.parse(persistentData);
                    // Check if item has expired
                    if (Date.now() - item.timestamp > this.ttl) {
                        this.localStorage.removeItem(this.storagePrefix + key);
                        return undefined;
                    }
                    // Put in memory cache for faster future access - LRUCache handles its own TTL
                    this.memoryCache.set(key, item.value, this.onEvict);
                    return item.value;
                }
            }
            catch (error) {
                console.warn('LiveI18n: Error reading from localStorage cache:', error);
            }
        }
        return undefined;
    }
    set(key, value) {
        // Store in memory cache with eviction callback to keep localStorage in sync
        this.memoryCache.set(key, value, this.onEvict);
        // Also store in localStorage for persistence with our own TTL management
        if (this.localStorage) {
            try {
                const item = {
                    value,
                    timestamp: Date.now()
                };
                this.localStorage.setItem(this.storagePrefix + key, JSON.stringify(item));
            }
            catch (error) {
                console.warn('LiveI18n: Error writing to localStorage cache:', error);
                // If quota exceeded, try to clear some old items
                if (error instanceof DOMException && error.code === DOMException.QUOTA_EXCEEDED_ERR) {
                    this.clearExpiredItems();
                }
            }
        }
    }
    clear() {
        // Clear memory cache
        this.memoryCache.clear();
        // Clear localStorage
        if (this.localStorage) {
            try {
                const keys = Object.keys(this.localStorage);
                const cacheKeys = keys.filter(key => key.startsWith(this.storagePrefix));
                cacheKeys.forEach(key => this.localStorage.removeItem(key));
            }
            catch (error) {
                console.warn('LiveI18n: Error clearing localStorage cache:', error);
            }
        }
    }
    size() {
        // Return memory cache size (localStorage doesn't provide easy size calculation)
        return this.memoryCache.size();
    }
    /**
     * Get statistics about both cache layers
     */
    getCacheStats() {
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
    async preloadCache(maxItems = 50) {
        if (!this.localStorage)
            return;
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
                            const item = JSON.parse(data);
                            const key = fullKey.replace(this.storagePrefix, '');
                            // Check if item has expired
                            if (now - item.timestamp <= this.ttl) {
                                this.memoryCache.set(key, item.value, this.onEvict);
                                loaded++;
                            }
                            else {
                                // Remove expired item
                                this.localStorage.removeItem(fullKey);
                            }
                        }
                    }
                    catch (error) {
                        // Invalid data, remove it
                        this.localStorage.removeItem(fullKey);
                    }
                }
                if (loaded > 0) {
                    console.log(`LiveI18n: Preloaded ${loaded} cache entries from localStorage`);
                }
            }
        }
        catch (error) {
            console.warn('LiveI18n: Error preloading cache from localStorage:', error);
        }
    }
    /**
     * Clear expired items from localStorage to free up space
     */
    clearExpiredItems() {
        if (!this.localStorage)
            return;
        try {
            const keys = Object.keys(this.localStorage);
            const cacheKeys = keys.filter(key => key.startsWith(this.storagePrefix));
            const now = Date.now();
            let cleared = 0;
            for (const fullKey of cacheKeys) {
                try {
                    const data = this.localStorage.getItem(fullKey);
                    if (data) {
                        const item = JSON.parse(data);
                        if (now - item.timestamp > this.ttl) {
                            this.localStorage.removeItem(fullKey);
                            cleared++;
                        }
                    }
                }
                catch (error) {
                    // Invalid data, remove it
                    this.localStorage.removeItem(fullKey);
                    cleared++;
                }
            }
            if (cleared > 0) {
                console.log(`LiveI18n: Cleared ${cleared} expired cache entries from localStorage`);
            }
        }
        catch (error) {
            console.warn('LiveI18n: Error clearing expired cache items:', error);
        }
    }
}

/**
 * CANONICAL Cache Key Generation Algorithm
 *
 * CRITICAL: This is the single source of truth for cache key generation.
 * The backend does NOT generate cache keys - it uses the key provided by this SDK.
 * This eliminates any risk of cache key drift between frontend and backend.
 */
function generateCacheKey(customerId, text, locale, context = '', tone = '') {
    // Step 1: Normalize ALL inputs to lowercase and trim
    const normalized = {
        c: customerId,
        t: text.trim().toLowerCase(),
        l: locale.toLowerCase(),
        ctx: context.trim().toLowerCase(),
        tn: tone.trim().toLowerCase()
    };
    // Step 2: Sort keys alphabetically to ensure consistent ordering
    const sortedKeys = Object.keys(normalized).sort();
    const sortedObj = {};
    sortedKeys.forEach(key => {
        sortedObj[key] = normalized[key];
    });
    // Step 3: Create JSON string
    const jsonString = JSON.stringify(sortedObj);
    // Step 4: Generate hash (using synchronous version for simplicity)
    return hashStringSync(jsonString);
}
/**
 * Synchronous version of hashString for compatibility
 */
function hashStringSync(str) {
    // Use simple hash for synchronous operation
    return simpleHash(str);
}
/**
 * Simple deterministic hash function
 * Not cryptographically secure, but good enough for cache keys
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive hex string with padding
    const hex = Math.abs(hash).toString(16);
    return hex.length >= 8 ? hex : '0'.repeat(8 - hex.length) + hex;
}

class TranslationError extends Error {
    constructor(message, code) {
        super(message);
        this.statusCode = code;
    }
}
class LiveI18n {
    constructor(config) {
        this.languageChangeListeners = [];
        // Batching-related properties
        this.translationQueue = [];
        this.queueTimer = null;
        this.apiKey = config.apiKey;
        this.customerId = config.customerId;
        this.endpoint = config.endpoint || 'https://api.livei18n.com';
        this.defaultLanguage = config.defaultLanguage;
        this.debug = config.debug || false;
        this.batchRequests = config.batch_requests || true;
        // Create appropriate cache based on configuration
        this.cache = this.createCache(config);
    }
    createCache(config) {
        // Create cache based on configuration
        if (config.cache) {
            if (config.cache.persistent !== false) {
                // Use localStorage + memory cache by default
                const localStorageCache = new LocalStorageCache(config.cache.entrySize || DEFAULT_CACHE_SIZE, config.cache.ttlHours || 1);
                // Preload cache if requested (default: true)
                if (config.cache.preload !== false) {
                    localStorageCache.preloadCache().catch(error => {
                        console.warn('LiveI18n: Failed to preload cache:', error);
                    });
                }
                return localStorageCache;
            }
            // Use memory-only cache with custom settings
            return new LRUCache(config.cache.entrySize || DEFAULT_CACHE_SIZE, config.cache.ttlHours || 1);
        }
        // Default to persistent cache (no preload unless explicitly configured)
        return new LocalStorageCache(DEFAULT_CACHE_SIZE, 1);
    }
    /**
     * Sleep for a given number of milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Make a single translation request attempt
     */
    async makeTranslationRequest(text, locale, tone, context, cacheKey) {
        const response = await fetch(`${this.endpoint}/api/v1/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
                'X-Customer-ID': this.customerId,
            },
            body: JSON.stringify({
                text: text.substring(0, 5000),
                locale,
                tone,
                context,
                cache_key: cacheKey,
            }),
        });
        if (!response.ok) {
            throw new TranslationError(`API error: ${response.status} ${response.statusText}. ${response.json()}`, response.status);
        }
        return await response.json();
    }
    debugLog(message, ...params) {
        if (this.debug) {
            console.log(`[debug] ${message}`, params);
        }
    }
    /**
     * Translate text using the LiveI18n API with retry logic
     * Generates cache key and sends it to backend to eliminate drift
     * Retries up to 5 times with exponential backoff, max 5 seconds total
     */
    async translate(text, options, onRetry) {
        // Input validation
        if (!text || text.length === 0)
            return text;
        if (text.length > 5000) {
            console.error('LiveI18n: Text exceeds 5000 character limit');
            return text;
        }
        const locale = (options === null || options === void 0 ? void 0 : options.language) || this.defaultLanguage || this.detectLocale();
        const tone = ((options === null || options === void 0 ? void 0 : options.tone) || '').substring(0, 50);
        const context = ((options === null || options === void 0 ? void 0 : options.context) || '').substring(0, 500);
        this.debugLog(`Attempting to translate ${JSON.stringify({ text, tone, context, locale })}`);
        // Generate cache key using canonical algorithm
        const cacheKey = generateCacheKey(this.customerId, text, locale, context, tone);
        this.debugLog(`cache key for translation ${cacheKey}`);
        // Check local cache first
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.debugLog(`found translation in cache`);
            return cached;
        }
        // Branch based on configuration
        if (this.batchRequests) {
            // NEW: Batch mode - add to queue
            this.debugLog('cache miss, adding to batch queue');
            return this.addToQueue({
                text,
                options,
                cacheKey,
                resolve: () => { }, // Will be set in addToQueue
                reject: () => { } // Will be set in addToQueue
            });
        }
        else {
            // EXISTING: Individual mode - direct API call
            this.debugLog('cache miss, making individual translation request');
            return this.makeIndividualTranslation(text, locale, tone, context, cacheKey, onRetry);
        }
    }
    /**
     * Make individual translation (existing logic moved here)
     */
    async makeIndividualTranslation(text, locale, tone, context, cacheKey, onRetry) {
        const maxRetries = 5;
        const baseDelay = 100; // Start with 100ms
        const maxTotalTime = 5000; // 5 seconds total limit
        const startTime = Date.now();
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Check if we've exceeded the total time limit
            if (Date.now() - startTime >= maxTotalTime) {
                console.warn(`LiveI18n: Translation timeout after ${maxTotalTime}ms`);
                break;
            }
            try {
                if (attempt > 0 && onRetry) {
                    onRetry(attempt);
                }
                const result = await this.makeTranslationRequest(text, locale, tone, context, cacheKey);
                // Cache the result locally
                this.cache.set(cacheKey, result.translated);
                // Log warnings for low confidence translations
                if (result.confidence < 0.4) {
                    console.warn(`LiveI18n: Low confidence translation (${result.confidence}):`, {
                        original: text,
                        translated: result.translated,
                        locale
                    });
                }
                // Log successful retry if not first attempt
                if (attempt > 0) {
                    console.log(`LiveI18n: Translation succeeded on attempt ${attempt + 1}`);
                }
                return result.translated;
            }
            catch (error) {
                const isLastAttempt = attempt === maxRetries - 1;
                const timeElapsed = Date.now() - startTime;
                if ((error === null || error === void 0 ? void 0 : error.statusCode) && (error === null || error === void 0 ? void 0 : error.statusCode) === 400) {
                    // don't retry on 400 errors
                    console.error(`LiveI18n: Translation failed with status code: 400. Will not retry:`, error);
                    return text; // Fallback to original text
                }
                if (isLastAttempt || timeElapsed >= maxTotalTime) {
                    console.error(`LiveI18n: Translation failed after ${attempt + 1} attempts:`, error);
                    return text; // Fallback to original text
                }
                // Calculate delay with exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
                const delay = Math.min(baseDelay * Math.pow(2, attempt), 1600);
                // Ensure we don't exceed the total time limit with the delay
                const remainingTime = maxTotalTime - timeElapsed;
                const actualDelay = Math.min(delay, remainingTime - 100); // Leave 100ms for the request
                if (actualDelay > 0) {
                    console.warn(`LiveI18n: Attempt ${attempt + 1} failed, retrying in ${actualDelay}ms:`, error);
                    await this.sleep(actualDelay);
                }
            }
        }
        // Should not reach here, but fallback just in case
        return text;
    }
    /**
     * Add translation request to batch queue
     */
    addToQueue(queuedTranslation) {
        return new Promise((resolve, reject) => {
            // Set the resolve and reject functions
            queuedTranslation.resolve = resolve;
            queuedTranslation.reject = reject;
            // Add to queue
            this.translationQueue.push(queuedTranslation);
            this.debugLog(`Added to queue, queue size: ${this.translationQueue.length}`);
            // Auto-flush conditions: 10 requests or start timer
            if (this.translationQueue.length >= 10) {
                this.debugLog('Queue full (10 requests), flushing immediately');
                this.flushQueue();
            }
            else if (!this.queueTimer) {
                this.debugLog('Starting 50ms queue timer');
                this.queueTimer = setTimeout(() => this.flushQueue(), 50);
            }
        });
    }
    /**
     * Flush the translation queue
     */
    async flushQueue() {
        var _a, _b, _c;
        // Clear the timer
        if (this.queueTimer) {
            clearTimeout(this.queueTimer);
            this.queueTimer = null;
        }
        // Get current queue and reset
        const currentQueue = [...this.translationQueue];
        this.translationQueue = [];
        if (currentQueue.length === 0) {
            this.debugLog('Queue flush called but queue is empty');
            return;
        }
        this.debugLog(`Flushing queue with ${currentQueue.length} translations`);
        try {
            // Call batch translation API
            const results = await this.translateBatch(currentQueue);
            // Resolve each promise with its result
            for (let i = 0; i < currentQueue.length; i++) {
                const queueItem = currentQueue[i];
                const result = results[i];
                if (result) {
                    // Cache the result locally
                    this.cache.set(queueItem.cacheKey, result);
                    queueItem.resolve(result);
                }
                else {
                    // Fallback to original text if no result
                    queueItem.resolve(queueItem.text);
                }
            }
        }
        catch (error) {
            this.debugLog('Batch translation failed, falling back to individual requests');
            // Detect locale once for efficiency
            const detectedLocale = this.detectLocale();
            // Fallback: process each translation individually
            for (const queueItem of currentQueue) {
                try {
                    const locale = ((_a = queueItem.options) === null || _a === void 0 ? void 0 : _a.language) || this.defaultLanguage || detectedLocale;
                    const tone = (((_b = queueItem.options) === null || _b === void 0 ? void 0 : _b.tone) || '').substring(0, 50);
                    const context = (((_c = queueItem.options) === null || _c === void 0 ? void 0 : _c.context) || '').substring(0, 500);
                    const result = await this.makeIndividualTranslation(queueItem.text, locale, tone, context, queueItem.cacheKey);
                    queueItem.resolve(result);
                }
                catch (individualError) {
                    console.error('Individual fallback translation failed:', individualError);
                    queueItem.reject(individualError);
                }
            }
        }
    }
    /**
     * Make batch translation request to API
     */
    async translateBatch(queuedTranslations) {
        var _a, _b, _c;
        // Detect locale once for efficiency
        const detectedLocale = this.detectLocale();
        // Prepare batch request (filtering out texts that are too long)
        const requests = [];
        const validIndices = [];
        for (let i = 0; i < queuedTranslations.length; i++) {
            const queued = queuedTranslations[i];
            // Check text length (same as individual translate method)
            if (queued.text.length > 5000) {
                console.error('LiveI18n: Text exceeds 5000 character limit in batch request');
                // This translation will return original text
                continue;
            }
            const locale = ((_a = queued.options) === null || _a === void 0 ? void 0 : _a.language) || this.defaultLanguage || detectedLocale;
            const tone = (((_b = queued.options) === null || _b === void 0 ? void 0 : _b.tone) || '').substring(0, 50); // Truncate like individual method
            const context = (((_c = queued.options) === null || _c === void 0 ? void 0 : _c.context) || '').substring(0, 500); // Truncate like individual method
            requests.push({
                text: queued.text,
                locale,
                tone,
                context,
                cache_key: queued.cacheKey
            });
            validIndices.push(i);
        }
        this.debugLog(`Making batch request with ${requests.length} valid translations (${queuedTranslations.length - requests.length} filtered out)`);
        // If no valid requests, return all original texts
        if (requests.length === 0) {
            return queuedTranslations.map(q => q.text);
        }
        const response = await fetch(`${this.endpoint}/api/v1/translate_batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
                'X-Customer-ID': this.customerId,
            },
            body: JSON.stringify({
                requests: requests
            }),
        });
        if (!response.ok) {
            throw new TranslationError(`Batch API error: ${response.status} ${response.statusText}`, response.status);
        }
        const batchResponse = await response.json();
        // Map responses back to the original order by cache_key
        const results = new Array(queuedTranslations.length);
        // Fill in results for valid translations
        for (let i = 0; i < validIndices.length; i++) {
            const originalIndex = validIndices[i];
            const originalCacheKey = queuedTranslations[originalIndex].cacheKey;
            const responseItem = batchResponse.responses.find(r => r.cache_key === originalCacheKey);
            if (responseItem) {
                results[originalIndex] = responseItem.translated;
                // Log warnings for low confidence translations
                if (responseItem.confidence < 0.4) {
                    console.warn(`LiveI18n: Low confidence batch translation (${responseItem.confidence}):`, {
                        original: queuedTranslations[originalIndex].text,
                        translated: responseItem.translated
                    });
                }
            }
            else {
                // Fallback if response not found
                results[originalIndex] = queuedTranslations[originalIndex].text;
                console.warn(`LiveI18n: No batch response found for cache key: ${originalCacheKey}`);
            }
        }
        // Fill in original text for invalid translations (text too long)
        for (let i = 0; i < queuedTranslations.length; i++) {
            if (results[i] === undefined) {
                results[i] = queuedTranslations[i].text; // Return original text for filtered items
            }
        }
        return results;
    }
    /**
     * Clear local cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size(),
            maxSize: 500
        };
    }
    /**
     * Update the default language without re-initializing
     */
    updateDefaultLanguage(language) {
        this.defaultLanguage = language;
        // Notify all listeners of the language change
        this.languageChangeListeners.forEach(listener => listener(language));
    }
    /**
     * Get the current default language
     */
    getDefaultLanguage() {
        return this.defaultLanguage;
    }
    /**
     * Add a listener for default language changes
     * Returns an unsubscribe function
     */
    addLanguageChangeListener(listener) {
        this.languageChangeListeners.push(listener);
        // Return unsubscribe function
        return () => {
            const index = this.languageChangeListeners.indexOf(listener);
            if (index > -1) {
                this.languageChangeListeners.splice(index, 1);
            }
        };
    }
    /**
     * Detect browser locale
     */
    detectLocale() {
        if (typeof window !== 'undefined' && window.navigator) {
            return window.navigator.language || 'en-US';
        }
        return 'en-US';
    }
}

const LiveI18nContext = createContext({
    instance: null,
    defaultLanguage: undefined,
    updateDefaultLanguage: () => { }
});
/**
 * Legacy function - use LiveI18nProvider instead
 * @deprecated Use LiveI18nProvider component instead
 */
function initializeLiveI18n(config) {
    console.warn('initializeLiveI18n is deprecated. Use LiveI18nProvider component instead.');
}
/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use useLiveI18n hook within LiveI18nProvider instead
 */
function getLiveI18nInstance() {
    console.warn('getLiveI18nInstance is deprecated. Use useLiveI18n hook within LiveI18nProvider instead.');
    return null;
}
const LiveI18nProvider = ({ config, children }) => {
    const [instance] = useState(() => new LiveI18n(config));
    const [defaultLanguage, setDefaultLanguage] = useState(instance.getDefaultLanguage());
    const updateDefaultLanguage = useCallback((language) => {
        instance.updateDefaultLanguage(language);
        setDefaultLanguage(language);
    }, [instance]);
    const contextValue = useCallback(() => ({
        instance,
        defaultLanguage,
        updateDefaultLanguage
    }), [instance, defaultLanguage, updateDefaultLanguage]);
    return (jsx(LiveI18nContext.Provider, { value: contextValue(), children: children }));
};
/**
 * Extract string content from React.ReactNode
 * Handles strings, numbers, arrays of strings/numbers, and filters out non-text content
 */
function extractStringContent(children) {
    if (typeof children === 'string') {
        return children;
    }
    if (typeof children === 'number') {
        return children.toString();
    }
    if (Array.isArray(children)) {
        return children
            .filter(child => typeof child === 'string' || typeof child === 'number')
            .map(child => typeof child === 'number' ? child.toString() : child)
            .join('');
    }
    // For other ReactNode types (React elements, fragments, etc.), 
    // try to convert to string but warn about potential issues
    if (children != null && typeof children === 'object') {
        console.warn('LiveText: Non-string React elements detected. Only string content will be translated.');
        return String(children);
    }
    return String(children || '');
}
const LiveText = ({ children, tone, context, language, fallback, onTranslationComplete, onError }) => {
    // Extract string content from children
    const textContent = extractStringContent(children);
    const [translated, setTranslated] = useState(textContent);
    const [isLoading, setIsLoading] = useState(true);
    const [attempts, setAttempts] = useState(0);
    const contextValue = useContext(LiveI18nContext);
    if (!contextValue.instance) {
        throw new Error('LiveText must be used within LiveI18nProvider');
    }
    const instance = contextValue.instance;
    const defaultLanguage = contextValue.defaultLanguage;
    useEffect(() => {
        // if we are on a second attempt set loading to false
        // this way we can show the original text and exit the loading animation early
        // while we keep attempting translation in the background
        if (attempts > 0 && isLoading) {
            setIsLoading(false);
        }
    }, [attempts]);
    useEffect(() => {
        // Don't translate empty strings
        if (!textContent.trim()) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const onRetry = (attempts) => {
            setAttempts(attempts);
        };
        instance
            .translate(textContent, { tone, context, language }, onRetry)
            .then((result) => {
            setTranslated(result);
            onTranslationComplete === null || onTranslationComplete === void 0 ? void 0 : onTranslationComplete(textContent, result);
        })
            .catch((error) => {
            console.error('LiveText translation failed:', error);
            setTranslated(fallback || textContent);
            onError === null || onError === void 0 ? void 0 : onError(error);
        })
            .finally(() => {
            setIsLoading(false);
        });
    }, [
        textContent,
        tone,
        context,
        language,
        defaultLanguage,
        fallback,
        onTranslationComplete,
        onError,
        instance
    ]);
    return jsx(Fragment, { children: translated });
};
/**
 * Hook for programmatic translation access
 * Must be used within LiveI18nProvider
 */
function useLiveI18n() {
    const context = useContext(LiveI18nContext);
    if (!context.instance) {
        throw new Error('useLiveI18n must be used within LiveI18nProvider');
    }
    const instance = context.instance; // TypeScript now knows this is not null
    const translate = async (text, options) => {
        return instance.translate(text, options);
    };
    return {
        translate,
        defaultLanguage: context.defaultLanguage,
        clearCache: () => instance.clearCache(),
        getCacheStats: () => instance.getCacheStats() || { size: 0, maxSize: 0 },
        updateDefaultLanguage: context.updateDefaultLanguage,
        getDefaultLanguage: () => instance.getDefaultLanguage()
    };
}
/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use updateDefaultLanguage from useLiveI18n hook within LiveI18nProvider instead
 */
function updateDefaultLanguage(language) {
    console.warn('updateDefaultLanguage standalone function is deprecated. Use updateDefaultLanguage from useLiveI18n hook within LiveI18nProvider instead.');
}
/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use defaultLanguage from useLiveI18n hook within LiveI18nProvider instead
 */
function getDefaultLanguage() {
    console.warn('getDefaultLanguage standalone function is deprecated. Use defaultLanguage from useLiveI18n hook within LiveI18nProvider instead.');
    return undefined;
}

var LiveText$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    LiveI18nProvider: LiveI18nProvider,
    LiveText: LiveText,
    getDefaultLanguage: getDefaultLanguage,
    getLiveI18nInstance: getLiveI18nInstance,
    initializeLiveI18n: initializeLiveI18n,
    updateDefaultLanguage: updateDefaultLanguage,
    useLiveI18n: useLiveI18n
});

// Direct translate function for convenience
async function translate(text, options) {
    const { getLiveI18nInstance } = await Promise.resolve().then(function () { return LiveText$1; });
    const instance = getLiveI18nInstance();
    if (!instance) {
        console.warn('LiveI18n not initialized, returning original text');
        return text;
    }
    return instance.translate(text, options);
}

export { LRUCache, LiveI18n, LiveI18nProvider, LiveText, LocalStorageCache, generateCacheKey, getDefaultLanguage, getLiveI18nInstance, initializeLiveI18n, translate, updateDefaultLanguage, useLiveI18n };
//# sourceMappingURL=index.js.map
