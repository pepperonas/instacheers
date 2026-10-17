const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('package, extension, and changelog agree on the current stable SemVer release', () => {
  const { version } = readJSON('package.json');
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.equal(readJSON('manifest.json').version, version);
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  assert.ok(changelog.includes(`## ${version} — `));
  assert.equal(changelog.match(/^## ([\d.]+) /m)[1], version);
});

test('the npm version lifecycle synchronizes manifest metadata without changing other fields', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cheers-mate-version-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temp, 'scripts'));
  fs.copyFileSync(path.join(root, 'scripts/sync-version.cjs'), path.join(temp, 'scripts/sync-version.cjs'));
  const pkg = { ...readJSON('package.json'), version: '2.3.4' };
  fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify(pkg));
  const manifest = readJSON('manifest.json');
  fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(manifest));
  execFileSync(process.execPath, ['scripts/sync-version.cjs'], { cwd: temp });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temp, 'manifest.json'), 'utf8')), { ...manifest, version: '2.3.4' });
  execFileSync('npm', ['version', 'patch', '--no-git-tag-version'], { cwd: temp, stdio: 'pipe' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'package.json'), 'utf8')).version, '2.3.5');
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'manifest.json'), 'utf8')).version, '2.3.5');
  pkg.version = '2.3.6-beta.1';
  fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify(pkg));
  assert.throws(() => execFileSync(process.execPath, ['scripts/sync-version.cjs'], { cwd: temp, stdio: 'pipe' }), /stable major.minor.patch/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'manifest.json'), 'utf8')).version, '2.3.5');
});
