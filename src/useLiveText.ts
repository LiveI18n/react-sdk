import { useState, useEffect } from 'react';
import { useLiveI18n } from './LiveText';
import type { LiveTextOptions } from './types';

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
  const { translate, defaultLanguage } = useLiveI18n();

  useEffect(() => {
    // Don't translate empty strings
    if (!text.trim()) {
      setTranslatedText(text);
      return;
    }

    // Perform translation
    translate(text, options)
      .then((result) => {
        setTranslatedText(result);
      })
      .catch((error) => {
        console.error('useLiveText translation failed:', error);
        // Fallback to original text on error
        setTranslatedText(text);
      });
  }, [
    text,
    options?.context,
    options?.tone, 
    options?.language,
    defaultLanguage, // Re-translate when default language changes
    translate
  ]);

  return translatedText;
}