# T-800 — The trader waits at the depot while the caravan does

**Closed:** 2026-11-26, in 7cb68eb3, 84dfbe37.

**Source:** playtest 8 ([report](../../../reports/data/2026-11-26-playtest-8.md), finding 6) · **Size:** S · **Needs:** — · **Status:** done

## Why

The trade job ends when the trader reaches the depot. `completeJob` (`src/systems/trade/index.ts:250-268`) completes it and opens the session, and nothing keeps the trader there. Closing the trade screen (Esc, `TradeCancel`, `trade_session.ts:183`, `index.ts:372`) ends the session. The next [t] makes a new job and a new trip.

On that trip the trader's postponed needs win:
- Want-level needs wait only while a job is open, not once it is claimed (`dwarves/brain.ts:476`, `board.ts:971`).
- The 23:00 sleep start skips the urgency check (`brain.ts:532-535`).
- A dwarf in a need is never called back (`board.ts:1071-1105`).

In playtest 8 the status line cycled for two days: "Bjarni Marblehammer, the Broker, is asleep / is drinking / is taking a break / is eating: on the way after." The caravan waited five days at most, and less once attacked.

A player meets this naturally. The first session showed "Our goods at the depot" empty, so the player has to close it, send goods with Stocks [t], and press [t] again. (In playtest 8 the harness's own Esc presses made it worse, but the cause is above.)

Also seen in the trace: if the merchant or the trader is not on the depot footprint when the job completes, the job is dropped with no retry (`trade/index.ts:263-267`).

## What to do

Decisions taken here:

- **The trader stays.** While a caravan is at the depot and a session has opened this visit, the trader stays at the depot. Their trade job stays `working` until the caravan packs or the player closes the trade for the visit with [x] "done trading". Closing the screen with Esc only hides it. Critical needs still pull the trader away and bring them back; want-level needs and the sleep start wait.
- **Another trader goes.** If the Broker is asleep, or more than 200 ticks from the depot in a need, another dwarf with the trading labor takes the job. The status line names them, as the trade-wait line for a Broker with the trading labor off already does ("another dwarf with it trades instead").
- **The status line says when the trader has gone:** "Bjarni Marblehammer, the Broker, left the depot to sleep; back after."
- **A dropped job retries.** A trade job that completes with the merchant away re-queues once.

Decided in the work (ambiguity protocol):

- **The trader is not held; the session stays open.** Holding the trader at the depot (the trade job kept `working` while the session is open, critical needs taking them away and back) was built and measured, and is not adopted: the scripted fortresses keep a session open between their looks, so their trader stood idle at the depot, and the sweep's deaths rose past the bound. Twenty-seed sweep, pooled living / deaths, against master's about 1167 / 115 and the bounds ≥ 1046.63 / ≤ 132.5: the hold alone (run 45888132672, `7cb68eb3`) 1102.25 / 135.25, blocked; with T-798's raid pause (run 45889692256, `1553b00f`) 1111.5 / 127.75, pass; the hold with `[x]` completing the job (run 45909859678, `aecacfdd`) 1097.75 / 146, blocked. `defence_seeds` passed every time (45888136976: 7.38 raids turned back, 6.25 soldier kills; 45909862522: 7.50, 6.38). What stays solves the playtest's trip: once a session opens it stays open until `[x]` or the caravan leaves, `Esc` only hides the screen (a UI flag, cleared by the next `TradeOpen`), and `[t]` shows it again with no new trip. The trader goes back to work when the job completes, as before. The keys line is shortened to fit 80 columns: "[Tab] side [+]/[-] qty [a] all [Enter] Offer [g] Gift [x] Done [Esc] Hide". The depot's line while the session is open and hidden: "The trade is open, Bjarni Marblehammer, the Broker, trading: [t] shows it." With no hold there is no "left the depot" line.
- **Another trader goes** only when another dwarf with the trading labor is free of squad duty; otherwise the job waits for the Broker as before ("is asleep: on the way after."). "200 ticks from the depot" is `TRADER_AWAY_TICKS` = 200, read as straight-line tiles (the larger of the x and y distances, plus levels) × `STEP_COST` / the Broker's speed. A stand-in who has taken the job keeps it when the Broker wakes.
- **The retry** re-queues once (`retried` on the new job) when the job completes with its trader eligible but no merchant or trader on the depot's footprint.
- The spring caravan meeting the spring raid is decided in T-798.
- A follow-up for the hold, should the scripts learn to close a session they are done with: `docs/work/T-810-trader-held-at-depot.md`.

## Done

- [x] The trader held at the depot through closed and reopened sessions; a test that closes and reopens the screen with no new trip. (The session is held, not the trader: measured above.)
- [x] Another trader takes over from a sleeping Broker; a test.
- [x] The status line; the retry; tests.
- [x] 20 § The session and `panels.md` § Trade session updated (also § Depot's waiting line, `trade-session.md` and the keymap table).

## Measured again in T-814

The stand-in trader swept off on master `ddbff0d0` (`t814-tmp-nostandin`, run 46117162437) and paired with it (run 46111413549): deaths 134.5 against 117.25 (+17.25, noise ± 10.8), living 1113.5 against 1143.5. Without the stand-in the deaths rise, not fall (79 of 80 timelines move; up in 31 seed-shifts, down in 22), so the stand-in is not the cost of T-798..T-800 and stays. The re-queued job never fired in the 12 local three-year runs that logged it ([T-814](T-814-master-drift-t795-t798.md)).
