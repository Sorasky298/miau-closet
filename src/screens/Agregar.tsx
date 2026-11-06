import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ahora, leerAjuste, guardarAjuste, type Prenda } from '../db'
import { Pantalla, Titulo, Tarjeta, Boton, Aviso } from '../components/ui'
import { BotonArchivo, FotoPrenda, avisar } from '../components/comunes'
import EditorPrenda from '../components/EditorPrenda'
import { cargarFotos, cargarFotoGrupal, useCarga } from '../lib/procesador'
import { ICONO_TEMPORADA } from '../lib/temporadas'
import { registrarBorrado } from '../lib/sync'
import { obtenerLlave } from '../lib/gemini'

export default function Agregar({ irAjustes }: { irAjustes: () => void }) {
  const carga = useCarga()
  const pendientes = useLiveQuery(() => db.prendas.filter((p) => p.pendienteRevision).toArray(), [], [])
  const [editando, setEditando] = useState<Prenda | null>(null)
  const [fondo, setFondo] = useState(true)
  const [tieneLlave, setTieneLlave] = useState(true)

  useEffect(() => {
    leerAjuste('quitarFondo', true).then(setFondo)
    obtenerLlave().then((k) => setTieneLlave(Boolean(k)))
  }, [])

  const listas = pendientes.filter((p) => p.nombre !== 'Analizando…')

  async function aceptarTodas() {
    await db.prendas.bulkPut(listas.map((p) => ({ ...p, pendienteRevision: false, actualizadoEn: ahora() })))
    avisar(`✓ ${listas.length} prendas en tu clóset`)
  }

  async function borrar(p: Prenda) {
    await db.prendas.delete(p.id)
    await registrarBorrado('prendas', p.id)
  }

  return (
    <Pantalla>
      <Titulo sub="Sube varias a la vez. La IA llena las fichas.">Agregar</Titulo>

      {!tieneLlave && (
        <div className="mb-4">
          <Aviso tipo="error">
            Conecta tu IA para analizar prendas.{' '}
            <button className="font-semibold underline" onClick={irAjustes}>
              Conectar →
            </button>
          </Aviso>
        </div>
      )}

      {carga.activo ? (
        <Tarjeta className="space-y-4 text-center">
          <div className="text-5xl animate-bounce">🐾</div>
          <p className="font-semibold">{carga.texto}</p>
          <div className="h-3 rounded-full bg-rosa-100 overflow-hidden">
            <div className="h-full bg-tinta transition-all duration-500" style={{ width: `${carga.total ? (carga.hechas / carga.total) * 100 : 5}%` }} />
          </div>
          <p className="text-xs text-neutral-500">Deja la app abierta mientras termina</p>
        </Tarjeta>
      ) : (
        <div className="space-y-3">
          <BotonArchivo icono="🖼️" multiple alElegir={cargarFotos}>
            Elegir Varias Fotos
          </BotonArchivo>
          <div className="grid grid-cols-2 gap-3">
            <BotonArchivo icono="🧺" variante="suave" alElegir={(f) => cargarFotoGrupal(f[0])}>
              Foto Grupal
            </BotonArchivo>
            <BotonArchivo icono="📸" variante="suave" capture alElegir={cargarFotos}>
              Cámara
            </BotonArchivo>
          </div>
          <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-rosa-100">
            <span className="text-sm font-semibold">✂️ Quitar Fondo</span>
            <button
              onClick={async () => (setFondo(!fondo), await guardarAjuste('quitarFondo', !fondo))}
              className={`w-14 h-8 rounded-full p-1 transition ${fondo ? 'bg-tinta' : 'bg-rosa-200'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow transition ${fondo ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          <Consejos />
        </div>
      )}

      {carga.error && (
        <div className="mt-4">
          <Aviso tipo="error">{carga.error}</Aviso>
        </div>
      )}
      {!carga.activo && carga.texto && !carga.error && (
        <div className="mt-4">
          <Aviso tipo="ok">{carga.texto}</Aviso>
        </div>
      )}

      {pendientes.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl uppercase tracking-wider">Por Revisar · {pendientes.length}</h2>
          </div>
          {listas.length > 1 && (
            <Boton onClick={aceptarTodas} icono="✓" className="mb-3">
              Aceptar Todas ({listas.length})
            </Boton>
          )}
          <div className="grid grid-cols-2 gap-3">
            {pendientes.map((p) => (
              <div key={p.id} className="bg-white rounded-3xl border border-rosa-100 overflow-hidden">
                <FotoPrenda prenda={p} className="w-full aspect-square bg-rosa-50 p-2" />
                <div className="p-3 space-y-2">
                  <p className="font-semibold text-sm leading-tight line-clamp-2">{p.nombre}</p>
                  {p.nombre !== 'Analizando…' && (
                    <>
                      <p className="text-xs text-neutral-500">
                        {p.categoria} · {p.atemporal ? '♾️' : p.temporadas.map((t) => ICONO_TEMPORADA[t]).join('')}
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => db.prendas.update(p.id, { pendienteRevision: false, actualizadoEn: ahora() })}
                          className="flex-1 h-9 rounded-xl bg-tinta text-white text-sm font-bold"
                        >
                          ✓
                        </button>
                        <button onClick={() => setEditando(p)} className="flex-1 h-9 rounded-xl bg-rosa-200 text-sm">
                          ✏️
                        </button>
                        <button onClick={() => borrar(p)} className="w-9 h-9 rounded-xl bg-rosa-50 text-sm">
                          🗑
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <EditorPrenda prenda={editando} alCerrar={() => setEditando(null)} />
    </Pantalla>
  )
}

function Consejos() {
  return (
    <div className="grid grid-cols-3 gap-2 pt-2">
      {[
        ['💡', 'Buena Luz'],
        ['⬜', 'Fondo Liso'],
        ['👕', 'Prenda Estirada'],
      ].map(([i, t]) => (
        <div key={t} className="bg-white/60 rounded-2xl py-3 text-center">
          <div className="text-xl">{i}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{t}</div>
        </div>
      ))}
    </div>
  )
}
