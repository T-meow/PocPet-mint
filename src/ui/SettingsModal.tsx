import { ArrowLeft, CircleHelp, Download, FileText, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { defaultPetBirthday, getPetBirthdayMaxDay, type PetBirthday } from '../core/pet';
import type { ActivePetMod, InstalledPetModSummary } from '../core/mod';
import { giftBoxIcon } from '../assets';
import { languages, list, t, type LanguageCode } from '../i18n';
import { DialogShell } from './DialogShell';

interface SettingsModalProps {
  activeMod: ActivePetMod | null;
  installedMods: readonly InstalledPetModSummary[];
  modMessage: string;
  draftName: string;
  draftBirthday?: PetBirthday;
  language: LanguageCode;
  saveText: string;
  importSaveText: string;
  hasOpenedHelp: boolean;
  hasClaimedHelpPageGift: boolean;
  onDraftNameChange: (value: string) => void;
  onDraftBirthdayChange: (value: PetBirthday) => void;
  onLanguageChange: (value: LanguageCode) => void;
  onImportSaveTextChange: (value: string) => void;
  onOpenHelp: () => void;
  onClaimHelpPageGift: () => void;
  onClose: () => void;
  onSaveProfile: () => void;
  onReset: () => void;
  onClearMod: () => void;
  onActivateMod: (modId: string) => void;
  onDeleteMod: (modId: string) => void;
  onExportSave: () => void;
  onDownloadSave: () => void;
  onImportPastedSave: () => void;
  onModFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportSaveFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

type SettingsPage = 'main' | 'mod' | 'save';

const birthdayMonths = Array.from({ length: 12 }, (_, index) => index + 1);
const authorUrl = 'https://space.bilibili.com/37393114';

export const SettingsModal = ({
  activeMod,
  installedMods,
  modMessage,
  draftName,
  draftBirthday,
  language,
  saveText,
  importSaveText,
  hasOpenedHelp,
  hasClaimedHelpPageGift,
  onDraftNameChange,
  onDraftBirthdayChange,
  onLanguageChange,
  onImportSaveTextChange,
  onOpenHelp,
  onClaimHelpPageGift,
  onClose,
  onSaveProfile,
  onReset,
  onClearMod,
  onActivateMod,
  onDeleteMod,
  onExportSave,
  onDownloadSave,
  onImportPastedSave,
  onModFileChange,
  onImportSaveFileChange,
}: SettingsModalProps) => {
  const modFileInputRef = useRef<HTMLInputElement>(null);
  const saveFileInputRef = useRef<HTMLInputElement>(null);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState<SettingsPage>('main');
  const helpSections = [
    { title: t('ui.settings.help.statsTitle'), items: list('ui.settings.help.stats') },
    { title: t('ui.settings.help.actionsTitle'), items: list('ui.settings.help.actions') },
    { title: t('ui.settings.help.otherTitle'), items: list('ui.settings.help.other') },
  ];
  const pageTitle = page === 'mod' ? t('ui.settings.mod.title') : page === 'save' ? t('ui.settings.save.title') : t('ui.settings.title');
  const activeModSummary = activeMod
    ? t('ui.settings.mod.current', { name: activeMod.manifest.name, version: activeMod.manifest.version })
    : t('ui.settings.mod.currentDefault');
  const birthdayMonth = draftBirthday?.month ?? defaultPetBirthday.month;
  const birthdayMaxDay = getPetBirthdayMaxDay(birthdayMonth);
  const birthdayDay = Math.min(draftBirthday?.day ?? defaultPetBirthday.day, birthdayMaxDay);
  const birthdayDays = Array.from({ length: birthdayMaxDay }, (_, index) => index + 1);

  const handleBirthdayMonthChange = (value: string) => {
    const month = Number(value);
    const maxDay = getPetBirthdayMaxDay(month);
    onDraftBirthdayChange({ month, day: Math.min(birthdayDay, maxDay) });
  };

  const handleBirthdayDayChange = (value: string) => {
    onDraftBirthdayChange({ month: birthdayMonth, day: Number(value) });
  };

  const handleOpenHelp = () => {
    onOpenHelp();
    setHelpOpen(true);
  };

  const handleAuthorLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    event.preventDefault();
    void openUrl(authorUrl);
  };

  return (
    <>
      <DialogShell className="settings-modal" labelId="settings-title" onClose={onClose} closeOnEscape={!isHelpOpen}>
        <header>
          <div className="settings-title-row">
            {page !== 'main' && (
              <button
                type="button"
                className="settings-back-button"
                aria-label={t('ui.settings.back')}
                title={t('ui.settings.back')}
                onClick={() => setPage('main')}
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
            )}
            <h2 id="settings-title">{pageTitle}</h2>
          </div>
          <div className="settings-header-actions">
            {page === 'main' && (
              <button
                type="button"
                className={hasOpenedHelp ? 'settings-help-button' : 'settings-help-button settings-help-button--unread'}
                aria-label={t('ui.settings.help.open')}
                title={t('ui.settings.help.open')}
                onClick={handleOpenHelp}
              >
                <CircleHelp size={20} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="text-button" onClick={onClose}>
              {t('ui.settings.close')}
            </button>
          </div>
        </header>

        <div className="settings-modal__body">
          {page === 'main' && (
            <>
              <p className="settings-free-notice">{t('ui.settings.freeNotice')}</p>

              <label className="field settings-inline-field settings-name-field">
                <span>{t('ui.settings.petName')}</span>
                <input value={draftName} maxLength={32} onChange={(event) => onDraftNameChange(event.target.value)} />
              </label>

              <div className="field settings-birthday-field">
                <div className="settings-birthday-heading">
                  <span>{t('ui.settings.petBirthday')}</span>
                  <small>
                    {draftBirthday ? t('ui.settings.birthdayValue', { month: birthdayMonth, day: birthdayDay }) : t('ui.settings.birthdayUnset')}
                  </small>
                </div>
                <div className="settings-birthday-grid">
                  <label>
                    <span className="settings-date-label">{t('ui.settings.birthdayMonth')}</span>
                    <select value={birthdayMonth} onChange={(event) => handleBirthdayMonthChange(event.target.value)}>
                      {birthdayMonths.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="settings-date-label">{t('ui.settings.birthdayDay')}</span>
                    <select value={birthdayDay} onChange={(event) => handleBirthdayDayChange(event.target.value)}>
                      {birthdayDays.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <label className="field settings-inline-field settings-language-field" title={t('ui.settings.languageHint')}>
                <span>{t('ui.settings.language')}</span>
                <select value={language} onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}>
                  {languages.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="settings-nav-card" onClick={() => setPage('mod')}>
                <span>
                  <strong>{t('ui.settings.mod.manage')}</strong>
                  <small>{activeModSummary}</small>
                </span>
              </button>

              <button type="button" className="settings-nav-card" onClick={() => setPage('save')}>
                <span>
                  <strong>{t('ui.settings.save.manage')}</strong>
                  <small>{t('ui.settings.save.summary')}</small>
                </span>
              </button>
            </>
          )}

          {page === 'mod' && (
            <section className="settings-section" aria-label={t('ui.settings.mod.sectionAria')}>
              <div>
                <strong>{t('ui.settings.mod.title')}</strong>
                <span>{activeModSummary}</span>
              </div>
              {modMessage && <p className="settings-message">{modMessage}</p>}
              <input ref={modFileInputRef} className="file-input" type="file" accept=".zip,application/zip" onChange={onModFileChange} />
              <div className="settings-mod-list" aria-label={t('ui.settings.mod.libraryAria')}>
                {installedMods.map((mod) => {
                  const isActive = activeMod?.manifest.id === mod.manifest.id;
                  return (
                    <div className="settings-mod-row" key={mod.manifest.id}>
                      {mod.contentImageUrl
                        ? <img src={mod.contentImageUrl} alt="" aria-hidden="true" />
                        : <span className="settings-mod-row__placeholder" aria-hidden="true" />}
                      <span>
                        <strong>{mod.manifest.name}</strong>
                        <small>{mod.manifest.defaultPetName} · v{mod.manifest.version}</small>
                      </span>
                      {isActive ? (
                        <span className="settings-mod-row__active"><Check size={15} aria-hidden="true" />{t('ui.settings.mod.currentShort')}</span>
                      ) : (
                        <button type="button" className="secondary-button" onClick={() => onActivateMod(mod.manifest.id)}>
                          {t('ui.settings.mod.activate')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => onDeleteMod(mod.manifest.id)}
                        aria-label={t('ui.settings.mod.delete', { name: mod.manifest.name })}
                        title={t('ui.settings.mod.delete', { name: mod.manifest.name })}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
                {installedMods.length === 0
                  ? <p className="settings-mod-list__empty">{t('ui.settings.mod.libraryEmpty')}</p>
                  : null}
              </div>
              <div className="modal-actions">
                <button type="button" className="primary-button" onClick={() => modFileInputRef.current?.click()}>
                  <Upload size={18} aria-hidden="true" />
                  {t('ui.settings.mod.import')}
                </button>
                <button type="button" className="text-button settings-action" onClick={onClearMod}>
                  {t('ui.settings.mod.useBuiltin')}
                </button>
              </div>
            </section>
          )}

          {page === 'save' && (
            <section className="settings-section" aria-label={t('ui.settings.save.sectionAria')}>
              <div>
                <strong>{t('ui.settings.save.title')}</strong>
                <span>{t('ui.settings.save.summary')}</span>
              </div>
              {modMessage && <p className="settings-message">{modMessage}</p>}
              <div className="modal-actions">
                <button type="button" className="primary-button" onClick={onExportSave}>
                  <FileText size={18} aria-hidden="true" />
                  {t('ui.settings.save.exportText')}
                </button>
                <button type="button" className="primary-button" onClick={onDownloadSave}>
                  <Download size={18} aria-hidden="true" />
                  {t('ui.settings.save.download')}
                </button>
                <button type="button" className="text-button settings-action" onClick={() => saveFileInputRef.current?.click()}>
                  {t('ui.settings.save.importFile')}
                </button>
              </div>
              <input ref={saveFileInputRef} className="file-input" type="file" accept=".pocpet,.json,.txt,application/json,text/plain" onChange={onImportSaveFileChange} />
              {saveText && <textarea className="save-textarea" readOnly value={saveText} aria-label={t('ui.settings.save.exportedAria')} />}
              <label className="field">
                <span>{t('ui.settings.save.pasteText')}</span>
                <textarea className="save-textarea" value={importSaveText} onChange={(event) => onImportSaveTextChange(event.target.value)} />
              </label>
              <button type="button" className="primary-button" disabled={!importSaveText.trim()} onClick={onImportPastedSave}>
                {t('ui.settings.save.importPasted')}
              </button>
            </section>
          )}
        </div>

        {page === 'main' && (
          <div className="modal-actions settings-modal__footer">
            <button type="button" className="primary-button" onClick={onSaveProfile}>{t('ui.settings.saveName')}</button>
            <button type="button" className="danger-button" onClick={onReset}>
              <RotateCcw size={18} aria-hidden="true" />
              {t('ui.settings.resetSave')}
            </button>
          </div>
        )}
      </DialogShell>
      {isHelpOpen && (
        <DialogShell className={hasClaimedHelpPageGift ? 'help-modal' : 'help-modal help-modal--gift'} labelId="settings-help-title" onClose={() => setHelpOpen(false)}>
          <header>
            <h2 id="settings-help-title">{t('ui.settings.help.title')}</h2>
            <button type="button" className="text-button" onClick={() => setHelpOpen(false)}>
              {t('ui.settings.help.close')}
            </button>
          </header>
          <p className="help-author-link">
            <a href={authorUrl} target="_blank" rel="noopener noreferrer" onClick={handleAuthorLinkClick}>
              {t('ui.settings.help.authorLink')}
            </a>
          </p>
          <div className="help-content">
            {helpSections.map((section) => (
              <section className="help-section" key={section.title}>
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {!hasClaimedHelpPageGift && (
            <button
              type="button"
              className="help-gift-button"
              aria-label={t('ui.rewards.claim')}
              title={t('ui.rewards.claim')}
              onClick={onClaimHelpPageGift}
            >
              <img src={giftBoxIcon} alt="" aria-hidden="true" />
            </button>
          )}
        </DialogShell>
      )}
    </>
  );
};
