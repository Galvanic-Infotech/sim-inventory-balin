/** Maps API entity-type names to i18n keys under layout.entityTypes.* */
const ENTITY_TYPE_I18N_KEYS: Record<string, string> = {
  'system administrator': 'layout.entityTypes.systemAdministrator',
  oem: 'layout.entityTypes.oem',
  rfc: 'layout.entityTypes.rfc',
};

export function normalizeEntityTypeName(name: string): string {
  return name.trim().split('(')[0].trim();
}

export function translateEntityTypeName(
  name: string,
  translate: (key: string) => string,
): string {
  const base = normalizeEntityTypeName(name);
  if (!base) return '';
  const key = ENTITY_TYPE_I18N_KEYS[base.toLowerCase()];
  return key ? translate(key) : base;
}
