// Procesamiento de fotos en el dispositivo: redimensionar, recortar, quitar fondo, collage.
import { useEffect, useState } from 'react'

const LADO_MAX = 1024

async function abrir(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob)
  } catch {
    // Safari antiguo / HEIC: vía <img>
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
}

const ancho = (i: ImageBitmap | HTMLImageElement) => ('naturalWidth' in i ? i.naturalWidth : i.width)
const alto = (i: ImageBitmap | HTMLImageElement) => ('naturalHeight' in i ? i.naturalHeight : i.height)

function lienzo(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = Math.round(w)
  c.height = Math.round(h)
  return [c, c.getContext('2d')!] as const
}

const aBlob = (c: HTMLCanvasElement, tipo = 'image/jpeg', q = 0.86) =>
  new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('canvas'))), tipo, q))

/** Foto de la galería/cámara → JPEG de máx. 1024 px (convierte HEIC). */
export async function prepararFoto(archivo: Blob): Promise<Blob> {
  const img = await abrir(archivo)
  const esc = Math.min(1, LADO_MAX / Math.max(ancho(img), alto(img)))
  const [c, ctx] = lienzo(ancho(img) * esc, alto(img) * esc)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return aBlob(c)
}

/** Recorta según caja normalizada 0–1000 [ymin, xmin, ymax, xmax] de Gemini. */
export async function recortarCaja(foto: Blob, caja: number[], margen = 0.04): Promise<Blob> {
  const img = await abrir(foto)
  const W = ancho(img)
  const H = alto(img)
  let [y0, x0, y1, x1] = caja.map((v) => Math.min(1000, Math.max(0, v)) / 1000)
  y0 = Math.max(0, y0 - margen)
  x0 = Math.max(0, x0 - margen)
  y1 = Math.min(1, y1 + margen)
  x1 = Math.min(1, x1 + margen)
  const w = (x1 - x0) * W
  const h = (y1 - y0) * H
  if (w < 20 || h < 20) return foto
  const [c, ctx] = lienzo(w, h)
  ctx.drawImage(img, x0 * W, y0 * H, w, h, 0, 0, w, h)
  return aBlob(c)
}

/** Quita el fondo en el dispositivo y ajusta la prenda centrada (PNG transparente). */
export async function quitarFondo(foto: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  const png = await removeBackground(foto, { model: 'isnet_quint8', output: { format: 'image/png' } })
  return ajustarTransparente(png)
}

/** Recorta los bordes transparentes y deja la prenda centrada con aire. */
async function ajustarTransparente(png: Blob): Promise<Blob> {
  const img = await abrir(png)
  const W = ancho(img)
  const H = alto(img)
  const [c, ctx] = lienzo(W, H)
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, W, H).data
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return png
  const w = x1 - x0
  const h = y1 - y0
  const lado = Math.max(w, h) * 1.12
  const [c2, ctx2] = lienzo(lado, lado)
  ctx2.drawImage(c, x0, y0, w, h, (lado - w) / 2, (lado - h) / 2, w, h)
  return aBlob(c2, 'image/png')
}

/** Foto principal a mostrar de una prenda. */
export const fotoDe = (p: { fotoCatalogo?: Blob; fotoRecorte?: Blob; fotoOriginal: Blob }) => p.fotoCatalogo ?? p.fotoRecorte ?? p.fotoOriginal

/** URL temporal para mostrar un Blob en <img>. */
export function useUrl(blob?: Blob | null) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return setUrl(undefined)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

/** Collage para compartir: foto de cuerpo (opcional) + prendas sobre fondo rosado. */
export async function collageParaCompartir(prendas: Blob[], fotoCuerpo?: Blob, titulo = 'MIAU CLÓSET'): Promise<Blob> {
  const W = 1080
  const H = 1350
  const [c, ctx] = lienzo(W, H)
  ctx.fillStyle = '#FBF5F3'
  ctx.fillRect(0, 0, W, H)
  const zonaX = fotoCuerpo ? W * 0.42 : 0
  if (fotoCuerpo) {
    const cuerpo = await abrir(fotoCuerpo)
    const esc = Math.min((W * 0.4) / ancho(cuerpo), (H - 160) / alto(cuerpo))
    const w = ancho(cuerpo) * esc
    const h = alto(cuerpo) * esc
    ctx.drawImage(cuerpo, (W * 0.42 - w) / 2, 80 + (H - 160 - h) / 2, w, h)
  }
  const n = prendas.length
  const cols = n <= 2 ? 1 : 2
  const filas = Math.ceil(n / cols)
  const cw = (W - zonaX - 40) / cols
  const ch = (H - 160) / filas
  for (let i = 0; i < n; i++) {
    const img = await abrir(prendas[i])
    const col = i % cols
    const fila = Math.floor(i / cols)
    const esc = Math.min((cw - 30) / ancho(img), (ch - 30) / alto(img))
    const w = ancho(img) * esc
    const h = alto(img) * esc
    ctx.drawImage(img, zonaX + 20 + col * cw + (cw - w) / 2, 80 + fila * ch + (ch - h) / 2, w, h)
  }
  ctx.fillStyle = '#141414'
  ctx.font = '600 34px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText(titulo, W / 2, 52)
  return aBlob(c, 'image/jpeg', 0.9)
}
