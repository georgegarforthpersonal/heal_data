# UX review — `/groups/butterfly`

Reviewed 13 Aug 2026. Method: full code audit of `app/frontend/src/pages/groups`
and `components/groups` plus adjacent flows, and a live browser walkthrough
(desktop 1440px, mobile 390px) against a locally-run stack seeded with the real
Heal transect CSVs (2024 + 2025) and a synthesized live 2026 season.

## What's already working — protect these

- The information architecture: worklist → species → seasonal trend → files →
  map → export is the right panel set, on one screen.
- The worklist model (week-window slots, derived fulfilment, avatars) matches
  how a transect team actually operates.
- Self-signup is one tap, confirms itself in-row and with a toast.
- Slug URLs (`/groups/butterfly`) are human and shareable.
- Charts reserve their height while loading (`SeasonalCountPanel.tsx:148`);
  files load off the critical path (`GroupDetailPage.tsx:83-88`).

## Fix-first list

| # | Fix | Severity | Where |
|---|-----|----------|-------|
| 1 | Take org-wide `getAllWithBoundaries` + `surveyors.getAll` off the critical path; paint chrome immediately, panels progressively | Critical | `GroupDetailPage.tsx:100-107` |
| 2 | Stop rendering API failures as empty states; add retry to every error surface | Critical | `GroupDetailPage.tsx:87`, `SpeciesCountPanel.tsx:59`, `RecentMediaPanel.tsx:69` |
| 3 | Accessibility layer: real headings, focusable rows, keyboard-reachable tooltips, announced toasts | Critical | whole groups surface |
| 4 | Carry group context through the record flow (back label, slot/date prefill, surveyor = self) | High | `NewSurveyPage.tsx:622` |
| 5 | Small-text contrast: brand green 4.14:1, muted greys 3.55/2.85:1, Overdue amber 2.34:1 | High | `groupsTokens.ts`, `theme.ts:9-11` |
| 6 | Map hijacks page scroll on phones; sectors sort alphabetically instead of by walk order | High | `DeviceMap.tsx:323`, `LocationsPanel.tsx:90-92` |
| 7 | Withdraw is one unguarded tap; add Undo to signup/withdraw toasts, make signup optimistic | Medium | `SelfSignupButton.tsx` |
| 8 | Preserve view state (toggles, species pick, pagination, scroll) across navigation; set `document.title` | Medium | router / panels |
| 9 | One date format, one vocabulary ("group"/"survey type"/"Surveys"), one meaning for "Scheduled (n)" | Medium | several |
| 10 | Chart labelling: axis titles, single-year legend, colour-blind-safe years, UK dates | Medium | `SeasonalCountChart.tsx`, `CumulativeSpeciesChart.tsx` |

## 1. First paint & perceived speed

- The whole page hides behind one spinner (`GroupDetailPage.tsx:166-172`)
  until a **three-deep waterfall** resolves: `resolveGroupTypeId` (fetches the
  entire survey-type list to map slug→id, `groupMeta.ts:158-168`) →
  `getById` → `Promise.all(slots, surveys, ALL surveyors, ALL locations with
  geometry)`.
- `locationsAPI.getAllWithBoundaries()` (`GroupDetailPage.tsx:106`) returns
  every route/sector/boundary in the org and is used only to decorate
  `details.locations`. `locationsAPI.getBySurveyType` already exists
  (`api.ts:1379`). `surveyorsAPI.getAll()` is the same problem.
- No skeletons anywhere in the groups tree; loading vocabulary mixes spinners
  and the word "Loading…" (`SpeciesCountPanel.tsx:138`).
- Layout shifts: Species-count headline flashes 0 → real value
  (`SpeciesCountPanel.tsx:38,83`); Files panel reorders itself on mobile after
  its fetch resolves (`GroupDetailPage.tsx:298`); the seasonal chart is five
  sequential requests deep.
- No query cache anywhere: every navigation refetches everything, and
  `resolveGroupTypeId` is re-run verbatim on AllSurveysPage
  (`AllSurveysPage.tsx:124`).

## 2. Errors that look like emptiness

- Three fetches swallow failures into empty arrays, so errors render as
  "No files yet." / "No species recorded yet." / "No photos yet":
  `GroupDetailPage.tsx:87`, `SpeciesCountPanel.tsx:59`,
  `RecentMediaPanel.tsx:69-74`. Empty and failed must be distinct.
- "Failed to load this group. Please try again." has no retry affordance
  (`GroupDetailPage.tsx:178`); chart errors are equally terminal;
  `CumulativeSpeciesChart.tsx:178-182` leaks raw `err.message` into the UI.
- After a first-ever signup, the surveyor refresh is fire-and-forget
  (`useSignupSaved.ts:35`); if it fails the button reverts to "Sign up" even
  though the server accepted — inviting a double signup.
- `FilesPanel.tsx:27` calls `window.open` after an `await` — popup blockers
  (iOS Safari) eat it and the tap silently does nothing.

## 3. Worklist & signup

- On touch there is no hover, so the whole "Signed up ✕" button is a
  single-tap withdraw — no confirm, no undo, ~30px tall. Signup also awaits
  the round trip despite its own docstring arguing for optimistic action.
  Fix: optimistic flip + Undo in the toast, both directions.
- Overdue rows offer no action at all (`SurveyWorklistRow.tsx:41-43`) and
  `buildWorklist` returns every overdue slot pinned on top while capping
  upcoming at 3 (`surveyState.ts:137-139`) — a lapsed season opens as a wall
  of amber. Let people record/sign up for overdue weeks; collapse the pile.
- "SCHEDULED (5) showing next 3" can't be expanded in place, and the
  All-surveys page counts the same set differently ("Scheduled (6)" —
  includes cancelled/overdue; `AllSurveysPage.tsx:257` vs
  `SurveysPanel.tsx:146`).
- Green session avatars (`greenIds`) are never explained; surveyor names are
  mouse-tooltip-only (`SurveyorAvatars.tsx:50-71`).

## 4. Journeys that drop context

- **Record flow** (verified live): the form's header back-button is hardcoded
  to `/surveys` (`NewSurveyPage.tsx:622`) even though Cancel honours
  `returnTo` (`:539`). The tapped slot isn't carried: no banner, no date
  prefill/constraint, and nothing explains that the date is what links the
  survey to the due week. Surveyors don't default to the signed-in user.
- View state evaporates on navigation: Map/List, Chart/List, seasonal species
  pick, All-surveys filter and its "Load more" pages all reset
  (`returnTo.ts` carries no `search`; nothing is in the URL).
- No scroll restoration (the app scrolls an inner container,
  `Layout.tsx:38`): "View all" can land mid-scroll; back never restores
  position; `SurveysPage.tsx:212`'s `window.scrollTo` is a no-op.
- `document.title` is never set anywhere.
- The beta gate is a hardcoded name allowlist (`groupMeta.ts:25-48`);
  renaming a survey type silently 404s its bookmarked group URL. Move
  visibility server-side.

## 5. Locations & the map

- Map traps scroll: `DeviceMap.tsx:323-328` leaves wheel-zoom and one-finger
  drag enabled with no gesture shim, and Map is the default view — on phones
  the 400px map sits in the scroll path. The `height={360}` prop is dead
  (`minHeight: 400` wins, `DeviceMap.tsx:315-321`).
- Sectors ignore `ordinal`: the list shows Brook, Field, **Hedge, Marsh,
  Track** (alphabetical) while the hero's own instructions state the walk
  order Brook, Field, **Track, Marsh, Hedge** (`LocationsPanel.tsx:90-92`).
  Sort by ordinal and display it ("1 · Brook") — recorders think in section
  numbers.
- Geometry-free groups (or devices-with-no-locations,
  `LocationsPanel.tsx:93`) render a confident map of the default centre.
  Default to List when there is nothing to draw.

## 6. Charts & data

- No axis titles anywhere; "peak count per month" is a footnote
  (`SeasonalCountChart.tsx:116-118`); single-year charts render no legend, so
  nothing says which year is shown; tooltips have no unit noun and show 1–4
  lines depending on date collisions (`seasonalSeries.ts:141-148`).
- Years are colour-only, with deuteranopia-colliding green/olive and
  orange/olive pairs (`seasonalSeries.ts:35`). Add dashes or direct labels.
- US dates in a UK product: "Jul 04, 2026" in the cumulative chart tooltip
  (`CumulativeSpeciesChart.tsx:262`) and "Aug 5, 2026" on the survey detail
  page, vs "Wed 5 Aug 2026" everywhere else. Centralise formatting.
- Species List sorts by most-recent-first-seen with no caption and no
  sortable columns (`SpeciesCountPanel.tsx:56`); "Count" (total individuals)
  is unexplained; the Data export is offered even for empty groups with only
  "Preparing…" for feedback.

## 7. Mobile

- The first screenful is breadcrumb + hero + full description; the worklist
  starts below the fold — and when files exist, Files outranks the worklist
  entirely (`order: 1`, `GroupDetailPage.tsx:298`). Collapse the description
  on xs; put Surveys first unconditionally.
- Visual order is re-sequenced with CSS `order` under `display: contents`
  (`GroupDetailPage.tsx:238,293`), so reading/tab order ≠ visual order
  (WCAG 1.3.2).
- Fixed `1fr 64px 96px` species grid + `noWrap` truncates most names at
  320px (`SpeciesCountPanel.tsx:30-35,164`); 320px inner-scroll list with no
  affordance (`:152`); the seasonal picker input is under 16px so iOS zooms
  on focus (violates `config/responsive.ts:12`); signup/record/toggle targets
  are ~28–30px (below 44px); avatars render twice per row across breakpoints
  (`RecentSurveyRows.tsx:62-85`).

## 8. Accessibility

- Zero `aria-*`/`role`/`tabIndex` in `components/groups/` and
  `pages/groups/`. No headings at all — hero title and every panel header are
  `<p>` (`GroupHero.tsx:32`, `SurveysPanel.tsx:106`, …) while GroupsPage
  already does it right with `PageTitle component="h1"`.
- Recent-survey rows are click-handler `<Box>`es — keyboard-unreachable
  (`RecentSurveyRows.tsx:36-49`); `FilesPanel.tsx:53` shows the right
  pattern (`ButtonBase`).
- Breadcrumb: no `nav` semantics, separators read aloud, button-styled links
  break middle-click (`GroupBreadcrumb.tsx:17-38`).
- Toasts have no live region (`ToastContext.tsx:33-48`); charts have no
  accessible alternative.
- Contrast (small text, AA=4.5): brand green `#51895A` 4.14:1; `#888` 3.55:1;
  `#999` 2.85:1; Overdue amber chip 2.34:1 — the most urgent signal is the
  least legible. `theme.ts:9-11` already prescribes `brandDark` (6.26:1).

## 9. Copy

- One concept, three names: breadcrumb "Surveys", errors "group", locations
  empty state "survey type". "Past surveys" door → "All surveys" page.
- "You've been taken off this survey" → "You've withdrawn from this survey".
- "No surveyors yet" (italic grey, reads as an error) → "Be the first to
  sign up". Every empty state should name the next action or the person who
  can take it.
- "Species count 21" → "21 species recorded".

## Roadmap

1. **This week:** contrast tokens; sector ordinal sort; map gesture guard;
   `returnTo` on the form back button; date-format unification; Undo toasts;
   document titles; copy pass.
2. **Next sprint:** progressive first paint with skeletons; scoped
   location/surveyor fetches; per-panel error+retry; slot-aware record flow;
   heading/keyboard/toast a11y layer.
3. **Structural:** query cache across navigations; view state in URLs +
   scroll restoration; server-driven group visibility; chart accessibility
   and colour-safe year encoding; overdue-week actions.
