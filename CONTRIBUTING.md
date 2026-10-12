# Contributing to Verdant Ledger Light for Chrome and Edge

Thank you for helping. Bug reports, screenshots of parts of the browser that
look wrong, and pull requests are all welcome. Read [DESIGN.md](DESIGN.md)
first: it explains the palette, the role of each theme color, and the
contrast targets every change must meet.

## Requirements

- Google Chrome, Microsoft Edge, or Chromium, version 120 or later.
- Node.js 18 or later, for validation and packaging.

## Repository layout

| Path | Contents |
| --- | --- |
| `theme/` | The theme as the browser loads it: `manifest.json`, icons, and the name and description in each language (`_locales/`) |
| `scripts/` | Validator, packager, and the image and screenshot tools |
| `store/` | Store listing text, screenshots, promotional tiles, and the source of the tiles (`promo.html`) |
| `images/icon.svg` | Source of every icon |

## Preview your changes

1. Open `chrome://extensions` (in Edge, `edge://extensions`) and turn on
   **Developer mode**.
2. Select **Load unpacked** and choose the `theme` folder. The browser
   switches to the theme.
3. After editing `theme/manifest.json`, load the folder again.

Check the tab strip with several tabs, a window in the background, the
bookmarks bar (**Ctrl+Shift+B**, or **Cmd+Shift+B** on macOS), the address
bar while typing, and the New Tab page.

Chromium writes `Cached Theme.pak` into the `theme` folder when it loads it.
Git ignores the file and the packager leaves it out.

## Validate

```bash
npm test
```

The validator has no dependencies. It checks that:

- the manifest and translations are valid JSON without duplicate keys;
- the manifest is Manifest V3 and holds nothing a theme can't contain, such
  as scripts or permissions;
- the name and description are translated in every language and fit the
  stores' limits (75 and 132 characters);
- every icon exists and has its declared size;
- every theme key is one Chromium reads, every one is set, and none of the
  incognito keys, which have no effect, is used;
- every color comes from `scripts/palette.mjs`, and every palette color is
  used;
- text and icons meet the contrast targets in DESIGN.md;
- every palette color and theme key is documented, and CHANGELOG.md has a
  section for the version in the manifest.

GitHub Actions runs the same check and packages the theme for every pull
request and every push to `main`. The ZIP is attached to the workflow run.

## Images

```bash
CHROME=/path/to/chrome npm run images
```

renders the icons in `theme/icons/`, the Edge Add-ons logo, and the
promotional tiles in `store/` with headless Chrome. Run it after changing
`images/icon.svg` or `store/promo.html`.

```bash
CHROME=/path/to/chromium npm run screenshots
```

takes the four store screenshots with the theme loaded in a real browser
window. It needs Linux with Xvfb, ImageMagick, and Chromium; branded Google
Chrome ignores the `--load-extension` switch it uses. Set `SITE` to show
another page. To take them before the website is public, serve a local copy
and pass `HOST_RULES` and `CA_CERT`; see the comment at the top of the
script.

## Package

```bash
npm run package
```

validates the theme and writes `dist/verdant-ledger-light-<version>.zip`, the
file both stores accept. The archive is reproducible: the same files give
the same ZIP.

## Release

Maintainers release by pushing a version tag:

1. Update `version` in `theme/manifest.json` and add a section for it at the
   top of `CHANGELOG.md`, for example `## 1.0.1 - 2026-11-02`.
2. Commit, then tag and push:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

The **Release** workflow validates the theme, checks that the tag matches
the manifest, packages it, creates a GitHub release with the ZIP and the
changelog section, and submits the ZIP to the Chrome Web Store when its API
credentials are set. Both stores review every version before it goes live.

## Publish for the first time

The first submission to each store is made by hand, in the browser. Texts
to paste are in [store/listing.md](store/listing.md); images are in
`store/`.

### Chrome Web Store

This listing serves Chrome, Edge (through **Allow extensions from other
stores**), and Brave.

1. Register at the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   with a Google Account that has 2-Step Verification. Registration has a
   one-time fee of US$5.
2. Select **New item** and upload `verdant-ledger-light-<version>.zip` from
   the GitHub release.
3. **Store listing:** paste the description, choose the category
   **Minimalist**, set the language to English, and upload
   `store/screenshot-1.png` to `screenshot-4.png`, `store/promo-small.png`
   (small promo tile), and `store/promo-marquee.png` (marquee). Add the
   Bulgarian description under the Bulgarian language.
4. **Privacy:** paste the single purpose, declare that the theme uses no
   remote code and collects no data, and link to `PRIVACY.md`.
5. **Distribution:** public, all regions, free.
6. Select **Submit for review**.

To let the Release workflow upload later versions:

1. In the [Google Cloud console](https://console.cloud.google.com/), create
   a project, enable the **Chrome Web Store API**, configure the OAuth
   consent screen, and create an OAuth client of type **Desktop app**.
2. Get a refresh token for the scope
   `https://www.googleapis.com/auth/chromewebstore`, for example with the
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
   and your own client ID and secret.
3. In the GitHub repository, open **Settings** > **Secrets and variables** >
   **Actions** and add:
   - secrets `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, and `CWS_REFRESH_TOKEN`;
   - variables `CWS_PUBLISHER_ID` (from the dashboard's **Account** page)
     and `CWS_ITEM_ID` (the 32-letter ID of the item).

See [Use the Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
for details.

### Microsoft Edge Add-ons

Edge users can already install the theme from the Chrome Web Store. A
listing in [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons)
makes it easier to find there, but Microsoft has accepted themes from
outside developers only in limited cases, so Partner Center may decline it.
To try:

1. Register as an Edge developer in
   [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd)
   (no fee).
2. Select **Create new extension** and upload the same ZIP.
3. **Properties:** choose the closest category the form offers, and set the
   website to `https://github.com/nelvaron/chromium-verdant-ledger`.
4. **Privacy:** paste the single purpose, declare no remote code and no
   data collection, and link to `PRIVACY.md`.
5. **Store listings:** for English and Bulgarian, paste the description
   (Partner Center requires at least 250 characters), and upload
   `store/logo-300.png`, the promotional tiles, and the screenshots.
6. Select **Publish**. Certification can take up to seven business days.

### Before either submission

Both stores ask for a privacy policy URL. Link to `PRIVACY.md` on GitHub,
which works once the repository is public, or host the policy elsewhere.
