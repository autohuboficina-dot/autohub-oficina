export function createSecureId(prefix?: string) {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}-${id}` : id;
}
