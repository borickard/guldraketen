export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
}

export function isPlausibleHandle(handle: string): boolean {
  return /^[a-z0-9._-]{2,30}$/.test(handle);
}

export function isWorkEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;

  const blocked = [
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "yahoo.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
  ];

  const domain = e.split("@")[1] || "";
  return Boolean(domain) && !blocked.includes(domain);
}