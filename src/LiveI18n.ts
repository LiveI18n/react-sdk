import { LRUCache } from './LRUCache';
import { generateCacheKey } from './cacheKey';
import type { LiveI18nConfig, LiveTextOptions, TranslationResponse } from './types';

export class LiveI18n {
  private apiKey: string;
  private customerId: string;
  private cache: LRUCache<string, string>;
  private endpoint: string;
  private defaultLanguage?: string;

  constructor(config: LiveI18nConfig) {
    this.apiKey = config.apiKey;
    this.customerId = config.customerId;
    this.endpoint = config.endpoint || 'https://api.livei18n.com';
    this.defaultLanguage = config.defaultLanguage;
    this.cache = new LRUCache(500, 1); // 500 entries, 1 hour TTL
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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
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

    // Generate cache key using canonical algorithm
    const cacheKey = generateCacheKey(
      this.customerId,
      text,
      locale,
      context,
      tone
    );

    // Check local cache first
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

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
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        const timeElapsed = Date.now() - startTime;
        
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
  }

  /**
   * Get the current default language
   */
  getDefaultLanguage(): string | undefined {
    return this.defaultLanguage;
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
