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
