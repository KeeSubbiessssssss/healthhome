import { createHash, randomBytes } from "node:crypto";
export class AccessError extends Error {}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function invitationEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new AccessError("Enter a valid email address.");
  return normalizeEmail(value);
}
export function isHouseholdOwner(user: { email: string; emailVerified?: boolean }) {
  return user.emailVerified === true && normalizeEmail(user.email) === normalizeEmail(process.env.HEALTHHOME_OWNER_EMAIL || "kee.sublime@gmail.com");
}
export function invitationToken() { return randomBytes(32).toString("base64url"); }
export function invitationHash(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new AccessError("This invitation link is invalid. Ask for a new one.");
  return createHash("sha256").update(value).digest("hex");
}
export function checkInvitation(invite: { email: string; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null }, user: { email: string; emailVerified?: boolean }, now = new Date()) {
  if (invite.revokedAt || invite.acceptedAt || invite.expiresAt <= now) throw new AccessError("This invitation has expired or is no longer available. Ask for a new link.");
  if (!user.emailVerified) throw new AccessError("Verify your email address before joining.");
  if (normalizeEmail(user.email) !== invite.email) throw new AccessError("Sign in with the email address this invitation was made for.");
}
