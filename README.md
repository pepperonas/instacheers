# Cheers Mate

A lightweight Chrome extension that clicks Instagram's **Follow** buttons with random delays and a beer-themed animation. Built with plain JavaScript and Chrome Manifest V3; no build step or external dependencies.

## Install or update

1. Download and extract this repository, or clone it:
   ```sh
   git clone https://github.com/pepperonas/cheers-mate.git
   ```
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and select the `cheers-mate` folder containing `manifest.json`.
4. Reload any open Instagram tabs.

To update an existing installation, replace the files or pull the latest changes, click the extension's reload button in `chrome://extensions`, then reload Instagram. When replacing the former **Folgen-Klicker** extension, remove that installation first.

## Usage

1. Open Instagram and navigate to account suggestions.
2. Click the **Cheers Mate** extension icon, then **Open controls**.
3. Leave **Scroll automatically** enabled if you want the page to scroll while looking for more accounts.
4. Click **Start**. The first click also waits for a random delay.
5. Click **Stop**, press **Escape**, or close the on-page controls to stop the run and automatic reloads.

The controls show a countdown and the total number of click attempts. A beer glass pulses with bubbles for two seconds, bursts into gold and white droplets, and displays **BOTTLED!** before fading out. Both the animation and counter represent click attempts, not confirmed follows.

## Behavior

- Matches buttons whose text is exactly **Follow** or **Folgen**. Other labels, including **Requested**, **Angefragt**, and **Gefolgt**, are skipped. The extension UI is in English; button recognition supports English and German Instagram pages.
- Chooses a new random delay of 5–15 whole seconds between click attempts. The next allowed click time survives page reloads.
- Tracks processed profile paths when available to avoid repeating the same account within a tab session.
- Scrolls automatically when enabled. After roughly eight seconds without a new matching button, it reloads the page and resumes. After three reloads without new clicks, it stops.
- Continues clicking, scrolling, and reloading when you switch to another tab. The extension does not pause based on tab visibility.
- Stops when the page URL changes, a dialog opens, or a supported visible Instagram error message is detected.
- After the full delay, checks the previous button if it is still attached to the page. If it still says **Follow** or **Folgen**, the run stops for review.
- Keeps the run state and counter across reloads of the same tab and URL. Closing the tab removes its state; restarting the browser does not restart a run.

Chrome can delay background timers, so actual click intervals may exceed 5–15 seconds. A late callback performs at most one click and starts a fresh delay; it never catches up with a burst of clicks. A frozen or discarded tab, a sleeping computer, or a closed browser cannot execute page scripts. See [Chrome’s background timer documentation](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/).

Instagram can change its interface or restrict actions. Delays do not remove an existing restriction. Error detection is limited, and neither successful follows nor uninterrupted operation are guaranteed.

## Privacy and permissions

The extension uses no external services, analytics, or additional network requests. Clicking a button still triggers Instagram's own behavior and requests.

Run state is stored in Chrome's session storage, keyed by tab ID. It includes the current URL, processed profile paths, click count, reload count, next click time, and scrolling preference. It is cleared when the tab closes or the browser restarts.

| Permission or scope | Purpose |
| --- | --- |
| `activeTab` | Access the active tab when you open the controls. |
| `scripting` | Inject the controls when requested through the popup. |
| `storage` | Preserve per-tab run state across page reloads. |
| Content scripts on `https://instagram.com/*` and `https://www.instagram.com/*` | Load on Instagram pages so an active run can resume after a reload. |

## Project structure

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension metadata, permissions, popup, and content-script configuration. |
| `background.js` | Service worker that reads and writes per-tab session state and cleans up closed tabs. |
| `content.js` | On-page controls, button detection, timing, scrolling, reloads, and animations. |
| `popup.html` | Extension popup layout and English interface text. |
| `popup.js` | Active-tab validation and control injection. |
| `test/` | Unit tests and a mocked page/timer harness. |
| `scripts/sync-version.cjs` | Synchronizes the extension version with `package.json`. |
| `CHANGELOG.md` | Release history. |
| `AGENTS.md` | Contributor rules, including mandatory version bumps. |

## Development and validation

Edit the files directly, reload the extension in `chrome://extensions`, and refresh Instagram. There is no dependency installation or compilation step.

With Node.js 18 or later and npm installed, run the syntax checks and unit tests:

```sh
npm run check
```

Run only the unit tests with `npm test`. No `npm install` is required. Tests execute the actual scripts with a mocked DOM, Chrome session storage, and deterministic timers. They cover visible and hidden tabs, tab switching, random-delay boundaries, delayed callbacks without click bursts, stop controls, error handling, duplicate detection, scrolling, reload recovery, per-tab storage, and version consistency. They do not click a real Instagram account.

To check the installed extension manually, reload it in `chrome://extensions` and refresh Instagram. Start a run, switch to another tab, wait, and return to inspect the attempt counter. Stop the run and confirm the counter stays unchanged. Background timing can be affected by Chrome's resource management.

## Versioning

The current release is recorded in `manifest.json` and `package.json`; both must match. See [CHANGELOG.md](CHANGELOG.md) for release history.

Every delivered change, including documentation or tests, requires one version increment for the complete change set:

- **Patch** (`1.2.1` → `1.2.2`): bug fixes, tests, or documentation.
- **Minor** (`1.2.2` → `1.3.0`): backward-compatible features.
- **Major** (`1.2.2` → `2.0.0`): breaking changes.

Before committing a change set, increment the version using:

```sh
npm version patch --no-git-tag-version
```

Use `minor` or `major` as appropriate. The npm version lifecycle automatically synchronizes `manifest.json`; the command does not create a Git commit or tag. Add a matching entry at the top of `CHANGELOG.md`, run `npm run check` and `git diff --check`, then commit the complete change set. Use stable `major.minor.patch` versions without prerelease labels for Chrome releases.

The extension has not been tested live with an Instagram account. Syntax checks and local mocked checks cannot verify Instagram's current interface or whether a follow succeeds.
