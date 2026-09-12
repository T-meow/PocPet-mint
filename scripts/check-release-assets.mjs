import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const { version, pocpetRelease } = JSON.parse(readFileSync('package.json', 'utf8'));
const directory = process.argv[2] || 'release';
const expected = [`pp-Mint${version}.exe`, `pp-Mint${version}.apk`];
if (version.endsWith('.0') || pocpetRelease?.fullBuildVersions?.includes(version) || process.env.FULL_BUILD === 'true') expected.push(
  `pp-Mint${version}-win32.exe`, `pp-Mint${version}-32bit.apk`, `pp-Mint${version}-web.zip`,
  `pp-Mint${version}-mac.dmg`, `pp-Mint${version}-ubuntu.AppImage`,
);
const actual = readdirSync(directory).sort();
if (actual.includes(`pp-Mint${version}-ubuntu.deb`)) expected.push(`pp-Mint${version}-ubuntu.deb`);
assert.deepEqual(actual, expected.sort(), 'Release artifacts must match the required platform set.');
for (const file of actual) assert.ok(statSync(join(directory, file)).size > 0, `Empty artifact: ${file}`);
console.log(`Verified ${actual.length} release artifacts for ${version}.`);
