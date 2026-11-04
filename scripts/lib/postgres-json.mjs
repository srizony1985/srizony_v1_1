import { randomBytes } from 'node:crypto';

/**
 * Parse PostgreSQL JSON text without coercing BIGINT/NUMERIC tokens through
 * JavaScript's IEEE-754 number representation. This keeps IDs and money exact.
 */
export function parsePostgresJson(rawJson) {
  const nonce = randomBytes(12).toString('hex');
  const numericTokens = new Map();
  let safeJson = '';
  let inString = false;
  let escaped = false;
  let index = 0;

  while (index < rawJson.length) {
    const char = rawJson[index];
    if (inString) {
      safeJson += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      safeJson += char;
      index += 1;
      continue;
    }
    if (char === '-' || (char >= '0' && char <= '9')) {
      const match = rawJson.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (match) {
        const marker = `__SF_LOSSLESS_${nonce}_${numericTokens.size}__`;
        numericTokens.set(marker, match[0]);
        safeJson += JSON.stringify(marker);
        index += match[0].length;
        continue;
      }
    }
    safeJson += char;
    index += 1;
  }

  let value;
  try {
    value = JSON.parse(safeJson);
  } catch {
    throw new Error('PostgreSQL returned invalid JSON.');
  }
  return { value, numericTokens };
}

/** Serialize parsed PostgreSQL JSON while restoring its original number tokens. */
export function stringifyPostgresJson(value, numericTokens = new Map()) {
  let json = JSON.stringify(value);
  for (const [marker, number] of numericTokens) {
    json = json.replaceAll(JSON.stringify(marker), number);
  }
  return `${json}\n`;
}

/** Return the raw token for a number preserved by parsePostgresJson. */
export function originalNumericValue(value, numericTokens = new Map()) {
  return numericTokens.get(value) ?? value;
}
