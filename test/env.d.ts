declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {}
}

// Vite-style raw import: returns the file contents as a string.
declare module '*.sql?raw' {
	const content: string;
	export default content;
}
