/**
 * Entry point.
 *
 * `01-architecture/simulation-core.md` § Startup sequence: content is loaded into the registry,
 * the atlases are built, the world is constructed and the frame loop begins paused. `boot()` in
 * `game.ts` does all of it; this file only calls it and reports a failure where a player can see
 * it.
 */

import { boot } from '@app/game';

void boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // The canvas is not up, so this is the only place left to say it.
  document.body.innerHTML = `<pre style="color:#FF5555;font:14px monospace;padding:16px">Deepholm failed to start: ${message}</pre>`;
});
