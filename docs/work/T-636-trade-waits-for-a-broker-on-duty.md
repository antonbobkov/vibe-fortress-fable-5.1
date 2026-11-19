# T-636 — A trade request says why the Broker does not come

**Source:** [T-635's mid-game audit](../../reports/audits/2026-11-19-t635-midgame-ux.md), finding 1 · **Size:** S · **Needs:** — · **Status:** open

## Why

In the peril-2 fortress the Broker, Geir Ashsong, was also a member of the Gate Guard, which the player had set to Active during the raid a month before. When the Hillfolk reached the depot (Summer 12, Year 2), `[S-t] trade now` in Civilizations said "The broker is on the way to the depot. · [Space] resumes". Five days later the caravan left, `CaravanDeparted` with `boughtValue 0, soldValue 0`, and the log said only "The Hillfolk caravan has departed." In those five days the Jobs panel listed "trade trade depo  -" (open, no worker), the Broker was "Sleeping" or "Talking" in Units, and nothing anywhere said that a soldier on an active squad takes no civilian job, or that the trade never started. The player waited for a trade screen that could not come and lost the summer's caravan.

## What to do

1. While the `trade` job waits, the depot panel and the Civilizations panel name who it waits for and why, from the job's assigned worker and the worker's state: "Waiting for Geir Ashsong, the Broker: on duty with the Gate Guard. Set the squad to Off or Train, or appoint another Broker [u] [S-t]." Other reasons: asleep or eating ("Geir Ashsong, the Broker, is eating: on the way after."), unreachable, `trading` labor off.
2. The status line of the request says the same in place of "The broker is on the way" when the Broker cannot take the job now.
3. A caravan that leaves with no trade made while a request waited says so, as an alert: "The Hillfolk caravan left without trading: Geir Ashsong, the Broker, never reached the depot."
4. The Jobs panel names the job "Trade at Trade depot #1", not "trade trade depo".

Spec: 20 § Trade (the request), `ui-screens/panels.md` § Depot and § Civilizations, 24 § Announcements.

## Done

A test with the Broker in an active squad: the depot line names the reason, and the departure line is the alert. A test with the Broker asleep: the line says it will come after.
