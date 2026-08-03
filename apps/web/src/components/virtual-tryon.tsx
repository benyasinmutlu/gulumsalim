"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Sanal Deneme (büyüteç): kullanıcı kendi fotoğrafını yükler; tarayıcıda
// (MediaPipe selfie_multiclass, ÜCRETSİZ + client-side + GPU'suz, Apache-2.0)
// "kıyafet" bölgesi segment edilir ve ürün görseli bu bölgeye giydirilir.
// Fotoğraf localStorage'da kalır - SUNUCUYA GİTMEZ (gizlilik + sıfır maliyet).
// Büyüteç: fareyle gezerken bölgeyi yakınlaştıran mercek. Çizim-only compositing
// (getImageData/toDataURL yok) → S3 cross-origin görselleri canvas'ı "taint"
// etse bile sorun olmaz.

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const CLOTHES_CATEGORY = 4; // 0 arka plan,1 saç,2 gövde-cilt,3 yüz-cilt,4 KIYAFET,5 diğer
const STORAGE_KEY = "gs-tryon-photo";
const CW = 440;
const CH = 580;

interface Props {
  productImage: string | null;
  productName: string;
}

// segmenter tekil (singleton) - model bir kez indirilir.
let segmenterPromise: Promise<{ segment: (img: HTMLImageElement) => { categoryMask?: { width: number; height: number; getAsUint8Array: () => Uint8Array; close?: () => void } } }> | null = null;
async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const mod = await import("@mediapipe/tasks-vision");
      const vision = await mod.FilesetResolver.forVisionTasks(WASM_URL);
      return mod.ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    })();
  }
  return segmenterPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function VirtualTryOn({ productImage, productName }: Props) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0.95);
  const [ready, setReady] = useState(false);

  const displayRef = useRef<HTMLCanvasElement>(null);
  const magRef = useRef<HTMLCanvasElement>(null);
  const personImgRef = useRef<HTMLImageElement | null>(null);
  const productImgRef = useRef<HTMLImageElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const bboxRef = useRef({ x0: 0.2, y0: 0.15, x1: 0.8, y1: 0.6 }); // kıyafet kutusu (normalize)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (open && !photo) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPhoto(saved);
    }
  }, [open, photo]);

  // ürün görselini yükle
  useEffect(() => {
    if (!productImage) return;
    const img = new Image();
    img.onload = () => {
      productImgRef.current = img;
      redraw();
    };
    img.src = productImage; // crossOrigin YOK -> yalnızca çizim
  }, [productImage, open]);

  // fotoğraf değişince: yükle + segment et
  useEffect(() => {
    if (!open || !photo) return;
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        setStatus("Fotoğraf yükleniyor…");
        const img = await loadImage(photo);
        if (cancelled) return;
        personImgRef.current = img;
        redraw();
        setStatus("Kıyafet bölgesi ayrılıyor… (ilk seferde model iniyor)");
        const seg = await getSegmenter();
        if (cancelled) return;
        const result = seg.segment(img);
        const mask = result.categoryMask;
        if (mask) {
          const w = mask.width;
          const h = mask.height;
          const data = mask.getAsUint8Array();
          const m = document.createElement("canvas");
          m.width = w;
          m.height = h;
          const mctx = m.getContext("2d");
          if (mctx) {
            const id = mctx.createImageData(w, h);
            let minX = w, minY = h, maxX = 0, maxY = 0, cnt = 0;
            for (let i = 0; i < w * h; i++) {
              if (data[i] === CLOTHES_CATEGORY) {
                id.data[i * 4 + 3] = 255;
                const x = i % w;
                const y = (i / w) | 0;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                cnt++;
              }
            }
            mctx.putImageData(id, 0, 0);
            // Kıyafet bölgesi yeterince (görselin %2'sinden fazlası) bulunduysa
            // ürünü o maskeye kırp; bulunamadıysa (kötü poz/foto) maskeyi
            // kullanma - ürün kırpılmadan görünür ve elle konumlandırılabilir,
            // kaybolmaz.
            if (cnt > w * h * 0.02) {
              maskRef.current = m;
              bboxRef.current = { x0: minX / w, y0: minY / h, x1: maxX / w, y1: maxY / h };
            } else {
              maskRef.current = null;
            }
          }
          mask.close?.();
        }
        if (cancelled) return;
        setStatus("");
        setReady(true);
        redraw();
      } catch {
        // Segmentasyon başarısızsa: yine de manuel overlay ile çalışsın.
        setStatus("Otomatik kıyafet ayırma bu tarayıcıda çalışmadı — ürünü elle sürükleyip ölçekleyebilirsin.");
        setReady(true);
        redraw();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photo]);

  const redraw = useCallback(() => {
    const canvas = displayRef.current;
    const person = personImgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = "#f3f0f7";
    ctx.fillRect(0, 0, CW, CH);
    if (!person) return;

    const s = Math.min(CW / person.width, CH / person.height);
    const pw = person.width * s;
    const ph = person.height * s;
    const px = (CW - pw) / 2;
    const py = (CH - ph) / 2;
    ctx.drawImage(person, px, py, pw, ph);

    const product = productImgRef.current;
    if (!product) return;
    const bb = bboxRef.current;
    const bx = px + bb.x0 * pw;
    const by = py + bb.y0 * ph;
    const bw = (bb.x1 - bb.x0) * pw;
    const bh = (bb.y1 - bb.y0) * ph;
    // Bir tişört gövde GENİŞLİĞİNİ kaplar; genişliğe göre ölçekle ve üstten
    // (omuz/yaka) hizala - ortalamak yerine daha doğal durur.
    const ps = (bw / product.width) * scale * 1.08;
    const dw = product.width * ps;
    const dh = product.height * ps;
    const dx = bx + (bw - dw) / 2 + offset.x;
    const dy = by - dh * 0.05 + offset.y;

    const off = document.createElement("canvas");
    off.width = CW;
    off.height = CH;
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.drawImage(product, dx, dy, dw, dh);
    if (maskRef.current) {
      // kıyafet maskesine kırp; kenarı hafif bulanıklaştır (feather) ki keskin
      // ve yapay durmasın.
      octx.globalCompositeOperation = "destination-in";
      octx.filter = "blur(2.2px)";
      octx.drawImage(maskRef.current, px, py, pw, ph);
      octx.filter = "none";
      octx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = opacity;
    ctx.drawImage(off, 0, 0);
    ctx.globalAlpha = 1;
  }, [scale, offset, opacity]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      try {
        localStorage.setItem(STORAGE_KEY, url);
      } catch {
        /* fotoğraf büyükse localStorage dolabilir - sorun değil, oturumluk kullanılır */
      }
      setScale(1);
      setOffset({ x: 0, y: 0 });
      maskRef.current = null;
      setPhoto(url);
    };
    reader.readAsDataURL(file);
  }

  // büyüteç
  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = displayRef.current;
    const mag = magRef.current;
    if (!canvas || !mag) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CW;
    const y = ((e.clientY - rect.top) / rect.height) * CH;
    if (dragRef.current) {
      setOffset({ x: dragRef.current.ox + (x - dragRef.current.sx), y: dragRef.current.oy + (y - dragRef.current.sy) });
      return;
    }
    const mctx = mag.getContext("2d");
    if (!mctx) return;
    const R = 90;
    const Z = 2.2;
    mctx.clearRect(0, 0, R * 2, R * 2);
    mctx.save();
    mctx.beginPath();
    mctx.arc(R, R, R, 0, Math.PI * 2);
    mctx.clip();
    mctx.drawImage(canvas, x - R / Z, y - R / Z, (R * 2) / Z, (R * 2) / Z, 0, 0, R * 2, R * 2);
    mctx.restore();
    mctx.strokeStyle = "#7c3aed";
    mctx.lineWidth = 3;
    mctx.beginPath();
    mctx.arc(R, R, R - 2, 0, Math.PI * 2);
    mctx.stroke();
    mag.style.left = `${e.clientX - rect.left - R}px`;
    mag.style.top = `${e.clientY - rect.top - R - 200}px`;
    mag.style.display = "block";
  }

  return (
    <>
      <button type="button" className="btn-tryon" onClick={() => setOpen(true)}>
        <i className="fas fa-wand-magic-sparkles" /> Üzerimde Dene
      </button>

      {open && (
        <div className="tryon-backdrop" onClick={() => setOpen(false)}>
          <div className="tryon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tryon-head">
              <strong>
                <i className="fas fa-wand-magic-sparkles" /> Üzerimde Dene — {productName}
              </strong>
              <button type="button" className="tryon-close" onClick={() => setOpen(false)} aria-label="Kapat">
                <i className="fas fa-times" />
              </button>
            </div>

            {!photo ? (
              <label className="tryon-upload">
                <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} hidden />
                <i className="fas fa-camera" />
                <p>Kendi fotoğrafını yükle</p>
                <small>Fotoğrafın cihazında kalır, sunucuya gönderilmez.</small>
              </label>
            ) : (
              <div className="tryon-body">
                <div className="tryon-stage">
                  <canvas
                    ref={displayRef}
                    width={CW}
                    height={CH}
                    className="tryon-canvas"
                    onMouseMove={onMove}
                    onMouseLeave={() => {
                      if (magRef.current) magRef.current.style.display = "none";
                    }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * CW;
                      const y = ((e.clientY - rect.top) / rect.height) * CH;
                      dragRef.current = { sx: x, sy: y, ox: offset.x, oy: offset.y };
                    }}
                    onMouseUp={() => (dragRef.current = null)}
                  />
                  <canvas ref={magRef} width={180} height={180} className="tryon-mag" style={{ display: "none" }} />
                </div>
                {status && <p className="tryon-status">{status}</p>}
                <div className="tryon-controls">
                  <label>
                    Boyut
                    <input type="range" min={0.5} max={2} step={0.02} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
                  </label>
                  <label>
                    Opaklık
                    <input type="range" min={0.4} max={1} step={0.02} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                  </label>
                  <button type="button" className="btn btn-sec btn-sm" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); setOpacity(0.95); }}>
                    Sıfırla
                  </button>
                  <button
                    type="button"
                    className="btn btn-sec btn-sm"
                    onClick={() => {
                      localStorage.removeItem(STORAGE_KEY);
                      maskRef.current = null;
                      setPhoto(null);
                      setReady(false);
                    }}
                  >
                    Fotoğrafı değiştir
                  </button>
                </div>
                <p className="tryon-hint">
                  Ürünü sürükleyerek konumlandır, büyüteçle detayına bak. {ready ? "" : "İşleniyor…"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
