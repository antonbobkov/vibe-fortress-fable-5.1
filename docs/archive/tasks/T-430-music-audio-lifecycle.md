# T-430 — The music's audio context when music is off, interrupted or hidden

**Closed:** 2026-10-23, in 6474ab1.

**Source:** the review of T-422 (`c482ee4`), its nits 2 to 4 · **Size:** S · **Needs:** — · **Status:** open

## Why

The review of T-422 found three small gaps in `src/platform/audio.ts` and the director in `src/ui/music.ts`:

- **Music off.** Once created, the AudioContext keeps running with music off or the volume at 0, so the convolver and the master stay live. That is a small but constant cost on battery.
- **iOS.** The gesture gate resumes only a `suspended` context. iOS Safari can leave one `interrupted`, after a call for example, and music then stays silent until a reload.
- **A hidden tab.** If the frame loop ticks slowly in a hidden tab, `pump` skips every note whose time has passed, so the piece runs out silently and the director moves on.

## Decisions

1. Suspend the context when music turns off or the volume reaches 0. Resume it when music turns back on, or on the next gesture if the browser requires one.
2. The gate resumes a context in any state other than `running` and `closed`.
3. The director pauses while the document is hidden (`visibilitychange`), so the piece in progress is not lost. It resumes where it was, or starts the mood's piece after `MUSIC_CHANGE_GAP_S` if the mood changed meanwhile. 24 § Music says so.

## Done

- Unit tests with a fake context cover suspend on off or volume 0, resume on on, resume from `interrupted`, and pausing while hidden.
- No AudioContext is created headless (T-422's tests still pass), and the golden world hashes do not move.
