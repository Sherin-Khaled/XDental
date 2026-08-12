# Hero Slider

Data-driven, auto-rotating hero for the home page. No slide content is
hardcoded in these components — they render whatever `HeroSlide[]` they are
given.

## Files

| File | Responsibility |
| --- | --- |
| `HeroSlider.tsx` | State/logic: rotation, pause (hover/focus/tab-hidden), keyboard, touch swipe (RTL-mirrored), dots + arrows, aria-live announcements. |
| `HeroSlide.tsx` | Pure presentation of one `HeroSlide` record into the shared hero skeleton (badge, headline with highlight, subtext, optional countdown, CTAs, optional stats, image with orbit + floating labels, "why choose us" card). |
| `SlideDots.tsx` | Dot indicators; active dot elongates into a pill with a progress fill synced to the autoplay timer. |
| `SlideCountdown.tsx` | Days/Hrs/Mins/Secs ticker for slides with `countdownTo`; hides itself once the date passes. |
| `useAutoRotate.ts` | Drift-free autoplay timer with tab-visibility pause and cleanup. |

## Data flow

- Schema: `src/types/heroSlide.ts` (`HeroSlide`). All user-visible strings
  are `{ en, ar }` objects, matching how other DB-backed content in this
  project is localized.
- Access point: `src/data/heroSlides.ts` → `useHeroSlides()` /
  `getHeroSlides()`. First paint renders the bundled seed
  (`DEFAULT_HERO_SLIDES`) so the hero is never blank; the API copy from
  `GET /api/hero-slides` silently replaces it when it arrives, and the seed
  doubles as the offline fallback.
- Visibility rules live in `getVisibleSlides()`: a slide renders only when
  `isActive` and its `countdownTo` (if set) is in the future; slides sort by
  `order`. The backend applies the same rules server-side.

## Backend (already in place)

- Prisma model `HeroSlide` → table `hero_slides` (`id`, `order`, `isActive`,
  `countdownTo`, localized payload in `content` JSON, timestamps).
- `GET /api/hero-slides` (public) returns `{ slides: HeroSlide[] }` — active,
  unexpired, sorted by `order`.
- Seed: `node server/src/scripts/seedHeroSlides.js` (idempotent upserts of
  the three launch slides).

## What the future admin CRUD needs to implement

1. `POST /api/admin/hero-slides`, `PUT/PATCH /api/admin/hero-slides/:id`,
   `DELETE /api/admin/hero-slides/:id` (admin-authenticated, same shape as
   the GET payload; store everything except `id/order/isActive/countdownTo`
   inside the `content` JSON column).
2. Validation: `headlineHighlight` must be a substring of `headline` per
   language; max 2 `floatingLabels`; max 3 `stats`; image `src` is a URL or
   site-root path.
3. Reordering = updating the `order` integers.
4. Deactivation is just `isActive = false`; expired-countdown slides are
   filtered automatically, so a flash-sale slide needs no manual cleanup.
5. Image upload can stay out of scope: `image.src` is a plain URL the admin
   pastes (any CDN/storage works).

## UX/a11y notes

- 7s per slide; pauses on hover, on any focus inside the hero, and while the
  tab is hidden. `prefers-reduced-motion` disables autoplay and animations.
- Hidden slides get `aria-hidden` + `inert` (React 19), so their CTAs leave
  the tab order. Slide changes are announced via `aria-live="polite"` only
  when user-initiated.
- Slides are stacked in a single CSS-grid cell, so the hero reserves the
  height of the tallest slide — no cumulative layout shift.
