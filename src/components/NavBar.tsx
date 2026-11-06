export type Ruta = 'inicio' | 'closet' | 'agregar' | 'outfits' | 'perfil' | 'ajustes' | 'temporada' | 'compras' | 'maleta'

const items: { ruta: Ruta; icono: string; texto: string }[] = [
  { ruta: 'inicio', icono: '🏠', texto: 'Inicio' },
  { ruta: 'closet', icono: '👗', texto: 'Clóset' },
  { ruta: 'agregar', icono: '➕', texto: 'Agregar' },
  { ruta: 'outfits', icono: '✨', texto: 'Outfits' },
  { ruta: 'perfil', icono: '🐱', texto: 'Perfil' },
]

export default function NavBar({ actual, ir }: { actual: Ruta; ir: (r: Ruta) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-rosa-100 safe-bottom z-20">
      <ul className="max-w-xl mx-auto grid grid-cols-5 pt-2">
        {items.map((it) => {
          const activo = it.ruta === actual
          const central = it.ruta === 'agregar'
          return (
            <li key={it.ruta} className="flex justify-center">
              <button
                onClick={() => ir(it.ruta)}
                className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide ${activo ? 'text-tinta' : 'text-neutral-400'}`}
              >
                <span
                  className={`flex items-center justify-center text-xl ${central ? 'w-12 h-12 -mt-5 rounded-full bg-tinta text-white shadow-lg' : 'w-8 h-8'}`}
                >
                  {it.icono}
                </span>
                {it.texto}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
