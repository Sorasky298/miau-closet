import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Outfit } from '../db'
import { Boton, Tarjeta, Pantalla, Mosaico, Aviso } from '../components/ui'
import type { Ruta } from '../components/NavBar'
import { TarjetaOutfit } from './Outfits'
import { obtenerClima, describirClima, type Clima } from '../lib/clima'
import { outfitDelDia } from '../lib/outfits'
import { temporadaActual, ICONO_TEMPORADA } from '../lib/temporadas'
import { traducirError, obtenerLlave } from '../lib/gemini'
import { sinUsar } from './Closet'

export default function Inicio({ ir }: { ir: (r: Ruta) => void }) {
  const prendas = useLiveQuery(() => db.prendas.filter((p) => !p.pendienteRevision).toArray(), [], [])
  const guardados = useLiveQuery(() => db.outfits.filter((o) => o.guardado).count(), [], 0)
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const [clima, setClima] = useState<Clima>()
  const [look, setLook] = useState<Outfit | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const activas = prendas.filter((p) => p.estado === 'Activa')
  const dormidas = activas.filter(sinUsar).length
  const temporada = temporadaActual(perfil?.hemisferio ?? 'Norte')
  const porGuardar = activas.filter((p) => !p.atemporal && !p.temporadas.includes(temporada)).length

  useEffect(() => {
    if (perfil?.lat && perfil.lon) obtenerClima(perfil.lat, perfil.lon).then(setClima).catch(() => undefined)
  }, [perfil?.lat, perfil?.lon])

  async function cargarLook(forzar = false) {
    setCargando(true)
    setError('')
    try {
      setLook(await outfitDelDia(forzar))
    } catch (e) {
      setError(String((e as Error).message) === 'POCAS_PRENDAS' ? '' : traducirError(e))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (activas.length >= 3 && !look && !cargando) obtenerLlave().then((k) => { if (k) cargarLook() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activas.length >= 3])

  const hoy = clima?.dias[0]
  const c = clima ? describirClima(clima.actual.codigo) : undefined

  return (
    <Pantalla>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-[0.3em]">Miau Clóset</p>
          <h1 className="font-display text-3xl">Hola, {perfil?.apodo || 'Gatofeo'} 🐾</h1>
        </div>
        <button onClick={() => ir('ajustes')} className="w-11 h-11 rounded-full bg-white border border-rosa-100 text-xl" aria-label="Ajustes">
          ⚙️
        </button>
      </div>

      {clima && c && hoy ? (
        <div className="bg-tinta text-white rounded-3xl p-4 flex items-center gap-4 mb-4">
          <span className="text-5xl">{c.icono}</span>
          <div className="flex-1">
            <p className="font-display text-3xl leading-none">{clima.actual.temp}°</p>
            <p className="text-sm text-white/70">
              {c.texto} · {hoy.min}° / {hoy.max}°{hoy.lluvia > 30 ? ` · ☔ ${hoy.lluvia}%` : ''}
            </p>
          </div>
          <span className="text-xs font-bold uppercase bg-white/15 rounded-full px-3 py-1">
            {ICONO_TEMPORADA[temporada]} {temporada}
          </span>
        </div>
      ) : (
        !perfil?.lat && (
          <button onClick={() => ir('perfil')} className="w-full mb-4 bg-white rounded-3xl p-4 border-2 border-dashed border-rosa-300 text-left font-semibold">
            📍 Agrega Tu Ciudad Para Ver El Clima →
          </button>
        )
      )}

      <div className="grid grid-cols-3 gap-2 mb-5">
        <Dato valor={prendas.length} texto="Prendas" onClick={() => ir('closet')} />
        <Dato valor={guardados} texto="Outfits" onClick={() => ir('outfits')} />
        <Dato valor={dormidas} texto="Sin Usar" onClick={() => ir('closet')} />
      </div>

      {prendas.length === 0 ? (
        <Tarjeta className="space-y-4 text-center mb-5">
          <div className="text-5xl">👗</div>
          <h2 className="text-xl font-semibold">Llenemos Tu Clóset</h2>
          <p className="text-neutral-600 text-sm">Elige varias fotos a la vez. La IA hace el resto.</p>
          <Boton onClick={() => ir('agregar')} icono="➕">
            Cargar Mis Prendas
          </Boton>
        </Tarjeta>
      ) : (
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl uppercase tracking-wider">✨ Tu Look De Hoy</h2>
            {look && (
              <button onClick={() => cargarLook(true)} disabled={cargando} className="h-9 px-4 rounded-full bg-white border border-rosa-200 text-sm font-semibold">
                {cargando ? '…' : '🔄 Otro'}
              </button>
            )}
          </div>
          {look ? (
            <TarjetaOutfit outfit={look} />
          ) : cargando ? (
            <Tarjeta className="text-center py-10">
              <div className="text-4xl animate-bounce">🐾</div>
            </Tarjeta>
          ) : activas.length < 3 ? (
            <Aviso>Sube al menos 3 prendas para recibir tu look del día.</Aviso>
          ) : (
            <Boton icono="✨" onClick={() => cargarLook()}>
              Ver Mi Look
            </Boton>
          )}
          {error && (
            <div className="mt-3">
              <Aviso tipo="error">{error}</Aviso>
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Mosaico icono="🔄" texto="Temporada" sub={porGuardar ? `${porGuardar} por guardar` : 'Al día ✓'} onClick={() => ir('temporada')} destacado={porGuardar > 0} />
        <Mosaico icono="🛍️" texto="Compra Inteligente" sub="Qué te falta" onClick={() => ir('compras')} />
        <Mosaico icono="🧳" texto="Mi Maleta" sub="Viaja ligera" onClick={() => ir('maleta')} />
        <Mosaico icono="📅" texto="Mi Semana" sub="7 looks listos" onClick={() => ir('outfits')} />
      </div>
    </Pantalla>
  )
}

function Dato({ valor, texto, onClick }: { valor: number; texto: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white rounded-3xl p-3 border border-rosa-100 text-left active:scale-95 transition">
      <p className="font-display text-3xl leading-none">{valor}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mt-1">{texto}</p>
    </button>
  )
}
