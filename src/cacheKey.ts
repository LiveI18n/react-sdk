/**
 * CANONICAL Cache Key Generation Algorithm
 * 
 * CRITICAL: This is the single source of truth for cache key generation.
 * The backend does NOT generate cache keys - it uses the key provided by this SDK.
 * This eliminates any risk of cache key drift between frontend and backend.
 */

export function generateCacheKey(
  customerId: string,
  text: string,
  locale: string,
  context: string = '',
  tone: string = ''
): string {
  // Step 1: Normalize ALL inputs to lowercase and trim
  const normalized = {
    c: customerId,
    t: text.trim().toLowerCase(),
    l: locale.toLowerCase(),
    ctx: context.trim().toLowerCase(),
    tn: tone.trim().toLowerCase()
  };

  // Step 2: Sort keys alphabetically to ensure consistent ordering
  const sortedKeys = Object.keys(normalized).sort();
  const sortedObj: Record<string, string> = {};
  sortedKeys.forEach(key => {
    sortedObj[key] = normalized[key as keyof typeof normalized];
  });

  // Step 3: Create JSON string
  const jsonString = JSON.stringify(sortedObj);

  // Step 4: Generate hash (using synchronous version for simplicity)
  return hashStringSync(jsonString);
}

/**
 * Generate a deterministic hash from a string
 * Uses Web Crypto API when available, otherwise falls back to simple hash
 */
async function hashString(str: string): Promise<string> {
  // Try Web Crypto API (available in modern browsers and Node.js 16+)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fall through to simple hash
    }
  }

  // Fallback to simple deterministic hash
  return simpleHash(str);
}

/**
 * Synchronous version of hashString for compatibility
 */
function hashStringSync(str: string): string {
  // Use simple hash for synchronous operation
  return simpleHash(str);
}

/**
 * Simple deterministic hash function
 * Not cryptographically secure, but good enough for cache keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string with padding
  const hex = Math.abs(hash).toString(16);
  return hex.length >= 8 ? hex : '0'.repeat(8 - hex.length) + hex;
}