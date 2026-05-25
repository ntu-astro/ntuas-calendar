import { ICS_LINE_FOLD_OCTETS } from '../constants';

/**
 * RFC 5545 line folding: breaks long lines at 75 octets with CRLF+SPACE continuation.
 * This is critical for compatibility with calendar clients that strictly enforce the spec.
 *
 * Important: Octet count is bytes, not characters. Multi-byte UTF-8 characters (like CJK)
 * must be split correctly to avoid breaking in the middle of a character sequence.
 *
 * @param line The unfolded ICS property line
 * @returns Line folded to 75-octet chunks, joined with \r\n (CRLF)
 */
export function fold(line: string): string {
	const encoder = new TextEncoder();
	const parts: string[] = [];
	let remaining = line;

	while (encoder.encode(remaining).byteLength > ICS_LINE_FOLD_OCTETS) {
		let end = remaining.length;
		while (end > 0 && encoder.encode(remaining.slice(0, end)).byteLength > ICS_LINE_FOLD_OCTETS) {
			end--;
		}
		if (end === 0) end = 1; // at least one character per line
		parts.push(remaining.slice(0, end));
		remaining = ' ' + remaining.slice(end);
	}
	parts.push(remaining);
	return parts.join('\r\n');
}

/**
 * RFC 5545 datetime format for timed events.
 * Converts ISO 8601 datetime to RFC 5545 DATETIME with UTC-Z suffix.
 *
 * Format: YYYYMMDDTHHmmssZ (e.g., 20260409T153045Z for Apr 9, 2026 3:30:45 PM UTC)
 * The 'Z' suffix indicates UTC/Zulu time.
 *
 * @param dateStr ISO 8601 datetime string (e.g., "2026-04-09T15:30:45.000Z")
 * @returns RFC 5545 DATETIME format or null if input is null/undefined
 */
export function toIcsDate(dateStr: string | null): string | null {
	if (!dateStr) return null;
	return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * RFC 5545 date format for all-day events.
 * Converts date to DATE value format (time component omitted).
 *
 * Format: YYYYMMDD (e.g., 20260409 for Apr 9, 2026)
 * Used with VALUE=DATE parameter in DTSTART/DTEND properties for all-day events.
 * RFC 5545: All-day events span from start date (inclusive) to end date (exclusive),
 * so end date must be incremented by 1 day if not provided.
 *
 * @param dateStr ISO 8601 datetime string
 * @returns RFC 5545 DATE format (YYYYMMDD) or null if input is null/undefined
 */
export function toIcsDateOnly(dateStr: string | null): string | null {
	if (!dateStr) return null;
	const d = new Date(dateStr);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}${m}${day}`;
}

/**
 * RFC 5545 text value escaping for SUMMARY, DESCRIPTION, LOCATION, CATEGORIES, etc.
 *
 * RFC 5545 requires escaping of: backslashes, semicolons, commas, and newlines.
 * Order matters!
 * 1. Escape backslashes FIRST (so we don't double-escape in subsequent steps)
 * 2. Escape punctuation (semicolons, commas)
 * 3. Convert newlines to \\n literal escape sequence
 *
 * @param value Raw ICS property value (may contain special characters)
 * @returns Escaped value safe for RFC 5545 property
 */
export function sanitizeIcsValue(value: string): string {
	// Escape backslashes first, then semicolons/commas, then convert newlines.
	// Order matters: newline → \n must happen last so the introduced backslash
	// is not re-escaped.
	return value
		.replace(/\\/g, '\\\\')
		.replace(/[;,]/g, (ch) => '\\' + ch)
		.replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Sanitize ORGANIZER CN (Common Name) field for RFC 5545 compatibility.
 *
 * The CN parameter in ORGANIZER cannot contain newlines, semicolons, or colons
 * as these are special characters in the RFC 5545 syntax. Removing them prevents
 * malformed ORGANIZER properties that might break calendar client parsing.
 *
 * Note: Unlike sanitizeIcsValue(), we strip characters entirely rather than escaping,
 * because CN is a parameter value, not a text field.
 *
 * @param name Organizer name (may contain special characters)
 * @returns Sanitized name with \r \n ; : removed
 */
export function sanitizeIcsOrganizerName(name: string): string {
	return name.replace(/[\r\n;:]/g, '');
}
