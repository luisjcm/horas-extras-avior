// Entrega de archivos generados: descarga, compartir (Web Share API) y zip.
import JSZip from 'jszip'

let plantillaCache = null
export async function cargarPlantilla(url) {
  if (!plantillaCache) plantillaCache = fetch(url).then((r) => r.arrayBuffer())
  return (await plantillaCache).slice(0)
}

export function descargarArchivo(file) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function zipArchivos(files, nombre) {
  const zip = new JSZip()
  for (const f of files) zip.file(f.name, await f.arrayBuffer())
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' })
  return new File([blob], nombre, { type: 'application/zip' })
}

/**
 * Comparte los archivos con la hoja de compartir del teléfono. Si el navegador no puede,
 * descarga `respaldo` (o el único archivo).
 * @returns {Promise<'compartido'|'descargado'>}
 */
export async function compartirArchivos(files, respaldo) {
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, title: files.length === 1 ? files[0].name : `${files.length} reportes` })
    return 'compartido'
  }
  descargarArchivo(respaldo || files[0])
  return 'descargado'
}
