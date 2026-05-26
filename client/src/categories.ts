import type { ApiEvent } from './api-types.js';
import {
	activeCategories,
	eventsData,
	CATEGORY_CONFIG,
	setCategoryConfig,
	type CategoryStyle,
} from './state.js';
import { refreshAllDayChips } from './weekGrid.js';
import { renderUpcomingEvents } from './eventDetail.js';

export const NOTION_PALETTE: ReadonlyArray<CategoryStyle> = [
	{ color: '#337ea9', colorLight: '#ddebf1' }, // blue
	{ color: '#e03e3e', colorLight: '#ffe2dd' }, // red
	{ color: '#d9730d', colorLight: '#faebdd' }, // orange
	{ color: '#448361', colorLight: '#ddedea' }, // green
	{ color: '#9065b0', colorLight: '#eae4f2' }, // purple
	{ color: '#c14c8a', colorLight: '#f4dfeb' }, // pink
	{ color: '#cb912f', colorLight: '#fbf3db' }, // yellow
	{ color: '#64473a', colorLight: '#e9e5e3' }  // brown
];

export const DEFAULT_CATEGORY: CategoryStyle = { color: '#787774', colorLight: '#ebeced' };

export function buildCategoriesFromEvents(): void {
	const seen = new Map<string, string>();
	for (const e of eventsData) {
		if (!e || !e.categories) continue;
		const raw = String(e.categories).split(/[,;]/)[0].trim();
		if (!raw) continue;
		const key = raw.toLowerCase();
		if (!seen.has(key)) seen.set(key, raw);
	}
	const sortedKeys = [...seen.keys()].sort();
	const config: Record<string, CategoryStyle> = {};
	activeCategories.clear();
	sortedKeys.forEach((key, i) => {
		const palette = NOTION_PALETTE[i % NOTION_PALETTE.length];
		config[key] = { label: seen.get(key), ...palette };
		activeCategories.add(key);
	});
	setCategoryConfig(config);
}

export function getCategoryKey(evt: ApiEvent): string | null {
	if (!evt || !evt.categories) return null;
	const first = String(evt.categories).toLowerCase().split(/[,;]/)[0].trim();
	return first && CATEGORY_CONFIG[first] ? first : null;
}

export function getCategoryStyle(evt: ApiEvent): CategoryStyle {
	const key = getCategoryKey(evt);
	return key ? CATEGORY_CONFIG[key] : DEFAULT_CATEGORY;
}

export function isCategoryVisible(evt: ApiEvent): boolean {
	const key = getCategoryKey(evt);
	return key === null || activeCategories.has(key);
}

function buildCheckSvg(): SVGElement {
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '3.5');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	const p = document.createElementNS(SVG_NS, 'path');
	p.setAttribute('d', 'M5 12.5l5 5L20 7');
	svg.appendChild(p);
	return svg;
}

export function renderCategoryFilter(): void {
	const container = document.getElementById('eventCategories');
	if (!container) return;
	container.textContent = '';
	for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
		const row = document.createElement('div');
		row.className = 'category-item';
		row.dataset.category = key;
		row.style.setProperty('--cat-color', cfg.color);
		row.style.setProperty('--cat-color-light', cfg.colorLight);
		const icon = document.createElement('span');
		icon.className = 'category-icon';
		icon.appendChild(buildCheckSvg());
		const label = document.createElement('span');
		label.className = 'category-label';
		label.textContent = cfg.label || '';
		row.append(icon, label);
		row.addEventListener('click', () => {
			if (activeCategories.has(key)) {
				activeCategories.delete(key);
				row.classList.add('inactive');
			} else {
				activeCategories.add(key);
				row.classList.remove('inactive');
			}
			refreshAllDayChips();
			renderUpcomingEvents();
		});
		container.appendChild(row);
	}
}
