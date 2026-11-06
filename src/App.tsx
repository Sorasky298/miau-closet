import { useEffect, useState } from 'react'
import NavBar, { type Ruta } from './components/NavBar'
import { Avisos } from './components/comunes'
import Onboarding from './screens/Onboarding'
import Inicio from './screens/Inicio'
import Ajustes from './screens/Ajustes'
import Agregar from './screens/Agregar'
import Closet from './screens/Closet'
import Outfits from './screens/Outfits'
import Perfil from './screens/Perfil'
import Temporada from './screens/Temporada'
import Compras from './screens/Compras'
import Maleta from './screens/Maleta'
import { leerAjuste, pedirPersistencia } from './db'
import { sincronizar } from './lib/sync'

export type RutaApp = Ruta

function leerHash(): { ruta: RutaApp; param?: string } {
  const [r, p] = location.hash.slice(1).split('/')
  return { ruta: (r as RutaApp) || 'inicio', param: p }
}

export default function App() {
  const [listo, setListo] = useState<boolean | null>(null)
  const [{ ruta, param }, setNav] = useState(leerHash)

  useEffect(() => {
    pedirPersistencia()
    leerAjuste('onboardingListo', false).then(setListo)
    const alCambiar = () => setNav(leerHash())
    addEventListener('hashchange', alCambiar)
    return () => removeEventListener('hashchange', alCambiar)
  }, [])

  // Sincroniza en segundo plano al abrir (si entró con Google)
  useEffect(() => {
    if (!listo) return
    leerAjuste('googleUsuario', null).then((u) => u && sincronizar().catch(() => undefined))
  }, [listo])

  const ir = (r: RutaApp, p?: string) => {
    location.hash = p ? `${r}/${p}` : r
    scrollTo(0, 0)
  }

  if (listo === null) return null
  if (!listo) return <Onboarding alTerminar={() => setListo(true)} />

  const conBarra: RutaApp[] = ['inicio', 'closet', 'agregar', 'outfits', 'perfil']

  return (
    <>
      <Avisos />
      {ruta === 'inicio' && <Inicio ir={ir} />}
      {ruta === 'closet' && <Closet verOutfitsCon={(id) => ir('outfits', id)} />}
      {ruta === 'agregar' && <Agregar irAjustes={() => ir('ajustes')} />}
      {ruta === 'outfits' && <Outfits incluirId={param} limpiarIncluir={() => ir('outfits')} />}
      {ruta === 'perfil' && <Perfil />}
      {ruta === 'ajustes' && <Ajustes volver={() => history.back()} />}
      {ruta === 'temporada' && <Temporada volver={() => ir('inicio')} />}
      {ruta === 'compras' && <Compras volver={() => ir('inicio')} />}
      {ruta === 'maleta' && <Maleta volver={() => ir('inicio')} />}
      {conBarra.includes(ruta) && <NavBar actual={ruta as Ruta} ir={ir} />}
    </>
  )
}
