import type { ApiEvent } from './api-types.js';

/**
 * Fetches events from the API within an optional date range.
 * 
 * @param from - Start date in YYYY-MM-DD format
 * @param to - End date in YYYY-MM-DD format
 * @returns A promise that resolves to an array of ApiEvents
 */
export async function fetchEvents(from?: string, to?: string): Promise<ApiEvent[]> {
	let url = '/api/events';
	if (from && to) {
		url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
	}
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`/api/events returned HTTP ${res.status}`);
	}
	return (await res.json()) as ApiEvent[];
}
