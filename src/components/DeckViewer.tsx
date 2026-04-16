import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'

type Manifest = { name: string; slideCount: number }

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

const SWIPE_POWER = (offset: number, velocity: number) =>
  Math.abs(offset) * 0.6 + Math.abs(velocity) * 0.35

const CONTROLS_IDLE_MS = 2600

export function DeckViewer({ slug }: { slug: string }) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [loadedMap, setLoadedMap] = useState<Record<number, boolean>>({})

  const rootRef = useRef<HTMLDivElement>(null)
  const idleTimer = useRef<number | null>(null)

  // ── Fetch manifest ────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController()
    setManifest(null)
    setError(null)
    setCurrent(0)
    setLoadedMap({})
    fetch(`/decks/${slug}/manifest.json`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`manifest ${r.status}`)
        return r.json() as Promise<Manifest>
      })
      .then((m) => setManifest(m))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(String(e.message ?? e))
      })
    return () => ac.abort()
  }, [slug])

  const slides = useMemo(() => {
    if (!manifest) return [] as string[]
    return Array.from(
      { length: manifest.slideCount },
      (_, i) => `/decks/${slug}/slide-${i + 1}.jpg`,
    )
  }, [manifest, slug])

  const total = slides.length
  const goto = useCallback(
    (next: number) => {
      if (total === 0) return
      const clamped = Math.max(0, Math.min(total - 1, next))
      setDirection((prev) => {
        if (clamped === current) return prev
        return clamped > current ? 1 : -1
      })
      setCurrent(clamped)
    },
    [current, total],
  )
  const next = useCallback(() => goto(current + 1), [current, goto])
  const prev = useCallback(() => goto(current - 1), [current, goto])

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'Spacebar':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          prev()
          break
        case 'Home':
          e.preventDefault()
          goto(0)
          break
        case 'End':
          e.preventDefault()
          goto(total - 1)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, goto, total])

  // ── Fullscreen ────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument
    const el = rootRef.current as FullscreenElement | null
    if (!el) return
    const active = doc.fullscreenElement || doc.webkitFullscreenElement
    try {
      if (!active) {
        if (el.requestFullscreen) await el.requestFullscreen()
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      } else {
        if (doc.exitFullscreen) await doc.exitFullscreen()
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
      }
    } catch {
      /* user-gesture / permission hiccups — ignore */
    }
  }, [])

  useEffect(() => {
    const doc = document as FullscreenDocument
    const sync = () => {
      setIsFullscreen(
        Boolean(doc.fullscreenElement || doc.webkitFullscreenElement),
      )
    }
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  // ── Auto-hide chrome ──────────────────────────────────────────────
  const pokeChrome = useCallback(() => {
    setChromeVisible(true)
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      CONTROLS_IDLE_MS,
    )
  }, [])

  useEffect(() => {
    pokeChrome()
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [pokeChrome, current])

  // ── Drag handler ──────────────────────────────────────────────────
  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const power = SWIPE_POWER(info.offset.x, info.velocity.x)
    if (power > 140) {
      if (info.offset.x < 0) next()
      else prev()
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  const title = manifest?.name ?? '···'
  const counterCurrent = total > 0 ? String(current + 1).padStart(2, '0') : '--'
  const counterTotal = total > 0 ? String(total).padStart(2, '0') : '--'
  const progress = total > 1 ? current / (total - 1) : 0

  return (
    <div
      ref={rootRef}
      onMouseMove={pokeChrome}
      onTouchStart={pokeChrome}
      onClick={pokeChrome}
      className="relative h-[100svh] w-full overflow-hidden bg-black text-neutral-300 select-none [--chrome-ease:cubic-bezier(0.22,1,0.36,1)]"
      style={{ cursor: chromeVisible ? 'default' : 'none' }}
    >
      {/* grain + vignette atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.9 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* Top bar (overlay) */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{
          y: chromeVisible ? 0 : -32,
          opacity: chromeVisible ? 1 : 0,
        }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-3 pb-3 sm:px-8 sm:pt-5"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            aria-hidden
            className="inline-block h-[9px] w-[9px] rounded-full bg-red-500/90 shadow-[0_0_18px_rgba(239,68,68,0.65)]"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-500">
            Atomy · Deck
          </span>
          <span className="hidden sm:inline-block h-3 w-px bg-neutral-700" />
          <h1 className="truncate text-[11px] sm:text-xs uppercase tracking-[0.32em] text-neutral-100 font-medium">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-5 sm:gap-7">
          <div className="font-mono text-[11px] sm:text-xs tabular-nums text-neutral-400">
            <span className="text-neutral-100">{counterCurrent}</span>
            <span className="mx-1.5 text-neutral-600">/</span>
            <span>{counterTotal}</span>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="group relative grid h-11 w-11 place-items-center rounded-full border border-neutral-800 bg-neutral-900/40 text-neutral-300 backdrop-blur-sm transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </motion.header>

      {/* Progress rail (overlay, pinned under top bar) */}
      <motion.div
        initial={false}
        animate={{ opacity: chromeVisible ? 1 : 0 }}
        transition={{ duration: 0.45 }}
        className="pointer-events-none absolute inset-x-4 top-[54px] z-20 sm:inset-x-8 sm:top-[72px]"
      >
        <div className="h-px w-full bg-neutral-800/70">
          <motion.div
            className="h-px origin-left bg-gradient-to-r from-neutral-500 to-neutral-100"
            initial={false}
            animate={{ scaleX: progress }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%' }}
          />
        </div>
      </motion.div>

      {/* Stage — fills full viewport */}
      <div className="absolute inset-0 overflow-hidden">
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center font-mono text-xs text-red-400/80">
            <div>
              <div className="mb-2 uppercase tracking-[0.3em] text-red-500/70">
                Load error
              </div>
              <div className="opacity-80">{error}</div>
            </div>
          </div>
        )}

        {!error && total > 0 && (
          <>
            {/* Desktop edge arrows */}
            <ArrowEdge
              side="left"
              visible={chromeVisible && current > 0}
              onClick={prev}
            />
            <ArrowEdge
              side="right"
              visible={chromeVisible && current < total - 1}
              onClick={next}
            />

            {/* Swipe surface */}
            <motion.div
              className="absolute inset-0 touch-pan-y"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
            >
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={current}
                  custom={direction}
                  variants={{
                    enter: (d: number) => ({
                      x: d > 0 ? '6%' : '-6%',
                      opacity: 0,
                      scale: 0.985,
                    }),
                    center: { x: 0, opacity: 1, scale: 1 },
                    exit: (d: number) => ({
                      x: d > 0 ? '-6%' : '6%',
                      opacity: 0,
                      scale: 0.985,
                    }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 260, damping: 32 },
                    opacity: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                    scale: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
                  }}
                  className="absolute inset-0 grid place-items-center p-2 sm:p-6"
                >
                  <figure className="relative flex h-full w-full items-center justify-center">
                    {!loadedMap[current] && (
                      <div className="absolute inset-4 animate-pulse rounded-md bg-neutral-900/40" />
                    )}
                    <img
                      src={slides[current]}
                      alt={`${title} — slide ${current + 1} of ${total}`}
                      draggable={false}
                      onLoad={() =>
                        setLoadedMap((m) => ({ ...m, [current]: true }))
                      }
                      className="block max-h-full max-w-full rounded-[2px] object-contain shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]"
                    />
                  </figure>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Preload neighbors */}
            <div aria-hidden className="hidden">
              {[current - 1, current + 1].map((i) =>
                i >= 0 && i < total ? (
                  <img key={i} src={slides[i]} alt="" />
                ) : null,
              )}
            </div>
          </>
        )}
      </div>

      {/* Dots (overlay) */}
      <motion.footer
        initial={{ y: 24, opacity: 0 }}
        animate={{
          y: chromeVisible ? 0 : 32,
          opacity: chromeVisible ? 1 : 0,
        }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 px-4 pt-6 pb-3 sm:pb-5"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        {slides.map((_, i) => {
          const active = i === current
          return (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => goto(i)}
              className="group relative grid h-11 w-6 place-items-center focus:outline-none"
            >
              <span
                className={
                  'block transition-all duration-500 ease-out ' +
                  (active
                    ? 'h-[3px] w-5 rounded-full bg-neutral-100'
                    : 'h-[3px] w-2.5 rounded-full bg-neutral-700 group-hover:bg-neutral-400')
                }
              />
            </button>
          )
        })}
      </motion.footer>

      {/* Corner keyboard hint (desktop, fades out with chrome) */}
      <motion.div
        aria-hidden
        animate={{ opacity: chromeVisible ? 0.55 : 0 }}
        transition={{ duration: 0.4 }}
        className="pointer-events-none absolute bottom-5 right-6 z-20 hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-600"
      >
        <kbd className="rounded border border-neutral-800 bg-neutral-900/60 px-1.5 py-0.5">←</kbd>
        <kbd className="rounded border border-neutral-800 bg-neutral-900/60 px-1.5 py-0.5">→</kbd>
        <span>navigate</span>
      </motion.div>
    </div>
  )
}

function ArrowEdge({
  side,
  visible,
  onClick,
}: {
  side: 'left' | 'right'
  visible: boolean
  onClick: () => void
}) {
  const isLeft = side === 'left'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? 'Previous slide' : 'Next slide'}
      tabIndex={-1}
      className={
        'group absolute top-0 z-10 hidden h-full w-24 items-center md:flex ' +
        (isLeft ? 'left-0 justify-start pl-4' : 'right-0 justify-end pr-4')
      }
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <span
        className={
          'grid h-12 w-12 place-items-center rounded-full border border-neutral-800 bg-neutral-950/60 text-neutral-400 backdrop-blur-sm transition-all duration-300 ease-out ' +
          (visible
            ? 'opacity-0 group-hover:opacity-100 group-hover:border-neutral-600 group-hover:text-white group-hover:scale-105'
            : 'opacity-0')
        }
      >
        {isLeft ? (
          <ChevronLeft className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </span>
    </button>
  )
}

export default DeckViewer
