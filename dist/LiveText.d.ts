import React from 'react';
import { LiveI18n } from './LiveI18n';
import type { LiveTextOptions, LiveI18nConfig } from './types';
import './LiveText.css';
/**
 * Initialize the global LiveI18n instance
 * Must be called before using LiveText components
 */
export declare function initializeLiveI18n(config: LiveI18nConfig): void;
/**
 * Get the global LiveI18n instance
 * Logs error if not initialized instead of throwing
 */
export declare function getLiveI18nInstance(): LiveI18n | null;
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
export declare const LiveText: React.FC<LiveTextProps>;
/**
 * Hook for programmatic translation access
 */
export declare function useLiveI18n(): {
    translate: (text: string, options?: LiveTextOptions) => Promise<string>;
    submitFeedback: (originalText: string, translatedText: string, locale: string, rating: number, correction?: string) => Promise<boolean>;
    defaultLanguage: string | undefined;
    clearCache: () => void | undefined;
    getCacheStats: () => {
        size: number;
        maxSize: number;
    };
    updateDefaultLanguage: (language?: string) => void | undefined;
    getDefaultLanguage: () => string | undefined;
};
/**
 * Update the default language of the global instance
 */
export declare function updateDefaultLanguage(language?: string): void;
/**
 * Get the current default language of the global instance
 */
export declare function getDefaultLanguage(): string | undefined;
