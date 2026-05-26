/** Maps admin_sessions table row */
export interface AdminSession {
	token: string;
	csrf_token: string;
	created_at: string;
	expires_at: string;
}

/** Maps calendars table row */
export interface Calendar {
	id: string;
	prodid: string;
	version: string;
	calscale?: string;
	x_wr_calname?: string;
	x_wr_timezone?: string;
}

/** Maps events table row */
export interface Event {
	uid: string;
	calendar_id: string;
	dtstamp: string;
	dtstart: string;
	dtend?: string | null;
	duration?: string | null;
	transp?: string;
	summary?: string | null;
	description?: string | null;
	location?: string | null;
	geo?: string | null;
	categories?: string | null;
	class?: string;
	status?: string;
	url?: string | null;
	organizer_name?: string | null;
	organizer_email?: string | null;
	sequence?: number;
	created?: string | null;
	last_modified?: string | null;
}

/** Maps event_alarms table row */
export interface EventAlarm {
	id: number;
	event_uid: string;
	action?: string;
	trigger: string;
	description?: string | null;
	summary?: string | null;
	duration?: string | null;
	repeat?: number | null;
}

/** Maps event_attachments table row */
export interface EventAttachment {
	id: number;
	event_uid: string;
	uri?: string | null;
	binary_data?: Blob | null;
	fmttype?: string | null;
}

/** Query result type for login attempt count aggregation */
export interface LoginAttemptCount {
	cnt: number;
}
