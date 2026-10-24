# Changelog

Versions follow Semantic Versioning (`major.minor.patch`).

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
