# T-NEW — An animal's view and the Animals panel say nothing of its wounds

**Source:** T-723 · **Size:** S · **Needs:** — · **Status:** open

## Why

T-723 made a fortress animal bleeding with no bandage or cloth an alert (17 § Player-facing behavior). But the alert's `[v]` opens an animal view that has no wound or bleeding line at all, and the Animals panel's row for it says only its pasture, training and condition. A dwarf patient has a `Care:` line ("bleeding, and no bandage or cloth to bandage it"); an animal has nothing to show why it is dying.

## What to do

Decide what an animal's view (`ui/panels/look-animal.ts`) shows of its health: at least "Bleeding" while a wound bleeds unbandaged, and, while its `bandage_animal` is blocked for a missing input, the dwarf's Care line's words ("bleeding, and no bandage or cloth to bandage it"); perhaps a dim "wounded" in its Animals panel row.

Spec: 17 § Player-facing behavior; `ui-screens/panels.md` (Animals); `ui-screens/fortress-screen.md` § Inspection panel.

## Done

- [ ] A test: a war dog with a serious cut and no cloth shows the line in its view; bandaged, it does not.
