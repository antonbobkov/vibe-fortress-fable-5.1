# T-631 — Stocks counts goods that a build or an order cannot use, and nothing says which

**Closed:** 2026-11-19, in 9040537a,53ddda00.

**Source:** [T-618's first-year audit](../../../reports/audits/2026-11-18-t618-first-year-ux.md), finding 22, after T-626 · **Size:** S · **Needs:** — · **Status:** open

## Why

The audit saw "Straw pallet 3 fibers (0)" while barley straw and reeds were "in stock". T-626 made the build row and its stock warning name and count every alternative ("3 fiber, straw or reed (9)"), and checked that the count already summed fiber, straw and reed; the `(0)` was not reproduced from the code. The build count, the order picker and the workshop's "waiting for" count only *available* units (13 `countAvailable`: not forbidden, reserved, owned, carried, at a merchant's or installed), while the Stocks panel counts every unit that is not a merchant's: forbidden goods, goods reserved by a job, goods in a hauler's hands and goods taken to the trade depot (the same audit's depot listed "1 barley straw" eleven times). So Stocks can show straw that the pallet cannot have, and nothing on screen says why the two figures differ.

## What to do

1. The Stocks panel's selected-row line says how many of the row's units cannot be used now and why, when any: "barley straw ×14 · 11 at the depot, 3 forbidden".
2. The build list's count and the stock warning stay as they are (available units).

Spec: 24 § Panels (Stocks), `ui-screens/panels.md` § Stocks.

## Done

A unit test with straw at the depot, forbidden and reserved: the Stocks line names each, and the pallet's count is the rest.
