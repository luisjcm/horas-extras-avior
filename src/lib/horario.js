// Interpreta el Excel de horario mensual:
//   fila de cabecera con los nombres de los técnicos,
//   una columna con la fecha (y opcionalmente otra con el día de la semana) y,
//   por técnico, "04:30 - 12:30", "13:00 - 21:00" o "LIBRE".
import { aHHMM, aMinutos, diaSemana, isoDe, partesIso, serialAIso } from './tiempo.js'
import { ErrorArchivo } from './xlsxLectura.js'

export const normalizar = (t) =>
  String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function aFechaIso(v) {
  if (typeof v === 'number' && v > 30000 && v < 80000) return serialAIso(v)
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(String(v ?? '').trim())
  if (m) return isoDe(Number(m[3]), Number(m[2]), Number(m[1]))
  return null
}

const RE_TURNO = /(\d{1,2}):(\d{2})\s*(?:-|–|a|al|hasta)\s*(\d{1,2}):(\d{2})/i
const dos = (n) => String(n).padStart(2, '0')
const duracion = (ini, fin) => (fin > ini ? fin - ini : fin + 1440 - ini)

// → {inicio, fin, nota?} | null (libre) | {texto} (no reconocido)
// Un turno de más de 16 h casi siempre es una hora escrita en formato de 12 h
// ("05:00 - 01:00" = 05:00 a 13:00). Se interpreta sumando 12 h a la salida si eso
// da un turno de 4 a 12 h, y se deja una nota para que el técnico lo confirme.
export function interpretarTurno(valor) {
  const t = String(valor ?? '').trim()
  if (!t) return { texto: '(vacío)' }
  if (/^libre$/i.test(t)) return null
  const m = RE_TURNO.exec(t)
  if (!m) return { texto: t }
  const inicio = `${dos(m[1])}:${m[2]}`
  const fin = `${dos(m[3])}:${m[4]}`
  const ini = aMinutos(inicio)
  const f = aMinutos(fin)
  if (duracion(ini, f) <= 16 * 60) return { inicio, fin }
  const alt = (f + 720) % 1440
  const d = duracion(ini, alt)
  if (d >= 4 * 60 && d <= 12 * 60) {
    return { inicio, fin: aHHMM(alt), nota: `El Excel dice "${t}"; se interpretó ${inicio}–${aHHMM(alt)}` }
  }
  return { texto: t }
}

function cambiarAnio(iso, delta) {
  const { anio, mes, dia } = partesIso(iso)
  if (mes === 2 && dia === 29) return null
  return isoDe(anio + delta, mes, dia)
}

// Si el Excel trae una columna con el día de la semana y no coincide con las fechas,
// busca el año en que sí coincide (p. ej. fechas con 2025 y días de 2026).
function corregirAnio(filasDatos) {
  const conDia = filasDatos.filter((f) => f.diaTexto != null)
  if (conDia.length < 3) return { delta: 0 }
  const fallas = conDia.filter((f) => DIAS[diaSemana(f.iso)] !== f.diaTexto).length
  if (fallas <= conDia.length / 2) return { delta: 0 }
  for (const delta of [1, -1, 2, -2, 3, -3]) {
    const ok = conDia.every((f) => {
      const iso = cambiarAnio(f.iso, delta)
      return iso && DIAS[diaSemana(iso)] === f.diaTexto
    })
    if (ok) return { delta }
  }
  return { delta: 0 }
}

/**
 * @returns {{ tecnicos: string[], porTecnico: Record<string, Record<string, any>>,
 *   desde: string, hasta: string, ajusteAnio?: {de:number, a:number}, notas: string[] }}
 */
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

  // Columna opcional con el nombre del día (Domingo, Lunes…)
  const colDia = (filas[filaIni] || []).findIndex((v, c) => c !== colFecha && DIAS.includes(normalizar(v)))

  const datos = []
  for (let r = filaIni; r < filas.length; r++) {
    const fila = filas[r] || []
    const iso = aFechaIso(fila[colFecha])
    if (!iso) continue
    const diaTexto = colDia >= 0 && DIAS.includes(normalizar(fila[colDia])) ? normalizar(fila[colDia]) : null
    datos.push({ iso, diaTexto, fila })
  }

  const { delta } = corregirAnio(datos)
  const notas = []
  const porTecnico = Object.fromEntries(columnas.map((x) => [x.nombre, {}]))
  const fechas = []
  for (const { iso: original, fila } of datos) {
    const iso = delta ? cambiarAnio(original, delta) : original
    if (!iso) continue
    fechas.push(iso)
    for (const { c, nombre } of columnas) {
      const turno = interpretarTurno(fila[c])
      if (turno?.nota && !notas.includes(turno.nota)) notas.push(turno.nota)
      porTecnico[nombre][iso] = turno
    }
  }
  fechas.sort()
  const anioArchivo = datos.length ? partesIso(datos[0].iso).anio : null
  return {
    tecnicos: columnas.map((x) => x.nombre),
    porTecnico,
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
    ...(delta ? { ajusteAnio: { de: anioArchivo, a: anioArchivo + delta } } : {}),
    notas,
  }
}

// Turnos distintos que aparecen en el horario (de todos los técnicos), ordenados por hora.
export function catalogoTurnos(horario) {
  const vistos = new Map()
  for (const dias of Object.values(horario?.porTecnico || {})) {
    for (const t of Object.values(dias || {})) {
      if (t && t.inicio && t.fin) vistos.set(`${t.inicio}-${t.fin}`, { inicio: t.inicio, fin: t.fin })
    }
  }
  return [...vistos.values()].sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio))
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
