const STORAGE_KEY = "polymarket-gemini-api-key";

export function getStoredGeminiApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function setStoredGeminiApiKey(apiKey: string): void {
  window.localStorage.setItem(STORAGE_KEY, apiKey.trim());
}

export function clearStoredGeminiApiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
