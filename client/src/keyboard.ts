import { scrollToDate } from './weekGrid.js';
import { openSearch, closeSearch } from './search.js';

/** True when the user is typing, so shortcuts must not hijack the key. */
function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function wireKeyboardShortcuts(): void {
	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeSearch();
			return;
		}
		if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

		switch (e.key) {
			case 't':
			case 'T':
				e.preventDefault();
				scrollToDate(new Date(), 'smooth');
				break;
			case '/':
				e.preventDefault();
				openSearch();
				break;
			default:
				break;
		}
	});
}
