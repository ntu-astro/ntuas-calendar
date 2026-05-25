export const SESSION_MAX_AGE_SECONDS = 86400;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_LOGIN_ATTEMPTS = 5;
export const ICS_LINE_FOLD_OCTETS = 75;
export const MAX_SUMMARY_LENGTH = 500;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_LOCATION_LENGTH = 500;
export const VALID_STATUSES = ['CONFIRMED', 'TENTATIVE', 'CANCELLED'] as const;

export const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
	'Content-Security-Policy':
		"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'",
};
