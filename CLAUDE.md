# CLAUDE.md — Developer Notes for AI Agents

## Local Development Constraints

### No D1 Database Access on Local Dev

The local dev server (`npm run dev` → `http://localhost:8787`) does **not** have access to the production or a local Cloudflare D1 database.

**Consequences:**
- `/api/events` returns no data
- The public calendar page renders no events and no event categories
- The category filter sidebar section is empty

**Do not** attempt to verify event rendering, category filter behavior, or any data-driven UI by loading the local dev preview and checking for real data. It will always appear empty.

**Workaround for UI verification:** Inject fixture data directly via `preview_eval` after the page loads:

```js
// Inject stub categories for UI testing
Object.keys(CATEGORY_CONFIG).forEach(k => delete CATEGORY_CONFIG[k]);
Object.assign(CATEGORY_CONFIG, {
  work:     { label: 'Work',     color: '#337ea9', colorLight: '#ddebf1' },
  personal: { label: 'Personal', color: '#e03e3e', colorLight: '#ffe2dd' },
  study:    { label: 'Study',    color: '#448361', colorLight: '#ddedea' },
});
activeCategories.clear();
Object.keys(CATEGORY_CONFIG).forEach(k => activeCategories.add(k));
renderCategoryFilter();
```

For full end-to-end testing with real events, use the deployed Cloudflare Worker environment (production or a staging deployment with D1 bindings).
