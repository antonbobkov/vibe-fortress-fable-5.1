import { test, expect } from '@playwright/test';
import { bootSmoke } from './boot-smoke';

test.use({ baseURL: 'http://127.0.0.1:5175' });

test('T-M8-09 boot-dist', async ({ page }) => {
  await bootSmoke(page, 'boot-dist');
  const font = await page.evaluate(() => ({
    ready: document.fonts.check('16px DeepholmMono'),
    loaded: [...document.fonts].some((face) => face.family === 'DeepholmMono' && face.status === 'loaded'),
  }));
  expect(font).toEqual({ ready: true, loaded: true });
});

test('T-M8-09 bundled blocks fill square cells at zoom 1 and 1.5', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => [...document.fonts].some((face) => face.family === 'DeepholmMono' && face.status === 'loaded'));
  const solid = await page.evaluate(() => [16, 24].map((size) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${size}px DeepholmMono`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText('█');
    ctx.fillText('█', size / 2, size / 2);
    const rgba = ctx.getImageData(0, 0, size, size).data;
    return { size, width: metrics.width, height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      filled: Array.from(rgba).filter((_, i) => i % 4 === 3).every((alpha) => alpha > 0) };
  }));
  expect(solid).toEqual([{ size: 16, width: 16, height: 16, filled: true }, { size: 24, width: 24, height: 24, filled: true }]);
});
