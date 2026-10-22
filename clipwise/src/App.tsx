import { useEffect, useState } from 'react'
import { checkBrowserSupport } from './lib/browserSupport'
import { useApp } from './store'
import Home from './screens/Home'
import Workspace from './screens/Workspace'
import Unsupported from './screens/Unsupported'

export default function App() {
  const support = checkBrowserSupport()
  const { screen, go, setFile } = useApp()
  const [dragging, setDragging] = useState(false)

  // Drop a video anywhere on the page to start.
  useEffect(() => {
    const over = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false) }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer?.files?.[0]
      if (f && f.type.startsWith('video/')) {
        setFile(f)
        if (useApp.getState().screen === 'home') go('edit')
      }
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [go, setFile])

  if (!support.ok) return <Unsupported missing={support.missing} />

  return (
    <>
      {screen === 'home' && <Home />}
      {screen === 'clips' && <Workspace title="Make Clips" />}
      {screen === 'edit' && <Workspace title="Edit a Video" />}
      {dragging && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 border-4 border-dashed border-accent text-2xl font-semibold pointer-events-none">
          Drop your video here
        </div>
      )}
    </>
  )
}
