# T-473 — Runecraft 6: ward, mend, dread, daze, firebloom and vials

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** T-470 · **Status:** open

## What to do

Phase 3, the spells.

- The `ward` armour layer and column, Mend, Dread, Daze, Firebloom, each with the "cast when" rule from the content table.
- `Dazed`, `Fled` statuses. Fled does not count toward a party's retreat.
- Vial drinking: carried at the re-equip check, the daily limit, `rune_sick`.
- Announcements: out of rune; a firebloom that catches a fortress creature. Thoughts `warded`, `mended_by_rune`.

## Done

- A warded squad of six at the measured peril-2 raid loses less blood than an unwarded one in the arena. The ward lapses at the spec's ticks per channel.
- Dread sends at most four running and they return; the retreat counter does not move. Mental spells fail on large and `deep` creatures.
- Firebloom is never cast while a fortress creature stands in the square at the moment of casting.
- A caster below cost with a hostile in sight drinks; the fourth vial in a day gives the thought and no rune.
