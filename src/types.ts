export interface LiveTextOptions {
  tone?: string;
  context?: string;
  language?: string;
}

export interface LiveI18nConfig {
  apiKey: string;
  customerId: string;
  endpoint?: string;
  defaultLanguage?: string; // Global default language
  showLoadingAnimation?: boolean; // Enable/disable loading animation (default: true)
}

export interface TranslationResponse {
  translated: string;
  locale: string;
  cached: boolean;
  confidence: number;
}