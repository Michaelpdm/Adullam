/// <reference lib="webworker" />
import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  CanvasSink,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  type StreamTargetChunk,
} from 'mediabunny'
import { CanvasSource, AudioSampleSource } from 'mediabunny'
import { EXPORT_PRESETS, exportSize, type ExportPreset, type MediaMeta, type WorkerIn, type WorkerOut } from '../lib/mediaProtocol'

// Every job streams from the File with BlobSource, so only the byte ranges
// that are actually needed are ever read. Whole files are never in memory.

const post = (m: WorkerOut, transfer: Transferable[] = []) => self.postMessage(m, transfer)
const openInput = (file: File) => new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
const conversions = new Map<number, Conversion>()
const cancelled = new Set<number>()

async function probe(id: number, file: File) {
  const input = openInput(file)
  const video = await input.getPrimaryVideoTrack()
  const audio = await input.getPrimaryAudioTrack()
  const duration = await input.computeDuration()
  let fps: number | null = null
  if (video) {
    try {
      fps = (await video.computePacketStats(60)).averagePacketRate
    } catch { /* fps is optional */ }
  }
  post({
    type: 'probe',
    id,
    meta: {
      duration,
      width: video?.displayWidth ?? 0,
      height: video?.displayHeight ?? 0,
      fps,
      videoCodec: video?.codec ?? null,
      hasAudio: !!audio,
    },
  })
  post({ type: 'done', id })
}

async function thumbs(id: number, file: File, count: number, height: number, duration: number) {
  const input = openInput(file)
  const video = await input.getPrimaryVideoTrack()
  if (!video) return post({ type: 'done', id })
  const sink = new CanvasSink(video, { height })
  const step = duration / count
  const times = Array.from({ length: count }, (_, i) => (i + 0.5) * step)
  let i = 0
  for await (const frame of sink.canvasesAtTimestamps(times)) {
    if (cancelled.has(id)) break
    if (frame) {
      const blob = await (frame.canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.7 })
      post({ type: 'thumb', id, index: i, time: times[i], blob })
    }
    i++
    post({ type: 'progress', id, progress: i / count })
  }
  post({ type: 'done', id })
}

async function waveform(id: number, file: File, duration: number, bps: number) {
  const input = openInput(file)
  const audio = await input.getPrimaryAudioTrack()
  if (!audio) return post({ type: 'done', id })
  const sink = new AudioSampleSink(audio)
  const buckets = Math.ceil(duration * bps)
  const peaks = new Float32Array(buckets)
  const STRIDE = 4 // sample every 4th frame: plenty for a peak display
  let scratch = new Float32Array(0)
  let sent = 0
  for await (const sample of sink.samples()) {
    if (cancelled.has(id)) { sample.close(); break }
    const n = sample.numberOfFrames
    if (scratch.length < n) scratch = new Float32Array(n)
    for (let c = 0; c < sample.numberOfChannels; c++) {
      sample.copyTo(scratch, { planeIndex: c, format: 'f32-planar' })
      for (let f = 0; f < n; f += STRIDE) {
        const b = Math.floor((sample.timestamp + f / sample.sampleRate) * bps)
        if (b >= 0 && b < buckets) {
          const v = Math.abs(scratch[f])
          if (v > peaks[b]) peaks[b] = v
        }
      }
    }
    const reached = Math.min(buckets, Math.floor(sample.timestamp * bps))
    sample.close()
    if (reached - sent >= bps * 10) {
      post({ type: 'wave', id, from: sent, peaks: peaks.slice(sent, reached) })
      post({ type: 'progress', id, progress: reached / buckets })
      sent = reached
    }
  }
  if (sent < buckets) post({ type: 'wave', id, from: sent, peaks: peaks.slice(sent) })
  post({ type: 'done', id })
}

/** Builds the lightweight preview copy inside the browser's private storage (OPFS). */
async function proxy(id: number, file: File, key: string, width: number, height: number) {
  const root = await navigator.storage.getDirectory()
  const finalName = `proxy-${key}.mp4`
  try {
    await root.getFileHandle(finalName) // already built in an earlier session
    post({ type: 'proxy-done', id, fileName: finalName })
    return post({ type: 'done', id })
  } catch { /* not built yet */ }

  const partName = `proxy-${key}.part`
  const handle = await root.getFileHandle(partName, { create: true })
  const writable = await handle.createWritable()
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new StreamTarget(writable as unknown as WritableStream<StreamTargetChunk>),
  })
  const input = openInput(file)
  const landscape = width >= height
  const conversion = await Conversion.init({
    input,
    output,
    video: {
      ...(landscape ? { height: 540 } : { width: 540 }),
      codec: 'avc',
      bitrate: 1_200_000,
    },
    audio: { codec: 'aac', bitrate: 96_000 },
  })
  if (!conversion.isValid) {
    await writable.abort().catch(() => {})
    throw new Error('This video format could not be prepared for fast preview.')
  }
  conversions.set(id, conversion)
  conversion.onProgress = (p) => post({ type: 'progress', id, progress: p })
  await conversion.execute()
  conversions.delete(id)
  if (cancelled.has(id)) {
    await root.removeEntry(partName).catch(() => {})
    return post({ type: 'done', id })
  }
  await (handle as any).move(finalName) // only complete files get the final name
  post({ type: 'proxy-done', id, fileName: finalName })
  post({ type: 'done', id })
}


/**
 * Renders the edit straight to the file the user picked. Frames are decoded,
 * drawn on a canvas (where text/effects will be composited later) and encoded.
 * Output is streamed to disk as it is produced, so length doesn't matter.
 */
async function exportVideo(
  id: number, file: File, handle: FileSystemFileHandle,
  clips: { start: number; end: number }[], preset: ExportPreset, meta: MediaMeta,
) {
  const writable = await handle.createWritable()
  const input = openInput(file)
  const video = await input.getPrimaryVideoTrack()
  const audio = meta.hasAudio ? await input.getPrimaryAudioTrack() : null
  if (!video) throw new Error('This file has no video to export.')

  const { width, height } = exportSize(meta.width, meta.height, preset)
  const fps = meta.fps || 30
  const bitrate = Math.round(width * height * fps * EXPORT_PRESETS[preset].bpp)

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new StreamTarget(writable as unknown as WritableStream<StreamTargetChunk>),
  })
  const vsrc = new CanvasSource(canvas, { codec: 'avc', bitrate })
  output.addVideoTrack(vsrc, { frameRate: fps })
  const asrc = audio ? new AudioSampleSource({ codec: 'aac', bitrate: 192_000 }) : null
  if (asrc) output.addAudioTrack(asrc)
  await output.start()

  const vsink = new CanvasSink(video, { width, height, fit: 'fill' })
  const asink = audio ? new AudioSampleSink(audio) : null
  const total = clips.reduce((s, c) => s + (c.end - c.start), 0)
  let offset = 0
  let lastPost = 0

  try {
    for (const clip of clips) {
      const videoPass = (async () => {
        for await (const w of vsink.canvases(clip.start, clip.end)) {
          if (cancelled.has(id)) return
          ctx.drawImage(w.canvas as CanvasImageSource, 0, 0, width, height)
          const rel = Math.max(0, w.timestamp - clip.start)
          const dur = Math.min(w.duration, clip.end - Math.max(w.timestamp, clip.start))
          if (dur <= 0) continue
          await vsrc.add(offset + rel, dur)
          const now = performance.now()
          if (now - lastPost > 250) {
            lastPost = now
            post({ type: 'progress', id, progress: Math.min(0.99, (offset + rel) / total) })
          }
        }
      })()
      const audioPass = (async () => {
        if (!asink || !asrc) return
        for await (const s0 of asink.samples(clip.start, clip.end)) {
          if (cancelled.has(id)) { s0.close(); return }
          let s = s0
          const from = Math.max(0, Math.round((clip.start - s0.timestamp) * s0.sampleRate))
          const to = Math.min(s0.numberOfFrames, Math.round((clip.end - s0.timestamp) * s0.sampleRate))
          if (to <= from) { s0.close(); continue }
          if (from > 0 || to < s0.numberOfFrames) { s = s0.trim(from, to); s0.close() }
          s.setTimestamp(offset + Math.max(0, s.timestamp - clip.start))
          await asrc.add(s)
          s.close()
        }
      })()
      await Promise.all([videoPass, audioPass])
      if (cancelled.has(id)) break
      offset += clip.end - clip.start
    }
  } catch (err) {
    await output.cancel().catch(() => {})
    await writable.abort().catch(() => {})
    throw err
  }

  if (cancelled.has(id)) {
    await output.cancel().catch(() => {})
    await writable.abort().catch(() => {})
    return post({ type: 'done', id })
  }
  await output.finalize()
  post({ type: 'progress', id, progress: 1 })
  post({ type: 'done', id })
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data
  if (m.type === 'cancel') {
    cancelled.add(m.id)
    await conversions.get(m.id)?.cancel()
    return
  }
  try {
    if (m.type === 'probe') await probe(m.id, m.file)
    else if (m.type === 'thumbs') await thumbs(m.id, m.file, m.count, m.height, m.duration)
    else if (m.type === 'waveform') await waveform(m.id, m.file, m.duration, m.bucketsPerSecond)
    else if (m.type === 'export') await exportVideo(m.id, m.file, m.handle, m.clips, m.preset, m.meta)
    else if (m.type === 'proxy') await proxy(m.id, m.file, m.key, m.width, m.height)
  } catch (err) {
    post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) })
  }
}
