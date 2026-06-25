import { Bath, Bed, BriefcaseBusiness, Gamepad2, Sparkles } from 'lucide-react';
import type { PetAction } from '../core/pet';
import { t } from '../i18n';

interface ActionDockProps {
  isSleeping: boolean;
  isLowEnergy: boolean;
  onAction: (action: PetAction) => void;
  onOpenShop: () => void;
}

export const ActionDock = ({
  isSleeping,
  isLowEnergy,
  onAction,
  onOpenShop,
}: ActionDockProps) => {
  const lowEnergyTitle = isLowEnergy ? t('ui.actionDock.lowEnergy') : undefined;
  return (
    <div className="action-dock" aria-label={t('ui.actionDock.dock')}>
      <button
        type="button"
        className="action-button action-button--play"
        disabled={isLowEnergy}
        title={lowEnergyTitle}
        onClick={() => onAction('play')}
      >
        <Gamepad2 size={20} aria-hidden="true" />
        <span>{t('ui.actionDock.play')}</span>
      </button>
      <button type="button" className="action-button action-button--clean" onClick={() => onAction('clean')}>
        <Bath size={20} aria-hidden="true" />
        <span>{t('ui.actionDock.clean')}</span>
      </button>
      <button
        type="button"
        className="action-button action-button--work"
        disabled={isLowEnergy}
        title={lowEnergyTitle}
        onClick={() => onAction('work')}
      >
        <BriefcaseBusiness size={20} aria-hidden="true" />
        <span>{t('ui.actionDock.work')}</span>
      </button>
      <button type="button" className="action-button action-button--sleep" onClick={() => onAction('sleep')}>
        <Bed size={20} aria-hidden="true" />
        <span>{isSleeping ? t('ui.actionDock.wake') : t('ui.actionDock.sleep')}</span>
      </button>
      <button type="button" className="action-button action-button--shop" onClick={onOpenShop}>
        <Sparkles size={20} aria-hidden="true" />
        <span>{t('ui.actionDock.shop')}</span>
      </button>
    </div>
  );
};