# T-NEW — A tame animal's view has no "Pasture" action, which 08 promises

**Source:** T-700 ([work file](T-700-pasture-too-small-starves-grazers.md)), found while editing 08 § Player-facing behavior · **Size:** S · **Needs:** — · **Status:** open

## Why

08 § Player-facing behavior says a pasture is assigned "by selecting animals in the Animals panel or by clicking an animal and choosing "Pasture"". Only the first exists: the Animals panel's `[p]` is the one place in `src/ui` that sends `AssignPasture`. A tame animal's view in Look (`fortress-screen.md` § Inspection: species, state, owner, pasture, condition, training) shows its pasture and offers no way to change it, so a player who clicks the cow starving on a too-small pasture (T-700's alert opens it with `[v]`) has to find the Animals panel to move it.

## What to do

- Add a `[p] pasture` action to a tame grazer's view, doing what the Animals panel's `[p]` does for that one animal (the next pasture, after the last none), with the same status-row line and alert colour (`ui.animals.pastured`, `ui.animals.pastured_over`, `ui.animals.unpastured`; `src/ui/pasture.ts`). Check the view's own keys for a clash with `p` first (24 § Settings, the keymap contexts).
- Or, if a key there is not wanted, take the clause out of 08 and say in `fortress-screen.md` that the view shows the pasture only.

## Done

- [ ] A test: `[p]` in a cow's view sends `AssignPasture` for it and says where it went.
- [ ] 08 and `fortress-screen.md` say the same thing.
