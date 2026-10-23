# T-429 — Help: fold the panel notes into the key sections

**Source:** T-424, [keybindings audit](../../reports/audits/2026-10-23-keybindings.md) · **Size:** S · **Needs:** T-424 · **Status:** open

## Why

Since T-424 every panel's own keys are rows of the keymap, and Help's Keys tab lists them under the panel's heading ("Orders panel", "Building panel", "Zone inspector"). The older notes at the end of the tab ("Work orders", "Building panel (click a building)", "Zones and stockpiles", the Jobs, Stocks and Animals lines) list many of the same keys again, with the mouse's way beside them. A player reads two lists for one panel, and the notes' wording differs from the rows'.

## What to do

Keep one section per panel: the keymap rows, followed by the note lines that add what the rows do not say (the mouse's way, typing in a filter, the ranges and limits). Drop each note line whose keys and meaning a row already gives. The notes already name each key as it is bound now; keep that.

## Done

- Help shows each panel once; a test lists, per panel, the note lines that remain and why.
- The tests that read Help's notes (`t241`, `t246`, `t247`, `t272`, `u03-hotkeys`, `u03-orders`, `u04-drag-place`, `u05-building-panel`, `u07-zones`) are updated in the same commit, each change listed under "Expectations changed".
