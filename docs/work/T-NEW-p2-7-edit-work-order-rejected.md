# T-NEW — The three-year script's EditWorkOrder is rejected on p2-7

**Source:** T-400's sweeps, 2026-10-18, before (`06ba90b`) and after (`6af2414`) alike ([audit](../../reports/audits/2026-10-18-hostiles-open-doors.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

`three-years-p2-7` stops at tick 337,200 in both sweeps: `script-commands.ts` throws on `EditWorkOrder` rejected with `precondition_failed` (`{ workshopId: 16777331, index: 0, patch: { threshold: 1116 } }`), a rejection the script does not name. The script checks before it sends (testing-strategy.md § The long scenarios), so either the check misses this precondition or 14's command refuses a valid edit.

## What to do

1. Rerun `p2-7` to the tick and read why the command fails (which precondition, the workshop's orders then).
2. Fix the script's check or the command, with a test.

## Done

- `p2-7` plays its three years.
