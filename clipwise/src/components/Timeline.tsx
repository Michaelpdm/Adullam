import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useProject } from '../project'
import { useEdit, layout, totalDuration, type Placed } from '../edit'
import { WAVE_BUCKETS_PER_SECOND } from '../lib/mediaProtocol'
import { playback } from './Player'

const RULER_H = 24, THUMB_H = 72, WAVE_H = 56, H = RULER_H + THUMB_H + WAVE_H
const MAX_PPS = 1200 // pixels per second at full zoom: single frames
const HANDLE = 8
const STEPS = [0.04, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600]

const label = (t: number) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const sec = Number.isInteger(s) ? String(s).padStart(2, '0') : s.toFixed(2).padStart(5, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

type Drag =
  | { kind: 'scrub' }
  | { kind: 'trim'; id: string; side: 'start' | 'end'; x0: number; v0: number }
  | { kind: 'move'; id: string; x0: number; dx: number; moved: boolean }

/**
 * Only what is on screen is ever drawn: ruler + waveform go into one
 * viewport-wide canvas, and only visible clips/thumbnails are mounted.
 * That keeps a 3 hour movie as cheap as a 10 second clip.
 */
export default function Timeline() {
  const { thumbs, thumbInterval, peaks, peaksVersion } = useProject()
  const clips = useEdit((s) => s.clips)
  const selectedId = useEdit((s) => s.selectedId)
  const edit = useEdit.getState
  const scroller = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const playhead = useRef<HTMLDivElement>(null)
  const [vw, setVw] = useState(800)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [zoom, setZoom] = useState(0) // 0 = whole video, 1 = single frames
  const [drag, setDrag] = useState<Drag | null>(null)
  const anchor = useRef<number | null>(null)

  const placed = useMemo(() => layout(clips), [clips])
  const duration = Math.max(0.1, totalDuration(clips))
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
      el.scrollLeft = anchor.current * pps - vw / 2
      anchor.current = null
    }
  }, [pps, vw])

  const visible = useMemo(
    () => placed.filter((p) => p.editEnd * pps >= scrollLeft - 50 && p.editStart * pps <= scrollLeft + vw + 50),
    [placed, pps, scrollLeft, vw],
  )

  // Ruler + waveform for the visible window only.
  useEffect(() => {
    const c = canvas.current!
    const dpr = window.devicePixelRatio || 1
    c.width = vw * dpr
    c.height = H * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, vw, H)
    const t0 = scrollLeft / pps, t1 = (scrollLeft + vw) / pps

    const step = STEPS.find((s) => s * pps >= 90) ?? STEPS[STEPS.length - 1]
    g.fillStyle = '#8b93a1'
    g.strokeStyle = '#2f343c'
    g.font = '11px system-ui'
    for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
      const x = Math.round(t * pps - scrollLeft) + 0.5
      g.beginPath(); g.moveTo(x, RULER_H - 8); g.lineTo(x, RULER_H); g.stroke()
      g.fillText(label(t), x + 4, 13)
    }

    if (peaks) {
      const mid = RULER_H + THUMB_H + WAVE_H / 2
      g.fillStyle = '#ff5a36'
      for (const p of visible) {
        const xa = Math.max(0, Math.floor(p.editStart * pps - scrollLeft))
        const xb = Math.min(vw, Math.ceil(p.editEnd * pps - scrollLeft))
        for (let x = xa; x < xb; x++) {
          const srcT = p.clip.start + (scrollLeft + x) / pps - p.editStart
          const a = Math.max(0, Math.floor(srcT * WAVE_BUCKETS_PER_SECOND))
          const b = Math.min(peaks.length, Math.max(a + 1, Math.floor((srcT + 1 / pps) * WAVE_BUCKETS_PER_SECOND)))
          let m = 0
          for (let i = a; i < b; i++) if (peaks[i] > m) m = peaks[i]
          const h = Math.max(m > 0 ? 1 : 0, Math.min(1, m * 1.4) * (WAVE_H - 6))
          if (h) g.fillRect(x, mid - h / 2, 1, h)
        }
      }
    }
  }, [vw, scrollLeft, pps, peaks, peaksVersion, visible])

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

  const setZoomKeepingPlayhead = (z: number) => { anchor.current = playback.time; setZoom(z) }

  // ---- pointer interactions -------------------------------------------------
  const innerRef = useRef<HTMLDivElement>(null)
  const timeAt = (clientX: number) => (clientX - innerRef.current!.getBoundingClientRect().left) / pps

  const onBackgroundDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    edit().select(null)
    playback.seek(timeAt(e.clientX))
    setDrag({ kind: 'scrub' })
  }

  const onClipDown = (e: React.PointerEvent, p: Placed) => {
    e.stopPropagation()
    innerRef.current!.setPointerCapture(e.pointerId)
    edit().select(p.clip.id)
    playback.seek(timeAt(e.clientX))
    setDrag({ kind: 'move', id: p.clip.id, x0: e.clientX, dx: 0, moved: false })
  }

  const onHandleDown = (e: React.PointerEvent, p: Placed, side: 'start' | 'end') => {
    e.stopPropagation()
    innerRef.current!.setPointerCapture(e.pointerId)
    edit().select(p.clip.id)
    edit().beginGesture()
    setDrag({ kind: 'trim', id: p.clip.id, side, x0: e.clientX, v0: side === 'start' ? p.clip.start : p.clip.end })
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    if (drag.kind === 'scrub') playback.seek(timeAt(e.clientX))
    else if (drag.kind === 'trim') edit().trimLive(drag.id, drag.side, drag.v0 + (e.clientX - drag.x0) / pps)
    else {
      const dx = e.clientX - drag.x0
      setDrag({ ...drag, dx, moved: drag.moved || Math.abs(dx) > 4 })
    }
  }

  const onUp = () => {
    if (drag?.kind === 'move' && drag.moved) {
      const p = placed.find((q) => q.clip.id === drag.id)!
      const center = ((p.editStart + p.editEnd) / 2) * pps + drag.dx
      const others = placed.filter((q) => q.clip.id !== drag.id)
      const toIndex = others.filter((q) => ((q.editStart + q.editEnd) / 2) * pps < center).length
      edit().moveClip(drag.id, toIndex)
    }
    setDrag(null)
  }

  const btn = 'btn disabled:opacity-40 disabled:pointer-events-none'
  const canSplit = true

  return (
    <div className="glass rounded-2xl p-3">
      <EditBar canSplit={canSplit} btn={btn} />
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
          ref={innerRef}
          className="relative select-none"
          style={{ width, height: H }}
          onPointerDown={onBackgroundDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <canvas ref={canvas} className="sticky left-0 top-0 block pointer-events-none" style={{ width: vw, height: H }} />
          {visible.map((p) => {
            const sel = p.clip.id === selectedId
            const moving = drag?.kind === 'move' && drag.id === p.clip.id && drag.moved
            const t0 = p.clip.start - thumbInterval, t1 = p.clip.end + thumbInterval
            return (
              <div
                key={p.clip.id}
                onPointerDown={(e) => onClipDown(e, p)}
                className={`absolute overflow-hidden rounded-md cursor-grab ${sel ? 'ring-2 ring-accent z-10' : 'ring-1 ring-white/20'} ${moving ? 'opacity-80 z-20' : ''}`}
                style={{
                  left: p.editStart * pps,
                  width: (p.editEnd - p.editStart) * pps,
                  top: RULER_H,
                  height: THUMB_H + WAVE_H,
                  transform: moving ? `translateX(${(drag as { dx: number }).dx}px)` : undefined,
                }}
              >
                {thumbs
                  .filter((t) => t.time >= t0 && t.time <= t1 && (p.editStart + (t.time - p.clip.start)) * pps > scrollLeft - 400 - thumbInterval * pps && (p.editStart + (t.time - p.clip.start)) * pps < scrollLeft + vw + 400 + thumbInterval * pps)
                  .map((t) => (
                    <div
                      key={t.time}
                      className="absolute bg-cover bg-center opacity-90 pointer-events-none"
                      style={{ left: (t.time - thumbInterval / 2 - p.clip.start) * pps, width: thumbInterval * pps, top: 0, height: THUMB_H, backgroundImage: `url(${t.url})` }}
                    />
                  ))}
                <div className="absolute left-0 top-0 h-full cursor-ew-resize bg-accent/70 hover:bg-accent" style={{ width: HANDLE }} onPointerDown={(e) => onHandleDown(e, p, 'start')} title="Drag to trim" />
                <div className="absolute right-0 top-0 h-full cursor-ew-resize bg-accent/70 hover:bg-accent" style={{ width: HANDLE }} onPointerDown={(e) => onHandleDown(e, p, 'end')} title="Drag to trim" />
              </div>
            )
          })}
          <div ref={playhead} className="absolute top-0 left-0 h-full w-0.5 bg-white pointer-events-none z-30">
            <div className="absolute -top-0.5 -left-1.5 w-3.5 h-3 rounded-sm bg-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

function EditBar({ btn }: { canSplit: boolean; btn: string }) {
  const { undo, redo, split, deleteSelected } = useEdit.getState()
  const selectedId = useEdit((s) => s.selectedId)
  const nClips = useEdit((s) => s.clips.length)
  const canUndo = useEdit((s) => s.past.length > 0)
  const canRedo = useEdit((s) => s.future.length > 0)
  return (
    <div className="flex items-center gap-2 pb-3">
      <button className={btn} title="Cut the video in two at the playhead (S)" onClick={() => split(playback.time)}>✂️ <span>Cut</span></button>
      <button className={btn} disabled={!selectedId || nClips <= 1} title="Delete the selected piece (Delete)" onClick={() => deleteSelected()}>🗑 <span>Delete</span></button>
      <span className="w-px h-6 bg-line mx-1" />
      <button className={btn} disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={() => undo()}>↶ <span>Undo</span></button>
      <button className={btn} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={() => redo()}>↷ <span>Redo</span></button>
      <span className="ml-auto text-xs text-muted hidden md:block">Click a piece to select it · drag its orange edges to trim · drag it sideways to move</span>
    </div>
  )
}
