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
