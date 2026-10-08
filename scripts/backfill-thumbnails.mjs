/**
 * Renders studio previews for models that were published before the thumbnail
 * pipeline existed, then persists the image and points the model at it.
 *
 * Usage:
 *   1. npm run dev:client      (Vite dev server, serves the harness page)
 *   2. npm run server          (API on :3001)
 *   3. npm run db:thumbnails   (this script)
 *
 * The renderer that runs here is the exact module the upload flow uses, so a
 * backfilled preview and a freshly uploaded preview are indistinguishable.
 * Re-running is safe: existing previews are skipped unless --force is passed.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const HARNESS_URL = 'http://localhost:5173/scripts/thumbnail-backfill/';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api';
const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9361;
const FORCE = process.argv.includes('--force');
const prisma = new PrismaClient();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `/models/duck.glb` -> `/models/duck-thumb.jpg`, or null when unsupported. */
function targetFor(fileUrl) {
  const match = /^\/(models|uploads)\/(.+)\.(glb|gltf)$/i.exec(fileUrl);
  if (!match) return null;
  const [, folder, stem] = match;
  return {
    relative: `${folder}/${stem}-thumb.jpg`,
    thumbnailUrl: `/${folder}/${stem}-thumb.jpg`,
  };
}

async function launchChrome() {
  const profile = path.join(ROOT, 'node_modules', '.cache', 'thumbnail-backfill-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--enable-unsafe-swiftshader',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let target = null;
  for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {
      /* devtools not up yet */
    }
    if (!target) await sleep(200);
  }
  if (!target) throw new Error('Chrome DevTools endpoint never became available');
  return child;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.onopen = () => resolve(socket);
    socket.onerror = () => reject(new Error('Could not open the DevTools socket'));
  });
}

async function main() {
  const response = await fetch(`${API_BASE}/models`);
  if (!response.ok) throw new Error(`API responded ${response.status}`);
  const models = await response.json();

  const chrome = await launchChrome();

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('No debuggable page target was found');

  const ws = await connect(page.webSocketDebuggerUrl);
  let messageId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message.result ?? {});
      pending.delete(message.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++messageId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ?? 'Page evaluation failed',
      );
    }
    return result.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: HARNESS_URL });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate('window.thumbnailRendererReady === true')) break;
    await sleep(200);
  }
  if (!(await evaluate('window.thumbnailRendererReady === true'))) {
    throw new Error(
      `Harness never became ready. Is the dev server running at ${HARNESS_URL}?`,
    );
  }

  let rendered = 0;
  let skipped = 0;
  const failures = [];

  for (const model of models) {
    const target = targetFor(model.fileUrl);
    if (!target) {
      failures.push(`${model.name}: unsupported file url ${model.fileUrl}`);
      continue;
    }
    const absolute = path.join(PUBLIC_DIR, target.relative);
    if (!FORCE && fs.existsSync(absolute) && model.thumbnailUrl === target.thumbnailUrl) {
      skipped += 1;
      continue;
    }

    const dataUrl = await evaluate(
      `window.renderThumbnail(${JSON.stringify(model.fileUrl)})`,
    ).catch((error) => `ERROR:${error.message}`);

    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      failures.push(`${model.name}: ${String(dataUrl).slice(0, 120)}`);
      continue;
    }

    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, buffer);
    await prisma.model.update({
      where: { id: model.id },
      data: { thumbnailUrl: target.thumbnailUrl },
    });
    rendered += 1;
    console.log(`rendered ${model.name} -> ${target.thumbnailUrl} (${Math.round(buffer.length / 1024)} kB)`);
  }

  console.log(`\nrendered: ${rendered}  skipped: ${skipped}  failed: ${failures.length}`);
  if (failures.length) console.log(failures.map((f) => `  - ${f}`).join('\n'));

  ws.close();
  chrome.kill();
  await prisma.$disconnect();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error('backfill failed:', error.message);
  await prisma.$disconnect();
  process.exit(2);
});