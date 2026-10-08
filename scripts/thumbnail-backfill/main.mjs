/**
 * Backfill harness page (served by the Vite dev server only).
 *
 * It exposes the production thumbnail renderer on `window` so
 * `scripts/backfill-thumbnails.mjs` can drive it through the DevTools protocol
 * and render real previews for models that were uploaded before the studio
 * preview existed. Nothing here ships in the production bundle.
 */
import { generateThumbnail, disposeThumbnailRenderer } from '../../src/utils/thumbnailRenderer';

window.renderThumbnail = async (url) => {
  const result = await generateThumbnail(url);
  const dataUrl = result.dataUrl;
  disposeThumbnailRenderer();
  return dataUrl;
};

window.thumbnailRendererReady = true;
document.getElementById('status').textContent = 'renderer ready';
document.getElementById('log').textContent = 'window.renderThumbnail(url) -> dataUrl';