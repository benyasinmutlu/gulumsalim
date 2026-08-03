"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// bkz. kullanıcı isteği: "google ile giriş yapma olayını da ekleyelim" -
// Google Identity Services'in resmi butonu, ID token'ı doğrudan (bir
// yönlendirme/authorization code değişimi olmadan) alır; token backend'e
// gönderilip doğrulanır (bkz. auth.service.ts verifyGoogleIdToken).
export default function GoogleSignInButton({
  mode,
  enabled = true,
  marketingConsent = false,
  analyticsConsent = false,
  onError,
}: {
  mode: "login" | "register";
  // Kayıt Ol sayfasında Üyelik Sözleşmesi/KVKK checkbox'ı işaretlenmeden
  // false - e-posta kaydındaki zorunluluğun aynısı, Google tek tıkla bu
  // onayı atlamaz (bkz. register-form.tsx).
  enabled?: boolean;
  marketingConsent?: boolean;
  analyticsConsent?: boolean;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !CLIENT_ID || !containerRef.current || !enabled) return;

    async function handleCredential(response: GoogleCredentialResponse) {
      try {
        const path = mode === "login" ? "/auth/google/login" : "/auth/google/register";
        const body =
          mode === "login"
            ? { idToken: response.credential }
            : { idToken: response.credential, membershipConsent: true, marketingConsent, analyticsConsent };
        await mutateJson<CustomerProfile>(path, "POST", body);
        window.location.href = "/";
      } catch (err) {
        if (err instanceof ClientApiError && err.code === "google_account_not_found") {
          onError("Bu Google hesabıyla eşleşen bir üyelik bulunamadı. Lütfen önce Kayıt Ol.");
          return;
        }
        onError(err instanceof ClientApiError ? err.message : "Google ile giriş başarısız oldu");
      }
    }

    window.google?.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
    containerRef.current.innerHTML = "";
    window.google?.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      width: 360,
      text: mode === "login" ? "signin_with" : "signup_with",
      locale: "tr",
    });
  }, [scriptLoaded, enabled, mode, marketingConsent, analyticsConsent, onError]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
      <div className="oauth-divider">
        <span>veya</span>
      </div>
      {enabled ? (
        <div ref={containerRef} className="google-signin-btn" />
      ) : (
        <>
          <div className="google-signin-placeholder">
            <i className="fab fa-google" /> Google ile Devam Et
          </div>
          <p className="oauth-hint">Devam etmek için yukarıdaki onayı işaretleyin</p>
        </>
      )}
    </>
  );
}
