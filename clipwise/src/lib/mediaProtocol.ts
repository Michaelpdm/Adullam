export interface MediaMeta {
  duration: number
  width: number
  height: number
  fps: number | null
  videoCodec: string | null
  hasAudio: boolean
}

export type WorkerIn =
  | { type: 'probe'; id: number; file: File }
  | { type: 'thumbs'; id: number; file: File; count: number; height: number; duration: number }
  | { type: 'waveform'; id: number; file: File; duration: number; bucketsPerSecond: number }
  | { type: 'proxy'; id: number; file: File; key: string; width: number; height: number }
  | { type: 'export'; id: number; file: File; handle: FileSystemFileHandle; clips: { start: number; end: number }[]; preset: ExportPreset; meta: MediaMeta }
  | { type: 'cancel'; id: number }

export type WorkerOut =
  | { type: 'probe'; id: number; meta: MediaMeta }
  | { type: 'thumb'; id: number; index: number; time: number; blob: Blob }
  | { type: 'wave'; id: number; from: number; peaks: Float32Array }
  | { type: 'progress'; id: number; progress: number }
  | { type: 'proxy-done'; id: number; fileName: string }
  | { type: 'done'; id: number }
  | { type: 'error'; id: number; message: string }

/** Preview copies are made at this height (short side). */
export const PROXY_SHORT_SIDE = 540
/** Waveform resolution. */
export const WAVE_BUCKETS_PER_SECOND = 20

export type ExportPreset = 'youtube' | 'original' | 'small'

export const EXPORT_PRESETS: Record<ExportPreset, { label: string; sub: string; icon: string; maxShortSide: number | null; bpp: number }> = {
  youtube: { label: 'YouTube', sub: 'Up to 1080p, great quality', icon: '▶️', maxShortSide: 1080, bpp: 0.12 },
  original: { label: 'Original quality', sub: 'Same size as your video', icon: '💎', maxShortSide: null, bpp: 0.16 },
  small: { label: 'Small file', sub: '720p, easy to share', icon: '📦', maxShortSide: 720, bpp: 0.07 },
}

/** Output size for a preset: never upscales, always even numbers (video encoders need that). */
export function exportSize(w: number, h: number, preset: ExportPreset) {
  const cap = EXPORT_PRESETS[preset].maxShortSide
  const short = Math.min(w, h)
  const k = cap && short > cap ? cap / short : 1
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2)
  return { width: even(w), height: even(h) }
}
