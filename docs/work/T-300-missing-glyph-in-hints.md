# T-300 — The glyph `›` is not in the glyph set and draws as `?`

**Source:** found during T-277 (2026-10-12) · **Size:** S · **Needs:** — · **Status:** open

## Why

The bundled glyph set has no `›`. Strings that use it show `?` on screen, in hints that tell the player where to go.

## Reproduction

`grep -n "›" src/ui/strings.ts`: at least `ui.status.no_depot` ("build one [b › Special]") and `ui.orders.long.no_workshop` ("[b] build › Workshops"). Open either hint in the game and read the character.

## Decision

Replace `›` with ASCII `>` in every UI string, as T-277 already did for its own line. Do not add a glyph. Add a check to `strings:check` (or a unit test over `src/ui/strings.ts`) that every character of every UI string is in the glyph set, so the next one fails at build time.

## Done when

- No UI string holds a character outside the glyph set, and a test proves it.
- Goldens that move are named in the commit body.
