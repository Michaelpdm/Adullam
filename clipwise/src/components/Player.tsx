import { useEffect, useRef, useState } from 'react'
import { useProject } from '../project'
import { findAt, layout, totalDuration, useEdit } from '../edit'

/** Shared playhead, in EDIT time (seconds along the edited timeline). */
export const playback = { time: 0, seek: (_t: number) => {} }

const fmt = (t: number) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60)
  return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`
}

export default function Player() {
  const { originalUrl, proxyUrl, proxy } = useProject()
  const clips = useEdit((s) => s.clips)
  const ref = useRef<HTMLVideoElement>(null)
  const idx = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [undecodable, setUndecodable] = useState(false)
  const src = proxyUrl ?? originalUrl
  const total = totalDuration(clips)

  // Swap to the lightweight copy without losing the user's place.
  useEffect(() => {
    const v = ref.current
    if (!v || !src) return
    const t = v.currentTime, wasPlaying = !v.paused
    setUndecodable(false)
    v.src = src
    v.onloadedmetadata = () => {
      v.currentTime = t
      if (wasPlaying) v.play().catch(() => {})
    }
  }, [src])

  useEffect(() => {
    const v = ref.current!
    const placed = () => layout(useEdit.getState().clips)

    const seek = (t: number) => {
      const p = placed()
      if (!p.length) return
      const end = p[p.length - 1].editEnd
      t = Math.max(0, Math.min(t, end))
      idx.current = findAt(p, t)
      const cur = p[idx.current]
      v.currentTime = cur.clip.start + (t - cur.editStart)
      playback.time = t
      setTime(t)
    }
    playback.seek = seek

    let raf = 0
    const tick = () => {
      const p = placed()
      if (p.length && !v.paused) {
        let cur = p[Math.min(idx.current, p.length - 1)]
        if (v.currentTime >= cur.clip.end - 0.03) {
          const next = p[idx.current + 1]
          if (next) {
            idx.current++
            if (Math.abs(next.clip.start - v.currentTime) > 0.08) v.currentTime = next.clip.start
            cur = next
          } else {
            v.pause()
            playback.time = cur.editEnd
          }
        }
        if (!v.paused) playback.time = cur.editStart + Math.max(0, Math.min(v.currentTime - cur.clip.start, cur.clip.end - cur.clip.start))
      }
      setTime(playback.time)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // After an edit, keep the playhead on a valid spot (and show the frame there).
    const unsub = useEdit.subscribe((s, prev) => {
      if (s.clips !== prev.clips) seek(Math.min(playback.time, totalDuration(s.clips)))
    })
    return () => { cancelAnimationFrame(raf); unsub() }
  }, [])

  const toggle = () => {
    const v = ref.current!
    if (v.paused) {
      if (playback.time >= total - 0.05) playback.seek(0)
      v.play().catch(() => {})
    } else v.pause()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const ed = useEdit.getState()
      if (e.code === 'Space') { e.preventDefault(); toggle() }
      else if (e.code === 'ArrowLeft') playback.seek(playback.time - 5)
      else if (e.code === 'ArrowRight') playback.seek(playback.time + 5)
      else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) ed.split(playback.time)
      else if (e.code === 'Delete' || e.code === 'Backspace') ed.deleteSelected()
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? ed.redo() : ed.undo() }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); ed.redo() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  return (
    <div className="flex flex-col items-center gap-3 min-h-0 h-full">
      <div className="relative flex-1 min-h-0 w-full grid place-items-center bg-black rounded-2xl overflow-hidden">
        <video
          ref={ref}
          className="max-h-full max-w-full"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setUndecodable(true)}
          onClick={toggle}
          playsInline
        />
        {undecodable && (
          <div className="absolute inset-0 grid place-items-center bg-ink/90 text-center px-6">
            <p className="text-muted">
              {proxy === 'building'
                ? 'Preparing your video for smooth preview… this one needs a quick conversion first.'
                : 'This video can’t be previewed in your browser.'}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button onClick={() => playback.seek(time - 5)} className="btn" title="Back 5 seconds (←)">⏪ <span>Back 5s</span></button>
        <button onClick={toggle} className="btn btn-primary min-w-28" title="Play or pause (Space)">
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => playback.seek(time + 5)} className="btn" title="Forward 5 seconds (→)">⏩ <span>Forward 5s</span></button>
        <span className="tabular-nums text-muted text-sm">{fmt(time)} / {fmt(total)}</span>
      </div>
    </div>
  )
}
