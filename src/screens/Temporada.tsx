import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ahora, type Prenda, type Temporada as T } from '../db'
import { Pantalla, Titulo, Tarjeta, Boton, Volver } from '../components/ui'
import { FotoPrenda, avisar } from '../components/comunes'
import { TEMPORADAS, ICONO_TEMPORADA, temporadaActual, mesesDe } from '../lib/temporadas'

type Pestana = 'sacar' | 'guardar' | 'queda' | 'siempre'

export default function Temporada({ volver }: { volver: () => void }) {
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const hem = perfil?.hemisferio ?? 'Norte'
  const actual = temporadaActual(hem)
  const [elegida, setElegida] = useState<T>()
  const t = elegida ?? actual
  const [pestana, setPestana] = useState<Pestana>('guardar')
  const prendas = useLiveQuery(
    () => db.prendas.filter((p) => !p.pendienteRevision && (p.estado === 'Activa' || p.estado === 'Guardada')).toArray(),
    [],
    [],
  )

  const grupos: Record<Pestana, Prenda[]> = {
    sacar: prendas.filter((p) => !p.atemporal && p.temporadas.includes(t) && p.estado === 'Guardada'),
    guardar: prendas.filter((p) => !p.atemporal && !p.temporadas.includes(t) && p.estado === 'Activa'),
    queda: prendas.filter((p) => !p.atemporal && p.temporadas.includes(t) && p.estado === 'Activa'),
    siempre: prendas.filter((p) => p.atemporal),
  }

  const PESTANAS: { k: Pestana; icono: string; texto: string }[] = [
    { k: 'guardar', icono: '📦', texto: 'Guardar' },
    { k: 'sacar', icono: '📤', texto: 'Sacar' },
    { k: 'queda', icono: '✅', texto: 'Se Queda' },
    { k: 'siempre', icono: '♾️', texto: 'Siempre' },
  ]

  async function mover(lista: Prenda[], a: 'Guardada' | 'Activa') {
    await db.prendas.bulkPut(
      lista.map((p) => ({ ...p, estado: a, ubicacion: a === 'Guardada' ? 'Caja Guardada' : 'Clóset', actualizadoEn: ahora() })),
    )
    avisar(a === 'Guardada' ? `📦 ${lista.length} guardadas` : `📤 ${lista.length} al clóset`)
  }

  const lista = grupos[pestana]
  const accion = pestana === 'guardar' ? 'Guardada' : pestana === 'sacar' ? 'Activa' : null

  return (
    <Pantalla>
      <Volver onClick={volver} />
      <Titulo sub="Lo que va en tu clóset y lo que va a la caja">Temporada</Titulo>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {TEMPORADAS.map((x) => (
          <button
            key={x}
            onClick={() => setElegida(x)}
            className={`rounded-2xl py-3 flex flex-col items-center border-2 ${x === t ? 'bg-tinta text-white border-tinta' : 'bg-white border-rosa-100'}`}
          >
            <span className="text-2xl">{ICONO_TEMPORADA[x]}</span>
            <span className="text-[11px] font-bold uppercase">{x}</span>
            {x === actual && <span className={`text-[9px] ${x === t ? 'text-white/70' : 'text-neutral-400'}`}>AHORA</span>}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-neutral-500 mb-4">
        {ICONO_TEMPORADA[t]} {t} · {mesesDe(t, hem)} · Hemisferio {hem}
      </p>

      <div className="grid grid-cols-4 gap-1 bg-white rounded-2xl p-1 border border-rosa-100 mb-4">
        {PESTANAS.map((x) => (
          <button
            key={x.k}
            onClick={() => setPestana(x.k)}
            className={`rounded-xl py-2 flex flex-col items-center ${pestana === x.k ? 'bg-rosa-200' : ''}`}
          >
            <span className="text-lg">{x.icono}</span>
            <span className="text-[10px] font-bold uppercase">{x.texto}</span>
            <span className="text-xs font-semibold">{grupos[x.k].length}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <Tarjeta className="text-center">
          <div className="text-4xl mb-2">✨</div>
          <p className="text-neutral-600">{pestana === 'guardar' ? 'Nada que guardar. ¡Clóset al día!' : 'Nada por aquí.'}</p>
        </Tarjeta>
      ) : (
        <>
          {accion && (
            <Boton icono={accion === 'Guardada' ? '📦' : '📤'} className="mb-3" onClick={() => mover(lista, accion)}>
              {accion === 'Guardada' ? `Ya Guardé Todo (${lista.length})` : `Ya Saqué Todo (${lista.length})`}
            </Boton>
          )}
          <div className="grid grid-cols-3 gap-2">
            {lista.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-rosa-100 p-1.5 flex flex-col">
                <FotoPrenda prenda={p} className="w-full aspect-square" />
                <p className="text-[11px] font-semibold leading-tight px-1 mt-1 line-clamp-2">{p.nombre}</p>
                {pestana === 'siempre' && p.motivoAtemporal && <p className="text-[10px] text-neutral-400 px-1">{p.motivoAtemporal}</p>}
                {accion && (
                  <button onClick={() => mover([p], accion)} className="mt-1 h-8 rounded-xl bg-rosa-100 text-xs font-bold">
                    {accion === 'Guardada' ? '📦 Listo' : '📤 Listo'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Pantalla>
  )
}
