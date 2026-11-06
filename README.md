# 🐾 MIAU CLÓSET

Clóset digital con estilista IA. PWA instalable en iPhone y Android.

**App:** https://miaucloset.github.io/

## Funciones

| Módulo | Qué hace |
|---|---|
| ➕ Agregar | Varias fotos a la vez o Foto Grupal → la IA llena las fichas y quita el fondo |
| 👗 Clóset | Filtros por tipo, temporada, favoritas, sin usar, donar/vender |
| 🔄 Temporada | Qué guardar, qué sacar y qué es atemporal (hemisferio automático) |
| ✨ Outfits | Por ocasión, estilo y clima. Guardados y Mi Semana (7 looks) |
| 🪄 Probador | En la app (pago a Google), en Gemini (gratis) o en ChatGPT (incluido) |
| 🛍️ Compra Inteligente | Lo que te falta + Antes de Comprar |
| 🧳 Maleta | Maleta cápsula según destino, días y clima |
| 🐱 Perfil | Ciudad, estilo, colorimetría, medidas, foto para probador |
| ☁️ Sync | Google Drive (carpeta oculta) + respaldo .zip |

## Arquitectura

- Vite + React + TypeScript + Tailwind 4 + vite-plugin-pwa
- Datos locales: IndexedDB (Dexie). Sin servidor propio.
- IA: Gemini con la llave de cada usuaria (`src/lib/gemini.ts` es el único punto de contacto; para versión pública se reemplaza por un backend).
- Quitar fondo en el dispositivo: `@imgly/background-removal` (AGPL — revisar licencia antes de uso comercial).
- Clima: Open-Meteo.

## Configuración

| Variable (GitHub → Settings → Variables → Actions) | Para qué |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Botón Entrar con Google + sincronización con Drive |

Sin esa variable la app funciona igual en modo "solo este dispositivo".

## Desarrollo

```bash
npm install
npm run dev
```
