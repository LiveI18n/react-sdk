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
   * Translate text using the LiveI18n API
   * Generates cache key and sends it to backend to eliminate drift
   */
  async translate(text: string, options?: LiveTextOptions): Promise<string> {
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

    try {
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
          cache_key: cacheKey, // Send cache key to backend
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result: TranslationResponse = await response.json();
      
      // Cache the result locally
      this.cache.set(cacheKey, result.translated);

      // Log warnings for low confidence translations
      if (result.confidence < 0.7) {
        console.warn(`LiveI18n: Low confidence translation (${result.confidence}):`, {
          original: text,
          translated: result.translated,
          locale
        });
      }

      return result.translated;
    } catch (error) {
      console.error('LiveI18n: Translation failed:', error);
      return text; // Fallback to original text
    }
  }

  /**
   * Submit feedback for a translation
   */
  async submitFeedback(
    originalText: string,
    translatedText: string,
    locale: string,
    rating: number,
    correction?: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Customer-ID': this.customerId,
        },
        body: JSON.stringify({
          original_text: originalText,
          translated_text: translatedText,
          locale,
          rating,
          correction,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('LiveI18n: Failed to submit feedback:', error);
      return false;
    }
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
