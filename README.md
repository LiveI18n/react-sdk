# @livei18n/react-sdk

React SDK for LiveI18n real-time translation platform.

## Installation

```bash
npm install @livei18n/react-sdk
```

## Quick Start

### 1. Initialize the SDK

```typescript
import { initializeLiveI18n } from '@livei18n/react-sdk';

// Initialize once in your app root
initializeLiveI18n({
  apiKey: 'your-api-key',
  customerId: 'your-customer-id',
  defaultLanguage: 'es-ES' // optional - target language for translations
});
```

### 2. Use the LiveText Component

```jsx
import { LiveText } from '@livei18n/react-sdk';

function App() {
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
  const { translate } = useLiveI18n();
  
  const handleClick = async () => {
    const translated = await translate('Hello World', {
      tone: 'casual',
      language: 'es-ES'
    });
    console.log(translated);
  };
  
  return <button onClick={handleClick}>Translate</button>;
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

Returns an object with:

- `translate(text, options)` - Translate text programmatically
- `clearCache()` - Clear local translation cache
- `getCacheStats()` - Get cache statistics
- `updateDefaultLanguage(language?)` - Update the default language
- `getDefaultLanguage()` - Get the current default language

## Configuration

### Default Language

The `defaultLanguage` option controls the target language for all translations when no `language` prop is specified on individual `LiveText` components.

**Auto-detection (recommended for global apps):**
```typescript
initializeLiveI18n({
  apiKey: 'your-api-key',
  customerId: 'your-customer-id'
  // No defaultLanguage - uses browser language
});
```

**Fixed language (recommended for region-specific apps):**
```typescript
initializeLiveI18n({
  apiKey: 'your-api-key',
  customerId: 'your-customer-id',
  defaultLanguage: 'es-ES' // Always translate to Spanish
});
```

**Dynamic language switching:**
```typescript
import { updateDefaultLanguage } from '@livei18n/react-sdk';

// Switch to French
updateDefaultLanguage('fr-FR');

// Enable auto-detection
updateDefaultLanguage(undefined);
```

## Features

- ✅ Automatic caching (500 entries, 1 hour TTL)
- ✅ Graceful fallback to original text
- ✅ TypeScript support
- ✅ Real-time translation
- ✅ Context-aware translations
- ✅ Tone control
- ✅ Default language configuration

## Cache Key Algorithm

This SDK generates canonical cache keys that are sent to the backend, eliminating any risk of cache key drift between frontend and backend implementations.

## License

MIT
