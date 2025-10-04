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
export declare function useLiveText(text: string, options?: LiveTextOptions): string;
