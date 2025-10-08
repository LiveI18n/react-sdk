import React, { useState, useEffect, useContext } from 'react';
import { useLiveI18n, LiveI18nContext } from './LiveText';
import type { LiveTextOptions } from './types';
import { generateLoadingText } from './loadingIndicator';

/**
 * Hook for programmatic text translation that returns a string value
 * 
 * @param text - The text to translate
 * @param options - Translation options (context, tone, language)
 * @returns The translated text (starts with original, updates when translation completes)
 * 
 * @example
 * ```tsx
 * const greeting = useLiveText("Hello World");
 * const formalGreeting = useLiveText("Welcome", { 
 *   context: "homepage", 
 *   tone: "professional" 
 * });
 * const spanishText = useLiveText("Good morning", { 
 *   language: "es-ES" 
 * });
 * ```
 */
export function useLiveText(text: string, options?: LiveTextOptions): string {
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);
  const { translate, defaultLanguage } = useLiveI18n();
  const context = useContext(LiveI18nContext);

  useEffect(() => {
    // Don't translate empty strings
    if (!text.trim()) {
      setTranslatedText(text);
      setIsLoading(false);
      return;
    }

    // Get loading pattern from config
    const loadingPattern = context?.instance?.getLoadingPattern() || 'none';

    // Show loading indicator
    setIsLoading(true);
    setTranslatedText(generateLoadingText(text, loadingPattern));

    // Perform translation
    translate(text, options)
      .then((result) => {
        setTranslatedText(result);
      })
      .catch((error) => {
        console.error('useLiveText translation failed:', error);
        // Fallback to original text on error
        setTranslatedText(text);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [
    text,
    options?.context,
    options?.tone, 
    options?.language,
    defaultLanguage, // Re-translate when default language changes
    translate,
    context
  ]);

  return translatedText;
}