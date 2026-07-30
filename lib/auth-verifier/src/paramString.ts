/** Express 5 route params may be string | string[] — normalize to string. */
export function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
