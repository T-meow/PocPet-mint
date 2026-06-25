import { ShoppingBag } from 'lucide-react';
import type { ItemDisplay } from '../core/mod';
import type { Inventory, ItemId } from '../core/pet';
import { t } from '../i18n';

interface InventoryPanelProps {
  ownedItems: readonly ItemDisplay[];
  inventory: Inventory;
  itemIconMap: Record<ItemId, string>;
  onOpenShop: () => void;
  onUseItem: (itemId: ItemId) => void;
}

export const InventoryPanel = ({ ownedItems, inventory, itemIconMap, onOpenShop, onUseItem }: InventoryPanelProps) => (
  <section className="inventory-panel" aria-label={t('ui.inventory.aria')}>
    <header>
      <div>
        <span className="panel-kicker">{t('ui.inventory.kicker')}</span>
        <h2>{t('ui.inventory.title')}</h2>
      </div>
      <button type="button" className="text-button text-button--accent" onClick={onOpenShop}>
        <ShoppingBag size={17} aria-hidden="true" />
        {t('ui.inventory.shop')}
      </button>
    </header>

    {ownedItems.length > 0 ? (
      <div className="inventory-list">
        {ownedItems.map((item) => (
          <button type="button" key={item.id} className="inventory-item" onClick={() => onUseItem(item.id)} title={item.displaySummary}>
            <img src={itemIconMap[item.id]} alt="" aria-hidden="true" />
            <span>
              {item.displayName}
              <small>{item.displaySummary}</small>
            </span>
            <strong>x{inventory[item.id]}</strong>
          </button>
        ))}
      </div>
    ) : (
      <div className="empty-state">
        <span>{t('ui.inventory.empty')}</span>
      </div>
    )}
  </section>
);
