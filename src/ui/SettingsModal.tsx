import { CircleHelp, Download, FileText, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import type { ActivePetMod } from '../core/mod';
import { languages, list, t, type LanguageCode } from '../i18n';

interface SettingsModalProps {
  activeMod: ActivePetMod | null;
  modMessage: string;
  draftName: string;
  language: LanguageCode;
  saveText: string;
  importSaveText: string;
  onDraftNameChange: (value: string) => void;
  onLanguageChange: (value: LanguageCode) => void;
  onImportSaveTextChange: (value: string) => void;
  onClose: () => void;
  onRename: () => void;
  onReset: () => void;
  onClearMod: () => void;
  onExportSave: () => void;
  onDownloadSave: () => void;
  onImportPastedSave: () => void;
  onModFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportSaveFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const SettingsModal = ({
  activeMod,
  modMessage,
  draftName,
  language,
  saveText,
  importSaveText,
  onDraftNameChange,
  onLanguageChange,
  onImportSaveTextChange,
  onClose,
  onRename,
  onReset,
  onClearMod,
  onExportSave,
  onDownloadSave,
  onImportPastedSave,
  onModFileChange,
  onImportSaveFileChange,
}: SettingsModalProps) => {
  const modFileInputRef = useRef<HTMLInputElement>(null);
  const saveFileInputRef = useRef<HTMLInputElement>(null);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const helpSections = [
    { title: t('ui.settings.help.statsTitle'), items: list('ui.settings.help.stats') },
    { title: t('ui.settings.help.actionsTitle'), items: list('ui.settings.help.actions') },
    { title: t('ui.settings.help.otherTitle'), items: list('ui.settings.help.other') },
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <h2 id="settings-title">{t('ui.settings.title')}</h2>
          <div className="settings-header-actions">
            <button
              type="button"
              className="settings-help-button"
              aria-label={t('ui.settings.help.open')}
              title={t('ui.settings.help.open')}
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={20} aria-hidden="true" />
            </button>
            <button type="button" className="text-button" onClick={onClose}>
              {t('ui.settings.close')}
            </button>
          </div>
        </header>

        <p className="settings-free-notice">{t('ui.settings.freeNotice')}</p>

        <label className="field">
          <span>{t('ui.settings.petName')}</span>
          <input value={draftName} maxLength={16} onChange={(event) => onDraftNameChange(event.target.value)} />
        </label>

        <label className="field">
          <span>{t('ui.settings.language')}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}>
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
          <small>{t('ui.settings.languageHint')}</small>
        </label>

        <section className="settings-section" aria-label={t('ui.settings.mod.sectionAria')}>
          <div>
            <strong>{t('ui.settings.mod.title')}</strong>
            <span>{activeMod ? t('ui.settings.mod.current', { name: activeMod.manifest.name, version: activeMod.manifest.version }) : t('ui.settings.mod.currentDefault')}</span>
          </div>
          {modMessage && <p className="settings-message">{modMessage}</p>}
          <input ref={modFileInputRef} className="file-input" type="file" accept=".zip,application/zip" onChange={onModFileChange} />
          <div className="modal-actions">
            <button type="button" className="primary-button" onClick={() => modFileInputRef.current?.click()}>
              <Upload size={18} aria-hidden="true" />
              {t('ui.settings.mod.import')}
            </button>
            <button type="button" className="text-button settings-action" onClick={onClearMod}>
              {t('ui.settings.mod.restoreDefault')}
            </button>
          </div>
        </section>

        <section className="settings-section" aria-label={t('ui.settings.save.sectionAria')}>
          <div>
            <strong>{t('ui.settings.save.title')}</strong>
            <span>{t('ui.settings.save.summary')}</span>
          </div>
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

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onRename}>{t('ui.settings.saveName')}</button>
          <button type="button" className="danger-button" onClick={onReset}>
            <RotateCcw size={18} aria-hidden="true" />
            {t('ui.settings.resetSave')}
          </button>
        </div>
      </section>
      {isHelpOpen && (
        <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="settings-help-title">
          <header>
            <h2 id="settings-help-title">{t('ui.settings.help.title')}</h2>
            <button type="button" className="text-button" onClick={() => setHelpOpen(false)}>
              {t('ui.settings.help.close')}
            </button>
          </header>
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
        </section>
      )}
    </div>
  );
};

