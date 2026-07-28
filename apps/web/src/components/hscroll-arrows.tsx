"use client";

import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement } from "react";

// gulumsalim.com'daki main.js'teki initHscrollArrows()'un birebir karşılığı:
// masaüstünde yatay kaydırılan bir satırın sağına/soluna ok eklenir, en
// baştayken sol ok, en sondayken sağ ok otomatik gizlenir. Mobilde CSS
// (.hscroll-arrow media query) zaten okları hiç göstermiyor.
export default function HscrollArrows({ children }: { children: ReactElement }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function updateEdges() {
      if (!el) return;
      setShowPrev(el.scrollLeft > 4);
      setShowNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }

    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, []);

  function scrollByPage(dir: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  if (!isValidElement(children)) return children;

  return (
    <div className="hscroll-arrow-wrap">
      {cloneElement(children, { ref: scrollRef } as { ref: typeof scrollRef })}
      <button
        type="button"
        className={`hscroll-arrow hscroll-arrow-prev${showPrev ? "" : " is-hidden"}`}
        onClick={() => scrollByPage(-1)}
        aria-label="Geri"
      >
        <i className="fas fa-chevron-left" />
      </button>
      <button
        type="button"
        className={`hscroll-arrow hscroll-arrow-next${showNext ? "" : " is-hidden"}`}
        onClick={() => scrollByPage(1)}
        aria-label="İleri"
      >
        <i className="fas fa-chevron-right" />
      </button>
    </div>
  );
}
