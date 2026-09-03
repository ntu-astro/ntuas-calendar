/**
 * Shared API contract types between backend Worker and client.
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
