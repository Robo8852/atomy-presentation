export type PriceItem = { label: string; usd: string; pv: string }
export type Price =
  | { usd: string; pv: string }
  | { items: PriceItem[] }

export function PriceChip({ price }: { price: Price | undefined }) {
  if (!price) return null

  const rows: PriceItem[] =
    'items' in price
      ? price.items
      : [{ label: '', usd: price.usd, pv: price.pv }]

  return (
    <div className="pointer-events-none flex flex-col gap-1 bg-primary px-4 py-2.5 text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)]">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-col leading-tight">
          {row.label && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/75">
              {row.label}
            </span>
          )}
          <span className="font-mono tabular-nums text-[17px]">
            <span className="font-semibold">{row.usd} USD</span>
            <span className="mx-1.5 text-white/60">·</span>
            <span className="text-white/80">{row.pv} PV</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default PriceChip
