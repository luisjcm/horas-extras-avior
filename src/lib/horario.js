// Interpreta el Excel de horario mensual:
//   fila de cabecera con los nombres de los técnicos,
//   una columna con la fecha y, por técnico, "04:30 - 12:30", "13:00 - 21:00" o "LIBRE".
import { isoDe, serialAIso } from './tiempo.js'
import { ErrorArchivo } from './xlsxLectura.js'

export const normalizar = (t) =>
  String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function aFechaIso(v) {
  if (typeof v === 'number' && v > 30000 && v < 80000) return serialAIso(v)
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(String(v ?? '').trim())
  if (m) return isoDe(Number(m[3]), Number(m[2]), Number(m[1]))
  return null
}

const RE_TURNO = /(\d{1,2}):(\d{2})\s*(?:-|–|a|al|hasta)\s*(\d{1,2}):(\d{2})/i
const dos = (n) => String(n).padStart(2, '0')

// → {inicio, fin} | null (libre) | {texto} (no reconocido)
export function interpretarTurno(valor) {
  const t = String(valor ?? '').trim()
  if (!t) return { texto: '(vacío)' }
  if (/^libre$/i.test(t)) return null
  const m = RE_TURNO.exec(t)
  if (m) return { inicio: `${dos(m[1])}:${m[2]}`, fin: `${dos(m[3])}:${m[4]}` }
  return { texto: t }
}

/** @returns {{ tecnicos: string[], porTecnico: Record<string, Record<string, any>>, desde: string, hasta: string }} */
export function interpretarHorario(filas) {
  let colFecha = -1
  let filaIni = -1
  for (let r = 0; r < filas.length && filaIni < 0; r++) {
    const fila = filas[r] || []
    for (let c = 0; c < fila.length; c++) {
      if (aFechaIso(fila[c])) {
        colFecha = c
        filaIni = r
        break
      }
    }
  }
  if (filaIni < 0) throw new ErrorArchivo('No se encontró ninguna columna de fechas en el horario.')

  let cabecera = null
  for (let r = filaIni - 1; r >= 0 && !cabecera; r--) {
    const fila = filas[r] || []
    if (fila.some((v, c) => c > colFecha && typeof v === 'string' && v.trim())) cabecera = fila
  }
  if (!cabecera) throw new ErrorArchivo('No se encontró la fila con los nombres de los técnicos.')

  const columnas = []
  cabecera.forEach((v, c) => {
    if (c > colFecha && typeof v === 'string' && v.trim()) columnas.push({ c, nombre: v.trim() })
  })
  if (!columnas.length) throw new ErrorArchivo('El horario no tiene columnas de técnicos.')

  const porTecnico = Object.fromEntries(columnas.map((x) => [x.nombre, {}]))
  const fechas = []
  for (let r = filaIni; r < filas.length; r++) {
    const fila = filas[r] || []
    const iso = aFechaIso(fila[colFecha])
    if (!iso) continue
    fechas.push(iso)
    for (const { c, nombre } of columnas) porTecnico[nombre][iso] = interpretarTurno(fila[c])
  }
  fechas.sort()
  return { tecnicos: columnas.map((x) => x.nombre), porTecnico, desde: fechas[0], hasta: fechas[fechas.length - 1] }
}

// Sugiere la columna del horario que corresponde al nombre escrito.
export function sugerirTecnico(nombreCompleto, tecnicos) {
  const escrito = new Set(normalizar(nombreCompleto).split(' ').filter(Boolean))
  if (!escrito.size) return ''
  let mejor = ''
  let puntaje = 0
  for (const t of tecnicos) {
    const tokens = normalizar(t).split(' ').filter(Boolean)
    const aciertos = tokens.filter((x) => escrito.has(x)).length
    if (aciertos === tokens.length && aciertos > puntaje) {
      mejor = t
      puntaje = aciertos
    }
  }
  return mejor
}
