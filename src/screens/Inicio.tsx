import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Boton, Tarjeta, Pantalla } from '../components/ui'
import type { Ruta } from '../components/NavBar'

export default function Inicio({ ir }: { ir: (r: Ruta) => void }) {
  const total = useLiveQuery(() => db.prendas.count(), [], 0)
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const apodo = perfil?.apodo || 'Gatita'

  return (
    <Pantalla>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-widest">Miau Clóset</p>
          <h1 className="font-display text-3xl">Hola, {apodo} 🐾</h1>
        </div>
        <button onClick={() => ir('ajustes')} className="w-11 h-11 rounded-full bg-white border border-rosa-100 text-xl" aria-label="Ajustes">
          ⚙️
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Dato valor={total} texto="Prendas" />
        <Dato valor={0} texto="Outfits Guardados" />
      </div>

      {total === 0 ? (
        <Tarjeta className="space-y-4 text-center">
          <div className="text-5xl">👗</div>
          <h2 className="text-xl font-semibold">Tu Clóset Está Vacío</h2>
          <p className="text-neutral-600">Sube tus prendas en lote: elige varias fotos de tu galería y la IA llena las fichas por ti.</p>
          <Boton onClick={() => ir('agregar')} icono="➕">
            Cargar Mis Prendas
          </Boton>
        </Tarjeta>
      ) : (
        <Tarjeta className="space-y-3">
          <h2 className="font-semibold uppercase tracking-wide text-sm">✨ Outfit del Día</h2>
          <Boton onClick={() => ir('outfits')}>Ver Mi Outfit</Boton>
        </Tarjeta>
      )}
    </Pantalla>
  )
}

function Dato({ valor, texto }: { valor: number; texto: string }) {
  return (
    <div className="bg-white rounded-3xl p-4 border border-rosa-100">
      <p className="font-display text-3xl">{valor}</p>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{texto}</p>
    </div>
  )
}
