// Render the PNG images with headless Chromium: the theme icons from
// images/icon.svg, the logo for Microsoft Edge Add-ons, and the promotional
// tiles from store/promo.html. Run it after changing either source file:
//
//   CHROME=/path/to/chrome npm run images

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];
const chrome = candidates.find((path) => path && existsSync(path));
if (!chrome) {
  console.error("✗ Chrome or Chromium not found. Set CHROME to its executable.");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "verdant-ledger-"));

// Headless Chromium driven over the DevTools protocol on a pipe, so each
// image has exactly the requested size and a transparent background.
const browser = spawn(chrome, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--remote-debugging-pipe",
  `--user-data-dir=${join(work, "profile")}`,
  ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []),
  "about:blank",
], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });

let nextId = 0;
let buffer = "";
const pending = new Map();
const listeners = [];
browser.stdio[4].on("data", (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf("\0")) >= 0) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve: done, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else done(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  }
});
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
  return new Promise((done, reject) => pending.set(id, { resolve: done, reject }));
}
function once(method, sessionId) {
  return new Promise((done) => {
    listeners.push(function listener(message) {
      if (message.method === method && message.sessionId === sessionId) {
        listeners.splice(listeners.indexOf(listener), 1);
        done(message.params);
      }
    });
  });
}

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }, sessionId);

async function render(url, out, width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  const loaded = once("Page.loadEventFired", sessionId);
  await send("Page.navigate", { url }, sessionId);
  await loaded;
  await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true }, sessionId);
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } }, sessionId);
  writeFileSync(join(root, out), Buffer.from(data, "base64"));
  console.log(`  ${out} (${width}x${height})`);
}

// The icon fills the image, except at 128 px: the Chrome Web Store asks for
// 96 px of artwork with 16 px of transparent padding.
const svg = readFileSync(join(root, "images/icon.svg"), "utf8");
function icon(out, size, padding = 0) {
  const page = join(work, `icon-${size}.html`);
  writeFileSync(page, `<!doctype html><style>html,body{margin:0;background:transparent}
svg{display:block;margin:${padding}px;width:${size - 2 * padding}px;height:${size - 2 * padding}px}</style>${svg}`);
  return render(pathToFileURL(page).href, out, size, size);
}

try {
  console.log("Rendering images:");
  await icon("theme/icons/icon-16.png", 16);
  await icon("theme/icons/icon-32.png", 32);
  await icon("theme/icons/icon-48.png", 48);
  await icon("theme/icons/icon-128.png", 128, 16);
  await icon("store/logo-300.png", 300);
  const promo = pathToFileURL(join(root, "store/promo.html")).href;
  await render(`${promo}?tile=small`, "store/promo-small.png", 440, 280);
  await render(`${promo}?tile=marquee`, "store/promo-marquee.png", 1400, 560);
} finally {
  browser.kill();
  await new Promise((done) => browser.once("exit", done));
  rmSync(work, { recursive: true, force: true, maxRetries: 3 });
}
