import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { editionNoticeKey, localDateKey, originalPageUrl, readEditionNotice, recordEditionNoticeShown, shouldShowEditionNotice } from '../src/core/editionNotice';
import { supportsClientUpdates } from '../src/platform/clientUpdates';
import { setLanguage } from '../src/i18n';
import { EditionNoticeDialog } from '../src/ui/EditionNoticeDialog';

const values = new Map<string, string>();
let readBlocked = false;
let writeBlocked = false;
let writes = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => {
    if (readBlocked) throw new Error('Storage disabled');
    return values.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (writeBlocked) throw new Error('Quota exceeded');
    values.set(key, value);
    writes++;
  },
} });

const beforeMidnight = new Date(2026, 8, 12, 23, 59, 59).getTime();
const afterMidnight = new Date(2026, 8, 13, 0, 0, 1).getTime();
assert.equal(localDateKey(beforeMidnight), '2026-09-12');
assert.equal(localDateKey(afterMidnight), '2026-09-13');
assert.equal(shouldShowEditionNotice(readEditionNotice(beforeMidnight), beforeMidnight), true);
values.set('pocpet.edition-notice.1.8.0', JSON.stringify({ count: 3, lastLaunch: 'old' }));
assert.equal(shouldShowEditionNotice(readEditionNotice(beforeMidnight), beforeMidnight), true, 'original-edition and old launch limits must not hide the notice');
recordEditionNoticeShown(beforeMidnight);
recordEditionNoticeShown(beforeMidnight);
assert.equal(writes, 1, 're-rendering on the same day does not record another notice');
assert.equal(shouldShowEditionNotice(JSON.parse(values.get(editionNoticeKey)!), beforeMidnight), false, 'persisted state suppresses a second launch that day');
assert.equal(shouldShowEditionNotice(readEditionNotice(afterMidnight), afterMidnight), true, 'local midnight starts a new notice day');

// A full store may still return yesterday's value. The session fallback must win today.
writeBlocked = true;
recordEditionNoticeShown(afterMidnight);
assert.equal(shouldShowEditionNotice(readEditionNotice(afterMidnight), afterMidnight), false);
assert.equal(JSON.parse(values.get(editionNoticeKey)!).lastShownDate, '2026-09-12');
readBlocked = true;
const disabledDay = new Date(2026, 8, 14, 12).getTime();
assert.equal(shouldShowEditionNotice(readEditionNotice(disabledDay), disabledDay), true);
recordEditionNoticeShown(disabledDay);
assert.equal(shouldShowEditionNotice(readEditionNotice(disabledDay), disabledDay), false, 'disabled storage still allows one reminder per session day');
readBlocked = false;
writeBlocked = false;
values.set(editionNoticeKey, '{broken');
const nextDay = new Date(2026, 8, 15, 12).getTime();
assert.equal(shouldShowEditionNotice(readEditionNotice(nextDay), nextDay), true, 'corrupt state must not block the game or notice');
for (let day = 15; day <= 25; day++) {
  const now = new Date(2026, 8, day, 12).getTime();
  assert.equal(shouldShowEditionNotice(readEditionNotice(now), now), true, 'not capped at three launches or days');
  recordEditionNoticeShown(now);
  assert.equal(shouldShowEditionNotice(readEditionNotice(now), now), false);
}
assert.equal(shouldShowEditionNotice({ lastShownDate: '2099-01-01' }, nextDay), true, 'a future stored date must not suppress the reminder indefinitely');
assert.equal(originalPageUrl, 'https://t-meow.github.io/PocPet/');
Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {}, localStorage } });
assert.equal(supportsClientUpdates(), false, 'Mint must not advertise original-edition installers as in-place updates');
for (const language of ['zh-CN', 'en-US'] as const) {
  setLanguage(language);
  const html = renderToStaticMarkup(createElement(EditionNoticeDialog, { onAcknowledge() {}, onBackup() {} }));
  assert.ok(html.includes(`href="${originalPageUrl}"`));
  assert.ok(html.includes('target="_blank"'));
  assert.match(html, language === 'zh-CN' ? /此后不再更新/ : /final update/);
  assert.match(html, language === 'zh-CN' ? /今天知道了/ : /Got it for today/);
  assert.ok(!html.includes('ui.editionNotice.'), 'both languages have complete notice copy');
}
console.log('Daily Mint notice checks passed: midnight, restarts, repeated days, storage failures, both languages and migration link.');
