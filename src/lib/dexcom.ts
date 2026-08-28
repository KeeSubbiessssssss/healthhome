import { createCipheriv, randomBytes } from "node:crypto";

function required(name: "DEXCOM_OAUTH_AUTHORIZE_URL" | "DEXCOM_OAUTH_TOKEN_URL" | "DEXCOM_CLIENT_ID" | "DEXCOM_CLIENT_SECRET" | "DEXCOM_REDIRECT_URI" | "DEXCOM_TOKEN_ENCRYPTION_KEY") {
  const value = process.env[name];
  if (!value) throw new Error("Dexcom is not configured: missing " + name + ".");
  return value;
}

export function dexcomConfig() {
  return { authorizeUrl: required("DEXCOM_OAUTH_AUTHORIZE_URL"), tokenUrl: required("DEXCOM_OAUTH_TOKEN_URL"), clientId: required("DEXCOM_CLIENT_ID"), clientSecret: required("DEXCOM_CLIENT_SECRET"), redirectUri: required("DEXCOM_REDIRECT_URI") };
}

export function encryptDexcomToken(token: string) {
  const key = Buffer.from(required("DEXCOM_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("DEXCOM_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
