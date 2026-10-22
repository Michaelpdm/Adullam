import { create } from 'zustand'
import { useEdit } from './edit'
import MediaWorker from './workers/media.worker?worker'
import {
  PROXY_SHORT_SIDE,
  type ExportPreset,
  WAVE_BUCKETS_PER_SECOND,
  type MediaMeta,
  type WorkerIn,
  type WorkerOut,
} from './lib/mediaProtocol'

export interface Thumb { time: number; url: string }
export type Stage = 'idle' | 'reading' | 'ready' | 'error'

interface ProjectState {
  file: File | null
  stage: Stage
  error: string | null
  meta: MediaMeta | null
  originalUrl: string | null
  thumbs: Thumb[]
  thumbInterval: number
  thumbProgress: number
  peaks: Float32Array | null
  peaksVersion: number
  waveProgress: number
  /** 'skipped' = the original is already light enough to edit directly. */
  proxy: 'none' | 'building' | 'ready' | 'skipped' | 'failed'
  proxyProgress: number
  proxyUrl: string | null
  load: (file: File) => Promise<void>
  close: () => void
}

let worker: Worker | null = null
let nextId = 1
const listeners = new Map<number, (m: WorkerOut) => void>()
let activeJobs: number[] = []

function getWorker() {
  if (!worker) {
    worker = new MediaWorker()
    worker.onmessage = (e: MessageEvent<WorkerOut>) => listeners.get(e.data.id)?.(e.data)
  }
  return worker
}

type JobMsg<T = WorkerIn> = T extends { type: 'cancel' } ? never : T extends unknown ? Omit<T, 'id'> : never

function startJob(msg: JobMsg, on: (m: WorkerOut) => void) {
  const id = nextId++
  activeJobs.push(id)
  listeners.set(id, (m) => {
    on(m)
    if (m.type === 'done' || m.type === 'error') listeners.delete(id)
  })
  getWorker().postMessage({ ...msg, id } as WorkerIn)
  return id
}

const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`.replace(/[^a-z0-9]+/gi, '_').slice(0, 120)

export const useProject = create<ProjectState>((set, get) => ({
  file: null,
  stage: 'idle',
  error: null,
  meta: null,
  originalUrl: null,
  thumbs: [],
  thumbInterval: 10,
  thumbProgress: 0,
  peaks: null,
  peaksVersion: 0,
  waveProgress: 0,
  proxy: 'none',
  proxyProgress: 0,
  proxyUrl: null,

  async load(file) {
    get().close()
    set({ file, stage: 'reading', originalUrl: URL.createObjectURL(file) })

    startJob({ type: 'probe', file }, (m) => {
      if (m.type === 'error') return set({ stage: 'error', error: m.message })
      if (m.type !== 'probe') return
      const meta = m.meta
      set({ meta, stage: 'ready' })
      useEdit.getState().reset(meta.duration)

      // Thumbnails: about one per 10s, between 20 and 300 in total.
      const count = Math.max(20, Math.min(300, Math.ceil(meta.duration / 10)))
      set({ thumbInterval: meta.duration / count, thumbs: [] })
      if (meta.height > 0) {
        startJob({ type: 'thumbs', file, count, height: 72, duration: meta.duration }, (t) => {
          if (t.type === 'thumb') {
            set((s) => ({ thumbs: [...s.thumbs, { time: t.time, url: URL.createObjectURL(t.blob) }] }))
          } else if (t.type === 'progress') set({ thumbProgress: t.progress })
          else if (t.type === 'done') set({ thumbProgress: 1 })
        })
      }

      // Waveform, filled in progressively.
      if (meta.hasAudio) {
        set({ peaks: new Float32Array(Math.ceil(meta.duration * WAVE_BUCKETS_PER_SECOND)), peaksVersion: 0 })
        startJob(
          { type: 'waveform', file, duration: meta.duration, bucketsPerSecond: WAVE_BUCKETS_PER_SECOND },
          (w) => {
            if (w.type === 'wave') {
              get().peaks?.set(w.peaks, w.from)
              set((s) => ({ peaksVersion: s.peaksVersion + 1 }))
            } else if (w.type === 'progress') set({ waveProgress: w.progress })
            else if (w.type === 'done') set({ waveProgress: 1, peaksVersion: get().peaksVersion + 1 })
          },
        )
      }

      // Lightweight preview copy so editing a movie feels as smooth as a short clip.
      if (Math.min(meta.width, meta.height) <= PROXY_SHORT_SIDE) {
        set({ proxy: 'skipped' })
      } else {
        set({ proxy: 'building', proxyProgress: 0 })
        startJob({ type: 'proxy', file, key: fileKey(file), width: meta.width, height: meta.height }, async (p) => {
          if (p.type === 'progress') set({ proxyProgress: p.progress })
          else if (p.type === 'error') set({ proxy: 'failed' })
          else if (p.type === 'proxy-done') {
            const root = await navigator.storage.getDirectory()
            const f = await (await root.getFileHandle(p.fileName)).getFile()
            if (get().file !== file) return // user already opened another video
            set({ proxy: 'ready', proxyProgress: 1, proxyUrl: URL.createObjectURL(f) })
          }
        })
      }
    })
  },

  close() {
    for (const id of activeJobs) {
      worker?.postMessage({ type: 'cancel', id } satisfies WorkerIn)
      listeners.delete(id)
    }
    activeJobs = []
    const s = get()
    if (s.originalUrl) URL.revokeObjectURL(s.originalUrl)
    if (s.proxyUrl) URL.revokeObjectURL(s.proxyUrl)
    s.thumbs.forEach((t) => URL.revokeObjectURL(t.url))
    useEdit.getState().reset(0)
    set({
      file: null, stage: 'idle', error: null, meta: null, originalUrl: null, thumbs: [], thumbProgress: 0,
      peaks: null, peaksVersion: 0, waveProgress: 0, proxy: 'none', proxyProgress: 0, proxyUrl: null,
    })
  },
}))

// ---- Export -----------------------------------------------------------------

interface ExportState {
  stage: 'idle' | 'running' | 'done' | 'error'
  progress: number
  error: string | null
  fileName: string | null
  jobId: number | null
  start: (preset: ExportPreset) => Promise<void>
  cancel: () => void
  reset: () => void
}

export const useExport = create<ExportState>((set, get) => ({
  stage: 'idle',
  progress: 0,
  error: null,
  fileName: null,
  jobId: null,

  async start(preset) {
    const { file, meta } = useProject.getState()
    if (!file || !meta) return
    let handle: FileSystemFileHandle
    try {
      // Pick the destination first: the video is written straight to disk while rendering.
      handle = await (window as any).showSaveFilePicker({
        suggestedName: file.name.replace(/\.[^.]+$/, '') + ' (edited).mp4',
        types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
      })
    } catch {
      return // cancelled
    }
    const clips = useEdit.getState().clips.map((c) => ({ start: c.start, end: c.end }))
    set({ stage: 'running', progress: 0, error: null, fileName: handle.name })
    const jobId = startJob({ type: 'export', file, handle, clips, preset, meta }, (m) => {
      if (m.type === 'progress') set({ progress: m.progress })
      else if (m.type === 'error') set({ stage: 'error', error: m.message })
      else if (m.type === 'done' && get().stage === 'running') set({ stage: 'done', progress: 1 })
    })
    set({ jobId })
  },

  cancel() {
    const { jobId } = get()
    if (jobId !== null) worker?.postMessage({ type: 'cancel', id: jobId } satisfies WorkerIn)
    set({ stage: 'idle', progress: 0, jobId: null })
  },

  reset: () => set({ stage: 'idle', progress: 0, error: null, fileName: null, jobId: null }),
}))
