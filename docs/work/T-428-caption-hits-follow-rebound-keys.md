# T-428 — Caption buttons measured with the rebound key

**Source:** T-424, [keybindings audit](../../reports/audits/2026-10-23-keybindings.md) § Left open · **Size:** S · **Needs:** T-424 · **Status:** open

## Why

Since T-424 a caption that names a key (`[S-t] train`, `[x] disband`, `[o] order 5`) is drawn with the key its binding has now (24 § Settings). The click region of such a caption is still measured from the caption as written, with the default key. When the rebound key's name has another length (`[F6]` for `[S-n]`, `[Ctrl+Q]` for `[q]`), the drawn caption is a few cells shorter or longer than its button, so the end of a caption can be dead to a click, or a click just past it can still press it. The status rows and the hotkey strip already measure the drawn text; the panels' own captions do not.

## What to do

Measure each caption button from the text as it is drawn: let `label` return the cells it wrote after naming the keys (it does) and use that width for the `hit` beside it, or give `button` the same naming. Check the panels that place several captions on one line (Military, Animals, Orders, the zone inspector), where a longer key also moves the captions after it.

## Done

- A unit test: with a panel key rebound to a longer key, a click on the last cell of its drawn caption runs it and a click one cell past does not.
- No golden moves with the default bindings.
