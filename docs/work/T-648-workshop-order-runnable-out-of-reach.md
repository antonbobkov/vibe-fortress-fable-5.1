# T-648 — A workshop order is runnable on goods out of reach

**Source:** [T-642's measurement](../../reports/data/2026-11-19-t642-iron-for-steel.md) (`three-years-p4-6` at shift 50) · **Size:** M · **Needs:** — · **Status:** open

## Why

A work order is runnable when every input filter matches enough available items (12 § Operation, 13 `countAvailable`), wherever they lie. In `three-years-p4-6` at shift 50, 16 charcoal lay on the surface stockpile from day 140 on, out of reach from the workshop hall below whenever the gate was locked, while no other fuel stood below. The smelter's first order, the steel alloy, counted that charcoal as fuel, so it was always runnable: its job was created, found no fuel within reach and waited `blocked: missing_input`, holding the smelter (at each fortnightly look from day 168 to 210, and from 280 to 308, in one run), while the coal ore its next order would have smelted without fuel lay within reach. The three-year script now orders the coal first when the fuel under a roof is short (T-642), but a player's workshop would stall the same way.

## What to do

Decide in 12 how a workshop treats an order whose inputs exist but none within reach of its worker: skip it for the next runnable order (as a workshop skips an order whose inputs are missing), and look at it again after a while, or keep the blocked job and say why in the workshop panel. Measure the choice on the three-year sweep and the job-wait probes.

Spec: 12 § Operation, 11 § Blocking and retry, 13 § Searching.

## Done

A scenario with an order's inputs on the far side of a locked door: the workshop works its next order meanwhile and the first once the door opens; the sweep's verdict.
