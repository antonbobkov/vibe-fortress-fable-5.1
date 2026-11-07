# T-500 — The Warband's hunter never takes a hunt in pp_defence

**Closed:** 2026-11-07, in 0b082588.

**Source:** [the held-shot arena](../../../reports/audits/2026-11-04-t483-held-shot-arena.md) · **Size:** S · **Needs:** — · **Status:** open

The specification is [09](../../02-systems/09-hunting-gathering-fishing.md) § Hunting (hunter equipment) and [11](../../02-systems/11-jobs-and-labor.md) § Assignment.

## What was found

The Warband embark carries a crossbow, 50 iron bolts and a quiver, and one dwarf with crossbow 5 and hunting 3 ([embark catalog](../../03-content/embark-catalog.md) § Warband). In `pp_defence`, on all four seeds (`pp-defence`, `-2`, `-3`, `-4`), no launcher is fired in 8 to 26 days: the trace shows `hunt:no_tool` blocks (7 on `pp-defence`, 1 on `pp-defence-2`) and a hunt job left `blocked(no_tool)`. The scenario turns woodcutting off for everyone and forms a squad of the two best axe dwarves; nothing in it should take the crossbow away from the hunter.

## What to do

Find why the hunt is blocked with `no_tool` while the crossbow and bolts are in the fortress (the hunting labor, the claim-time reservation of launcher and ammunition in 11 step 5, or the squad's equipment pool), and fix the side that disagrees with 09. Pin it with a test on the Warband embark.
