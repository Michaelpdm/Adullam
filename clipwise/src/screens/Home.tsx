import { motion } from 'framer-motion'
import { APP_NAME, TAGLINE } from '../lib/config'
import { useApp, type Screen } from '../store'

const choices: { screen: Screen; icon: string; title: string; sub: string }[] = [
  { screen: 'clips', icon: '✂️', title: 'Make Clips', sub: 'Turn a long video into short clips' },
  { screen: 'edit', icon: '🎬', title: 'Edit a Video', sub: 'Trim, add text, music and effects' },
]

export default function Home() {
  const go = useApp((s) => s.go)
  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 py-16 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-sm tracking-widest uppercase text-accent mb-4">{APP_NAME}</div>
        <h1 className="text-4xl md:text-6xl font-semibold mb-3">What do you want to do?</h1>
        <p className="text-muted mb-12">🔒 {TAGLINE} Free. No sign up.</p>
      </motion.div>
      <div className="grid gap-6 md:grid-cols-2 w-full max-w-3xl">
        {choices.map((c, i) => (
          <motion.button
            key={c.screen}
            onClick={() => go(c.screen)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="glass rounded-3xl p-10 text-left hover:border-accent/60 transition-colors cursor-pointer"
          >
            <div className="text-5xl mb-5">{c.icon}</div>
            <div className="text-2xl font-semibold">{c.title}</div>
            <div className="text-muted mt-1">{c.sub}</div>
          </motion.button>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">Tip: you can also drop a video anywhere on this page.</p>
    </main>
  )
}
