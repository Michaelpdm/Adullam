import { useState } from 'react'
import { useExport } from '../project'
import { useEdit, totalDuration } from '../edit'
import { EXPORT_PRESETS, type ExportPreset } from '../lib/mediaProtocol'

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const [preset, setPreset] = useState<ExportPreset>('youtube')
  const ex = useExport()
  const clips = useEdit((s) => s.clips)
  const mins = Math.round(totalDuration(clips) / 6) / 10

  const close = () => { if (ex.stage !== 'running') { ex.reset(); onClose() } }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-4" onClick={close}>
      <div className="glass bg-panel rounded-3xl p-8 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        {ex.stage === 'idle' && (
          <>
            <h2 className="text-2xl font-semibold mb-1">Where is this video going?</h2>
            <p className="text-muted mb-6">We’ll pick the best settings. Your video is {mins} min long.</p>
            <div className="grid gap-3 mb-6">
              {(Object.keys(EXPORT_PRESETS) as ExportPreset[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setPreset(k)}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left cursor-pointer ${preset === k ? 'border-accent bg-accent/10' : 'border-line hover:bg-white/5'}`}
                >
                  <span className="text-3xl">{EXPORT_PRESETS[k].icon}</span>
                  <span>
                    <span className="block font-medium">{EXPORT_PRESETS[k].label}</span>
                    <span className="block text-sm text-muted">{EXPORT_PRESETS[k].sub}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn" onClick={close}>Cancel</button>
              <button className="btn btn-primary px-6" onClick={() => ex.start(preset)}>💾 Choose where to save</button>
            </div>
          </>
        )}
        {ex.stage === 'running' && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Exporting your video…</h2>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-2">
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(ex.progress * 100)}%` }} />
            </div>
            <p className="text-muted mb-6">{Math.round(ex.progress * 100)}% · saving straight to your computer. Keep this tab open.</p>
            <button className="btn" onClick={() => ex.cancel()}>Stop</button>
          </>
        )}
        {ex.stage === 'done' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">✅ All done!</h2>
            <p className="text-muted mb-6">Saved as {ex.fileName}.</p>
            <button className="btn btn-primary px-6" onClick={close}>Close</button>
          </>
        )}
        {ex.stage === 'error' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-red-400 mb-6">{ex.error}</p>
            <button className="btn" onClick={() => ex.reset()}>Try again</button>
          </>
        )}
      </div>
    </div>
  )
}
