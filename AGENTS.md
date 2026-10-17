# Project instructions

- Keep source text, user interface text, and documentation in English. Preserve supported Instagram labels in other languages for detection.
- Every delivered change, including documentation and tests, must increment the stable SemVer version. Use one bump for the complete change set: patch for fixes, tests, or documentation; minor for backward-compatible features; major for breaking changes.
- Run `npm version patch --no-git-tag-version` (or `minor` / `major`) to update `package.json` and synchronize `manifest.json` through the version lifecycle script. Do not bump again if the current change set already includes its version increment.
- Add a matching entry to `CHANGELOG.md` describing the changes and validation.
- Run `npm run check` and `git diff --check` before committing. Add meaningful regression tests for behavior changes.
- No build step or runtime dependencies are needed. Tests use Node.js built-in modules.
