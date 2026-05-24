---
version: alpha
name: NTUAS-calendar-design
description: NTUAS Club Event Calendar is a Notion-inspired editorial calendar product with a signature blue primary CTA ({colors.primary}), a warm-neutral palette (canvas/surface + charcoal/slate/steel text), and sober rectangular geometry — 8px buttons, 12px cards, no pills except for status badges. Two surfaces share the system: the public month-grid calendar (left sidebar with mini-cal + category filter, main grid with event chips, right sidebar with upcoming events / detail) and the admin CRUD dashboard (panel cards + form inputs + edit modal), plus a centered login card. The today marker uses semantic-error red to keep the "now" beat visually distinct from the blue primary CTA.

colors:
  primary: "#0075de"
  primary-pressed: "#005bab"
  on-primary: "#ffffff"
  brand-pink: "#ff64c8"
  brand-pink-deep: "#a02e6d"
  brand-orange: "#dd5b00"
  brand-orange-deep: "#793400"
  brand-purple: "#7b3ff2"
  brand-purple-300: "#d6b6f6"
  brand-purple-800: "#391c57"
  brand-teal: "#2a9d99"
  brand-green: "#1aae39"
  brand-yellow: "#f5d75e"
  brand-brown: "#523410"
  card-tint-peach: "#ffe8d4"
  card-tint-rose: "#fde0ec"
  card-tint-mint: "#d9f3e1"
  card-tint-lavender: "#e6e0f5"
  card-tint-sky: "#dcecfa"
  card-tint-yellow: "#fef7d6"
  card-tint-cream: "#f8f5e8"
  card-tint-gray: "#f0eeec"
  canvas: "#ffffff"
  surface: "#f6f5f4"
  surface-soft: "#fafaf9"
  hairline: "#e5e3df"
  hairline-soft: "#ede9e4"
  hairline-strong: "#c8c4be"
  ink-deep: "#000000"
  ink: "#1a1a1a"
  charcoal: "#37352f"
  slate: "#5d5b54"
  steel: "#787671"
  stone: "#a4a097"
  muted: "#bbb8b1"
  on-dark: "#ffffff"
  on-dark-muted: "#a4a097"
  semantic-success: "#1aae39"
  semantic-warning: "#dd5b00"
  semantic-error: "#e03131"

typography:
  heading-1:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.5px
  heading-2:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.5px
  heading-3:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  heading-4:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.30
    letterSpacing: -0.01em
  heading-5:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.40
  subtitle:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.50
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-md-medium:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.55
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
  body-sm-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.50
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.40
  caption-bold:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.40
  micro:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.40
  micro-uppercase:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.40
    letterSpacing: 0.08em
  button-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.30

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  section-sm: 48px
  section: 64px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    height: 32px
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.muted}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.charcoal}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: 32px
    border: "1px solid {colors.hairline-strong}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
    typography: "{typography.body-sm-medium}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm-medium}"
    padding: "4px 0"
  button-delete:
    backgroundColor: "{colors.card-tint-rose}"
    textColor: "{colors.brand-pink-deep}"
    typography: "{typography.body-sm-medium}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    border: "1px solid {colors.hairline-strong}"
    height: 44px
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.primary}"
    shadow: "0 0 0 3px rgba(0, 117, 222, 0.18)"
  toggle-switch:
    trackColor: "{colors.hairline-strong}"
    trackColorOn: "{colors.primary}"
    knobColor: "{colors.canvas}"
    width: 40px
    height: 22px
  card-base:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: "1px solid {colors.hairline}"
  admin-panel:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: "1px solid {colors.hairline}"
  modal-overlay:
    backgroundColor: "rgba(0, 0, 0, 0.25)"
    backdropFilter: "blur(2px)"
  modal:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
    border: "1px solid {colors.hairline}"
    shadow: "rgba(15, 15, 15, 0.16) 0px 16px 48px -8px"
    maxWidth: 520px
  login-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "40px 32px"
    border: "1px solid {colors.hairline}"
    shadow: "rgba(15, 15, 15, 0.08) 0px 4px 12px 0px"
    maxWidth: 380px
  admin-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.charcoal}"
    height: 48px
    padding: "0 {spacing.xl}"
    border: "0 0 1px {colors.hairline} solid"
  left-sidebar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.charcoal}"
    width: 260px
    padding: "{spacing.sm} {spacing.md}"
    border: "0 1px 0 0 {colors.hairline} solid"
  right-sidebar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.charcoal}"
    width: 280px
    padding: "{spacing.lg}"
    border: "1px 0 0 0 {colors.hairline} solid"
  month-header-sticky:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-3}"
    padding: "{spacing.xs} {spacing.md}"
  day-cell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.charcoal}"
    padding: "6px 8px"
    border: "0 1px 1px 0 {colors.hairline} solid"
    minHeight: 80px
  day-cell-weekend:
    backgroundColor: "rgba(0, 0, 0, 0.018)"
  day-cell-other-month:
    textColor: "rgba(55, 53, 47, 0.32)"
  day-cell-selected:
    backgroundColor: "{colors.card-tint-sky}"
  day-number:
    typography: "{typography.body-sm}"
    textColor: "{colors.charcoal}"
  today-marker:
    backgroundColor: "{colors.semantic-error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    size: "22px"
  event-chip:
    backgroundColor: "{colors.card-tint-sky}"
    textColor: "{colors.charcoal}"
    typography: "{typography.micro}"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
  event-chip-more:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
    typography: "{typography.micro}"
    padding: "2px 0 0 2px"
  mini-cal-cell:
    cellSize: 28px
    typography: "{typography.caption}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.xs}"
  mini-cal-cell-today:
    backgroundColor: "{colors.semantic-error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
  mini-cal-cell-other-month:
    textColor: "{colors.stone}"
  category-filter-item:
    backgroundColor: "transparent"
    textColor: "{colors.charcoal}"
    typography: "{typography.body-sm-medium}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
  category-filter-item-inactive:
    textColor: "{colors.steel}"
  category-dot:
    rounded: "{rounded.xs}"
    size: "14px"
  badge-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-tag-mint:
    backgroundColor: "{colors.card-tint-mint}"
    textColor: "#0a6e1f"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-tag-peach:
    backgroundColor: "{colors.card-tint-peach}"
    textColor: "{colors.brand-orange-deep}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-tag-rose:
    backgroundColor: "{colors.card-tint-rose}"
    textColor: "{colors.brand-pink-deep}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-tag-sky:
    backgroundColor: "{colors.card-tint-sky}"
    textColor: "#003f7a"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-tag-lavender:
    backgroundColor: "{colors.card-tint-lavender}"
    textColor: "{colors.brand-purple-800}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  search-overlay:
    backgroundColor: "rgba(0, 0, 0, 0.18)"
    backdropFilter: "blur(2px)"
  search-modal:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.hairline}"
    shadow: "rgba(15, 15, 15, 0.16) 0px 16px 48px 0px"
    width: 540px
  search-result-item:
    backgroundColor: "transparent"
    textColor: "{colors.charcoal}"
    typography: "{typography.body-sm-medium}"
    padding: "{spacing.xs} {spacing.md}"
  error-banner:
    backgroundColor: "{colors.semantic-error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm-medium}"
    padding: "{spacing.xs} {spacing.md}"
---

## Overview

NTUAS Club Event Calendar is a two-surface product: a public month-grid calendar at `/` and an admin CRUD dashboard at `/admin` (with a centered login card at `/admin/login`). The system is Notion-inspired — humanist Inter typography, warm-neutral surfaces ({colors.canvas} / {colors.surface}), and sober rectangular geometry — but its dominant CTA is **blue** ({colors.primary}), not Notion's signature purple, to reflect the NTUAS brand.

The public calendar uses a three-column layout: a 260px **left sidebar** (mini-calendar + category filter + help button), a flexible **calendar area** (sticky month header with `heading-3` label, micro-uppercase day-name row, then a continuous week-row grid of day cells), and a 280px **right sidebar** that toggles between "Upcoming Events" and a single-event detail view. Today is marked with a {colors.semantic-error} red rounded-square so it stays visually distinct from the blue Subscribe CTA. Events appear as soft-sky `event-chip` labels inside their day cells; selecting a day applies a `card-tint-sky` background.

The admin dashboard is a single-column form/list layout inside a 860px-wide content area. Panel cards (`admin-panel`) hold the "Create Event" form and the existing-events list. Inputs use the 44px-tall `text-input` with a blue focus ring. Destructive actions use the `button-delete` rose chip; edits open a `modal` (12px rounded, deep elevation shadow) with the same form layout. The login surface is a centered `login-card` with the `button-primary` blue Sign In CTA.

**Key Characteristics:**
- Blue primary CTA ({colors.primary}) — Subscribe / Sign In / form submits / toggle-on / focus rings
- Red today marker ({colors.semantic-error}) — the only red on each surface, reserved for "now"
- Warm-charcoal text hierarchy: {colors.ink} → {colors.charcoal} → {colors.slate} → {colors.steel} → {colors.stone} → {colors.muted}
- Pastel `card-tint-*` family used for status badges (mint/peach/rose), day selection (sky), and the all-day badge (sky)
- 8px-rounded buttons + 12px-rounded cards — sober rectangular geometry, NOT pills (pills reserved for `badge-primary` status only)
- Micro-uppercase typography for sidebar/section headers ("UPCOMING EVENTS", day names, admin h3)
- Inter served from Google Fonts (humanist-geometric, weights 400/500/600/700)

## Colors

> All three surfaces (public calendar, admin dashboard, login) share these tokens. Source files: `public/index.html`, `ADMIN_HTML` + `LOGIN_HTML` in `src/index.ts`.

### Brand & Primary
- **Primary Blue** ({colors.primary}): The dominant CTA color — Subscribe button, Sign In, admin form submit, toggle-on, input focus ring, button-link text. Also doubles as the inline-link color (underlined). When used as a button background, pair with {colors.on-primary} text.
- **Primary Pressed** ({colors.primary-pressed}): Pressed/hover variant of the blue CTA.

### Brand Color Spectrum (event-chip categories + decorative)
The category-dot palette auto-derived from event metadata uses these brand-toned hues. JS assigns each unique category one of: pink, orange, purple, teal, green, yellow, brown, or a slate fallback. Dots in the left-sidebar `category-filter` mirror this palette.
- **Brand Pink** ({colors.brand-pink}) + **Pink Deep** ({colors.brand-pink-deep})
- **Brand Orange** ({colors.brand-orange}) + **Orange Deep** ({colors.brand-orange-deep})
- **Brand Purple** ({colors.brand-purple}) + **Purple 300** ({colors.brand-purple-300}) + **Purple 800** ({colors.brand-purple-800})
- **Brand Teal** ({colors.brand-teal})
- **Brand Green** ({colors.brand-green})
- **Brand Yellow** ({colors.brand-yellow})
- **Brand Brown** ({colors.brand-brown})

### Card Tints (Soft Surfaces)
- **Tint Peach** ({colors.card-tint-peach}): `badge-tag-peach` (tentative status), peach category fill
- **Tint Rose** ({colors.card-tint-rose}): `badge-tag-rose` (cancelled status), `button-delete` background, pink category fill
- **Tint Mint** ({colors.card-tint-mint}): `badge-tag-mint` (confirmed status), green category fill
- **Tint Lavender** ({colors.card-tint-lavender}): `badge-tag-lavender`, purple category fill
- **Tint Sky** ({colors.card-tint-sky}): Day-cell selection, `event-chip` default background, all-day badge, blue category fill
- **Tint Yellow** ({colors.card-tint-yellow}): Yellow category fill
- **Tint Cream** ({colors.card-tint-cream}): Reserved
- **Tint Gray** ({colors.card-tint-gray}): Reserved neutral

### Surface
- **Canvas** ({colors.canvas}): Page background for `/admin` form, `card-base`, `modal`, `login-card`, right sidebar, day cells
- **Surface** ({colors.surface}): Left-sidebar background, admin-header background, body background for admin/login pages, button-secondary hover
- **Surface Soft** ({colors.surface-soft}): Reserved for quieter section divisions
- **Hairline** ({colors.hairline}): Default 1px borders — day-cell grid, panel borders, sidebar dividers
- **Hairline Soft** ({colors.hairline-soft}): Quieter dividers between table rows
- **Hairline Strong** ({colors.hairline-strong}): Form input borders, secondary button borders

### Text
- **Ink Deep** ({colors.ink-deep}): Reserved for maximum contrast
- **Ink** ({colors.ink}): Headings (month label, modal titles, login title), input text values
- **Charcoal** ({colors.charcoal}): Primary body text, day-cell numbers, event titles
- **Slate** ({colors.slate}): Secondary body
- **Steel** ({colors.steel}): Tertiary — micro-uppercase labels, ghost button text, form labels, admin-link
- **Stone** ({colors.stone}): Muted labels, mini-cal other-month days
- **Muted** ({colors.muted}): Disabled, placeholders
- **On Dark** ({colors.on-dark}): White text on the today-marker, badges, primary button

### Semantic
- **Success** ({colors.semantic-success}): "Copied" state on Copy URL button
- **Warning** ({colors.semantic-warning}): Reserved
- **Error** ({colors.semantic-error}): Today marker, mini-cal today, error banner, error message, delete-button hover background

## Typography

### Font Family
**Inter** (served via Google Fonts at weights 400/500/600/700). Fallback chain: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`. The CSS also lists `'Notion Sans'` first as an opportunistic match for users who happen to have the proprietary face installed; in practice the rendered font is Inter.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.heading-1}` | 48px | 600 | 1.15 | -0.5px | Reserved |
| `{typography.heading-2}` | 36px | 600 | 1.20 | -0.5px | Reserved |
| `{typography.heading-3}` | 28px | 600 | 1.25 | -0.01em | Calendar month label (`#monthLabel`) |
| `{typography.heading-4}` | 22px | 600 | 1.30 | -0.01em | Login card title |
| `{typography.heading-5}` | 18px | 600 | 1.40 | 0 | Modal titles |
| `{typography.subtitle}` | 18px | 400 | 1.50 | 0 | Reserved |
| `{typography.body-md}` | 16px | 400 | 1.55 | 0 | Reserved |
| `{typography.body-md-medium}` | 16px | 500 | 1.55 | 0 | Reserved |
| `{typography.body-sm}` | 14px | 400 | 1.50 | 0 | Primary body, day numbers, input text |
| `{typography.body-sm-medium}` | 14px | 500 | 1.50 | 0 | Buttons, category labels, button-link |
| `{typography.caption}` | 13px | 400 | 1.40 | 0 | Detail row text, mini-cal days |
| `{typography.caption-bold}` | 13px | 600 | 1.40 | 0 | Badge labels |
| `{typography.micro}` | 12px | 500 | 1.40 | 0 | Event chips, admin form labels |
| `{typography.micro-uppercase}` | 11px | 600 | 1.40 | 0.08em | Sidebar h3, day-name row, detail-date heading, admin h3 |
| `{typography.button-md}` | 14px | 500 | 1.30 | 0 | Button labels |

### Principles
- `heading-3` for the dominant on-page label (calendar month), `heading-4` for surface titles (login), `heading-5` for modal titles
- Micro-uppercase (11px / 600 / 0.08em letter-spacing) is the system's section-label voice — used 5 places: sidebar `h3`, day-name row, detail-date heading, admin form `h3`, search section labels
- Body and form text use 14px (`body-sm`); inputs render at 14px to match
- Negative letter-spacing only on `heading-3+` for tighter display rhythm
- Button labels always 14px / 500 / 1.3 line-height

## Layout

### Spacing System
- **Base unit**: 4px (8px primary increment)
- **Tokens**: `{spacing.xxs}` (4px) through `{spacing.section}` (64px)
- **No `hero` / `section-lg`** — the calendar has no large-marketing whitespace

### Grid & Container
- **Public calendar**: 3-column grid `260px | 1fr | 280px` (left sidebar / calendar / right sidebar), fills viewport height
- **Admin dashboard**: single-column, 860px max-width content area with `{spacing.xl}` padding
- **Login**: viewport-centered 380px-max card

### Calendar Header Stack (sticky)
The calendar header is a sticky 3-row stack at the top of the calendar area:
1. **Top bar** (`44px` min-height) — Subscribe + Copy URL + Admin link on the right; nav arrows + Today button on the right
2. **Month heading** — `heading-3` label `{spacing.xs} {spacing.md}` padded
3. **Day-name row** — micro-uppercase `Sun Mon Tue Wed Thu Fri Sat`, bottom-bordered with `{colors.hairline}`

### Week Rows
The calendar grid below the header is a continuous stream of `week-row` elements (each a 7-column grid). Day cells fill viewport height ÷ 6 rows so a month fits without scroll. Scrolling extends the buffer (~16 weeks each direction).

### Whitespace Philosophy
The calendar product is dense by design — day cells are tight (6×8 padding) so 35 cells fit a viewport without scroll. Whitespace lives in the right sidebar (between event cards) and the admin form (between field rows at `{spacing.md}`).

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow; `{colors.hairline}` border | Default `card-base`, `admin-panel`, day cells, table rows |
| 1 (subtle) | `rgba(15, 15, 15, 0.04) 0px 1px 2px 0px` | Reserved |
| 2 (card) | `rgba(15, 15, 15, 0.08) 0px 4px 12px 0px` | `login-card`, help-menu popover |
| 3 (modal) | `rgba(15, 15, 15, 0.16) 0px 16px 48px -8px` | Admin edit `modal`, `search-modal` |

### Decorative Depth
- No hero band, no workspace mockup card — the calendar is product UI, not marketing
- The search modal floats on a `rgba(0, 0, 0, 0.18)` backdrop with `blur(2px)`
- The edit modal floats on a `rgba(0, 0, 0, 0.25)` backdrop with `blur(2px)`

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Event chip, mini-cal cell, category dot |
| `{rounded.sm}` | 6px | Status badges (`badge-tag-*`), today-marker, category-filter row, ghost button, error message bar |
| `{rounded.md}` | 8px | Buttons (primary/secondary/delete/edit), text inputs |
| `{rounded.lg}` | 12px | Cards (`card-base`, `admin-panel`, `modal`, `login-card`, `search-modal`) |
| `{rounded.xl}` | 16px | Reserved |
| `{rounded.full}` | 9999px | `badge-primary` status badge, toolbar icon button, mini-cal nav buttons |

Geometry is sober-editorial — 8px buttons distinguish this system from pill-button SaaS UIs. The only full-pill is `badge-primary` (status indicator).

## Components

> Per the no-hover policy, hover states are NOT separately documented — see CSS for hover treatments.

### Buttons

**`button-primary`** — Signature blue rectangular primary CTA (Subscribe, Sign In, "Create Event", "Save Changes").
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.button-md}`, padding `10px 18px`, height 32px on calendar surfaces / `width: 100%` on form surfaces, rounded `{rounded.md}`.
- Pressed state `button-primary-pressed` darkens to `{colors.primary-pressed}`.
- Disabled state uses `{colors.hairline}` background, `{colors.muted}` text, `opacity: 0.5`.

**`button-secondary`** — Outlined rectangular for secondary actions (Today, Copy URL, Edit).
- Background transparent, text `{colors.charcoal}`, border `1px solid {colors.hairline-strong}`, typography `{typography.button-md}`, padding `0 14px` (calendar) / `8px 14px` (admin), rounded `{rounded.md}`.
- Hover background `{colors.surface}`.

**`button-ghost`** — Quiet utility button (Admin link, sidebar toolbar icons, nav arrows).
- Background transparent, text `{colors.steel}`, typography `{typography.body-sm-medium}`, padding `6px 10px`, rounded `{rounded.sm}`.

**`button-link`** — Inline blue text link (sidebar back button, detail-value links).
- Background transparent, text `{colors.primary}`, typography `{typography.body-sm-medium}`, padding `4px 0`. Underline only on `detail-value a`.

**`button-delete`** — Destructive admin action (Delete event).
- Background `{colors.card-tint-rose}`, text `{colors.brand-pink-deep}` (`#a02e6d`), typography `{typography.body-sm-medium}`, rounded `{rounded.md}`, padding `8px 14px`. Hover swaps to `{colors.semantic-error}` background + `{colors.on-primary}` text.

### Inputs & Forms

**`text-input`** — Standard text/datetime/select field (admin + login).
- Background `{colors.canvas}`, text `{colors.ink}`, border `1px solid {colors.hairline-strong}`, rounded `{rounded.md}`, padding `10px 12px`, height 44px, typography `{typography.body-sm}`.

**`text-input-focused`** — Activated state.
- Border switches to `1px solid {colors.primary}` + box-shadow ring `0 0 0 3px rgba(0, 117, 222, 0.18)`.

**`toggle-switch`** — Custom toggle (admin "All Day Event").
- Track 40×22px, track color `{colors.hairline-strong}` (off) → `{colors.primary}` (on). Knob 16×16 white circle, `box-shadow: 0 1px 3px rgba(0,0,0,0.15)`. Animates `transform: translateX(18px)` on check.

### Cards & Surfaces

**`card-base`** — Standard content card.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.xl}`, border `1px solid {colors.hairline}`.

**`admin-panel`** — Admin section card (Create Event, existing events).
- Same as `card-base`; padding `{spacing.xl}`.

**`modal`** — Admin edit-event dialog.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, border `1px solid {colors.hairline}`, padding `{spacing.xxl}`, max-width 520px, shadow `rgba(15, 15, 15, 0.16) 0px 16px 48px -8px`, max-height 90vh + scroll. Sits inside `modal-overlay` (rgba(0,0,0,0.25) + blur(2px)).

**`login-card`** — Centered login surface.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `40px 32px`, max-width 380px, border `1px solid {colors.hairline}`, shadow `rgba(15, 15, 15, 0.08) 0px 4px 12px 0px`, centered with `text-align: center`.

### Calendar Surface

**`month-header-sticky`** — Sticky 3-row header above the week grid.
- Background `{colors.canvas}`, contains the top toolbar row, month heading row, and day-name row. Z-index 20.

**`day-cell`** — Single date cell in the week grid.
- Background `{colors.canvas}`, padding `6px 8px`, right + bottom border `1px solid {colors.hairline}`, height `calc((100vh - header-height) / 6)`, min-height 80px. Cursor pointer.

**`day-cell-weekend`** — Saturday/Sunday cells with subtle tint.
- Background `rgba(0, 0, 0, 0.018)`.

**`day-cell-other-month`** — Days outside the visible month (ghosted).
- Day number text fades to `rgba(55, 53, 47, 0.32)`.

**`day-cell-selected`** — User-clicked day.
- Background `{colors.card-tint-sky}`.

**`day-number`** — Date label in top-right of cell.
- Typography `{typography.body-sm}`, `{colors.charcoal}`, right-aligned. First-of-month variant prefixes the short month name and uses `{typography.body-sm-medium}`.

**`today-marker`** — Replaces `day-number` for today.
- 22×22 square, background `{colors.semantic-error}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`, rounded `{rounded.sm}`. The only red on each surface.

**`event-chip`** — Inline event label inside a day cell (up to 2 per cell).
- Background `{colors.card-tint-sky}` (or a category-specific tint set by JS), text `{colors.charcoal}` (or category-tone), typography `{typography.micro}`, rounded `{rounded.xs}`, padding `2px 6px`, single line with ellipsis.

**`event-chip-more`** — "+N more" indicator when a day has >2 events.
- Background transparent, text `{colors.steel}`, typography `{typography.micro}`.

### Mini Calendar (Left Sidebar)

**`mini-cal-cell`** — Single day in the 7-column mini grid.
- 28×28, typography `{typography.caption}`, text `{colors.charcoal}`, rounded `{rounded.xs}`, centered. Other-month cells use `{colors.stone}`.

**`mini-cal-cell-today`** — Today highlight in mini cal.
- Background `{colors.semantic-error}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`.

### Category Filter (Left Sidebar)

**`category-filter-item`** — One filter row (dot + check + label).
- Background transparent, text `{colors.charcoal}`, typography `{typography.body-sm-medium}`, rounded `{rounded.sm}`, padding `6px 8px`. Hover swaps to `{colors.surface}`.
- Inactive state: text fades to `{colors.steel}` and the checkmark SVG opacity → 0 (dot remains visible).

**`category-dot`** — 14×14 colored square with check icon.
- Rounded `{rounded.xs}`, background is a category color from the brand spectrum (JS-assigned). Inner check icon is 10×10 white.

### Sidebars

**`left-sidebar`** — 260px sidebar with mini-cal + categories + help footer.
- Background `{colors.surface}`, padding `{spacing.sm} {spacing.md}`, right border `1px solid {colors.hairline}`, flex-column, scrolls independently.

**`right-sidebar`** — 280px sidebar with Upcoming Events / event detail.
- Background `{colors.canvas}`, padding `{spacing.lg}`, left border `1px solid {colors.hairline}`, scrolls independently. Section h3 uses `{typography.micro-uppercase}`.

### Admin Surface

**`admin-header`** — Top sticky bar across admin pages.
- Background `{colors.surface}`, height 48px, padding `0 {spacing.xl}`, bottom border `1px solid {colors.hairline}`, contains the page title (`heading-5` weight 600) and logout link (`button-ghost`).

**`event-card`** (admin list row) — Single existing-event row.
- Padding `14px 0`, bottom border `1px solid {colors.hairline}`, flex layout (column on mobile, row on >=650px) with title + status badge on the left and Edit + Delete buttons + delete-password input on the right.

### Badges

**`badge-primary`** — Pill status badge in primary blue.
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`, padding `4px 10px`.

**`badge-tag-mint`** — Confirmed-event status chip.
- Background `{colors.card-tint-mint}`, text `#0a6e1f`, typography `{typography.caption-bold}`, rounded `{rounded.sm}`, padding `2px 8px`. Upper-cased label.

**`badge-tag-peach`** — Tentative-event status chip.
- Background `{colors.card-tint-peach}`, text `{colors.brand-orange-deep}`, rounded `{rounded.sm}`, padding `2px 8px`.

**`badge-tag-rose`** — Cancelled-event status chip.
- Background `{colors.card-tint-rose}`, text `{colors.brand-pink-deep}`, rounded `{rounded.sm}`, padding `2px 8px`.

**`badge-tag-sky`** — All-day-event indicator (admin form, event list).
- Background `{colors.card-tint-sky}`, text `#003f7a`, typography `{typography.caption-bold}`, rounded `{rounded.sm}`, padding `2px 8px`.

**`badge-tag-lavender`** — Reserved soft-purple tag (event categories, future labels).
- Background `{colors.card-tint-lavender}`, text `{colors.brand-purple-800}`, rounded `{rounded.sm}`, padding `2px 8px`.

### Search Modal

**`search-overlay`** — Backdrop for the public search modal.
- Background `rgba(0, 0, 0, 0.18)`, `backdrop-filter: blur(2px)`, fixed full-viewport, fade-in transition.

**`search-modal`** — 540px dialog with input row + results + esc hint.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, border `1px solid {colors.hairline}`, shadow `rgba(15, 15, 15, 0.16) 0px 16px 48px 0px`, slides + fades in on open.
- Input row: 17px input, magnifier icon at `{colors.steel}`, optional clear button (small dark dot).
- Section labels use `{typography.micro-uppercase}`.

**`search-result-item`** — One result row.
- Padding `{spacing.xs} {spacing.md}`, hover/focus background `{colors.surface}`. Layout: 8×8 category dot, title (`{typography.body-sm-medium}`, charcoal), meta (`{typography.micro}`, steel).

### Misc

**`error-banner`** — Top-of-page error strip when `/api/events` fails to load.
- Background `{colors.semantic-error}`, text `{colors.on-primary}`, typography `{typography.body-sm-medium}`, padding `{spacing.xs} {spacing.md}`, fixed top-zero.

**`help-button`** + **`help-menu`** — Bottom-left help affordance in the left sidebar.
- Help button: 32×32 ghost circle with question-mark icon, 10px rounded.
- Help menu: dark popover (`#2f2f2f` background, `{colors.on-dark}` text), 8px rounded, 220px min-width, shadow `0 4px 16px rgba(0,0,0,0.2)`.

## Do's and Don'ts

### Do
- Use `{colors.primary}` (blue) as the dominant CTA on every surface — Subscribe, Sign In, form submits, toggle-on, focus rings
- Use `{colors.semantic-error}` red for the today marker only — it's the one moment of red on each surface
- Apply `{rounded.md}` (8px) to buttons + inputs, `{rounded.lg}` (12px) to cards/modals, `{rounded.sm}` (6px) to badges, `{rounded.xs}` (4px) to chips
- Use micro-uppercase for section labels (sidebar h3, day-name row, admin h3, detail-date heading) — it's the system's editorial voice
- Use pastel `card-tint-*` for soft tints: `tint-sky` for day-selection + event-chip + all-day badge; `tint-mint/peach/rose` for confirmed/tentative/cancelled status
- Keep the warm-charcoal text hierarchy — `{colors.ink}` for headings, `{colors.charcoal}` for body, `{colors.steel}` for labels, `{colors.stone}` for ghosted/muted
- Pair Inter weights consistently: 600 for headings, 500 for buttons/labels, 400 for body

### Don't
- Don't use `{colors.primary}` blue for large background surfaces or body text — it's a CTA accent, not a fill color
- Don't use pill-shaped buttons; geometry is rectangular at `{rounded.md}` — the only full-pill is `badge-primary`
- Don't reintroduce purple as a primary brand color — purple is now a category/spectrum tone only (brand-purple-* tokens, tint-lavender)
- Don't use multiple reds on a single surface — the today marker already owns the red beat
- Don't apply heavy shadows on flat cards — elevation lives only on modals (level 3) and the login card (level 2)
- Don't replace Inter with another sans without verifying the metric-compatible fallback chain still renders correctly

## Responsive Behavior

### Breakpoints (from `public/index.html` + admin)

| Name | Width | Key Changes |
|---|---|---|
| Mobile (small) | < 480px | Calendar: 4px day-cell padding, event chips hidden, blue dot indicator on `has-event` days; month label 18px. Admin form: single-column. |
| Mobile | 480 – 599px | Same as small but slightly looser. |
| Tablet (compact) | 600 – 899px | Calendar: right sidebar drops below the grid as a 240px-max strip with top border. Admin form: still single-column until 600px, then two-column rows. |
| Tablet | 900 – 1099px | Calendar: left sidebar hidden (toolbar icons surface inline), grid + right sidebar visible. |
| Desktop | ≥ 1100px | Full 3-column calendar (260 / 1fr / 280), admin 860px content area. |

### Touch Targets
- Buttons render at 32px (calendar header) or 44px (admin forms) effective height — both meet WCAG minimums for adult thumbs
- Form inputs render at 44px height
- Mini-calendar cells are 28×28 — below the 44px target but in a non-primary navigation context

### Collapsing Strategy
- **Left sidebar** hides at < 1100px; its toolbar icons (sidebar-toggle, search) re-appear inline at the top-left of the calendar area
- **Right sidebar** drops below the calendar at < 900px as a 240px-max event strip
- **Calendar day cells** shrink from 80px min-height (desktop) → 64px (tablet) → 48px (mobile)
- **Event chips** are replaced by a single blue dot indicator on `has-event` days below 600px
- **Admin form** collapses 2-column rows to 1-column below 600px

## Iteration Guide

1. **Focus on ONE component at a time** — the system is small enough that one component can be tuned in isolation
2. **Reference component names and tokens directly** in code (`var(--color-primary)`, `var(--tint-sky)`) so this doc stays the source of truth
3. **Always pair the blue primary with the red today marker** — they're the two anchor colors that define the system's identity
4. **Default to `{typography.body-sm}` for body, `{typography.micro-uppercase}` for section labels**
5. **Use `{rounded.md}` for buttons (rectangles), `{rounded.lg}` for cards, `{rounded.full}` for `badge-primary` only**
6. **Inline links and primary CTA share `{colors.primary}`** — there is no separate link-blue token in this system; differentiate by treatment (underline for links, filled background for buttons)

## Known Gaps

- Dark-mode token values not surfaced (the help menu is the only dark surface; no full dark theme defined)
- Animation/transition timings live in CSS as `0.12s`–`0.2s ease` — not tokenized
- Form validation success state not explicitly captured (only the "Copied" green pulse on the Copy URL button)
- The auto-derived category palette (in `public/index.html`) overlaps with but is not identical to the brand-spectrum tokens here — alignment is a future task
