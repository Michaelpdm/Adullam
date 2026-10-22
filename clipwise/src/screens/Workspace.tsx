import { useEffect } from 'react'
import { useApp } from '../store'
import { useProject } from '../project'
import Player from '../components/Player'
import Timeline from '../components/Timeline'

const gb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(0)} MB`)
const pct = (p: number) => `${Math.round(p * 100)}%`

function Bar({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-72 truncate text-muted">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: pct(progress) }} />
      </div>
    </div>
  )
}

async function pickVideo(): Promise<File | null> {
  try {
    const [h] = await (window as any).showOpenFilePicker({
      types: [{ description: 'Videos', accept: { 'video/*': ['.mp4', '.mov', '.mkv', '.webm', '.m4v'] } }],
    })
    return await h.getFile()
  } catch {
    return null // cancelled
  }
}

export default function Workspace({ title }: { title: string }) {
  const go = useApp((s) => s.go)
  const appFile = useApp((s) => s.file)
  const p = useProject()

  // A video dropped on the page (App.tsx) is picked up here.
  useEffect(() => {
    if (appFile && appFile !== p.file) p.load(appFile)
  }, [appFile])

  const open = async () => {
    const f = await pickVideo()
    if (f) { useApp.getState().setFile(f); p.load(f) }
  }

  if (!p.file) {
    return (
      <main className="min-h-full grid place-items-center px-6 text-center">
        <div className="glass rounded-3xl p-12 max-w-lg w-full border-dashed">
          <h1 className="text-3xl font-semibold mb-2">{title}</h1>
          <p className="text-muted mb-8">Drop a video anywhere on this page, or choose one.</p>
          <button onClick={open} className="btn btn-primary text-lg px-8 py-4">📁 Choose a video</button>
          <p className="text-xs text-muted/70 mt-6">🔒 Your video stays on this computer. Any size works.</p>
          <button onClick={() => go('home')} className="btn mt-6">← Back</button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-full flex flex-col gap-4 p-4">
      <header className="flex items-center gap-4">
        <button onClick={() => { p.close(); useApp.getState().setFile(null); go('home') }} className="btn" title="Back to start">← Home</button>
        <div className="min-w-0">
          <div className="font-medium truncate">{p.file.name}</div>
          <div className="text-xs text-muted">
            {gb(p.file.size)}
            {p.meta && ` · ${p.meta.width}×${p.meta.height} · ${Math.round(p.meta.duration / 60)} min`}
          </div>
        </div>
        <button onClick={open} className="btn ml-auto" title="Open a different video">📁 Open another</button>
      </header>

      {p.stage === 'error' && <p className="text-red-400">Couldn’t read this video: {p.error}</p>}
      {p.stage === 'reading' && <Bar label="Reading your video…" progress={0.05} />}

      {p.meta && (
        <>
          <section className="flex-1 min-h-0 flex"><div className="flex-1 min-w-0 flex"><div className="flex-1 min-h-0 flex flex-col"><Player /></div></div></section>
          <Timeline />
          <section className="grid gap-2">
            {p.thumbProgress < 1 && <Bar label="Making thumbnails…" progress={p.thumbProgress} />}
            {p.meta.hasAudio && p.waveProgress < 1 && <Bar label="Drawing the sound wave…" progress={p.waveProgress} />}
            {p.proxy === 'building' && <Bar label="Preparing your movie for smooth editing…" progress={p.proxyProgress} />}
            {p.proxy === 'ready' && <div className="text-sm text-muted">✅ Smooth preview ready. Exports always use your original quality.</div>}
            {p.proxy === 'failed' && <div className="text-sm text-muted">Smooth preview couldn’t be made; playing the original.</div>}
          </section>
        </>
      )}
    </main>
  )
}
