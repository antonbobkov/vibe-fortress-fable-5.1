# T-774 — Stocks cannot open weapons or ammunition

**Source:** playtest 2026-11-25 (military) ([report](../../reports/data/2026-11-25-playtest-6.md), finding 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

Equipping a squad, I wanted to see which weapons the fortress had. `playtest-1125-p3m`, Spring 28, Year 2: Stocks listed "weapon 10 900 ☼" and "ammo 21 63 ☼" with no `►`, and the cursor skips both rows; every other category opens (`10-stocks-weapon-closed.png`). With the filter "weapon" the row shows only "Usable 2 of 10: 8 owned". The squad's weapon list (`[w]`) counts by class ("sword (2)"), but nothing lists the ten weapons, their materials or qualities, or the arrows, which is what a player compares before choosing the squad's class or ordering more.

The cause: the content export files a melee weapon under its class and ammunition under its kind (`scripts/lib/export/items.mjs`: `weapon/${w.weaponClass}`, `ammo/${a.id}`; `items.categoryOf` gives `weapon/spear`, `weapon/sword`, `ammo/arrow`), while 13's category tree (`CATEGORY_TREE` in `src/systems/items/stockpiles.ts`, 13 § Categories: `weapon/ melee ranged`, `ammo/`) has `weapon/melee`, `weapon/ranged` and no node under `ammo`. Stocks attaches a type to the node its category names, so these types attach nowhere: the top row counts them and opens to nothing. Launchers already file under `weapon/ranged`. The same mismatch reaches stockpile filters: one set to `weapon/melee` alone accepts no sword or spear.

## What to do

Decisions:

- **Melee weapons and ammunition file under 13's tree.** The export writes `weapon/melee` for every weapon that is not a launcher (training weapons included) and `ammo` for every ammunition row; launchers stay `weapon/ranged`. The class stays on the weapon's row, where the squad's weapon list reads it; any code that reads a class from the category path reads the row's class instead. Only a column's value changes, so no row number moves (`npm run content:export`, `content:check`). Stocks then opens `weapon` to `melee` and `ranged` and those to their types (`short sword`, `spear`), and `ammo` to its types (`arrow`, `bolt`), as every other category does.
- **Check the stockpile filters on the same tree:** a stockpile set to `weapon/melee` alone takes swords and spears and not crossbows; a test pins it.
- If the change moves which stockpile a weapon goes to in the economy fixture, the sweep says so; it should not.
- **Decided while doing it:** the two places that read the old paths now read the new ones: the ranged kit's ammunition check (`jobs/items-adapter.ts`, `startsWith('ammo/')` to `=== 'ammo'`) and the ruins' valuable prefixes (`app/ruins.ts`, `ammo/` to `ammo`); both pick exactly the same items as before. A stockpile filter saved with an old class node (`weapon/sword`) is not migrated: the stockpile editor offers only `CATEGORY_TREE`'s nodes, so only a hand-made command could have set one. 13's spec tree also lacked three leaves items use (`furniture/archery_target`, `furniture/chain`, `tool/quiver`); they are added, and the spec now says every item type's category is a node of the tree. The code's `CATEGORY_TREE` lacks nine of the spec's leaves, which the stockpile editor therefore cannot pick alone: a follow-up (`T-NEW-stockpile-tree-misses-leaves.md`). No world hash moves (the flat-test golden passes and nothing that steers the simulation reads a class from a path), so no sweep.

Spec: 13 § Categories (check that its tree is the one items use), `ui-screens/panels.md` § Stocks (unchanged).

## Done

- [x] Tests (`describe` with the task id): a fortress holding a short sword, a spear, a crossbow and arrows shows `weapon ►`, `melee ►` with `short sword` and `spear`, `ranged ►` with `crossbow`, and `ammo ►` with `arrow`. A stockpile accepting only `weapon/melee` takes the sword and not the crossbow.
- [x] If any world hash moves (stockpile placement), the sweep on GitHub: none moves, so none ran.
