import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function required(name: "DEXCOM_OAUTH_AUTHORIZE_URL" | "DEXCOM_OAUTH_TOKEN_URL" | "DEXCOM_CLIENT_ID" | "DEXCOM_CLIENT_SECRET" | "DEXCOM_REDIRECT_URI" | "DEXCOM_TOKEN_ENCRYPTION_KEY") {
  const value = process.env[name];
  if (!value) throw new Error("Dexcom is not configured: missing " + name + ".");
  return value;
}

export function dexcomConfig() {
  const authorizeUrl = required("DEXCOM_OAUTH_AUTHORIZE_URL");
  return { authorizeUrl, tokenUrl: required("DEXCOM_OAUTH_TOKEN_URL"), apiBaseUrl: new URL(authorizeUrl).origin, clientId: required("DEXCOM_CLIENT_ID"), clientSecret: required("DEXCOM_CLIENT_SECRET"), redirectUri: required("DEXCOM_REDIRECT_URI") };
}

function tokenKey() { const key = Buffer.from(required("DEXCOM_TOKEN_ENCRYPTION_KEY"), "base64"); if (key.length !== 32) throw new Error("DEXCOM_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key."); return key; }

export function encryptDexcomToken(token: string) {
  const key = tokenKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptDexcomToken(payload: string) {
  const input = Buffer.from(payload, "base64"); const decipher = createDecipheriv("aes-256-gcm", tokenKey(), input.subarray(0, 12)); decipher.setAuthTag(input.subarray(12, 28)); return Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]).toString("utf8");
}
