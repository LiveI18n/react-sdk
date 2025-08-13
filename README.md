# @livei18n/react

React SDK for LiveI18n real-time translation platform.

## Installation

```bash
npm install @livei18n/react
```

## Quick Start

### 1. Initialize the SDK

```typescript
import { initializeLiveI18n } from '@livei18n/react';

// Initialize once in your app root
initializeLiveI18n({
  apiKey: 'your-api-key',
  customerId: 'your-customer-id',
  endpoint: 'https://api.livei18n.com' // optional
});
```

### 2. Use the LiveText Component

```jsx
import { LiveText } from '@livei18n/react';

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
import { useLiveI18n } from '@livei18n/react';

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
- `submitFeedback(original, translated, locale, rating, correction?)` - Submit translation feedback
- `clearCache()` - Clear local translation cache
- `getCacheStats()` - Get cache statistics

## Features

- ✅ Automatic caching (500 entries, 1 hour TTL)
- ✅ Graceful fallback to original text
- ✅ TypeScript support
- ✅ Real-time translation
- ✅ Context-aware translations
- ✅ Tone control
- ✅ Feedback system

## Cache Key Algorithm

This SDK generates canonical cache keys that are sent to the backend, eliminating any risk of cache key drift between frontend and backend implementations.

## License

MIT