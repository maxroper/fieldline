# Fieldline redesign — mockup pass, October 2026

A browsable mockup of every Fieldline page redesigned on the existing palette, with the twenty features the research recommends, plus the design system, the feature research, and the architecture review. Built for review before anything is implemented.

## Open it

- Published artifact: https://claude.ai/artifact/V9TpWSgtNSsYT2eTasp8CP (private to the account; share from the page's Share menu).
- Locally: open `preview.html` in any browser (double-click it in Finder). Everything is inline except the IBM Plex fonts from Google Fonts. The dark bar at the top picks screens; **Design notes** shows what changed per screen; Alt + arrow keys step through.
- `index.html` is the same page without the document skeleton; it is what gets published as an artifact.

## What is in here

| Path | What |
|---|---|
| `shell.html` | The page shell: review bar, the grouped sidebar menu and slim top bar for the office, phone frames for tech and customer screens, the create / company / user menus. |
| `fieldline-ds.css` | The design system: tokens, components, layout, motion. Meant to become the product stylesheet. |
| `fieldline-ds.js` | Mockup behaviors: screen router, segmented controls, chips, tabs, sheets, toasts, status track, count-ups. Not product code. |
| `screens/NN-id.html` | One file per screen, office, tech and customer. Each has a design-notes block and its overlays. |
| `review/0N-*.html` | The four review pages: overview, design system, feature research, architecture review. |
| `research/*.md` | The research record: platform feature landscape, pain points and 2025–26 trends, the current UI inventory, the data model and architecture read, reference architectures. About 140 source links. |
| `BRIEF.md` | The build brief used for the screens: fragment contract, conventions, the twenty features and where they land, every screen's specification. |
| `build.mjs` | Assembles `index.html` and `preview.html` from the parts. Run `node build.mjs` from this folder. |

## Decisions recorded here

- Palette, type, and the component set stay; every page is redrawn. After the first review ("still too cluttered"), the tab row became a grouped sidebar menu with one "+ New" button, filters moved behind a Filters button, and density was reduced everywhere.
- Job state uses one color language everywhere: steel scheduled, amber en route, moss on site or done, rust waiting on parts, red urgent or late, plum quoted.
- Office pages follow one grammar: toolbar with summary numbers, work rail, canvas, side sheet, and the shared Back bar with Save and Save and back on editors.
- Tech pages are phone-first, one task per screen, thumb-sized controls, a sync pill always visible.
- Twenty features were chosen from thirty candidates; ten were left out on purpose (listed on the feature research page).
- The architecture review recommends keeping TypeScript and React, moving off static-export Next.js and localStorage to Postgres with row-level security behind an API, splitting the monolith into feature modules during the redesign build, and going native (Expo) for techs only when GPS tracking and true offline are needed.

## Not in this pass

The Claude Design canvas could not be started in this environment, so the mockup is a plain HTML page instead of a canvas. The data on every screen is invented. Copy is proposed, not final.
