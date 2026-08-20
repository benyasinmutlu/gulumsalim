"use client";

import { useEffect, useState } from "react";

function timeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// bkz. kullanıcı isteği (mockup): "Flaş İndirimler ⚡" bölümünün gerçek
// bitiş zamanına sayan geri sayımı - backend'de resolveOneSection zaten
// süresi geçmiş bölümü hiç döndürmüyor (bkz. homepage-sections.service.ts),
// bu bileşen sadece SÜRE İÇİNDEYKEN görünür UI'ı sağlar. Süre dolduğunda
// (kullanıcı sayfayı açık bırakırsa) bir şey göstermez - sahte/asılı bir
// geri sayım kalmaz.
export default function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState(() => timeLeft(endsAt));

  useEffect(() => {
    const interval = setInterval(() => setLeft(timeLeft(endsAt)), 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!left) return null;

  return (
    <div className="countdown-timer">
      <i className="fas fa-bolt" />
      <span>{pad(left.hours)}</span>:<span>{pad(left.minutes)}</span>:<span>{pad(left.seconds)}</span>
    </div>
  );
}
