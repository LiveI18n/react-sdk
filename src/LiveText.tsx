import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { LiveI18n } from './LiveI18n';
import type { LiveTextOptions, LiveI18nConfig } from './types';
import { generateLoadingText } from './loadingIndicator';

// No longer using global instance - all access through Context Provider

// React Context for LiveI18n
interface LiveI18nContextValue {
  instance: LiveI18n | null;
  defaultLanguage: string | undefined;
  updateDefaultLanguage: (language?: string) => void;
}

export const LiveI18nContext = createContext<LiveI18nContextValue>({
  instance: null,
  defaultLanguage: undefined,
  updateDefaultLanguage: () => {}
});

/**
 * Legacy function - use LiveI18nProvider instead
 * @deprecated Use LiveI18nProvider component instead
 */
export function initializeLiveI18n(config: LiveI18nConfig): void {
  console.warn('initializeLiveI18n is deprecated. Use LiveI18nProvider component instead.');
}

/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use useLiveI18n hook within LiveI18nProvider instead
 */
export function getLiveI18nInstance(): LiveI18n | null {
  console.warn('getLiveI18nInstance is deprecated. Use useLiveI18n hook within LiveI18nProvider instead.');
  return null;
}

/**
 * React Context Provider for LiveI18n
 * Provides a cleaner alternative to the global instance pattern
 */
export interface LiveI18nProviderProps {
  config: LiveI18nConfig;
  children: React.ReactNode;
}

export const LiveI18nProvider: React.FC<LiveI18nProviderProps> = ({ config, children }) => {
  const [instance] = useState(() => new LiveI18n(config));
  const [defaultLanguage, setDefaultLanguage] = useState<string | undefined>(
    instance.getDefaultLanguage()
  );

  const updateDefaultLanguage = useCallback((language?: string) => {
    instance.updateDefaultLanguage(language);
    setDefaultLanguage(language);
  }, [instance]);

  const contextValue = useCallback(() => ({
    instance,
    defaultLanguage,
    updateDefaultLanguage
  }), [instance, defaultLanguage, updateDefaultLanguage]);

  return (
    <LiveI18nContext.Provider value={contextValue()}>
      {children}
    </LiveI18nContext.Provider>
  );
};

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

    const onRetry: (attempts: number) => void = (attempts: number) => {
      setAttempts(attempts)
    }

    instance
      .translate(textContent, { tone, context, language }, onRetry)
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

  // Show loading indicator on initial load (attempts = 0) while loading
  const shouldShowLoading = isLoading && attempts === 0;
  const loadingPattern = instance.getLoadingPattern();
  const displayText = shouldShowLoading ? generateLoadingText(textContent, loadingPattern) : translated;
  
  return <>{displayText}</>;
};

/**
 * Hook for programmatic translation access
 * Must be used within LiveI18nProvider
 */
export function useLiveI18n() {
  const context = useContext(LiveI18nContext);
  
  if (!context.instance) {
    throw new Error('useLiveI18n must be used within LiveI18nProvider');
  }

  const instance = context.instance; // TypeScript now knows this is not null

  const translate = async (text: string, options?: LiveTextOptions): Promise<string> => {
    return instance.translate(text, options);
  };

  return {
    translate,
    defaultLanguage: context.defaultLanguage,
    clearCache: () => instance.clearCache(),
    getCacheStats: () => instance.getCacheStats() || { size: 0, maxSize: 0 },
    updateDefaultLanguage: context.updateDefaultLanguage,
    getDefaultLanguage: () => instance.getDefaultLanguage(),
    getSupportedLanguages: (all?: boolean) => instance.getSupportedLanguages(all)
  };
}

/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use updateDefaultLanguage from useLiveI18n hook within LiveI18nProvider instead
 */
export function updateDefaultLanguage(language?: string): void {
  console.warn('updateDefaultLanguage standalone function is deprecated. Use updateDefaultLanguage from useLiveI18n hook within LiveI18nProvider instead.');
}

/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use defaultLanguage from useLiveI18n hook within LiveI18nProvider instead
 */
export function getDefaultLanguage(): string | undefined {
  console.warn('getDefaultLanguage standalone function is deprecated. Use defaultLanguage from useLiveI18n hook within LiveI18nProvider instead.');
  return undefined;
}
