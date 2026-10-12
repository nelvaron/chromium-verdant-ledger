# Verdant Ledger Light design

This document describes the decisions behind the browser theme, so changes
keep its character. [CONTRIBUTING.md](CONTRIBUTING.md) covers the practical
workflow.

## Principles

The principles are those of
[Verdant Ledger Light for VS Code](https://github.com/nelvaron/vscode-verdant-ledger/blob/main/DESIGN.md),
applied to the browser:

- **Calm first.** The theme is light and low-glare, not high-contrast. The
  browser frames the page; it should not compete with it.
- **Every color has a role.** A color is used only for a job that no other
  color in the set can do, and its role is written down here.
- **Same role, same color, in every product.** A surface, text, or accent
  has the color it has in the editor: the frame is the editor's sidebar, the
  active tab and toolbar are the editor background, the address bar is an
  input, and links are forest green.
- **Accessible by measurement.** Contrast targets are checked by `npm test`,
  not judged by eye.
- **No borrowed defaults.** Every color Chromium takes from a theme is set
  from the palette.

## Palette

| Color | Name | Role in the browser |
| --- | --- | --- |
| `#1b2320` | Deep evergreen | Tab titles, bookmarks, address bar and New Tab page text |
| `#5d6864` | Evergreen gray | Background tab titles, toolbar icons, New Tab page section borders |
| `#2d6a3b` | Forest green | Links on the New Tab page |
| `#eef2ef` | Pale surface | Window frame and background tabs |
| `#f6f8f6` | Near-white surface | Active tab, toolbar, bookmarks bar, New Tab page |
| `#ffffff` | White | Address bar |

These are six of the fourteen colors of the VS Code theme, with the same
names. The others mark syntax, diagnostics, and diffs, which a browser frame
does not show.

## Theme colors

Chromium reads the following colors from a theme's `manifest.json`
(`kOverwritableColorTable` in `chrome/browser/themes/browser_theme_pack.cc`).
The theme sets all of them.

| Key | Color | Where it appears |
| --- | --- | --- |
| `frame` | `#eef2ef` | Window frame and tab strip |
| `frame_inactive` | `#eef2ef` | The same, while the window is in the background |
| `background_tab` | `#eef2ef` | Tabs that are not selected |
| `background_tab_inactive` | `#eef2ef` | The same, while the window is in the background |
| `tab_text` | `#1b2320` | Title of the selected tab |
| `tab_background_text` | `#5d6864` | Titles of the other tabs |
| `tab_background_text_inactive` | `#5d6864` | The same, while the window is in the background |
| `toolbar` | `#f6f8f6` | Selected tab, toolbar, bookmarks bar |
| `toolbar_text` | `#1b2320` | Text on the toolbar |
| `toolbar_button_icon` | `#5d6864` | Back, forward, reload, extensions, profile, and menu icons |
| `bookmark_text` | `#1b2320` | Bookmarks and folders on the bookmarks bar |
| `omnibox_background` | `#ffffff` | Address bar |
| `omnibox_text` | `#1b2320` | Text in the address bar |
| `ntp_background` | `#f6f8f6` | New Tab page |
| `ntp_text` | `#1b2320` | Text on the New Tab page |
| `ntp_link` | `#2d6a3b` | Links on the New Tab page |
| `ntp_header` | `#5d6864` | Section borders on the New Tab page, drawn at 31% opacity |
| `button_background` | `#eef2ef` at 0% opacity | Behind the window buttons on Windows: none, so they sit on the frame |

Choices worth knowing:

- **The frame keeps its color in background windows**, as the VS Code title
  bar does. Chromium shows that a window is in the background by drawing
  the active tab title 25% lighter.
- **The selected tab joins the toolbar.** Chromium paints the selected tab in
  the `toolbar` color, as VS Code joins the active tab to the editor.
- **The address bar is white**, like every input in the VS Code theme, on
  the near-white toolbar.
- **The Google logo is a single sage color.** With `ntp_logo_alternate` set
  to 1, Chromium draws the logo in a tint of the New Tab page background,
  `#a3b7a3` (2.00:1). Four bright brand colors would be the loudest thing on
  the page; logos need no minimum contrast under WCAG, and the search box
  below it says what it is.
- **No images and no tints.** Colors alone cover every part of the browser
  that a theme can reach, and they stay sharp at any scale.

### Colors Chromium derives

A theme does not set everything. Chromium derives these from the theme's
colors, so they stay in the same family:

- Shortcut tiles on the New Tab page: a slightly darker gray-green from
  `ntp_background`.
- The line under the bookmarks bar: a light gray-green, close to the border
  gray-green `#cfd6d2` of the VS Code theme.
- The title of the active tab in a background window: `tab_text` blended 75%
  into the tab, `#525856` (6.81:1).

### What a theme cannot change

- **Incognito and InPrivate windows.** Chromium gives them its dark incognito
  colors whatever theme is installed (`ThemeService::GetColorProviderKey`).
  The `*_incognito` keys are still parsed but have no effect, so the
  validator rejects them.
- **Menus, dialogs, bubbles, and side panels.** They follow the browser's
  light or dark mode, and their buttons and links, the filled bookmark star,
  and the **Customize Chrome** button use the browser's accent blue.
- **Web pages,** including their scroll bars and form controls.

## Accessibility targets

These are enforced by `npm test`:

- Text: 4.5:1 on its own background, for tab titles in active and background
  windows, bookmarks, toolbar text, the address bar, and New Tab page text
  and links.
- Toolbar icons: 3:1 (WCAG 1.4.11).
- Only `button_background` may be see-through, and then fully.

## Changing the theme

1. Edit `theme/manifest.json`. Colors are `[red, green, blue]` lists.
2. Use palette colors from `scripts/palette.mjs`. If a new color is needed,
   take it from the VS Code theme, add it there with its role, and add it to
   the tables in this document and the README.
3. Run `npm test`, then load the theme in the browser and look at it.
4. Update the screenshots in `store/` when the look changes.
5. Don't make the theme dark or high-contrast; those would be separate
   themes.
