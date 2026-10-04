import { test } from '@playwright/test';
import { bootSmoke } from './boot-smoke';

test('boot', async ({ page }) => {
  await bootSmoke(page, 'boot');
});
