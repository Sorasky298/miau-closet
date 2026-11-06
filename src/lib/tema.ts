// Color de la app (se guarda en el dispositivo para cargar sin parpadeo)
export const TEMAS = [
  { id: 'rosa', nombre: 'Rosa', colores: ['#F6E4E4', '#E7A9B0', '#C9727D'] },
  { id: 'lavanda', nombre: 'Lavanda', colores: ['#ECE6F6', '#B9A5DE', '#7D62B8'] },
  { id: 'durazno', nombre: 'Durazno', colores: ['#F8E6D8', '#E6A57C', '#C66B3D'] },
  { id: 'menta', nombre: 'Menta', colores: ['#E1F2EA', '#8FCBB0', '#3E8E6B'] },
] as const

export type Tema = (typeof TEMAS)[number]['id']

export function leerTema(): Tema {
  try {
    return (localStorage.getItem('miau-tema') as Tema) || 'rosa'
  } catch {
    return 'rosa'
  }
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.tema = t
  try {
    localStorage.setItem('miau-tema', t)
  } catch {
    /* sin almacenamiento */
  }
}
