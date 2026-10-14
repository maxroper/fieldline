# Design system

The look of Fieldline is one stylesheet, `apps/web/src/design/fieldline.css`, and one file of React wrappers, `design/components.tsx`. The mockups it came from are in `design/redesign-2026-10/` (open `review/02-design-system.html` for the visual reference). This page is the written contract.

## Principles

- **Calm paper, few colors, one accent.** Warm off-white surfaces, near-black ink, copper for the one primary action on a screen. Everything else is muted.
- **Color means state, never decoration.** The same six tones mean the same things on the board, in tables, on the phone and on customer pages.
- **One toolbar, one page.** Each office screen is a `.toolbar` row (filters, segments, the primary button) above a `.page`. Secondary controls go in a `Sheet`, not on the page.
- **Numbers are tabular.** Anything a person compares (money, hours, times, work order numbers) gets `.num`, which switches to the mono font with tabular figures.
- **Motion is transform-only and short.** Entrances translate and fade; nothing animates layout. Durations are 120, 220 and 380 ms.

## Tokens

Defined on `:root` at the top of `fieldline.css`.

| Group | Tokens |
| --- | --- |
| Surfaces | `--paper` (app background), `--paper-2`, `--paper-3` (recessed), `--card`, `--white` |
| Ink | `--ink`, `--ink-2` (secondary text), `--ink-3` (hints) |
| Lines | `--line`, `--line-2` |
| Accent | `--copper`, `--copper-deep`, `--copper-tint` |
| States | `--steel`, `--amber`, `--moss`, `--rust`, `--red`, `--plum`, each with `-deep` and `-tint` |
| Type | `--font` IBM Plex Sans, `--mono` IBM Plex Mono |
| Shape | `--r-1` 8px, `--r-2` 12px, `--r-3` 16px, `--r-4` 22px, `--pill` |
| Motion | `--dur-1/2/3`, `--ease`, `--ease-out`, `--ease-spring` |
| Layout | `--top-h` 56px top bar, `--tap` 44px minimum touch target |

Never write a hex color in a component. If a color is missing, add a token.

## The state color language

| Tone | Meaning | Where it shows |
| --- | --- | --- |
| steel | scheduled, planned, informational | board slots, `pill.sched`, visit dots |
| amber | en route, in motion, due today | `pill.route`, ticket `t-amber`, truck on the map |
| moss | on site, done, paid, healthy | `pill.site`, `pill.done`, `pill.ready`, meters |
| rust | waiting on parts, partial, low stock | `pill.parts`, ticket `t-rust` |
| red | urgent, late, over limit, failed | `pill.urgent`, `pill.overdue`, out of stock |
| plum | quoted work | `pill.quote`, ticket `t-plum` |
| copper | the primary action, agreements, selected | `btn.copper`, `pill.copper` |
| plain/hold | neutral or inactive | `pill.open`, `pill.hold` |

`app/format.ts` has `woTone()` and `ticketTone()` so screens never pick these by hand for work orders.

## Components (React wrapper → CSS)

| Component | Class | Notes |
| --- | --- | --- |
| `Button` | `.btn` + tone (`primary`, `copper`, `ghost`, `subtle`, `danger`, `moss`, `steel`) + size (`sm`, `lg`, `xl`) | one copper button per screen; `icon` for icon-only |
| `LinkButton` | `.btn.nav-link` | a router link styled as a button |
| `Pill` | `.pill` + tone, `plain` removes the dot | state, never actions |
| `Chip` | `.chip`, `.on`, `.count` | saved views and filters in a `.chips` row |
| `Seg` | `.seg` | segmented control for 2 to 4 views |
| `Tabs` | `.tabs` | sections inside a record |
| `Kpi` | `.kpi` in a `.kpis` grid | eyebrow, value, delta |
| `Card` | `.card`, `flat`, `inset`, `pad-0` | `title` and `actions` in `.card-head` |
| `Field`, `Input`, `Select`, `Textarea` | `.field`, `.input`, `.select`, `.textarea` | fields sit in `.field-grid` or `.inline-form` |
| `Switch`, `Check` | `.switch`, `.check` | |
| `Facts` | `.facts` | definition list for a record's facts |
| `StatusTrack` | `.status-track` | the step line on work orders, quotes, tracking |
| `Sheet` | `.sheet` (+ `bottom` on the phone) with `.scrim` | every secondary form; closes on Escape |
| `SummaryLine` | `.summary-line` | counts with state dots in a toolbar |
| `Meter` | `.meter` | capacity and progress |
| `Avatar` | `.avatar` | initials with a tone |
| `Empty`, `Notice`, `Loading`, `ErrorBox` | `.empty`, `.notice`, `.app-loading` | |
| `BackBar` | `.back-bar` | record pages: back link plus save actions |
| `SignaturePad` | `.signature-pad` | pointer drawing to a PNG data URL |
| `ToastHost` | `.toast-host` | fed by `toast()` in `app/store.ts` |

Lists and tables are plain markup: `.table` (`dense`, `.primary-cell`, `.num`, `tr.clickable`), `.list > .item` (`.title`, `.sub`, `tall`, `clickable`), `.ticket` for board cards.

## Layout patterns

- **Office shell**: `.app` grid with `.side` (grouped menu: Work, Customers, Sales, Money, Insights; Users and Settings at the bottom; collapsible) and `.content` with `.topbar` (page title, follow-up bell, one "+ New" button) and `.main`.
- **List screen**: `.toolbar` (chips or `Seg`, search, `Filters` sheet button, primary action) then `.page` with a `SummaryLine` and a `.table-wrap`.
- **Record screen**: `BackBar`, header row (title, pills, facts line), `Tabs`, then `.two-col.loose` with the main column and an `aside` of facts and timeline.
- **Board**: `.rail` queue on the left, the day grid on the right, `.week-grid` and `.month-grid` for the other views, `.map` for the map toggle.
- **Sheets** hold every secondary form: filters, new purchase order, invoice detail, schedule a visit. `wide` for tables inside.

## Phone patterns

Rendered inside `PhoneShell` (`.phone-stage.full > .phone`), 390px wide, with `.tech-top` and the `.ph-nav` bottom bar (Today, Timesheet, Lookup, Van).

- `.ph-page` stacks `.ph-section`s with an `.eyebrow` label each.
- `.ph-ticket` is the visit row: time, title and site, state pill; `now` highlights the active job.
- `.big-actions` holds the status buttons; `.hero` spans both columns. Minimum height 56px.
- `.choice-row` is the pass / flag / fail / N/A control for checklist items.
- `.ph-bar` is the sticky bottom action (Complete job, Submit timesheet).
- `Sheet` with `bottom` slides up from the bottom edge.

## Customer pages

`.public` is a centered 760px column with `.public-card` blocks. They use the same tokens and pills, with no app chrome, and work at phone width.

## Motion rules

- Entrances: `.stagger > *` fades and lifts children with a 40 ms cascade; `.sheet` slides; `.live` pulses a dot for running clocks.
- Only `transform` and `opacity` animate. No animated heights or widths.
- Respect `prefers-reduced-motion` (the stylesheet turns animations off).

## Adding a screen

1. Sketch the toolbar and the page in terms of the components above. If a new pattern is needed, add the class to `fieldline.css` in the matching section and a wrapper in `components.tsx`.
2. Use the state language for every pill and tone. Do not invent a seventh color.
3. Keep text sizes to the existing scale: 22 to 26px page titles, 14px body, 12px `.small`, 11px `.eyebrow`.
4. Check it at 1440px and at 390px. The office layout collapses `.two-col` and `.kpis` under 900px.
