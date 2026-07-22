import { PackageOpen, ShoppingBag, Sprout, X } from 'lucide-react';
import { shopCategories, type Inventory, type InventoryItemDefinition, type ItemId, type ShopCategory } from '../core/pet';
import { unknownItemIcon } from '../assets';
import { t } from '../i18n';
import { DialogShell } from './DialogShell';
import { getItemEffectBadges, getItemEffectTitle } from './itemEffectBadges';

interface InventoryModalProps {
  items: readonly InventoryItemDefinition[];
  inventory: Inventory;
  itemIconMap: Partial<Record<string, string>>;
  activeCategory: ShopCategory;
  isPetBusy: boolean;
  onCategoryChange: (category: ShopCategory) => void;
  onClose: () => void;
  onOpenShop: (category: ShopCategory) => void;
  onOpenGarden: () => void;
  onUseItem: (itemId: ItemId) => void;
}

export const InventoryModal = ({
  items,
  inventory,
  itemIconMap,
  activeCategory,
  isPetBusy,
  onCategoryChange,
  onClose,
  onOpenShop,
  onOpenGarden,
  onUseItem,
}: InventoryModalProps) => {
  const visibleItems = items.filter((item) => item.kind === activeCategory);

  return (
    <DialogShell
      className="inventory-modal"
      backdropClassName="inventory-backdrop"
      labelId="inventory-title"
      onClose={onClose}
    >
      <header className="dialog-header inventory-modal__header">
        <div className="dialog-title-group">
          <span className="dialog-title-icon" aria-hidden="true"><PackageOpen size={22} /></span>
          <div>
            <h2 id="inventory-title">{t('ui.inventory.modalTitle')}</h2>
            <p>{t('ui.inventory.ownedKinds', { count: items.length })}</p>
          </div>
        </div>
        <div className="dialog-header__actions">
          <button type="button" className="secondary-button" onClick={() => onOpenShop(activeCategory)}>
            <ShoppingBag size={17} aria-hidden="true" />
            {t('ui.inventory.shop')}
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('ui.inventory.close')} title={t('ui.inventory.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="inventory-tabs" role="tablist" aria-label={t('ui.inventory.tabsAria')}>
        {shopCategories.map((category) => {
          const count = items.filter((item) => item.kind === category.id).length;
          return (
            <button
              type="button"
              role="tab"
              key={category.id}
              aria-selected={activeCategory === category.id}
              className="inventory-tab"
              onClick={() => onCategoryChange(category.id)}
            >
              <span>{category.label}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>

      {visibleItems.length > 0 ? (
        <div className="inventory-modal__list">
          {visibleItems.map((item) => {
            const effectBadges = getItemEffectBadges(item.effect);
            const icon = itemIconMap[item.id] ?? item.imageUrl ?? unknownItemIcon;
            const isGardenItem = item.kind === 'garden';
            return (
              <article className="inventory-modal__item" key={item.id} title={getItemEffectTitle(item.displaySummary, item.effect)}>
                <span className="inventory-item__icon-wrap">
                  <img src={icon} alt="" aria-hidden="true" />
                  <strong className="inventory-item__count">x{inventory[item.id]}</strong>
                </span>
                <div className="inventory-item__copy">
                  <div className="inventory-item__title-row">
                    <strong className="inventory-item__name">{item.displayName}</strong>
                    {effectBadges.length > 0 && (
                      <span className="inventory-effect-badges" aria-label={effectBadges.map((badge) => badge.label).join(', ')}>
                        {effectBadges.map((badge) => <span className="inventory-effect-badge" key={badge.key}>{badge.label}</span>)}
                      </span>
                    )}
                  </div>
                  <small className="inventory-item__summary">{item.displaySummary}</small>
                </div>
                <button
                  type="button"
                  className={isGardenItem ? 'secondary-button inventory-modal__action' : 'primary-button inventory-modal__action'}
                  disabled={!isGardenItem && (isPetBusy || !item.usable)}
                  title={!isGardenItem && isPetBusy ? t('ui.inventory.partnerScheduleBusy') : undefined}
                  onClick={() => isGardenItem ? onOpenGarden() : onUseItem(item.id)}
                >
                  {isGardenItem && <Sprout size={17} aria-hidden="true" />}
                  {isGardenItem
                    ? t('ui.inventory.goGarden')
                    : isPetBusy
                      ? t('ui.inventory.partnerScheduleBusyShort')
                      : item.usable
                        ? t('ui.inventory.use')
                        : t('ui.inventory.unavailable')}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="inventory-modal__empty">
          <PackageOpen size={34} aria-hidden="true" />
          <p>{t('ui.inventory.emptyCategory')}</p>
          <button type="button" className="primary-button" onClick={() => onOpenShop(activeCategory)}>
            <ShoppingBag size={17} aria-hidden="true" />
            {t('ui.inventory.openCategoryShop')}
          </button>
        </div>
      )}
    </DialogShell>
  );
};
