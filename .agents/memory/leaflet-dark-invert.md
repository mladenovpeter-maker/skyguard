---
name: Leaflet dark-mode via CSS invert
description: Why a CSS invert(100%) filter on react-leaflet tiles can produce a light map instead of a dark one, and the fix.
---

A common way to force a dark-themed Leaflet map is a CSS filter like
`filter: invert(100%) hue-rotate(180deg)` applied broadly (e.g. to `.leaflet-layer`
plus the zoom/attribution controls).

**Why this breaks:** if the tile source is *already* a dark basemap (e.g. CARTO
`dark_all`), inverting it produces a washed-out light map — the opposite of the
intended effect. The bug is silent: no console error, the map just looks wrong,
and it's easy to miss in a quick glance since the rest of the UI (chrome, panels)
is correctly dark.

**How to apply:** when a map looks unexpectedly light in an otherwise dark-themed
app, check two things together: (1) the tile layer URL/style, and (2) whether a
CSS invert filter is also applied to the tile pane. Pick one mechanism, not both —
either use a genuinely dark tile source with no invert filter, or use a light tile
source with the invert filter scoped to exclude content that's already dark
(e.g. apply invert only to `.leaflet-control-zoom-in/out` and
`.leaflet-control-attribution`, never to `.leaflet-layer` if tiles are already dark).
