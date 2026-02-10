export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
}

export function isPlausibleHandle(handle: string): boolean {
  return /^[a-z0-9._-]{2,30}$/.test(handle);
}

export function isEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}