# T-NEW — A first bed order eats the embark's linen, the only dressing the fortress has

**Source:** T-765 ([report](../../reports/audits/2026-11-25-t765-alpine-frostbite.md), § The linen) · **Size:** M · **Needs:** — · **Status:** open

## Why

Every embark preset carries five linen so that the first bleeding wound can be bandaged (17 § Patients and hospitals, `stop_bleeding`; `embark-catalog.md` § Presets). `make_bed` takes one log and two cloth (`workshops-and-recipes.md` § Carpenter), and nothing keeps the linen from it until a hospital asks for cloth. In T-765's reproduction a newcomer's first order, four beds at the carpenter's, took the five linen in the first 30 hours (5 → 3 → 0 by hour 27), and the dogs and the cat frostbitten that night found no dressing: the `NoDressing` alert came at hour 29. With T-765's fix nobody bleeds from frostbite, but the next cut of the first week, a snow leopard's or a boar's, finds the same empty wagon.

## What to do

Decide how a fortress with no hospital keeps a dressing for the first wound. Options, in the order to weigh them: a carpenter's order does not take the last `HOSPITAL_DEFAULT_SUPPLIES.cloth`-worth of cloth while no hospital exists (as `dress_burn` already spares the hospitals' cloth, 17 § `dress_burn`); `make_bed` prefers wool and takes cloth only when there are more than five; or the embark gives a few bandages in place of some linen, which no recipe uses. Measure with T-763's probe (`T763_DAMAGE=1`) how many cloth are left on day 7 of a busy first week, and add a test.

## Done

- [ ] A decision in 17 or 12, with a test.
- [ ] The probe's day-7 cloth count before and after.
