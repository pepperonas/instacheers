const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Chrome icon references resolve to transparent PNGs with their declared dimensions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(manifest.icons['128'], 'The extension manager needs a large icon');
  assert.ok(manifest.action.default_icon['16'], 'The toolbar needs a small icon');
  for (const icons of [manifest.icons, manifest.action.default_icon]) {
    for (const [declared, file] of Object.entries(icons)) {
      const png = fs.readFileSync(path.join(root, file));
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file);
      assert.equal(png.toString('ascii', 12, 16), 'IHDR', file);
      assert.equal(png.readUInt32BE(16), Number(declared), file + ' width');
      assert.equal(png.readUInt32BE(20), Number(declared), file + ' height');
      assert.equal(png[25], 6, file + ' must retain RGBA transparency');
    }
  }
});
