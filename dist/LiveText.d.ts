import React from 'react';
import { LiveI18n } from './LiveI18n';
import type { LiveTextOptions, LiveI18nConfig } from './types';
/**
 * Legacy function - use LiveI18nProvider instead
 * @deprecated Use LiveI18nProvider component instead
 */
export declare function initializeLiveI18n(config: LiveI18nConfig): void;
/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use useLiveI18n hook within LiveI18nProvider instead
 */
export declare function getLiveI18nInstance(): LiveI18n | null;
/**
 * React Context Provider for LiveI18n
 * Provides a cleaner alternative to the global instance pattern
 */
export interface LiveI18nProviderProps {
    config: LiveI18nConfig;
    children: React.ReactNode;
}
export declare const LiveI18nProvider: React.FC<LiveI18nProviderProps>;
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
 * Must be used within LiveI18nProvider
 */
export declare function useLiveI18n(): {
    translate: (text: string, options?: LiveTextOptions) => Promise<string>;
    defaultLanguage: string | undefined;
    clearCache: () => void;
    getCacheStats: () => {
        size: number;
        maxSize: number;
    };
    updateDefaultLanguage: (language?: string) => void;
    getDefaultLanguage: () => string | undefined;
};
/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use updateDefaultLanguage from useLiveI18n hook within LiveI18nProvider instead
 */
export declare function updateDefaultLanguage(language?: string): void;
/**
 * Legacy function - use useLiveI18n hook instead
 * @deprecated Use defaultLanguage from useLiveI18n hook within LiveI18nProvider instead
 */
export declare function getDefaultLanguage(): string | undefined;
