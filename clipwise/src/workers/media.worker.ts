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
import type { WorkerIn, WorkerOut } from '../lib/mediaProtocol'

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
    else if (m.type === 'proxy') await proxy(m.id, m.file, m.key, m.width, m.height)
  } catch (err) {
    post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) })
  }
}
