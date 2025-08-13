import React, { useEffect, useState } from 'react';
import { LiveI18n } from './LiveI18n';
import type { LiveTextOptions, LiveI18nConfig } from './types';

// Global instance
let globalInstance: LiveI18n | null = null;

/**
 * Initialize the global LiveI18n instance
 * Must be called before using LiveText components
 */
export function initializeLiveI18n(config: LiveI18nConfig): void {
  globalInstance = new LiveI18n(config);
}

/**
 * Get the global LiveI18n instance
 * Logs error if not initialized instead of throwing
 */
export function getLiveI18nInstance(): LiveI18n | null {
  if (!globalInstance) {
    console.error('LiveI18n not initialized. Call initializeLiveI18n() first.');
    return null;
  }
  return globalInstance;
}

/**
 * Extract string content from React.ReactNode
 * Handles strings, numbers, arrays of strings/numbers, and filters out non-text content
 */
function extractStringContent(children: React.ReactNode): string {
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

/**
 * React component for automatic text translation
 * 
 * Usage:
 * <LiveText tone="formal" context="navigation">Hello World</LiveText>
 * <LiveText>Hello {name}!</LiveText>
 * <LiveText>You have {count} {count === 1 ? 'message' : 'messages'}</LiveText>
 */
export interface LiveTextProps extends LiveTextOptions {
  children: React.ReactNode;
  fallback?: string;
  onTranslationComplete?: (original: string, translated: string) => void;
  onError?: (error: Error) => void;
}

export const LiveText: React.FC<LiveTextProps> = ({
  children,
  tone,
  context,
  language,
  fallback,
  onTranslationComplete,
  onError
}) => {
  // Extract string content from children
  const textContent = extractStringContent(children);
  
  const [translated, setTranslated] = useState(textContent);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!globalInstance) {
      console.error('LiveI18n not initialized. Call initializeLiveI18n() first.');
      return;
    }

    // Don't translate empty strings
    if (!textContent.trim()) {
      return;
    }

    setIsLoading(true);

    globalInstance
      .translate(textContent, { tone, context, language })
      .then((result) => {
        setTranslated(result);
        onTranslationComplete?.(textContent, result);
      })
      .catch((error) => {
        console.error('LiveText translation failed:', error);
        setTranslated(fallback || textContent);
        onError?.(error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [textContent, tone, context, language, fallback, onTranslationComplete, onError]);

  // Show loading state or translated text
  return <>{translated}</>;
};

/**
 * Hook for programmatic translation access
 */
export function useLiveI18n() {
  const instance = getLiveI18nInstance();

  const translate = async (text: string, options?: LiveTextOptions): Promise<string> => {
    if (!instance) {
      console.warn('LiveI18n not initialized, returning original text');
      return text;
    }
    return instance.translate(text, options);
  };

  const submitFeedback = async (
    originalText: string,
    translatedText: string,
    locale: string,
    rating: number,
    correction?: string
  ): Promise<boolean> => {
    if (!instance) {
      console.warn('LiveI18n not initialized, feedback not submitted');
      return false;
    }
    return instance.submitFeedback(originalText, translatedText, locale, rating, correction);
  };

  return {
    translate,
    submitFeedback,
    defaultLanguage: instance?.getDefaultLanguage(),
    clearCache: () => instance?.clearCache(),
    getCacheStats: () => instance?.getCacheStats() || { size: 0, maxSize: 0 },
    updateDefaultLanguage: (language?: string) => instance?.updateDefaultLanguage(language),
    getDefaultLanguage: () => instance?.getDefaultLanguage()
  };
}

/**
 * Update the default language of the global instance
 */
export function updateDefaultLanguage(language?: string): void {
  const instance = getLiveI18nInstance();
  if (!instance) {
    console.warn('LiveI18n not initialized, cannot update default language');
    return;
  }
  instance.updateDefaultLanguage(language);
}

/**
 * Get the current default language of the global instance
 */
export function getDefaultLanguage(): string | undefined {
  const instance = getLiveI18nInstance();
  if (!instance) {
    console.warn('LiveI18n not initialized, cannot get default language');
    return undefined;
  }
  return instance.getDefaultLanguage();
}
