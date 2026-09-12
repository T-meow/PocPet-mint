import { useEffect, useState, type MouseEvent } from 'react';
import { Bell, Check, Download, ExternalLink, Heart } from 'lucide-react';
import { t } from '../i18n';
import { appBuild, isNativeApp } from '../platform/edition';
import { originalPageUrl, recordEditionNoticeShown } from '../core/editionNotice';
import { DialogShell } from './DialogShell';

export const EditionNoticeDialog = ({ onAcknowledge, onBackup }: {
  onAcknowledge: () => void;
  onBackup?: () => void;
}) => {
  const [openFailed, setOpenFailed] = useState(false);
  useEffect(() => { recordEditionNoticeShown(); }, []);
  const openOriginalPage = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isNativeApp()) return;
    event.preventDefault();
    setOpenFailed(false);
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(originalPageUrl);
    } catch { setOpenFailed(true); }
  };
  const sections = [
    { key: 'merged', Icon: Heart, paragraphs: ['mergedAdvice', 'discontinuedAdvice'] },
    { key: 'migration', Icon: Download, paragraphs: ['migrationAdvice', 'modAdvice'] },
  ];
  return <DialogShell className="edition-notice" labelId="edition-notice-title" onClose={onAcknowledge}>
    <header className="edition-notice__header">
      <span className="dialog-title-icon"><Bell size={23} aria-hidden="true" /></span>
      <div><h2 id="edition-notice-title">{t('ui.editionNotice.title')}</h2><p>v{appBuild.version}</p></div>
    </header>
    <div className="edition-notice__body">
      {sections.map(({ key, Icon, paragraphs }) => <section className={`edition-notice__section edition-notice__section--${key}`} key={key}>
        <Icon size={19} aria-hidden="true" />
        <div><h3>{t(`ui.editionNotice.${key}Title`)}</h3>
          {paragraphs.map((paragraph) => <p key={paragraph}>{t(`ui.editionNotice.${paragraph}`)}</p>)}
        </div>
      </section>)}
      <p>{t('ui.editionNotice.dailyReminder')}</p>
      <a className="text-button edition-notice__update-link" href={originalPageUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => void openOriginalPage(event)}><ExternalLink size={16} />{t('ui.editionNotice.openOriginal')}</a>
      {openFailed && <p role="alert">{t('ui.editionNotice.openFailed')} <span>{originalPageUrl}</span></p>}
    </div>
    <footer className="edition-notice__footer save-actions">
      <button type="button" className="secondary-button save-action" onClick={onAcknowledge}><Check size={18} />{t('ui.editionNotice.acknowledge')}</button>
      {onBackup && <button type="button" className="primary-button save-action" onClick={onBackup}><Download size={18} />{t('ui.editionNotice.backup')}</button>}
    </footer>
  </DialogShell>;
};
