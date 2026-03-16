/**
 * format.ts
 *
 * Utility functions for formatting search result metadata.
 * These are pure functions with no Vue dependencies.
 */

/** Convert a snake_case or camelCase key to a readable label. */
export function formatMetadataKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/** Format an authors list: handle string, array of strings, or array of {name} objects. */
export function formatAuthors(authors: unknown): string {
  if (!authors) return ''
  if (typeof authors === 'string') return authors
  if (Array.isArray(authors)) {
    return authors
      .map((a) =>
        typeof a === 'object' && a !== null && 'name' in a
          ? String((a as { name: unknown }).name)
          : String(a),
      )
      .filter(Boolean)
      .join('; ')
  }
  return String(authors)
}

/**
 * Format a geographic coverage entry (can be string or object).
 */
export function formatGeo(
  item: string | { title?: string; name?: string; [key: string]: unknown },
): string {
  if (typeof item === 'string') return item
  return item.title ?? item.name ?? JSON.stringify(item)
}

/** Truncate a string to maxChars, appending ellipsis if needed. */
export function truncate(text: string, maxChars = 200): string {
  if (!text || text.length <= maxChars) return text
  return text.slice(0, maxChars).trimEnd() + '…'
}

/** Build a DOI URL from a DOI string (handles both bare DOIs and full URLs). */
export function doiUrl(doi: string): string {
  if (!doi) return ''
  if (doi.startsWith('http')) return doi
  return `https://doi.org/${doi}`
}

/** Return true if the value is a non-empty plain object (not array, not null). */
export function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}

/** Return true if the value is a non-empty array. */
export function isNonEmptyArray(val: unknown): val is unknown[] {
  return Array.isArray(val) && val.length > 0
}
