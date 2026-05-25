import { MAX_SUMMARY_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_LOCATION_LENGTH, VALID_STATUSES } from '../constants';
import { toIcsDate, toIcsDateOnly, sanitizeIcsOrganizerName } from './ics';

export interface EventInput {
	isAllDay: boolean;
	dtstart: string;
	dtend: string | null;
	summary: string;
	description: string | null;
	location: string | null;
	transp: string;
	geo: string | null;
	categories: string | null;
	class: string;
	status: string;
	url: string | null;
	organizer: string | null;
	attachUri: string | null;
	attachFmttype: string | null;
	alarmAction: string | null;
	alarmTrigger: string | null;
	alarmDescription: string | null;
}

export interface ValidationError {
	status: number;
	body: { success: false; error: string };
}

export type ValidationResult = { ok: true; input: EventInput } | { ok: false; error: ValidationError };

const ALARM_TRIGGER_MAP: Record<string, string> = {
	'At time of event': '-PT0M',
	'5 minutes before': '-PT5M',
	'10 minutes before': '-PT10M',
	'15 minutes before': '-PT15M',
	'30 minutes before': '-PT30M',
	'1 hour before': '-PT1H',
	'2 hours before': '-PT2H',
	'1 day before': '-P1D',
	'2 days before': '-P2D',
	'1 week before': '-P1W',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(status: number, error: string): ValidationResult {
	return { ok: false, error: { status, body: { success: false, error } } };
}

function nullable(value: File | string | null): string | null {
	if (value === null) return null;
	const s = String(value);
	return s.length === 0 ? null : s;
}

export function parseAndValidateEventInput(formData: FormData): ValidationResult {
	const summary = (formData.get('summary') as string | null) ?? '';
	if (!summary || summary.trim().length === 0) {
		return fail(400, 'Event title is required.');
	}
	if (summary.length > MAX_SUMMARY_LENGTH) {
		return fail(400, `Event title must be ${MAX_SUMMARY_LENGTH} characters or less.`);
	}

	const isAllDay = formData.get('is_all_day') === '1';
	const rawDtstart = formData.get('dtstart') as string | null;
	const rawDtend = formData.get('dtend') as string | null;

	let dtstart: string | null;
	let dtend: string | null;

	if (isAllDay) {
		dtstart = toIcsDateOnly(rawDtstart);
		dtend = toIcsDateOnly(rawDtend);
		if (dtstart && !dtend && rawDtstart) {
			const d = new Date(rawDtstart);
			d.setUTCDate(d.getUTCDate() + 1);
			dtend = toIcsDateOnly(d.toISOString());
		}
	} else {
		dtstart = toIcsDate(rawDtstart);
		dtend = toIcsDate(rawDtend);
	}

	if (!dtstart) return fail(400, 'Start date is required.');

	const description = nullable(formData.get('description'));
	if (description && description.length > MAX_DESCRIPTION_LENGTH) {
		return fail(400, `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`);
	}

	const location = nullable(formData.get('location'));
	if (location && location.length > MAX_LOCATION_LENGTH) {
		return fail(400, `Location must be ${MAX_LOCATION_LENGTH} characters or less.`);
	}

	const status = (formData.get('status') as string | null) || 'CONFIRMED';
	if (!(VALID_STATUSES as readonly string[]).includes(status)) {
		return fail(400, 'Invalid status value.');
	}

	const orgName = nullable(formData.get('organizer_name'));
	const orgEmail = nullable(formData.get('organizer_email'));
	if (orgEmail && !EMAIL_RE.test(orgEmail)) {
		return fail(400, 'Invalid organizer email format.');
	}

	let organizer: string | null = null;
	if (orgName && orgEmail) {
		organizer = `;CN=${sanitizeIcsOrganizerName(orgName)}:mailto:${orgEmail}`;
	} else if (orgEmail) {
		organizer = `mailto:${orgEmail}`;
	}

	const transp = isAllDay ? 'TRANSPARENT' : (formData.get('transp') as string | null) || 'OPAQUE';

	const rawAlarmTrigger = nullable(formData.get('alarm_trigger'));
	const alarmTrigger = rawAlarmTrigger ? (ALARM_TRIGGER_MAP[rawAlarmTrigger] ?? rawAlarmTrigger) : null;

	return {
		ok: true,
		input: {
			isAllDay,
			dtstart,
			dtend,
			summary,
			description,
			location,
			transp,
			geo: nullable(formData.get('geo')),
			categories: nullable(formData.get('categories')),
			class: (formData.get('class') as string | null) || 'PUBLIC',
			status,
			url: nullable(formData.get('url')),
			organizer,
			attachUri: nullable(formData.get('attach_uri')),
			attachFmttype: nullable(formData.get('attach_fmttype')),
			alarmAction: (formData.get('alarm_action') as string | null) || 'DISPLAY',
			alarmTrigger,
			alarmDescription: nullable(formData.get('alarm_desc')) || 'Event Reminder',
		},
	};
}
