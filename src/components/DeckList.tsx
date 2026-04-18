import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { cn } from '@/lib/utils'

type CatalogEntry = { slug: string; name: string; kind?: string }

export function DeckList() {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { isFavorite, toggle } = useFavorites()

  useEffect(() => {
    const ac = new AbortController()
    fetch('/decks/catalog.json', { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`catalog ${r.status}`)
        return r.json() as Promise<CatalogEntry[]>
      })
      .then((data) => setEntries(data))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(String(e.message ?? e))
      })
    return () => ac.abort()
  }, [])

  const count = entries?.length ?? 0

  return (
    <div className="relative min-h-[100svh] w-full bg-black text-neutral-300 select-none">
      {/* grain + vignette atmosphere (same language as DeckViewer) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.9 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 30%, transparent 55%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      <header className="relative z-10 flex flex-col gap-2 px-5 pt-8 pb-6 sm:px-10 sm:pt-12 sm:pb-10">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-[9px] w-[9px] rounded-full bg-red-500/90 shadow-[0_0_18px_rgba(239,68,68,0.65)]"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
            Atomy · Decks
          </span>
          <span className="hidden sm:inline-block h-3 w-px bg-neutral-700" />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-600 tabular-nums">
            {count > 0 ? String(count).padStart(2, '0') : '--'} available
          </span>
        </div>
        <h1 className="text-xl sm:text-3xl font-medium tracking-tight text-neutral-100">
          Presentation library
        </h1>
        <p className="max-w-xl text-sm text-neutral-500">
          Tap a deck to open the full-screen viewer. Swipe or use the arrow keys
          to navigate slides.
        </p>
      </header>

      <main className="relative z-10 px-5 pb-16 sm:px-10 sm:pb-24">
        {error && (
          <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 font-mono text-xs text-red-400/80">
            <div className="mb-1 uppercase tracking-[0.3em] text-red-500/70">
              Catalog load error
            </div>
            <div className="opacity-80">{error}</div>
          </div>
        )}

        {!error && entries === null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] animate-pulse rounded-md bg-neutral-900/40"
              />
            ))}
          </div>
        )}

        {!error && entries && entries.length === 0 && (
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-600">
            No decks in catalog.
          </div>
        )}

        {!error && entries && entries.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {entries.map((entry, i) => (
              <DeckCard
                key={entry.slug}
                entry={entry}
                index={i}
                favorited={isFavorite(entry.slug)}
                onToggleFavorite={() => toggle(entry.slug)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function DeckCard({
  entry,
  index,
  favorited,
  onToggleFavorite,
}: {
  entry: CatalogEntry
  index: number
  favorited: boolean
  onToggleFavorite: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.035, 0.35),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="group relative block overflow-hidden rounded-md border border-neutral-900 bg-neutral-950/60 transition-colors hover:border-neutral-700">
        <Link
          to={`/decks/${entry.slug}`}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900/40">
            {!loaded && (
              <div className="absolute inset-0 animate-pulse bg-neutral-900/50" />
            )}
            <img
              src={`/decks/${entry.slug}/slide-1.jpg`}
              alt=""
              draggable={false}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className="relative block h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)',
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-100">
                {entry.name}
              </div>
              {entry.kind && (
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-600">
                  {entry.kind}
                </div>
              )}
            </div>
            <span
              aria-hidden
              className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-600 transition-colors group-hover:text-neutral-300"
            >
              Open →
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite()
          }}
          aria-label={favorited ? 'Quitar de favoritos' : 'Marcar como favorito'}
          aria-pressed={favorited}
          className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Star
            className={cn(
              'h-5 w-5 transition-colors',
              favorited
                ? 'fill-primary text-primary'
                : 'fill-transparent text-muted-foreground',
            )}
            strokeWidth={1.75}
          />
        </button>
      </div>
    </motion.li>
  )
}

export default DeckList
