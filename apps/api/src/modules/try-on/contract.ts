// =============================================================================
// Virtual Try-On / Style Lens — Domain & API Contract (FAZ 5, TASARIM)
// =============================================================================
// Bu turda GERÇEK image upload veya dış AI YOK. Yalnızca job lifecycle sözleşmesi,
// model-adapter arayüzü ve güvenli bir mock. Gizlilik/güvenlik gerekçeleri
// docs/architecture/virtual-try-on.md ve privacy-threat-model.md içinde.

export const TRY_ON_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const TRY_ON_MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12MB
export const TRY_ON_DEFAULT_RETENTION_SECONDS = 60 * 60; // 1 saat, kısa saklama

export type TryOnJobStatus = "created" | "uploaded" | "processing" | "completed" | "failed" | "expired";

// İzin verilen durum geçişleri (state machine). Keyfi geçiş reddedilir.
const TRANSITIONS: Record<TryOnJobStatus, TryOnJobStatus[]> = {
  created: ["uploaded", "expired", "failed"],
  uploaded: ["processing", "expired", "failed"],
  processing: ["completed", "failed", "expired"],
  completed: ["expired"],
  failed: [],
  expired: [],
};

export function canTransition(from: TryOnJobStatus, to: TryOnJobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTryOnTransitionError extends Error {
  constructor(from: TryOnJobStatus, to: TryOnJobStatus) {
    super(`Geçersiz try-on durum geçişi: ${from} -> ${to}`);
  }
}

export interface TryOnJob {
  id: string;
  customerId: number; // yalnız giriş yapmış kullanıcı (IDOR sınırı için sahiplik)
  status: TryOnJobStatus;
  createdAt: number;
  expiresAt: number;
  consentToProcess: boolean; // açık rıza olmadan işlenmez
  garmentProductId: number;
}

export function transition(job: TryOnJob, to: TryOnJobStatus): TryOnJob {
  if (!canTransition(job.status, to)) throw new InvalidTryOnTransitionError(job.status, to);
  return { ...job, status: to };
}

// Upload descriptor doğrulaması (SÖZLEŞME seviyesi). Gerçek decode + EXIF strip
// + decompression-bomb koruması izole worker'da yapılır (bkz. mimari doküman).
export interface UploadDescriptor {
  mime: string;
  byteSize: number;
  declaredWidth?: number;
  declaredHeight?: number;
}

export type UploadValidation = { ok: true } | { ok: false; reason: string };

export function validateUploadDescriptor(d: UploadDescriptor): UploadValidation {
  if (!(TRY_ON_ALLOWED_MIME as readonly string[]).includes(d.mime)) {
    return { ok: false, reason: "unsupported_mime" };
  }
  if (d.byteSize <= 0 || d.byteSize > TRY_ON_MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "size_out_of_bounds" };
  }
  return { ok: true };
}

// Model adapter arayüzü — gerçek AI servisi buranın ardına takılır (izole GPU
// worker). API bu arayüzü bilir; timeout/retry/maliyet limiti çağıranda.
export interface TryOnModelInput {
  jobId: string;
  personImageRef: string; // private storage anahtarı (public URL DEĞİL)
  garmentImageRef: string;
}

export interface TryOnModelResult {
  resultImageRef: string; // private storage anahtarı
  approximate: true; // her zaman "yaklaşık görselleştirme"
  modelVersion: string;
}

export interface TryOnModelAdapter {
  readonly name: string;
  process(input: TryOnModelInput): Promise<TryOnModelResult>;
}

// Güvenli mock: gerçek AI/görsel işleme yok; uçtan uca job lifecycle'ı test
// etmeyi sağlar. Gerçek adapter aynı arayüzü uygular.
export function mockTryOnAdapter(modelVersion = "mock-0"): TryOnModelAdapter {
  return {
    name: "mock",
    async process(input: TryOnModelInput): Promise<TryOnModelResult> {
      return { resultImageRef: `mock-result/${input.jobId}`, approximate: true, modelVersion };
    },
  };
}
