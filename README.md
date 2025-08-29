# @livei18n/react-sdk

React SDK for LiveI18n real-time translation platform.

## Installation

```bash
npm install @livei18n/react-sdk
```

## Quick Start

### 1. Setup the Provider

```typescript
import { LiveI18nProvider } from '@livei18n/react-sdk';

// Wrap your app with the provider
function App() {
  return (
    <LiveI18nProvider config={{
      apiKey: 'your-api-key',
      customerId: 'your-customer-id',
      defaultLanguage: 'es-ES' // optional - target language for translations
    }}>
      <YourApp />
    </LiveI18nProvider>
  );
}
```

### 2. Use the LiveText Component

```jsx
import { LiveText } from '@livei18n/react-sdk';

function YourApp() {
  return (
    <div>
      <h1>
        <LiveText>Welcome to our app</LiveText>
      </h1>
      
      <p>
        <LiveText 
          tone="formal" 
          context="navigation menu"
        >
          Click here to get started
        </LiveText>
      </p>
    </div>
  );
}
```

### 3. Programmatic Translation

```typescript
import { useLiveI18n } from '@livei18n/react-sdk';

function MyComponent() {
  const { translate, defaultLanguage, updateDefaultLanguage } = useLiveI18n();
  
  const handleClick = async () => {
    const translated = await translate('Hello World', {
      tone: 'casual',
      language: 'es-ES'
    });
    console.log(translated);
  };
  
  const switchLanguage = () => {
    updateDefaultLanguage('fr-FR'); // All LiveText components will re-render
  };
  
  return (
    <div>
      <p>Current language: {defaultLanguage || 'auto-detect'}</p>
      <button onClick={handleClick}>Translate</button>
      <button onClick={switchLanguage}>Switch to French</button>
    </div>
  );
}
```

## API Reference

### LiveText Component

| Prop | Type | Description |
|------|------|-------------|
| `children` | `string` | Text to translate |
| `tone` | `string` | Translation tone (e.g., "formal", "casual") |
| `context` | `string` | Context for better translation |
| `language` | `string` | Target language (e.g., "es-ES") |
| `fallback` | `string` | Fallback text if translation fails |
| `onTranslationComplete` | `function` | Callback when translation completes |
| `onError` | `function` | Callback when translation fails |

### useLiveI18n Hook

**Must be used within `LiveI18nProvider`**

Returns an object with:

- `translate(text, options)` - Translate text programmatically
- `defaultLanguage` - Current default language (reactive state)
- `clearCache()` - Clear local translation cache
- `getCacheStats()` - Get cache statistics
- `updateDefaultLanguage(language?)` - Update the default language (triggers re-renders)
- `getDefaultLanguage()` - Get the current default language

### LiveI18nProvider Component

| Prop | Type | Description |
|------|------|-------------|
| `config` | `LiveI18nConfig` | Configuration object with API credentials |
| `children` | `ReactNode` | Child components that will have access to translation |

### LiveI18nConfig

| Prop | Type | Description |
|------|------|-------------|
| `apiKey` | `string` | Your LiveI18n API key |
| `customerId` | `string` | Your customer ID |
| `defaultLanguage` | `string?` | Default target language (optional) |
| `batch_requests` | `boolean?` | Enable request batching for efficiency (default: true) |
| `debug` | `boolean?` | Enable debug logging (default: false) |
| `cache` | `object?` | Cache configuration (optional) |

## Configuration

### Default Language

The `defaultLanguage` option controls the target language for all translations when no `language` prop is specified on individual `LiveText` components.

**Auto-detection (recommended for global apps):**
```typescript
<LiveI18nProvider config={{
  apiKey: 'your-api-key',
  customerId: 'your-customer-id'
  // No defaultLanguage - uses browser language
}}>
  <App />
</LiveI18nProvider>
```

**Fixed language (recommended for region-specific apps):**
```typescript
<LiveI18nProvider config={{
  apiKey: 'your-api-key',
  customerId: 'your-customer-id',
  defaultLanguage: 'es-ES' // Always translate to Spanish
}}>
  <App />
</LiveI18nProvider>
```

**Dynamic language switching:**
```typescript
function LanguageSwitcher() {
  const { updateDefaultLanguage } = useLiveI18n();
  
  return (
    <div>
      <button onClick={() => updateDefaultLanguage('fr-FR')}>
        Switch to French
      </button>
      <button onClick={() => updateDefaultLanguage(undefined)}>
        Auto-detect language
      </button>
    </div>
  );
}
```

### Advanced Configuration

```typescript
<LiveI18nProvider config={{
  apiKey: 'your-api-key',
  customerId: 'your-customer-id',
  defaultLanguage: 'es-ES',
  batch_requests: true,     // Enable batching (default: true)
  debug: false,             // Enable debug logging (default: false)
  cache: {
    preload: true,          // Preload cache from localStorage
    entrySize: 1000,        // Max cache entries
    ttlHours: 3,            // Cache TTL in hours
    persistent: true        // Use localStorage + memory cache
  }
}}>
  <App />
</LiveI18nProvider>
```

### Request Batching

By default, the SDK automatically batches translation requests that aren't found in cache for improved performance:

```typescript
<LiveI18nProvider config={{
  apiKey: 'your-api-key',
  customerId: 'your-customer-id',
  batch_requests: true  // Default: true
}}>
  <div>
    {/* These requests will be batched together if not cached */}
    <LiveText>Hello</LiveText>
    <LiveText>World</LiveText>
    <LiveText>Welcome</LiveText>
  </div>
</LiveI18nProvider>
```

**Batching behavior:**
- Only requests that miss cache are batched
- Batches are sent when 10 requests are queued OR after 50ms timeout
- If batch API fails, individual requests are sent as fallback
- Can be disabled by setting `batch_requests: false`

**Benefits:**
- Reduces API calls and latency
- More efficient for apps with many simultaneous translations
- Transparent to your components - no code changes needed

## Features

- ✅ **React Context Provider** - Clean, modern React architecture
- ✅ **Automatic Re-renders** - Components automatically update when language changes
- ✅ **Request Batching** - Multiple translation requests are batched for efficiency (10 requests or 50ms timeout)
- ✅ **Automatic caching** - 500 entries, 1 hour TTL by default
- ✅ **Graceful fallback** to original text on errors
- ✅ **TypeScript support** with full type definitions
- ✅ **Real-time translation** with retry logic
- ✅ **Context-aware translations** for better accuracy
- ✅ **Tone control** (formal, casual, etc.)
- ✅ **Reactive language switching** with instant UI updates
- ✅ **localStorage persistence** for cached translations

## Migration from Legacy API

If you're upgrading from an older version that used `initializeLiveI18n()`:

```typescript
// OLD (deprecated)
import { initializeLiveI18n } from '@livei18n/react-sdk';
initializeLiveI18n({ apiKey: '...', customerId: '...' });

// NEW (recommended)
import { LiveI18nProvider } from '@livei18n/react-sdk';
<LiveI18nProvider config={{ apiKey: '...', customerId: '...' }}>
  <App />
</LiveI18nProvider>
```

The legacy functions still work but will show deprecation warnings. The new provider pattern offers:
- Better React integration
- Automatic re-renders on language changes
- No global state management
- Easier testing

## Cache Key Algorithm

This SDK generates canonical cache keys that are sent to the backend, eliminating any risk of cache key drift between frontend and backend implementations.

## License

MIT
