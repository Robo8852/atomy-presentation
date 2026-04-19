import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Star, X } from 'lucide-react'
import Fuse from 'fuse.js'
import { Input } from '@/components/ui/input'
import { useFavorites } from '@/hooks/useFavorites'
import { cn } from '@/lib/utils'

const norm = (s: string) =>
  s.normalize('NFKD').replace(/\p{Mn}/gu, '').toLowerCase()

const CATEGORIES = [
  'Consumibles',
  'Cuidado de la Piel',
  'Cuidado del Cabello',
  'Maquillaje',
  'Higiene Personal',
  'Hogar',
] as const
type Category = (typeof CATEGORIES)[number]

type CatalogEntry = {
  slug: string
  name: string
  kind?: string
  category?: Category | null
}

export function DeckList() {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  )
  const { favorites, isFavorite, toggle } = useFavorites()

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
      Category,
      number
    >
    for (const e of entries ?? []) {
      if (e.category && (CATEGORIES as readonly string[]).includes(e.category)) {
        counts[e.category as Category]++
      }
    }
    return counts
  }, [entries])

  const searchable = useMemo(
    () => (entries ?? []).map((d) => ({ ...d, _search: norm(d.name) })),
    [entries],
  )

  const fuse = useMemo(
    () =>
      new Fuse(searchable, {
        keys: ['_search'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [searchable],
  )

  const filteredEntries = useMemo<CatalogEntry[] | null>(() => {
    if (!entries) return null
    const q = query.trim()
    if (q === '') return entries
    return fuse.search(norm(q)).map((r) => {
      const { _search: _unused, ...rest } = r.item
      void _unused
      return rest as CatalogEntry
    })
  }, [entries, query, fuse])

  const categoryFilteredEntries = useMemo<CatalogEntry[] | null>(() => {
    if (!filteredEntries) return null
    if (selectedCategory === null) return filteredEntries
    return filteredEntries.filter(
      (e) =>
        e.slug === 'presentacion-de-productos' ||
        e.category === selectedCategory,
    )
  }, [filteredEntries, selectedCategory])

  const orderedEntries = useMemo(() => {
    if (!categoryFilteredEntries) return null
    const presentacion: CatalogEntry[] = []
    const favorited: CatalogEntry[] = []
    const rest: CatalogEntry[] = []
    for (const e of categoryFilteredEntries) {
      if (e.slug === 'presentacion-de-productos') presentacion.push(e)
      else if (favorites.has(e.slug)) favorited.push(e)
      else rest.push(e)
    }
    return [...presentacion, ...favorited, ...rest]
  }, [categoryFilteredEntries, favorites])

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
    <div className="relative min-h-[100svh] w-full bg-background text-foreground select-none">
      <header className="relative z-10 px-5 pt-8 pb-10 sm:px-10 sm:pt-14 sm:pb-16">
        <div className="flex items-center justify-between gap-4">
          <img
            src="/brand/logo.svg"
            alt="Atomy"
            className="h-10 w-auto sm:h-12"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground tabular-nums">
            decks · 2026
          </span>
        </div>

        <div className="mt-10 grid grid-cols-12 items-end gap-4 sm:mt-14">
          <h1 className="col-span-7 min-w-0 font-serif text-[clamp(2rem,6vw,4rem)] leading-[0.92] tracking-[-0.02em] text-foreground sm:col-span-8">
            Catálogo
          </h1>
          <div className="col-span-5 flex flex-col items-end text-right sm:col-span-4">
            <span className="font-serif text-[clamp(1.75rem,4.75vw,3.25rem)] leading-none tracking-tight tabular-nums text-foreground">
              {count > 0 ? count : '—'}
            </span>
            <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              decks disponibles
            </span>
          </div>
        </div>

        <div aria-hidden className="mt-8 h-[2px] w-24 bg-primary sm:mt-10" />

        <p className="mt-6 max-w-xl text-sm text-muted-foreground">
          Toca un deck para abrirlo. Desliza o usa las flechas para navegar.
        </p>
      </header>

      <div className="sticky top-0 z-20 backdrop-blur bg-background/80 supports-[backdrop-filter]:bg-background/60">
        <div className="relative px-5 pt-3 sm:px-10">
          <label className="relative block">
            <span className="sr-only">Buscar deck</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar deck..."
              autoComplete="off"
              className="h-11 pl-9 pr-12 text-base"
            />
            {query !== '' && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-0 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>
        <div className="overflow-x-auto px-5 py-3 sm:px-10">
          <div
            role="tablist"
            aria-label="Filtrar por categoría"
            className="flex snap-x gap-2"
          >
            <CategoryChip
              selected={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
            >
              Todos
            </CategoryChip>
            {CATEGORIES.map((c) => (
              <CategoryChip
                key={c}
                selected={selectedCategory === c}
                onClick={() =>
                  setSelectedCategory((prev) => (prev === c ? null : c))
                }
              >
                {c} ({categoryCounts[c]})
              </CategoryChip>
            ))}
          </div>
        </div>
      </div>

      <main className="relative z-10 px-5 pb-16 sm:px-10 sm:pb-24">
        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
            <div className="mb-1 uppercase tracking-[0.3em]">
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
                className="aspect-[4/3] animate-pulse bg-muted"
              />
            ))}
          </div>
        )}

        {!error && entries && entries.length === 0 && (
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            No decks in catalog.
          </div>
        )}

        {!error &&
          entries &&
          entries.length > 0 &&
          orderedEntries &&
          orderedEntries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin resultados para &ldquo;{query.trim()}&rdquo;
            </p>
          )}

        {!error && orderedEntries && orderedEntries.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence initial={false}>
              {orderedEntries.map((entry, i) => (
                <DeckCard
                  key={entry.slug}
                  entry={entry}
                  index={i}
                  favorited={isFavorite(entry.slug)}
                  onToggleFavorite={() => toggle(entry.slug)}
                />
              ))}
            </AnimatePresence>
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
      <div className="group relative block overflow-hidden border border-border bg-card transition-colors hover:border-foreground/40">
        <Link
          to={`/decks/${entry.slug}`}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {!loaded && (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}
            <img
              src={`/decks/${entry.slug}/slide-1.jpg`}
              alt=""
              draggable={false}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className="relative block h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">
                {entry.name}
              </div>
              {entry.kind && (
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  {entry.kind}
                </div>
              )}
            </div>
            <span
              aria-hidden
              className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors group-hover:text-primary"
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

function CategoryChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 shrink-0 snap-start items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-transparent text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

export default DeckList
