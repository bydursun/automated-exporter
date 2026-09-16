# Automated Exporter (Demo)

A small Chrome extension that demonstrates a pattern I built for a real
internal tool: **walk every page of a paginated web app and export each
page as a PDF, fully automatically.**

This repo is a sanitized, fictional demo — it targets a mock "Records
Portal" page included here (`demo-site/`), not any real product or real
data. It exists to show the technique without exposing any vendor,
company, or real personal data.

> The real version of this tool works against a genuine EHR platform and
> handles real client records. It's kept private for privacy/compliance
> reasons and isn't published anywhere. This repo is the public,
> data-safe write-up of how it works.

## Live demo

Try the mock page here: **https://bydursun.github.io/automated-exporter/demo-site/**

Load the extension (see below), open that page, click the extension icon,
and hit **Start Export** — it'll walk all 5 pages and save 5 PDFs.

## How it works

1. **Detection** — when you open the popup, it runs a small script in the
   page to read how many pages exist and who/what the current record
   belongs to (`popup.js: detectPage`).
2. **Pagination walk** — the export script is injected into the page's
   own JS context (`world: "MAIN"` in `chrome.scripting.executeScript`),
   so it can call the page's own navigation function directly instead of
   simulating clicks.
3. **Per-page capture** — each page triggers the site's own "print" flow,
   which opens a dedicated print window. The extension grabs that
   window's rendered content with `html2canvas`.
4. **PDF assembly** — `jspdf` slices the captured canvas into A4-sized
   pages and saves one PDF per page (`<Subject> - <date> - Page NN.pdf`).
5. **Progress relay** — because the export script runs in the page's
   *main* world (no `chrome.*` APIs available there), it can't message
   the popup directly. `bridge.js` runs in the extension's isolated
   content-script world on the same page and relays `postMessage` events
   from the main-world script up to the popup via
   `chrome.runtime.sendMessage` (`popup.js` listens for those to drive
   the progress bar).

## Load the extension locally

1. Clone this repo.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked**, select the `extension/` folder.
4. Open the live demo link above (or `demo-site/index.html` served over
   `http(s)://`, not `file://` — the manifest's `host_permissions` is
   scoped to the GitHub Pages domain).
5. Click the extension icon, then **Start Export**.

## Notes on the real version

The production version of this tool is intentionally **not** published.
It's scoped to a specific internal system, handles real client records,
and depends on that system's undocumented internal DOM/JS — publishing
it would mean shipping a working bulk-export tool against real personal
data with no control over who installs it. This demo exists so the
underlying engineering (pagination-walking, DOM automation, PDF
generation, extension architecture) can be shown safely instead.

## Files

- `demo-site/index.html` — fictional multi-page "Records Portal" the
  extension targets
- `extension/manifest.json` — extension config, scoped to the demo domain
- `extension/popup.html` / `popup.js` — UI + export/detection logic
- `extension/bridge.js` — relays progress from the page to the popup
- `extension/lib/` — bundled `html2canvas` and `jspdf` (no CDN fetch at
  runtime)
