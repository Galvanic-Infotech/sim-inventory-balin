import {
  ITEM_STATUS_META,
  ItemStatus,
  ItemStatusMeta,
  itemStatusMeta,
  normalizeItemStatus,
} from '../../shared/models/item-status.model';

export function itemStatusI18nKey(status: string): string {
  const normalized = normalizeItemStatus(status);
  return `devices.status.${normalized}`;
}

export function translateItemStatusLabel(
  status: string,
  translate: (key: string) => string,
): string {
  const key = itemStatusI18nKey(status);
  const translated = translate(key);
  if (translated !== key) return translated;
  return itemStatusMeta(status).label;
}

export function translatedItemStatusMeta(
  status: string,
  translate: (key: string) => string,
): ItemStatusMeta {
  const meta = itemStatusMeta(status);
  return {
    ...meta,
    label: translateItemStatusLabel(status, translate),
  };
}

export function translatedItemStatusMetaMap(
  translate: (key: string) => string,
): Record<ItemStatus, ItemStatusMeta> {
  const result = {} as Record<ItemStatus, ItemStatusMeta>;
  for (const status of Object.keys(ITEM_STATUS_META) as ItemStatus[]) {
    result[status] = translatedItemStatusMeta(status, translate);
  }
  return result;
}
