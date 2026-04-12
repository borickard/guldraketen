import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.DASHBOARD_SECRET ?? "fallback-dev-secret-change-in-prod"
);

export const COOKIE_NAME = "dashboard_session";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  userId: string;
  username: string;
  handles: string[];
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
