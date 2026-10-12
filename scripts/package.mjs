// Package theme/ as dist/verdant-ledger-light-<version>.zip, the file both
// the Chrome Web Store and Microsoft Edge Add-ons accept. The archive is
// reproducible: files are sorted and every entry has the same timestamp.
//
// Run with: npm run package   (Node.js 18 or later, no dependencies)

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "theme");
const { version } = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));

// Chromium writes "Cached Theme.pak" next to an unpacked theme it loads.
const ignored = (name) => name.startsWith(".") || name === "Cached Theme.pak";

function files(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !ignored(entry.name))
    .flatMap((entry) => (entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 1 January 2026, 00:00, in MS-DOS date and time format.
const dosTime = 0;
const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

const locals = [];
const centrals = [];
let offset = 0;
const paths = files(source).map((path) => relative(source, path).split("\\").join("/")).sort();
for (const path of paths) {
  const data = readFileSync(join(source, path));
  const deflated = deflateRawSync(data, { level: 9 });
  const stored = deflated.length >= data.length;
  const body = stored ? data : deflated;
  const name = Buffer.from(path, "utf8");

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed to extract
  header.writeUInt16LE(0x0800, 6); // UTF-8 file names
  header.writeUInt16LE(stored ? 0 : 8, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc32(data), 14);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  locals.push(header, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0x031e, 4); // made by: Unix, version 3.0
  header.copy(central, 6, 4, 30);
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, rw-r--r--
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += header.length + name.length + body.length;
}

const directory = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(paths.length, 8);
end.writeUInt16LE(paths.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

const out = join(root, "dist", `verdant-ledger-light-${version}.zip`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([...locals, directory, end]));
console.log(`${relative(root, out)}: ${paths.length} files`);
