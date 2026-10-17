const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
// Chrome release versions use three numeric components, without prerelease labels.
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  throw new Error('Use a stable major.minor.patch SemVer version for the extension.');
}
const manifestPath = path.join(projectRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
