export function handleHealth(url: URL): Response | null {
	if (url.pathname !== '/health') return null;
	return Response.json({ status: 'ok' });
}
