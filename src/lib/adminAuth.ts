import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.DASHBOARD_SECRET ?? "fallback-dev-secret-change-in-prod"
);

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function signAdminSession(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload?.admin === true;
  } catch {
    return false;
  }
}
