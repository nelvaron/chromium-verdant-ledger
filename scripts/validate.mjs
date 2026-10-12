// Validate the Verdant Ledger Light browser theme: manifest structure, theme
// keys that Chromium reads, palette use, WCAG contrast, icons, translations
// and documentation.
//
// Run with: npm test   (Node.js 18 or later, no dependencies)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contrast, over } from "./color.mjs";
import { palette } from "./palette.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
let checks = 0;

function check(ok, message) {
  checks += 1;
  if (!ok) errors.push(message);
  return ok;
}

// ---------------------------------------------------------------------------
// Strict JSON parsing: JSON.parse silently keeps the last of duplicate keys.

function parseStrictJson(text, file) {
  let i = 0;
  const lineAt = (pos) => text.slice(0, pos).split("\n").length;
  const fail = (message) => {
    throw new Error(`${file}:${lineAt(i)}: ${message}`);
  };
  const ws = () => {
    while (/\s/.test(text[i])) i += 1;
  };
  const string = () => {
    const start = i;
    i += 1;
    while (text[i] !== '"') {
      if (i >= text.length) fail("unterminated string");
      i += text[i] === "\\" ? 2 : 1;
    }
    i += 1;
    return JSON.parse(text.slice(start, i));
  };
  const value = () => {
    ws();
    const ch = text[i];
    if (ch === "{") {
      i += 1;
      const object = {};
      ws();
      if (text[i] === "}") {
        i += 1;
        return object;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail("expected a property name");
        const keyPos = i;
        const key = string();
        if (Object.hasOwn(object, key)) {
          errors.push(`${file}:${lineAt(keyPos)}: duplicate key "${key}"`);
        }
        ws();
        if (text[i] !== ":") fail("expected ':'");
        i += 1;
        object[key] = value();
        ws();
        if (text[i] === ",") {
          i += 1;
          continue;
        }
        if (text[i] === "}") {
          i += 1;
          return object;
        }
        fail("expected ',' or '}'");
      }
    }
    if (ch === "[") {
      i += 1;
      const array = [];
      ws();
      if (text[i] === "]") {
        i += 1;
        return array;
      }
      for (;;) {
        array.push(value());
        ws();
        if (text[i] === ",") {
          i += 1;
          continue;
        }
        if (text[i] === "]") {
          i += 1;
          return array;
        }
        fail("expected ',' or ']'");
      }
    }
    if (ch === '"') return string();
    const literal = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
    if (!literal) fail("unexpected character");
    i += literal[0].length;
    return JSON.parse(literal[0]);
  };
  const result = value();
  ws();
  if (i !== text.length) fail("unexpected content after the JSON value");
  return result;
}

function readJson(relativePath) {
  try {
    return parseStrictJson(readFileSync(join(root, relativePath), "utf8"), relativePath);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Theme keys Chromium reads from a manifest. Source: kOverwritableColorTable,
// kTintTable and kDisplayProperties in
// chrome/browser/themes/browser_theme_pack.cc (Chromium 141).

const colorKeys = [
  "frame", "frame_inactive", "background_tab", "background_tab_inactive",
  "tab_text", "tab_background_text", "tab_background_text_inactive",
  "toolbar", "toolbar_text", "toolbar_button_icon", "bookmark_text",
  "omnibox_background", "omnibox_text", "ntp_background", "ntp_text",
  "ntp_link", "ntp_header", "button_background",
];
// Chromium still parses these, but incognito windows ignore extension themes
// (ThemeService::GetColorProviderKey sets no custom theme for them).
const incognitoKeys = [
  "frame_incognito", "frame_incognito_inactive", "background_tab_incognito",
  "background_tab_incognito_inactive", "tab_background_text_incognito",
  "tab_background_text_incognito_inactive",
];
const tintKeys = ["buttons", "frame", "frame_inactive", "frame_incognito", "frame_incognito_inactive", "background_tab"];
const propertyValues = {
  ntp_logo_alternate: (v) => v === 0 || v === 1,
  ntp_background_alignment: (v) => typeof v === "string" && /^(?:(?:center|top|bottom|left|right)(?: |$))+$/.test(v),
  ntp_background_repeat: (v) => ["no-repeat", "repeat-x", "repeat-y", "repeat"].includes(v),
};
// Keys a theme may have. Anything else, such as scripts or permissions, would
// make it an extension rather than a theme.
const manifestKeys = new Set([
  "manifest_version", "name", "short_name", "description", "version", "version_name",
  "default_locale", "homepage_url", "icons", "theme", "minimum_chrome_version", "key",
]);

const file = "theme/manifest.json";
const where = (detail) => `${file}: ${detail}`;
const manifest = readJson(file);
const theme = manifest.theme ?? {};
const colors = theme.colors ?? {};

// ---------------------------------------------------------------------------
// Manifest

check(manifest.manifest_version === 3, where("the Chrome Web Store accepts only manifest_version 3"));
for (const key of Object.keys(manifest)) {
  check(manifestKeys.has(key), where(`"${key}" does not belong in a theme manifest`));
}
const version = String(manifest.version);
check(
  /^\d+(?:\.\d+){0,3}$/.test(version) && version.split(".").every((part) => Number(part) <= 65535 && !/^0\d/.test(part)),
  where(`version "${version}" must be one to four dot-separated integers`),
);

// Translations: name and description come from _locales, so both stores list
// every language the theme is translated into.
const localesDir = join(root, "theme/_locales");
const locales = existsSync(localesDir) ? readdirSync(localesDir).sort() : [];
check(locales.includes(manifest.default_locale), where(`default_locale "${manifest.default_locale}" has no folder in theme/_locales`));
const messages = Object.fromEntries(locales.map((locale) => [locale, readJson(`theme/_locales/${locale}/messages.json`)]));
const reference = messages[manifest.default_locale] ?? {};
for (const [field, limit] of [["name", 75], ["description", 132]]) {
  const match = /^__MSG_(\w+)__$/.exec(manifest[field] ?? "");
  if (!check(match, where(`${field} must be a __MSG_…__ reference to theme/_locales`))) continue;
  for (const locale of locales) {
    const text = messages[locale][match[1]]?.message;
    if (!check(typeof text === "string" && text.trim(), `theme/_locales/${locale}/messages.json: "${match[1]}" is missing`)) continue;
    check([...text].length <= limit, `theme/_locales/${locale}/messages.json: ${field} has ${[...text].length} characters, the stores allow ${limit}`);
  }
}
for (const locale of locales) {
  const keys = Object.keys(messages[locale]).sort().join();
  check(keys === Object.keys(reference).sort().join(), `theme/_locales/${locale}/messages.json: keys differ from the default locale`);
}

// Icons: PNG files of the size they are declared at.
for (const [size, path] of Object.entries(manifest.icons ?? {})) {
  const iconPath = join(root, "theme", path);
  if (!check(existsSync(iconPath), where(`icon ${path} does not exist`))) continue;
  const png = readFileSync(iconPath);
  const isPng = png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!check(isPng, where(`icon ${path} is not a PNG file`))) continue;
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  check(width === Number(size) && height === Number(size), where(`icon ${path} is ${width}x${height}, declared as ${size}x${size}`));
}
check("128" in (manifest.icons ?? {}), where("the Chrome Web Store needs a 128x128 icon"));

// ---------------------------------------------------------------------------
// Theme colors

const hex = (rgb) => `#${rgb.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const used = new Set();
const value = {};
for (const [key, rgb] of Object.entries(colors)) {
  if (incognitoKeys.includes(key)) {
    check(false, where(`colors.${key}: Chromium does not apply themes to incognito windows, so the key has no effect`));
    continue;
  }
  check(colorKeys.includes(key), where(`colors.${key} is not a color Chromium reads`));
  const valid =
    Array.isArray(rgb) &&
    (rgb.length === 3 || rgb.length === 4) &&
    rgb.slice(0, 3).every((v) => Number.isInteger(v) && v >= 0 && v <= 255) &&
    (rgb.length === 3 || (typeof rgb[3] === "number" && rgb[3] >= 0 && rgb[3] <= 1));
  if (!check(valid, where(`colors.${key}: ${JSON.stringify(rgb)} is not [r, g, b] or [r, g, b, alpha]`))) continue;
  const color = hex(rgb);
  value[key] = color;
  used.add(color);
  check(color in palette, where(`colors.${key}: ${color} is not in scripts/palette.mjs`));
  // Only the window buttons may be see-through, and then fully: Chromium
  // draws every other surface opaque.
  if (rgb.length === 4) {
    check(key === "button_background" && rgb[3] === 0, where(`colors.${key}: only button_background may have an alpha value, and it must be 0`));
  }
}
// No borrowed defaults: every color Chromium reads is set from the palette.
for (const key of colorKeys) {
  check(key in colors, where(`colors.${key} is not set, so Chromium would choose it`));
}
for (const color of Object.keys(palette)) {
  check(used.has(color), where(`palette color ${color} is listed in scripts/palette.mjs but never used`));
}

for (const [key, hsl] of Object.entries(theme.tints ?? {})) {
  check(tintKeys.includes(key), where(`tints.${key} is not a tint Chromium reads`));
  check(
    Array.isArray(hsl) && hsl.length === 3 && hsl.every((v) => typeof v === "number" && (v === -1 || (v >= 0 && v <= 1))),
    where(`tints.${key}: ${JSON.stringify(hsl)} must be [h, s, l] with values from 0 to 1, or -1 to keep a channel`),
  );
}
for (const [key, setting] of Object.entries(theme.properties ?? {})) {
  if (!check(key in propertyValues, where(`properties.${key} is not a property Chromium reads`))) continue;
  check(propertyValues[key](setting), where(`properties.${key}: ${JSON.stringify(setting)} is not a valid value`));
}
for (const [key, path] of Object.entries(theme.images ?? {})) {
  check(existsSync(join(root, "theme", path)), where(`images.${key}: ${path} does not exist`));
}

// ---------------------------------------------------------------------------
// Contrast (WCAG 2.x)

const ratio = (fgKey, bgKey, minimum, fg = value[fgKey], note = "") => {
  const bg = value[bgKey];
  if (!fg || !bg) return;
  const result = contrast(fg, bg);
  check(result >= minimum, where(`${fgKey}${note} on ${bgKey}: ${result.toFixed(2)}:1, needs ${minimum}:1`));
};

// Text: 4.5:1.
ratio("tab_text", "toolbar", 4.5); // the active tab is drawn in the toolbar color
ratio("tab_background_text", "background_tab", 4.5);
ratio("tab_background_text_inactive", "background_tab_inactive", 4.5);
ratio("toolbar_text", "toolbar", 4.5);
ratio("bookmark_text", "toolbar", 4.5);
ratio("omnibox_text", "omnibox_background", 4.5);
ratio("ntp_text", "ntp_background", 4.5);
ratio("ntp_link", "ntp_background", 4.5);
// In an inactive window Chromium blends the active tab title 75% into the tab.
if (value.tab_text && value.toolbar) {
  const faded = over(`${value.tab_text}bf`, value.toolbar);
  ratio("tab_text", "toolbar", 4.5, faded, " (window in the background)");
}
// Icons: 3:1 (WCAG 1.4.11).
ratio("toolbar_button_icon", "toolbar", 3);

// ---------------------------------------------------------------------------
// Documentation and versions

const design = readFileSync(join(root, "DESIGN.md"), "utf8").toLowerCase();
const readme = readFileSync(join(root, "README.md"), "utf8").toLowerCase();
for (const color of Object.keys(palette)) {
  check(design.includes(color), `DESIGN.md: ${color} from scripts/palette.mjs is not documented`);
  check(readme.includes(color), `README.md: palette color ${color} is missing from the palette table`);
}
for (const key of colorKeys) {
  check(design.includes(`\`${key}\``), `DESIGN.md: the role of colors.${key} is not documented`);
}
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
check(new RegExp(`^## ${version.replaceAll(".", "\\.")} - \\d{4}-\\d{2}-\\d{2}$`, "m").test(changelog), `CHANGELOG.md: no "## ${version} - YYYY-MM-DD" section`);

// ---------------------------------------------------------------------------

if (errors.length) {
  console.error(`${errors.length} of ${checks} checks failed:\n`);
  for (const message of errors) console.error(`  ✗ ${message}`);
  process.exit(1);
}
console.log(`All ${checks} checks passed.`);
