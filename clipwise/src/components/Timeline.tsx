import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useProject } from '../project'
import { WAVE_BUCKETS_PER_SECOND } from '../lib/mediaProtocol'
import { playback } from './Player'

const RULER_H = 24, THUMB_H = 72, WAVE_H = 56, H = RULER_H + THUMB_H + WAVE_H
const MAX_PPS = 1200 // pixels per second at full zoom: single frames
const STEPS = [0.04, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600]

const label = (t: number) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const sec = Number.isInteger(s) ? String(s).padStart(2, '0') : s.toFixed(2).padStart(5, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/**
 * Only what is on screen is ever drawn: the ruler and waveform are painted
 * into one viewport-wide canvas, and only visible thumbnails are mounted.
 * That keeps a 3 hour movie as cheap as a 10 second clip.
 */
export default function Timeline() {
  const { meta, thumbs, thumbInterval, peaks, peaksVersion } = useProject()
  const scroller = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const playhead = useRef<HTMLDivElement>(null)
  const [vw, setVw] = useState(800)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [zoom, setZoom] = useState(0) // 0 = whole video, 1 = single frames
  const anchor = useRef<number | null>(null)

  const duration = meta?.duration ?? 1
  const fitPps = Math.max(0.01, (vw - 2) / duration)
  const maxPps = Math.max(MAX_PPS, fitPps)
  const pps = fitPps * Math.pow(maxPps / fitPps, zoom)
  const width = Math.max(vw, duration * pps)

  useEffect(() => {
    const el = scroller.current!
    const ro = new ResizeObserver(() => setVw(el.clientWidth))
    ro.observe(el)
    setVw(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Keep the playhead put while zooming.
  useLayoutEffect(() => {
    const el = scroller.current!
    if (anchor.current !== null) {
      el.scrollLeft = anchor.current * pps - (playback.time * pps - el.scrollLeft < 0 ? 0 : vw / 2)
      anchor.current = null
    }
  }, [pps, vw])

  // Redraw ruler + waveform for the visible window only.
  useEffect(() => {
    const c = canvas.current!
    const dpr = window.devicePixelRatio || 1
    c.width = vw * dpr
    c.height = H * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, vw, H)
    const t0 = scrollLeft / pps, t1 = (scrollLeft + vw) / pps

    // ruler
    const step = STEPS.find((s) => s * pps >= 90) ?? STEPS[STEPS.length - 1]
    g.fillStyle = '#8b93a1'
    g.strokeStyle = '#2f343c'
    g.font = '11px system-ui'
    for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
      const x = Math.round(t * pps - scrollLeft) + 0.5
      g.beginPath(); g.moveTo(x, RULER_H - 8); g.lineTo(x, RULER_H); g.stroke()
      g.fillText(label(t), x + 4, 13)
    }

    // waveform (max of the peaks that fall inside each pixel)
    if (peaks) {
      const mid = RULER_H + THUMB_H + WAVE_H / 2
      g.fillStyle = '#ff5a36'
      for (let x = 0; x < vw; x++) {
        const a = Math.max(0, Math.floor(((scrollLeft + x) / pps) * WAVE_BUCKETS_PER_SECOND))
        const b = Math.min(peaks.length, Math.max(a + 1, Math.floor(((scrollLeft + x + 1) / pps) * WAVE_BUCKETS_PER_SECOND)))
        let m = 0
        for (let i = a; i < b; i++) if (peaks[i] > m) m = peaks[i]
        const h = Math.max(m > 0 ? 1 : 0, Math.min(1, m * 1.4) * (WAVE_H - 6))
        if (h) g.fillRect(x, mid - h / 2, 1, h)
      }
    }
  }, [vw, scrollLeft, pps, peaks, peaksVersion])

  // Playhead follows playback, moving the DOM directly (no React render per frame).
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const x = playback.time * pps
      if (playhead.current) playhead.current.style.transform = `translateX(${x}px)`
      const el = scroller.current!
      const vid = document.querySelector('video')
      if (vid && !vid.paused && (x < el.scrollLeft || x > el.scrollLeft + vw - 40)) el.scrollLeft = x - 40
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pps, vw])

  const visibleThumbs = useMemo(() => {
    const t0 = scrollLeft / pps - thumbInterval, t1 = (scrollLeft + vw) / pps + thumbInterval
    return thumbs.filter((t) => t.time >= t0 && t.time <= t1)
  }, [thumbs, scrollLeft, pps, vw, thumbInterval])

  const seekFromEvent = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    playback.seek((e.clientX - rect.left) / pps)
  }

  const setZoomKeepingPlayhead = (z: number) => { anchor.current = playback.time; setZoom(z) }

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-3 pb-2 text-sm text-muted">
        <span>🔍 Zoom</span>
        <button className="btn" title="Show the whole video" onClick={() => setZoomKeepingPlayhead(0)}>Whole video</button>
        <input
          type="range" min={0} max={1} step={0.001} value={zoom} className="w-56 accent-[#ff5a36]"
          onChange={(e) => setZoomKeepingPlayhead(Number(e.target.value))}
          aria-label="Timeline zoom"
        />
        <button className="btn" title="Zoom to single frames" onClick={() => setZoomKeepingPlayhead(1)}>Frames</button>
      </div>
      <div
        ref={scroller}
        className="overflow-x-auto overflow-y-hidden rounded-lg bg-black/30"
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      >
        <div
          className="relative select-none cursor-text"
          style={{ width, height: H }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFromEvent(e) }}
          onPointerMove={(e) => { if (e.buttons) seekFromEvent(e) }}
        >
          <canvas ref={canvas} className="sticky left-0 top-0 block" style={{ width: vw, height: H }} />
          {visibleThumbs.map((t) => (
            <div
              key={t.time}
              className="absolute bg-cover bg-center opacity-90"
              style={{
                left: (t.time - thumbInterval / 2) * pps,
                width: thumbInterval * pps,
                top: RULER_H,
                height: THUMB_H,
                backgroundImage: `url(${t.url})`,
              }}
            />
          ))}
          <div ref={playhead} className="absolute top-0 left-0 h-full w-0.5 bg-white pointer-events-none">
            <div className="absolute -top-0.5 -left-1.5 w-3.5 h-3 rounded-sm bg-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
