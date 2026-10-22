import { useEffect, useRef, useState } from 'react'
import { useProject } from '../project'

export interface PlayerApi {
  seek: (t: number) => void
}

export const playback = { time: 0, seek: (_t: number) => {} }

const fmt = (t: number) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60)
  return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`
}

export default function Player() {
  const { originalUrl, proxyUrl, proxy, meta } = useProject()
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [undecodable, setUndecodable] = useState(false)
  const src = proxyUrl ?? originalUrl

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
    playback.seek = (t) => { v.currentTime = Math.max(0, Math.min(t, meta?.duration ?? t)); setTime(v.currentTime) }
    let raf = 0
    const tick = () => { playback.time = v.currentTime; setTime(v.currentTime); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.code === 'Space') { e.preventDefault(); v.paused ? v.play() : v.pause() }
      if (e.code === 'ArrowLeft') playback.seek(v.currentTime - 5)
      if (e.code === 'ArrowRight') playback.seek(v.currentTime + 5)
    }
    window.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key) }
  }, [meta])

  const toggle = () => { const v = ref.current!; v.paused ? v.play() : v.pause() }

  return (
    <div className="flex flex-col items-center gap-3 min-h-0">
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
        <span className="tabular-nums text-muted text-sm">{fmt(time)} / {fmt(meta?.duration ?? 0)}</span>
      </div>
    </div>
  )
}
