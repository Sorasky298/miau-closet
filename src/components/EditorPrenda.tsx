import { useEffect, useState } from 'react'
import { db, ahora, type Prenda, type Capa, type Temporada } from '../db'
import { CATEGORIAS, CAPAS, ESTILOS } from '../lib/ia'
import { TEMPORADAS, ICONO_TEMPORADA } from '../lib/temporadas'
import { Boton, Chips, Hoja } from './ui'
import { FotoPrenda } from './comunes'

export const UBICACIONES = ['Clóset', 'Cajón 1', 'Cajón 2', 'Cajón 3', 'Caja Guardada', 'Maleta'] as const

export default function EditorPrenda({ prenda, alCerrar }: { prenda: Prenda | null; alCerrar: () => void }) {
  const [p, setP] = useState<Prenda | null>(prenda)
  useEffect(() => setP(prenda), [prenda])
  if (!p) return null
  const set = <K extends keyof Prenda>(k: K, v: Prenda[K]) => setP({ ...p, [k]: v })

  async function guardar() {
    await db.prendas.put({ ...p!, pendienteRevision: false, actualizadoEn: ahora() })
    alCerrar()
  }

  return (
    <Hoja abierta={Boolean(prenda)} alCerrar={alCerrar} titulo="Editar Prenda">
      <div className="space-y-5">
        <div className="flex gap-4 items-center">
          <FotoPrenda prenda={p} className="w-24 h-24 rounded-2xl bg-white" />
          <input
            value={p.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            className="flex-1 text-lg font-semibold rounded-2xl border-2 border-rosa-200 px-4 py-3 bg-white"
          />
        </div>

        <Campo titulo="Tipo">
          <select
            value={p.categoria}
            onChange={(e) => set('categoria', e.target.value)}
            className="w-full h-12 rounded-2xl border-2 border-rosa-200 px-4 bg-white font-semibold"
          >
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Campo>

        <Campo titulo="Capa">
          <Chips opciones={CAPAS} valor={p.capa} alCambiar={(v) => v[0] && set('capa', v[0] as Capa)} />
        </Campo>

        <Campo titulo="Rota Por Temporada">
          <div className="flex gap-2 mb-3">
            <BotonToggle activo={!p.atemporal} onClick={() => set('atemporal', false)}>
              🔄 Sí, Rota
            </BotonToggle>
            <BotonToggle activo={p.atemporal} onClick={() => setP({ ...p, atemporal: true, temporadas: [...TEMPORADAS] })}>
              ♾️ Todo El Año
            </BotonToggle>
          </div>
          {!p.atemporal && (
            <Chips
              opciones={TEMPORADAS}
              valor={p.temporadas}
              multiple
              iconos={ICONO_TEMPORADA}
              alCambiar={(v) => set('temporadas', v as Temporada[])}
            />
          )}
        </Campo>

        <Campo titulo="Estilo">
          <Chips opciones={ESTILOS} valor={p.estilos as (typeof ESTILOS)[number][]} multiple alCambiar={(v) => set('estilos', v)} />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo titulo="Abrigo">
            <Nivel valor={p.abrigo} icono="🧣" alCambiar={(v) => set('abrigo', v)} />
          </Campo>
          <Campo titulo="Formalidad">
            <Nivel valor={p.formalidad} icono="✨" alCambiar={(v) => set('formalidad', v)} />
          </Campo>
        </div>

        <Campo titulo="Color">
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={p.colorPrincipalHex ?? '#cccccc'}
              onChange={(e) => set('colorPrincipalHex', e.target.value)}
              className="w-12 h-12 rounded-xl border-2 border-rosa-200 bg-white"
            />
            <input
              value={p.colorPrincipal}
              onChange={(e) => set('colorPrincipal', e.target.value)}
              className="flex-1 h-12 rounded-2xl border-2 border-rosa-200 px-4 bg-white"
            />
          </div>
        </Campo>

        <Campo titulo="¿Dónde Está?">
          <Chips opciones={UBICACIONES} valor={p.ubicacion as (typeof UBICACIONES)[number]} alCambiar={(v) => set('ubicacion', v[0])} />
        </Campo>

        <Campo titulo="Marca">
          <input
            value={p.marca ?? ''}
            onChange={(e) => set('marca', e.target.value)}
            placeholder="Opcional"
            className="w-full h-12 rounded-2xl border-2 border-rosa-200 px-4 bg-white"
          />
        </Campo>

        <Boton onClick={guardar} icono="✓">
          Guardar
        </Boton>
      </div>
    </Hoja>
  )
}

export function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{titulo}</p>
      {children}
    </div>
  )
}

function BotonToggle({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-11 rounded-2xl font-semibold text-sm border-2 ${activo ? 'bg-tinta text-white border-tinta' : 'bg-white border-rosa-200'}`}
    >
      {children}
    </button>
  )
}

function Nivel({ valor, icono, alCambiar }: { valor: number; icono: string; alCambiar: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => alCambiar(n)} className={`text-xl transition ${n <= valor ? '' : 'opacity-20 grayscale'}`}>
          {icono}
        </button>
      ))}
    </div>
  )
}
