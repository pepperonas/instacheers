# Changelog

Versions follow Semantic Versioning (`major.minor.patch`).

## 1.4.0 — 2026-10-24

### Added

- Increase the keyword-search account limit from 50 to 100, including result collection and the persisted profile queue. The default remains 10; fewer matching results may be available.
- Show the allowed range directly in the account-count label and highlight/focus invalid values before starting search.
- Add an original camera/follow icon generated with the built-in Imagegen tool. Include transparent PNG exports at 16, 32, 48, and 128 px for the Chrome toolbar and extension manager, plus the popup header.

### Validation

- Add regressions for limits of 1, 50, and 100, result queues beyond 50 accounts, and invalid-input feedback. Run the Chrome search regression with a limit of 100.
- Verify that manifest icon references point to valid PNG files with their declared dimensions.
- Run `npm run check`, `npm run test:browser`, and `git diff --check`.
- The reported screenshot showed a 100-account value rejected by the former 1–50 validation, so search had not started. Live Instagram account discovery remains unverified.

## 1.3.2 — 2026-10-24

### Fixed

- Prefer the focused search input over a still-visible launcher or background search field. Activate and focus Instagram search fields instead of treating any existing input as an opened search. Support read-only launchers and notify controlled inputs with composed input and change events.
- Recognize account results inside Explore's main search surface or in an explicitly associated result portal, matching account text, accessible labels, or usernames.
- Reopen pending keyword searches after refresh with a fresh discovery timeout. Keep the edited keyword, account limit, and stopped status across refreshes without restarting stopped runs.
- Persist recognized native search-route changes and continue stopping for unrelated navigation.
- Route the page-follow button to keyword search when a term is entered. Do not reload an Explore post grid with no Follow buttons.
- Show distinct status messages for an unopened search versus an empty result list, and display the installed extension version in the overlay.

### Validation

- Add regression tests for launchers, portal/inline search results, refresh recovery, retained settings, route changes, and the empty Explore-page reload loop.
- Run the complete unit suite and syntax checks (`npm run check`), headless Chrome regressions (`npm run test:browser`), and `git diff --check`.
- Browser search regression uses a local fixture shaped around the reported Explore layout; live Instagram DOM inspection is unavailable because JavaScript through Apple Events is disabled. No live follow actions were performed.

## 1.3.1 — 2026-10-24

### Fixed

- Keep keyboard events from the overlay away from page-level shortcut handlers, including document capture listeners that see the shadow host instead of its text input.
- Keep editing, composition, clipboard, pointer, click, and focus events inside the overlay at its shadow boundary without preventing native control behavior.
- Preserve Escape-to-stop inside the overlay while leaving Instagram keyboard behavior outside the controls unchanged.

### Validation

- Reproduce focus loss while typing `camping` with an earlier document capture shortcut in a real headless Chrome fixture; the regression test fails on 1.3.0 and passes with the fix.
- Verify native typing, Backspace, inserted text, Tab/Shift+Tab, button activation, Escape, and page keyboard behavior outside the overlay in Chrome (`npm run test:browser`).
- Run the unit suite and syntax checks (`npm run check`) and `git diff --check`.
- No live Instagram account test; the browser fixture uses the actual content scripts with mocked extension storage.

## 1.3.0 — 2026-10-24

### Added

- A keyword search field and **Search and follow** action using Instagram's native search UI, with a configurable limit of 1–50 accounts (default: 10).
- Scoped discovery of visible, matching account links and a persisted profile queue that resumes across expected page navigations.
- Profile-header-only follow clicks, skipping already followed or requested accounts, preserving random click delays and stop/error controls.
- Search/profile timeouts, stop-on-query-change behavior, and persisted follow confirmation checked after profile reloads.
- Regression tests for discovery scope, native input events, profile queues, cancellation, resume timing, and existing following states.

### Validation

- Run JavaScript syntax checks, the complete unit test suite (`npm run check`), and `git diff --check`.
- The live browser inspection tool could not start. Native search and profile recognition are tested with a mocked DOM and have not been validated on a signed-in Instagram account.

## 1.2.3 — 2026-10-24

### Changed

- Rename the app from Cheers Mate to InstaCheers, including popup text, on-page controls, extension metadata, and the internal control API.
- Rename the GitHub repository and local project folder to `instacheers`, and update installation instructions and repository links.
- Preserve existing functionality and per-tab storage keys.

### Validation

- Add a regression test that opens the renamed on-page control API through the actual popup script.
- Run JavaScript syntax checks, the complete unit test suite (`npm run check`), and `git diff --check`.
- No live test with an Instagram account.

## 1.2.2 — 2026-10-17

### Fixed

- Continue active runs when the Instagram tab is hidden, including click attempts, scrolling, and automatic reloads. Switching tabs no longer pauses the extension.
- Keep the existing random delay, stop controls, and error checks in background tabs. Delayed callbacks perform at most one click and schedule the next delay from that click.

### Added

- Dependency-free unit tests with mocked DOM, Chrome APIs, and time for background execution, timing, stopping, reload recovery, and per-tab storage.
- A SemVer workflow that synchronizes the package and extension versions, contributor instructions requiring a version bump for every delivered change, and version consistency tests.
- Documentation for background execution, browser timer limits, testing, and version updates.

### Validation

- JavaScript syntax checks and the Node.js unit test suite (`npm run check`).
- No live test with an Instagram account.

## 1.2.1 — 2026-10-17

- Publish the project as Cheers Mate with an English interface and README.
- Preserve English and German Instagram button detection and existing per-tab resume behavior.
