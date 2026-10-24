# InstaCheers

<img src="icons/icon128.png" alt="InstaCheers camera and follow icon" width="64" height="64">

A lightweight Chrome extension that finds Instagram accounts by keyword and clicks **Follow** with random delays and a beer-themed animation. Built with plain JavaScript and Chrome Manifest V3; no build step or external dependencies.

## Install or update

1. Download and extract this repository, or clone it:
   ```sh
   git clone https://github.com/pepperonas/instacheers.git
   ```
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and select the `instacheers` folder containing `manifest.json`.
4. Reload any open Instagram tabs. The overlay shows the installed version next to **InstaCheers**.

To update an existing installation, replace the files or pull the latest changes, click the extension's reload button in `chrome://extensions`, then reload Instagram. If you installed an earlier version as **Cheers Mate** from a `cheers-mate` folder, remove the old unpacked extension and load the renamed `instacheers` folder, then refresh Instagram. The same applies to the former **Folgen-Klicker** extension.

## Usage

### Search for accounts and follow them

1. Open Instagram in Chrome and sign in.
2. Click the **InstaCheers** extension icon, then **Open controls**.
3. Enter a term such as `camping` in **Find accounts**. A leading `#` is removed automatically: `#vanlife` becomes the account query `vanlife`, which is also shown in the overlay. This searches account names and result labels, rather than opening hashtag pages or collecting authors from hashtag posts.
4. Set **Maximum accounts** (default: 10, range: 1–100).
5. Click **Search and follow**. InstaCheers activates Instagram's search field (including read-only search launchers), focuses its editable input, enters the term, and waits for matching account links. The status distinguishes waiting for the search field from collecting results.
6. The extension visits the collected profiles in the same tab and clicks the profile header's **Follow** button when available. Accounts already marked **Following** or **Requested** are skipped without clicking their relationship controls. After a batch is processed, the extension returns to the saved search for more unprocessed accounts. It stops when the account limit is reached or no new results remain.
7. Click **Stop**, press **Escape** while the Instagram tab has focus, or close the controls to cancel.

Search collects batches of visible account links in Instagram's search panel whose text, accessible label, or profile username contains your keyword, ignoring case. It does not infer a profile's interests, search post captions or hashtags, or crawl every result. The account limit caps profiles visited, including accounts skipped because you already follow them; fewer results may be available. The supported range is shown next to the field. Invalid values are highlighted and focused before any search starts. Only the profile header is used for follow clicks, excluding suggested accounts elsewhere on a profile. Relationship detection accepts English/German labels with dropdown text or accessible labels, including disabled status controls. The overlay reports profiles checked and accounts skipped.

If a search batch contains only processed accounts, InstaCheers tries the **Non-personalized / Nicht personalisiert** tab once when available. With **Scroll automatically** enabled, it also scrolls the result container to look for new profiles, stopping after three unsuccessful scroll attempts per search pass. Processed profile paths are remembered across stopped-run refreshes in the same tab session. Exhausted known results are reported as **No new accounts remain**, rather than **No matching accounts**.

The search term and account limit are saved while you edit them and remain visible after refreshing, together with the last stopped status. A stopped run never restarts just because you refresh. Active searches reopen and re-enter the term with a fresh discovery timeout after refresh. The queued profile paths, expected destination, and click deadline are saved before each profile navigation, allowing the run to continue when the page loads. Unexpected navigation stops the run. If no matching search results or profile controls can be identified within 20 seconds, the run stops with a message. Changing the search term directly on Instagram also stops discovery. The existing error and dialog checks remain active when following profiles.

Search panel and profile-header recognition currently target English and German labels. Instagram layout variants may not be recognized; if search is not found, open **Search** on Instagram and try again. This workflow is covered by local tests but has not been validated against a signed-in Instagram account.

### Follow suggestions on the current page

1. Open Instagram and navigate to account suggestions.
2. Click the **InstaCheers** extension icon, then **Open controls**.
3. Leave **Scroll automatically** enabled if you want the page to scroll while looking for more accounts.
4. Leave **Find accounts** empty and click **Follow this page**. The first click also waits for a random delay. With a keyword entered, this button starts keyword search instead. On an Explore post grid without Follow buttons, the extension asks for a search term instead of repeatedly reloading.
5. Click **Stop**, press **Escape**, or close the on-page controls to stop the run and automatic reloads.

Typing and editing inside the overlay are isolated from Instagram's page shortcuts, so the keyword field keeps focus while you type. Native text editing, paste, Tab navigation, and button activation remain enabled. Escape also stops a run when focus is inside the overlay.

The controls show a countdown and the total number of click attempts. A beer glass pulses with bubbles for two seconds, bursts into gold and white droplets, and displays **BOTTLED!** before fading out. Both the animation and counter represent click attempts, not confirmed follows.

## Behavior

- Matches buttons whose text is exactly **Follow** or **Folgen**. Other labels, including **Requested**, **Angefragt**, and **Gefolgt**, are skipped. The extension UI is in English; button recognition supports English and German Instagram pages.
- Chooses a new random delay of 5–15 whole seconds between click attempts. The next allowed click time survives page reloads.
- Tracks processed profile paths when available to avoid repeating the same account within a tab session.
- Scrolls automatically when enabled. After roughly eight seconds without a new matching button, it reloads the page and resumes. After three reloads without new clicks, it stops.
- Continues clicking, scrolling, and reloading when you switch to another tab. The extension does not pause based on tab visibility.
- Stops on unexpected URL changes, dialogs during following, or supported visible Instagram error messages. Search mode permits its own search panel and saves each expected profile navigation before opening it.
- After the full delay in keyword mode, reads the current profile relationship controls again. A **Following/Gefolgt** or **Requested/Angefragt** state takes precedence over Follow buttons in suggestion cards; an old clicked node retained by a page rerender cannot override that state. Identifiable controls belonging to other profiles are excluded. If the target still shows **Follow/Folgen**, the run stops for review. Current-page suggestion mode retains its previous-button check.
- Keeps the run state and counter across reloads of the same tab and URL. Closing the tab removes its state; restarting the browser does not restart a run.

Chrome can delay background timers, so actual click intervals may exceed 5–15 seconds. A late callback performs at most one click and starts a fresh delay; it never catches up with a burst of clicks. A frozen or discarded tab, a sleeping computer, or a closed browser cannot execute page scripts. See [Chrome’s background timer documentation](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/).

Instagram can change its interface or restrict actions. Delays do not remove an existing restriction. Error detection is limited, and neither successful follows nor uninterrupted operation are guaranteed.

## Privacy and permissions

The extension uses no external services or analytics and makes no private API calls. Search input, profile navigation, and follow clicks use Instagram's normal interface and trigger Instagram's own network requests.

Run state is stored in Chrome's session storage, keyed by tab ID. It includes the current URL, processed profile paths, click count, reload count, next click time, and scrolling preference. During a keyword run it also includes the search term, account limit, remaining profile queue, saved search URL, current target, checked/skipped counts, and follow-confirmation state. The keyword, account limit, and last status are also retained for stopped runs within the tab session. It is cleared when the tab closes or the browser restarts.

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
| `content.js` | On-page controls, discovery workflow, button detection, timing, scrolling, reloads, and animations. |
| `discovery.js` | Native Instagram search input and scoped account-link discovery. |
| `popup.html` | Extension popup layout and English interface text. |
| `icons/` | Generated camera/follow artwork and Chrome icons in 16, 32, 48, and 128 px sizes; generation prompt in `icons/README.md`. |
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

Run only the unit tests with `npm test`. No `npm install` is required. Tests execute the actual scripts with a mocked DOM, Chrome session storage, and deterministic timers. They cover visible and hidden tabs, tab switching, random-delay boundaries, delayed callbacks without click bursts, stop controls, error handling, duplicate detection, scrolling, reload recovery, per-tab storage, version consistency, keyword matching, queued profile navigation, following-state skips, and search cancellation. They do not click a real Instagram account.

An additional browser regression test uses a separate, temporary headless Chrome profile and a local fixture with simulated page shortcuts. It types `camping` with real keyboard events and checks focus, editing, Tab navigation, button clicks, and Escape. The search browser test also activates an Explore search launcher, distinguishes it from the focused search input, fills the native search input, recognizes a separate result portal, and navigates to a saved profile path. A multi-page browser regression verifies that an already-followed profile is skipped and a subsequent new profile is followed in the local fixture. No Instagram login or network access to Instagram is involved. Chrome is detected at its default macOS application path; on other systems, set `CHROME_PATH` to your Chrome/Chromium executable:

```sh
npm run test:browser
# If needed:
CHROME_PATH=/usr/bin/google-chrome npm run test:browser
```

To check the installed extension manually, reload it in `chrome://extensions` and refresh Instagram. Start a run, switch to another tab, wait, and return to inspect the attempt counter. Stop the run and confirm the counter stays unchanged. Then enter `camping`, set a small account limit, and start **Search and follow**. Check that the native search receives the term, each visited profile matches a collected result, the queue resumes after navigation, and Stop prevents further navigation. Background timing can be affected by Chrome's resource management.

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
