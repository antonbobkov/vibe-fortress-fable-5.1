/**
 * Entry point.
 *
 * `01-architecture/simulation-core.md` § Startup sequence: content is loaded into the registry,
 * the atlases are built, the world is constructed and the frame loop begins paused. `boot()` in
 * `game.ts` does all of it; this file only calls it and reports a failure where a player can see
 * it.
 */

import { boot } from '@app/game';
import { CELL_PX_ZOOM_1 } from '@core/constants';
import { BUNDLED_FONT_FAMILY } from '@render/constants';
import './style.css';

async function start(): Promise<void> {
  const fonts = await document.fonts.load(`${CELL_PX_ZOOM_1}px ${BUNDLED_FONT_FAMILY}`);
  if (fonts.length === 0) throw new Error('Bundled font did not load');
  await boot();
}

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // The canvas is not up, so this is the only place left to say it.
  document.body.innerHTML = `<pre style="color:#FF5555;font:14px monospace;padding:16px">Deepholm failed to start: ${message}</pre>`;
});
