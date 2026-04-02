/** Fixed palette for known teammates; otherwise DB color or neutral gray. */
const BY_NORMALIZED_NAME: Record<string, string> = {
  'ethan wood': '#1e3a5f',
  'luke carr': '#0d9488',
  'paris ward': '#6d28d9',
};

/** Prefer DB/admin color when set; otherwise known names; then neutral. */
export function resolveMemberColor(displayName: string, fallback?: string): string {
  const fromDb = fallback?.trim();
  if (fromDb) return fromDb;
  const key = displayName.trim().toLowerCase();
  if (BY_NORMALIZED_NAME[key]) return BY_NORMALIZED_NAME[key];
  return '#94a3b8';
}
