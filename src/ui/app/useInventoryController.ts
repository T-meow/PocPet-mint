import { useRef, useState } from 'react';
import { shopCategories, type InventoryItemDefinition, type ShopCategory } from '../../core/pet';

export const useInventoryController = (items: readonly InventoryItemDefinition[]) => {
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('food');
  const hasOpenedRef = useRef(false);

  const prepareOpen = () => {
    if (hasOpenedRef.current) return;
    const firstNonEmpty = shopCategories.find((category) => items.some((item) => item.kind === category.id));
    if (firstNonEmpty) setActiveCategory(firstNonEmpty.id);
    hasOpenedRef.current = true;
  };

  return { activeCategory, setActiveCategory, prepareOpen };
};
