# T-644 — The requests editor finds a good without stepping through every item

**Closed:** 2026-11-19, in 1dedf85a.

**Source:** [T-640](T-640-long-lists-animals-jobs-requests.md), found while adding the material choice · **Size:** S · **Needs:** — · **Status:** done

## Why

The Civilizations requests editor lists every item id of the content registry in registry order, a few hundred, and `↑` `↓` step through them one at a time. To ask the Mountainhome for iron bars a player presses `↓` until "bar" comes up, then `→` for the material. Most of the list is goods no civilization brings (a request for one is never served), and the ones the selected civilization does bring are scattered among them.

## What to do

Put the selected civilization's own goods first, in its list's order, then the rest in registry order; and let typing filter the list by name, as the other panels' `/filter` does. Keep the never-sold refusal on `Enter`.

Spec: `ui-screens/panels.md` § Civilizations (the editor's sentence); `ui-keymap-and-screens.md` § Civilizations panel.

## Done

A test that the Mountainhome's editor starts on a good of its list and that typing "bar" leaves the bars.

- [x] **Own goods first**, `test/unit/ui/t644-requests-editor.test.ts`: the Mountainhome's editor opens on `bar`, the first good of its list ("Add: bar: any"); its goods come once each in the list's order (`bar`, `pick`, `axe`, `short_sword`, …, animals such as `dog` included, since `SetRequests` takes a creature id), then every other item in registry order (167 goods in all). `requestCandidates` in `src/ui/panels/civilizations.ts`.
- [x] **Filter**, the same file: `/` focuses the editor's `/filter` field (the shared `PanelFilter`, as Jobs, Stocks and Log), letters are text and not panel keys while it has focus, `Enter` or `Esc` finishes typing without closing the editor; "bar" leaves `bar` and `barrel`, the title reads `Civilizations · filter: bar (2 of 167)`, and `→` `Enter` then ask for iron bars. A filter matching nothing reads "Add: no good matches the filter" and `Enter` adds nothing; the text clears when the editor opens again or the panel closes. The never-sold refusal on `Enter` is unchanged.
- [x] Spec: `panels.md` § Civilizations and `ui-keymap-and-screens.md` § Civilizations panel.
