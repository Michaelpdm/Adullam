import { APP_NAME } from '../lib/config'

export default function Unsupported({ missing }: { missing: string[] }) {
  return (
    <main className="min-h-full grid place-items-center px-6 text-center">
      <div className="glass rounded-3xl p-10 max-w-md">
        <div className="text-5xl mb-4">🧭</div>
        <h1 className="text-2xl font-semibold mb-2">Open this in Chrome or Edge for the full editor.</h1>
        <p className="text-muted mb-6">
          {APP_NAME} uses your computer's video hardware, which Chrome and Edge support best.
        </p>
        <a
          href="https://www.google.com/chrome/"
          className="inline-block rounded-xl bg-accent px-6 py-3 font-medium text-white"
        >
          Get Chrome
        </a>
        <p className="mt-6 text-xs text-muted/70">Missing: {missing.join(', ')}</p>
      </div>
    </main>
  )
}
