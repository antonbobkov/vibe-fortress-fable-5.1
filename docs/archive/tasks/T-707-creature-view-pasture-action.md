# T-707 — A tame animal's view has no "Pasture" action, which 08 promises

**Closed:** 2026-11-24, in 549f2229,4a35234b,dc6a9716,93931f1d.

**Source:** T-700 ([work file](T-700-pasture-too-small-starves-grazers.md)), found while editing 08 § Player-facing behavior · **Size:** S · **Needs:** — · **Status:** open

## Why

08 § Player-facing behavior says a pasture is assigned "by selecting animals in the Animals panel or by clicking an animal and choosing "Pasture"". Only the first exists: the Animals panel's `[p]` is the one place in `src/ui` that sends `AssignPasture`. A tame animal's view in Look (`fortress-screen.md` § Inspection: species, state, owner, pasture, condition, training) shows its pasture and offers no way to change it, so a player who clicks the cow starving on a too-small pasture (T-700's alert opens it with `[v]`) has to find the Animals panel to move it.

## What to do

- Add a `[p] pasture` action to a tame grazer's view, doing what the Animals panel's `[p]` does for that one animal (the next pasture, after the last none), with the same status-row line and alert colour (`ui.animals.pastured`, `ui.animals.pastured_over`, `ui.animals.unpastured`; `src/ui/pasture.ts`). Check the view's own keys for a clash with `p` first (24 § Settings, the keymap contexts).
- Or, if a key there is not wanted, take the clause out of 08 and say in `fortress-screen.md` that the view shows the pasture only.

Decided while doing it (the orchestrator's brief: a picker, not the next pasture):

- `[p]` opens a picker in place of the view's sections: "Pasture for the cow:", "Off pasture", then each pasture with T-700's verdict counted with the animal on it ("Feeds 0 of 6 grazers", alert colour when over, dim otherwise), then `[Enter] choose  [Esc] cancel`. It opens on the animal's pasture now; `↑` `↓`, `Enter` or a click on a row, `Esc`/`Backspace`/`[p]` close it. The status line is the Animals panel's, through one shared function (`assignPasture` in `panels/animals.ts`): "1 cow to Pasture #1: it feeds 0 of 6 grazers.", "Bramble off the pasture.".
- The view did not show the pasture (the animal sections the inspector list names are not drawn), so the foot has a third key row, `[p] pasture: Pasture #1` (`none`), a button like the others.
- `p` is Look's own key only in a tame grazer's view (a tame animal `AssignPasture` takes); in the tile list, a dwarf's, a wild animal's or a dog's view it is Population, as `c` and `f` are Look's only in a view.

## Done

- [x] A test: `[p]` in a cow's view sends `AssignPasture` for it and says where it went (`test/unit/ui/t707-creature-view-pasture.test.ts`: the picker and its verdicts, the over-capacity warning in the alert colour, a click on a row, a named animal, Off pasture, Esc; a dwarf, a wild deer and a dog have no action and `p` opens Population). The parity scenario checks `p` in a dwarf's and a cow's view and the foot button.
- [x] 08 and `fortress-screen.md` say the same thing; 24 § Input model and § Inspection, the keymap table (Look panel `[p]`) and Help's Look note.
