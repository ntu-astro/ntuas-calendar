import type { ApiEvent } from './api-types.js';

export interface CategoryStyle {
	label?: string;
	color: string;
	colorLight: string;
}

export interface CalendarState {
	renderedStart: Date | null;
	renderedEnd: Date | null;
	weekElements: Map<string, HTMLElement>;
	BUFFER_WEEKS: number;
	MAX_WEEKS: number;
	observers: {
		sentinel?: IntersectionObserver;
		header?: IntersectionObserver;
	};
	updateVisibleMonth?: () => void;
}

// ─── Mutable module-scope bindings ───
export let eventsData: ApiEvent[] = [];
export let miniCalDate: Date = new Date();
export let currentVisibleMonth: string | null = null;
export let CATEGORY_CONFIG: Record<string, CategoryStyle> = {};

// Mutable containers — binding is stable, contents change in place.
export const activeCategories = new Set<string>();

export const STATE: CalendarState = {
	renderedStart: null,
	renderedEnd: null,
	weekElements: new Map(),
	BUFFER_WEEKS: 16,
	MAX_WEEKS: 60,
	observers: {},
};

// ─── Setters for let bindings ───
export function setEventsData(v: ApiEvent[]): void {
	eventsData = v;
}
export function setMiniCalDate(v: Date): void {
	miniCalDate = v;
}
export function setCurrentVisibleMonth(v: string | null): void {
	currentVisibleMonth = v;
}
export function setCategoryConfig(v: Record<string, CategoryStyle>): void {
	CATEGORY_CONFIG = v;
}
