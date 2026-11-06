import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'principal' | 'secundario' | 'suave' | 'peligro'

const estilos: Record<Variante, string> = {
  principal: 'bg-tinta text-white active:bg-black',
  secundario: 'bg-white text-tinta border-2 border-tinta active:bg-rosa-100',
  suave: 'bg-rosa-200 text-tinta active:bg-rosa-300',
  peligro: 'bg-white text-rosa-500 border-2 border-rosa-300',
}

export function Boton({
  variante = 'principal',
  icono,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icono?: ReactNode }) {
  return (
    <button
      className={`w-full min-h-14 rounded-2xl px-5 font-semibold tracking-wide flex items-center justify-center gap-2 transition disabled:opacity-40 ${estilos[variante]} ${className}`}
      {...props}
    >
      {icono && <span className="text-xl leading-none">{icono}</span>}
      {children}
    </button>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-3xl p-5 shadow-sm border border-rosa-100 ${className}`}>{children}</div>
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="font-display text-3xl uppercase tracking-wider">{children}</h1>
      {sub && <p className="text-sm text-neutral-500 mt-1">{sub}</p>}
    </header>
  )
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'ok' | 'error'; children: ReactNode }) {
  const c = { info: 'bg-rosa-100', ok: 'bg-emerald-50 text-emerald-800', error: 'bg-red-50 text-red-700' }[tipo]
  return <div className={`rounded-2xl px-4 py-3 text-sm ${c}`}>{children}</div>
}

export function Pantalla({ children }: { children: ReactNode }) {
  return <main className="safe-top px-5 pb-28 max-w-xl mx-auto">{children}</main>
}

/* ---------- Hoja inferior (modal móvil) ---------- */
export function Hoja({ abierta, alCerrar, titulo, children }: { abierta: boolean; alCerrar: () => void; titulo?: ReactNode; children: ReactNode }) {
  if (!abierta) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button aria-label="Cerrar" onClick={alCerrar} className="absolute inset-0 bg-black/40 animate-[fade_.2s]" />
      <div className="relative w-full max-w-xl bg-rosa-50 rounded-t-[2rem] p-5 safe-bottom max-h-[92vh] overflow-y-auto animate-[subir_.25s_ease-out]">
        <div className="w-12 h-1.5 rounded-full bg-rosa-200 mx-auto mb-4" />
        {titulo && <h2 className="font-display text-2xl uppercase tracking-wider mb-4 text-center">{titulo}</h2>}
        {children}
      </div>
    </div>
  )
}

/* ---------- Chips seleccionables ---------- */
export function Chips<T extends string>({
  opciones,
  valor,
  alCambiar,
  multiple = false,
  iconos,
  fila = false,
}: {
  fila?: boolean
  opciones: readonly T[]
  valor: T[] | T | undefined
  alCambiar: (v: T[]) => void
  multiple?: boolean
  iconos?: Partial<Record<T, string>>
}) {
  const sel = Array.isArray(valor) ? valor : valor ? [valor] : []
  return (
    <div className={`flex gap-2 ${fila ? 'flex-nowrap' : 'flex-wrap'}`}>
      {opciones.map((o) => {
        const activo = sel.includes(o)
        return (
          <button
            key={o}
            onClick={() => alCambiar(multiple ? (activo ? sel.filter((x) => x !== o) : [...sel, o]) : activo ? [] : [o])}
            className={`shrink-0 whitespace-nowrap px-4 h-10 rounded-full text-sm font-semibold border-2 transition ${
              activo ? 'bg-tinta text-white border-tinta' : 'bg-white border-rosa-200 text-neutral-700'
            }`}
          >
            {iconos?.[o] && <span className="mr-1">{iconos[o]}</span>}
            {o}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Cargando ---------- */
export function Cargando({ texto }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-neutral-500">
      <div className="text-4xl animate-bounce">🐾</div>
      {texto && <p className="text-sm font-semibold uppercase tracking-wide">{texto}</p>}
    </div>
  )
}

/* ---------- Botón cuadrado con icono (menús) ---------- */
export function Mosaico({ icono, texto, sub, onClick, destacado }: { icono: string; texto: string; sub?: string; onClick: () => void; destacado?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-3xl p-4 text-left flex flex-col gap-2 border transition active:scale-[.98] ${
        destacado ? 'bg-tinta text-white border-tinta' : 'bg-white border-rosa-100'
      }`}
    >
      <span className="text-3xl">{icono}</span>
      <span className="font-semibold uppercase tracking-wide text-sm leading-tight">{texto}</span>
      {sub && <span className={`text-xs ${destacado ? 'text-white/70' : 'text-neutral-500'}`}>{sub}</span>}
    </button>
  )
}

/* ---------- Encabezado con volver ---------- */
export function Volver({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-10 px-4 -ml-2 rounded-full text-sm font-semibold uppercase tracking-wide mb-2 active:bg-rosa-100">
      ← Volver
    </button>
  )
}
