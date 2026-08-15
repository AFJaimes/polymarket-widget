export function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  if (firstBrace >= 0) {
    return trimmed.slice(firstBrace);
  }
  return trimmed;
}

/** Best-effort repair for truncated Gemini JSON (unterminated strings / missing closers). */
export function repairJsonText(raw: string): string {
  let text = extractJsonText(raw).replace(/^\uFEFF/, "").trim();

  // Normalize smart quotes that break JSON.parse
  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  try {
    JSON.parse(text);
    return text;
  } catch {
    // continue repairing
  }

  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    if (ch === "[") stack.push("]");
    if ((ch === "}" || ch === "]") && stack.length > 0 && stack[stack.length - 1] === ch) {
      stack.pop();
    }
  }

  if (inString) {
    text += '"';
  }
  // Drop dangling comma before closers we will append
  text = text.replace(/,\s*$/, "");
  while (stack.length > 0) {
    text += stack.pop();
  }

  return text;
}

export function parseLlmJson<T = unknown>(raw: string): T {
  const candidates = [extractJsonText(raw), repairJsonText(raw)];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to parse model JSON");
}
