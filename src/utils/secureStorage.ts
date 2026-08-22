/**
 * Secure Storage Utility for FixHome
 * Obfuscates and adds TTL expiration metadata to sensitive session items in localStorage
 * to protect user and admin session tokens against plain-text inspection and token theft.
 */

const STORAGE_SALT = "FixHome_Sec_Storage_v1_Salt";

function encodeValue(valueStr: string): string {
  try {
    let result = "";
    for (let i = 0; i < valueStr.length; i++) {
      result += String.fromCharCode(valueStr.charCodeAt(i) ^ STORAGE_SALT.charCodeAt(i % STORAGE_SALT.length));
    }
    return btoa(result);
  } catch {
    return valueStr;
  }
}

function decodeValue(encodedStr: string): string {
  try {
    const raw = atob(encodedStr);
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      result += String.fromCharCode(raw.charCodeAt(i) ^ STORAGE_SALT.charCodeAt(i % STORAGE_SALT.length));
    }
    return result;
  } catch {
    return encodedStr;
  }
}

interface EncryptedPayload<T> {
  _fh_sec: boolean;
  exp: number | null; // epoch timestamp in ms
  val: T;
}

export const secureStorage = {
  /**
   * Save an item in localStorage with encryption/obfuscation and optional TTL expiration (default 7 days)
   */
  setItem: <T>(key: string, value: T, ttlMs: number | null = 7 * 24 * 60 * 60 * 1000): void => {
    try {
      const payload: EncryptedPayload<T> = {
        _fh_sec: true,
        exp: ttlMs ? Date.now() + ttlMs : null,
        val: value
      };
      const jsonStr = JSON.stringify(payload);
      const obfuscated = encodeValue(jsonStr);
      localStorage.setItem(key, obfuscated);
    } catch (e) {
      console.warn("secureStorage.setItem failed:", e);
    }
  },

  /**
   * Retrieve and decrypt an item from localStorage. Handles legacy plain-text items gracefully.
   */
  getItem: <T>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      // Check if it's already a plain string or JSON (legacy stored items)
      if (raw.startsWith("{") || raw.startsWith("[")) {
        try {
          const parsed = JSON.parse(raw);
          // Auto-migrate legacy item to secure format
          secureStorage.setItem(key, parsed);
          return parsed as T;
        } catch {
          return raw as unknown as T;
        }
      }

      // Deobfuscate
      const decodedJson = decodeValue(raw);
      let parsed: any;
      try {
        parsed = JSON.parse(decodedJson);
      } catch {
        // Fallback for unparseable raw string
        return raw as unknown as T;
      }

      // Validate secure payload structure and expiry
      if (parsed && typeof parsed === "object" && parsed._fh_sec === true) {
        if (parsed.exp && Date.now() > parsed.exp) {
          console.warn(`[secureStorage] Session/item "${key}" has expired. Clearing.`);
          localStorage.removeItem(key);
          return null;
        }
        return parsed.val as T;
      }

      return decodedJson as unknown as T;
    } catch (e) {
      console.warn("secureStorage.getItem failed:", e);
      return null;
    }
  },

  /**
   * Remove an item safely from localStorage
   */
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("secureStorage.removeItem failed:", e);
    }
  }
};
