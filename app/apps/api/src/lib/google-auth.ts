import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env";

export class GoogleAuthNotConfiguredError extends Error {}
export class InvalidGoogleTokenError extends Error {}

const client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  // Google hesabının profil fotoğrafı (varsa) - bkz. auth.service.ts
  // loginWithGoogle, ilk kayıtta profil fotoğrafı olarak kullanılır.
  picture: string | null;
}

// google-signin-button.tsx, Google Identity Services'ten aldığı ID token'ı
// (bir kod değişimi yapmadan) doğrudan buraya gönderir. Doğrulama Google'ın
// genel anahtarlarına karşı yapılır - aud (audience) GOOGLE_CLIENT_ID'ye eşit
// olmalı, aksi halde başka bir uygulama için üretilmiş bir token kabul
// edilebilirdi.
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!client) throw new GoogleAuthNotConfiguredError();

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new InvalidGoogleTokenError();
  }
  if (!payload?.sub || !payload.email) throw new InvalidGoogleTokenError();

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    fullName: payload.name ?? payload.email,
    picture: payload.picture ?? null,
  };
}
