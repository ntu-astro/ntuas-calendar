export const DEFAULT_PAST_DAYS = 30;
export const DEFAULT_FUTURE_DAYS = 180;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface Range {
	/** ISO date YYYY-MM-DD, inclusive lower bound */
	from: string;
	/** ISO date YYYY-MM-DD, inclusive upper bound */
	to: string;
}

export type ParseResult = Range | { error: Response };

function isoDate(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function badRequest(msg: string): Response {
	return new Response(JSON.stringify({ error: msg }), {
		status: 400,
		headers: { 'Content-Type': 'application/json' },
	});
}

export function parseRange(url: URL): ParseResult {
	const now = new Date();

	const rawFrom = url.searchParams.get('from');
	const rawTo = url.searchParams.get('to');

	let from: string;
	if (rawFrom === null || rawFrom === '') {
		const past = new Date(now);
		past.setUTCDate(past.getUTCDate() - DEFAULT_PAST_DAYS);
		from = isoDate(past);
	} else {
		if (!DATE_RE.test(rawFrom) || Number.isNaN(Date.parse(`${rawFrom}T00:00:00Z`))) {
			return { error: badRequest('Invalid `from` — expected YYYY-MM-DD') };
		}
		from = rawFrom;
	}

	let to: string;
	if (rawTo === null || rawTo === '') {
		const future = new Date(now);
		future.setUTCDate(future.getUTCDate() + DEFAULT_FUTURE_DAYS);
		to = isoDate(future);
	} else {
		if (!DATE_RE.test(rawTo) || Number.isNaN(Date.parse(`${rawTo}T00:00:00Z`))) {
			return { error: badRequest('Invalid `to` — expected YYYY-MM-DD') };
		}
		to = rawTo;
	}

	if (Date.parse(`${from}T00:00:00Z`) > Date.parse(`${to}T00:00:00Z`)) {
		return { error: badRequest('`from` must be on or before `to`') };
	}

	return { from, to };
}
