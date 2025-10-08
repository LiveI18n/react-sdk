/**
 * Loading indicator pattern types
 */
export type LoadingPattern = 'dots' | 'blocks' | 'none';
/**
 * Configuration for loading indicator appearance
 */
export interface LoadingIndicatorConfig {
    pattern: LoadingPattern;
}
/**
 * Default loading indicator configuration
 */
export declare const DEFAULT_LOADING_CONFIG: LoadingIndicatorConfig;
/**
 * Generates a loading text pattern that matches the length and structure of the original text
 * Replaces all characters except spaces with the specified pattern while preserving layout
 *
 * @param originalText - The original text to create a loading pattern for
 * @param pattern - The loading pattern to use ('dots', 'blocks', or 'none')
 * @returns Loading text with same length and structure, or original text if pattern is 'none'
 *
 * @example
 * generateLoadingText("Hello World!", 'dots') → "••••• ••••••"
 * generateLoadingText("Hello World!", 'blocks') → "▮▮▮▮▮ ▮▮▮▮▮▮"
 * generateLoadingText("Hello World!", 'none') → "Hello World!"
 * generateLoadingText("Welcome back", 'dots') → "••••••• ••••"
 * generateLoadingText("Welcome back", 'blocks') → "▮▮▮▮▮▮▮ ▮▮▮▮"
 */
export declare function generateLoadingText(originalText: string, pattern?: LoadingPattern): string;
