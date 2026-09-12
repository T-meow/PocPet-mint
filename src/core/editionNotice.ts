export const editionNoticeKey = 'pocpet-mint.merge-notice.v1';
export const originalPageUrl = 'https://t-meow.github.io/PocPet/';
export const localDateKey = (now = Date.now()) => {
  const date = new Date(now);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
export interface EditionNotice { lastShownDate: string }
let sessionNotice: EditionNotice = { lastShownDate: '' };
export const readEditionNotice = (now = Date.now()): EditionNotice => {
  if (sessionNotice.lastShownDate === localDateKey(now)) return sessionNotice;
  try {
    const value = JSON.parse(localStorage.getItem(editionNoticeKey) || 'null');
    if (value && typeof value.lastShownDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.lastShownDate)) return value;
  } catch { /* A disabled store must not block the game. */ }
  return sessionNotice;
};
export const shouldShowEditionNotice = (notice: EditionNotice, now = Date.now()) =>
  notice.lastShownDate !== localDateKey(now);
export const recordEditionNoticeShown = (now = Date.now()) => {
  const current = readEditionNotice(now);
  if (!shouldShowEditionNotice(current, now)) return;
  sessionNotice = { lastShownDate: localDateKey(now) };
  try { localStorage.setItem(editionNoticeKey, JSON.stringify(sessionNotice)); } catch { /* Session fallback. */ }
};
