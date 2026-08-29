"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import { hardNavigateInternal } from "@/lib/navigation";
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

// bkz. kullanıcı isteği: "google ile giriş yap a tıklayınca direkt kayıt
// yapılsın eksik bilgileri giriş yapınca tamamlatalım müşteri kaydı
// kısmında google ile giriş yap olmasın" - tek buton, sadece giriş
// sayfasında (bkz. login-form.tsx). /auth/google/login hem mevcut hesapla
// giriş yapar hem de hesap yoksa anında açar (bkz. auth.service.ts
// loginWithGoogle); Üyelik Sözleşmesi/KVKK onayı bu adımda alınamadığı
// için yeni hesaplarda needsConsent true döner, kullanıcı /uyelik-tamamla'ya
// yönlendirilir.
export default function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !CLIENT_ID || !containerRef.current) return;

    async function handleCredential(response: GoogleCredentialResponse) {
      try {
        const customer = await mutateJson<CustomerProfile>("/auth/google/login", "POST", { idToken: response.credential });
        hardNavigateInternal(customer.needsConsent ? "/uyelik-tamamla" : "/");
      } catch (err) {
        onError(err instanceof ClientApiError ? err.message : "Google ile giriş başarısız oldu");
      }
    }

    window.google?.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
    containerRef.current.innerHTML = "";
    window.google?.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      width: 360,
      text: "signin_with",
      locale: "tr",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
      <div className="oauth-divider">
        <span>veya</span>
      </div>
      <div ref={containerRef} className="google-signin-btn" />
    </>
  );
}
