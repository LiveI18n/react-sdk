import { LRUCache, DEFAULT_CACHE_SIZE } from './LRUCache';
import { LocalStorageCache } from './LocalStorageCache';
import { generateCacheKey } from './cacheKey';
import type { LiveI18nConfig, LiveTextOptions, TranslationResponse, QueuedTranslation, BatchTranslationRequest, BatchTranslationResponse } from './types';

export class TranslationError extends Error {
  statusCode: number;

  constructor(message: string, code: number) {
    super(message);
    this.statusCode = code;
  }
}

export class LiveI18n {
  private apiKey: string;
  private customerId: string;
  private cache: LRUCache<string, string> | LocalStorageCache;
  private endpoint: string;
  private defaultLanguage?: string;
  private debug: boolean;
  private batchRequests: boolean;
  private languageChangeListeners: Array<(language?: string) => void> = [];
  
  // Batching-related properties
  private translationQueue: QueuedTranslation[] = [];
  private queueTimer: number | null = null;

  constructor(config: LiveI18nConfig) {
    this.apiKey = config.apiKey;
    this.customerId = config.customerId;
    this.endpoint = config.endpoint || 'https://api.livei18n.com';
    this.defaultLanguage = config.defaultLanguage;
    this.debug = config.debug || false;
    this.batchRequests = config.batch_requests ?? true;
    
    // Create appropriate cache based on configuration
    this.cache = this.createCache(config);
  }

  private createCache(config: LiveI18nConfig): LRUCache<string, string> | LocalStorageCache {
    // Create cache based on configuration
    if (config.cache) {
      if (config.cache.persistent !== false) {
        // Use localStorage + memory cache by default
        const localStorageCache = new LocalStorageCache(
          config.cache.entrySize || DEFAULT_CACHE_SIZE,
          config.cache.ttlHours || 1
        );
        
        // Preload cache if requested (default: true)
        if (config.cache.preload !== false) {
          localStorageCache.preloadCache().catch(error => {
            console.warn('LiveI18n: Failed to preload cache:', error);
          });
        }
        
        return localStorageCache;
      }
      
      // Use memory-only cache with custom settings
      return new LRUCache(
        config.cache.entrySize || DEFAULT_CACHE_SIZE, 
        config.cache.ttlHours || 1
      );
    }

    // Default to persistent cache (no preload unless explicitly configured)
    return new LocalStorageCache(DEFAULT_CACHE_SIZE, 1);
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make a single translation request attempt
   */
  private async makeTranslationRequest(
    text: string,
    locale: string,
    tone: string,
    context: string,
    cacheKey: string
  ): Promise<TranslationResponse> {
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

  private debugLog(message: string, ...params: any) {
      if (this.debug) {
          console.log(`[debug] ${message}`, params);
      }
  }

  /**
   * Translate text using the LiveI18n API with retry logic
   * Generates cache key and sends it to backend to eliminate drift
   * Retries up to 5 times with exponential backoff, max 5 seconds total
   */
  async translate(text: string, options?: LiveTextOptions, onRetry?: (attempt: number) => void): Promise<string> {
    // Input validation
    if (!text || text.length === 0) return text;
    if (text.length > 5000) {
      console.error('LiveI18n: Text exceeds 5000 character limit');
      return text;
    }

    const locale = options?.language || this.defaultLanguage || this.detectLocale();
    const tone = (options?.tone || '').substring(0, 50);
    const context = (options?.context || '').substring(0, 500);

    this.debugLog(`Attempting to translate ${JSON.stringify({text, tone, context, locale})}`);

    // Generate cache key using canonical algorithm
    const cacheKey = generateCacheKey(
      this.customerId,
      text,
      locale,
      context,
      tone
    );

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
        resolve: () => {}, // Will be set in addToQueue
        reject: () => {}   // Will be set in addToQueue
      });
    } else {
      // EXISTING: Individual mode - direct API call
      this.debugLog('cache miss, making individual translation request');
      return this.makeIndividualTranslation(text, locale, tone, context, cacheKey, onRetry);
    }
  }

  /**
   * Make individual translation (existing logic moved here)
   */
  private async makeIndividualTranslation(
    text: string, 
    locale: string, 
    tone: string, 
    context: string, 
    cacheKey: string,
    onRetry?: (attempt: number) => void
  ): Promise<string> {
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
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const timeElapsed = Date.now() - startTime;
        
        if (error?.statusCode && error?.statusCode === 400) {
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
  private addToQueue(queuedTranslation: QueuedTranslation): Promise<string> {
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
      } else if (!this.queueTimer) {
        this.debugLog('Starting 50ms queue timer');
        this.queueTimer = setTimeout(() => this.flushQueue(), 50) as unknown as number;
      }
    });
  }

  /**
   * Flush the translation queue
   */
  private async flushQueue(): Promise<void> {
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
    
    // Call batch translation API with retry (never throws)
    const results = await this.translateBatchWithRetry(currentQueue);
    
    // Resolve each promise with its result
    for (let i = 0; i < currentQueue.length; i++) {
      const queueItem = currentQueue[i];
      const result = results[i];
      
      // Check if result is different from original text (successful translation)
      if (result && result !== queueItem.text) {
        // Cache the successful translation locally
        this.cache.set(queueItem.cacheKey, result);
        queueItem.resolve(result);
      } else {
        // Return original text for failed translations (already handled by retry logic)
        queueItem.resolve(queueItem.text);
      }
    }
  }

  /**
   * Make batch translation request with retry logic
   * Never throws - always returns results array (original text for failures)
   */
  private async translateBatchWithRetry(queuedTranslations: QueuedTranslation[]): Promise<string[]> {
    const maxRetries = 1; // Single retry for batch requests
    const retryDelay = 500; // 500ms delay before retry
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.debugLog(`Batch translation attempt ${attempt + 1}/${maxRetries + 1}`);
        return await this.translateBatch(queuedTranslations);
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        
        // Check if it's a 4xx error - don't retry client errors
        let shouldRetry = true;
        if (error?.message && error.message.includes('Batch API error:')) {
          const statusMatch = error.message.match(/Batch API error: (\d+)/);
          if (statusMatch) {
            const statusCode = parseInt(statusMatch[1]);
            if (statusCode >= 400 && statusCode < 500) {
              this.debugLog(`4xx error (${statusCode}), not retrying batch translation`);
              shouldRetry = false;
            }
          }
        }
        
        if (isLastAttempt || !shouldRetry) {
          this.debugLog(`Batch translation failed after ${attempt + 1} attempts, returning original text for all`);
          // Return original text for all translations instead of throwing
          return queuedTranslations.map(q => q.text);
        }
        
        this.debugLog(`Batch translation attempt ${attempt + 1} failed, retrying in ${retryDelay}ms:`, error?.message || error);
        await this.sleep(retryDelay);
      }
    }
    
    // Fallback - should never reach here, but return original text if we do
    return queuedTranslations.map(q => q.text);
  }

  /**
   * Make batch translation request to API
   */
  private async translateBatch(queuedTranslations: QueuedTranslation[]): Promise<string[]> {
    // Detect locale once for efficiency
    const detectedLocale = this.detectLocale();
    
    // Prepare batch request (filtering out texts that are too long)
    const requests: BatchTranslationRequest[] = [];
    const validIndices: number[] = [];
    
    for (let i = 0; i < queuedTranslations.length; i++) {
      const queued = queuedTranslations[i];
      
      // Check text length (same as individual translate method)
      if (queued.text.length > 5000) {
        console.error('LiveI18n: Text exceeds 5000 character limit in batch request');
        // This translation will return original text
        continue;
      }
      
      const locale = queued.options?.language || this.defaultLanguage || detectedLocale;
      const tone = (queued.options?.tone || '').substring(0, 50); // Truncate like individual method
      const context = (queued.options?.context || '').substring(0, 500); // Truncate like individual method
      
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

    const batchResponse: BatchTranslationResponse = await response.json();
    
    // Map responses back to the original order by cache_key
    const results: string[] = new Array(queuedTranslations.length);
    
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
      } else {
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
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size(),
      maxSize: 500
    };
  }

  /**
   * Update the default language without re-initializing
   */
  updateDefaultLanguage(language?: string): void {
    this.defaultLanguage = language;
    // Notify all listeners of the language change
    this.languageChangeListeners.forEach(listener => listener(language));
  }

  /**
   * Get the current default language
   */
  getDefaultLanguage(): string | undefined {
    return this.defaultLanguage;
  }

  /**
   * Add a listener for default language changes
   * Returns an unsubscribe function
   */
  addLanguageChangeListener(listener: (language?: string) => void): () => void {
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
  private detectLocale(): string {
    if (typeof window !== 'undefined' && window.navigator) {
      return window.navigator.language || 'en-US';
    }
    return 'en-US';
  }
}
