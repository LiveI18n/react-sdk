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
export const DEFAULT_LOADING_CONFIG: LoadingIndicatorConfig = {
  pattern: 'none'
};

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
export function generateLoadingText(originalText: string, pattern: LoadingPattern = 'none'): string {
  // Return original text if no loading pattern is desired
  if (pattern === 'none') {
    return originalText;
  }
  
  let result = '';
  let charIndex = 0;
  
  for (let i = 0; i < originalText.length; i++) {
    const char = originalText[i];
    
    // Replace all non-space characters with the specified pattern
    if (char === ' ') {
      // Preserve spaces for layout
      result += char;
    } else {
      // Replace letters, numbers, punctuation, and special characters
      if (pattern === 'blocks') {
        result += '▮'; // U+25AE (Black vertical rectangle)
      } else {
        // 'dots' pattern - consistent medium dots
        result += '•'; // U+2022 (Bullet)
      }
      charIndex++;
    }
  }
  
  return result;
}