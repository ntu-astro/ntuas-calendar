/**
 * Shape returned by GET /api/events. This is the SINGLE SOURCE OF TRUTH for the
 * client/server JSON contract. Server: src/routes/events.ts produces this shape.
 * Client: client/src/api.ts consumes this shape.
 */
export interface ApiEvent {
	uid: string;
	summary: string | null;
	dtstart: string;
	dtend: string | null;
	status: string | null;
	location: string | null;
	geo: string | null;
	description: string | null;
	categories: string | null;
	url: string | null;
	organizer: { name: string | null; email: string | null } | null;
}
