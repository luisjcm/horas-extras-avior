// Motor de cálculo de horas extras. Funciones puras, sin UI.
//
// Reglas (jefatura, 03/11/2026):
//  - Bono nocturno: solo la parte del HORARIO ASIGNADO que cae en 19:00–04:59.
//    No depende del marcaje (llegar tarde no lo reduce, llegar antes no lo aumenta).
//  - Todo lo trabajado FUERA del horario asignado (antes de la entrada o después
//    de la salida) es hora extra. Cada tramo se redondea y clasifica por separado:
//    diurna (05:00–18:59), nocturna (19:00–04:59) o mixta (abarca ambas; con más
//    de 4 h nocturnas cuenta como nocturna).
//  - Redondeo: medias horas completas + 0,5 si la fracción restante ≥ umbral.
//  - Domingo laborado dentro de la rotación → 1. Día libre laborado → 1 (descanso
//    legal laborado). Feriado laborado → 1.
import { REGLAS } from '../data/reglas.js'
import { aHHMM, aMinutos, diaSemana } from './tiempo.js'

// Minutos de [a, b) que caen en la franja nocturna. Admite cruce de medianoche (b < a).
export function minutosNocturnos(a, b, reglas = REGLAS) {
  if (b < a) b += 1440
  const { nocheInicio: ni, nocheFin: nf } = reglas
  const franjas = [[0, nf], [ni, 1440 + nf], [1440 + ni, 2880]]
  let total = 0
  for (const [x, y] of franjas) total += Math.max(0, Math.min(b, y) - Math.max(a, x))
  return total
}

export function redondearHoras(minutos, umbral = REGLAS.umbralMinutos) {
  if (minutos <= 0) return 0
  const medias = Math.floor(minutos / 30)
  return medias * 0.5 + (minutos % 30 >= umbral ? 0.5 : 0)
}

export function clasificarTramo(a, b, reglas = REGLAS) {
  const duracion = b - a
  const noct = minutosNocturnos(a, b, reglas)
  if (noct === 0) return 'diurnas'
  if (noct === duracion || noct > reglas.maxNocturnoMixta) return 'nocturnas'
  return 'mixtas'
}

const ETIQUETA = { diurnas: 'diurna', mixtas: 'mixta', nocturnas: 'nocturna' }
export const fmtHoras = (h) => String(h).replace('.', ',')

function tramoExtra(a, b, cuando, reglas, r) {
  const min = b - a
  if (min <= 0) return
  const horas = redondearHoras(min, reglas.umbralMinutos)
  const rango = `${aHHMM(a)}–${aHHMM(b)} (${min} min)`
  if (!horas) {
    r.detalle.push(`${cuando}: ${rango}, menos de ${reglas.umbralMinutos} min, no cuenta`)
    return
  }
  const tipo = clasificarTramo(a, b, reglas)
  r[tipo] += horas
  r.detalle.push(`${cuando}: ${rango} → ${fmtHoras(horas)} h extra ${ETIQUETA[tipo]}`)
}

/**
 * Calcula un día.
 * @param {object} p
 * @param {string} p.fecha ISO 'AAAA-MM-DD'
 * @param {{inicio:string, fin:string}|{texto:string}|null} p.asignado null = libre
 * @param {string|null} p.entrada 'HH:MM' primera marca del día
 * @param {string|null} p.salida  'HH:MM' última marca del día
 * @param {boolean} [p.feriado]
 */
export function calcularDia({ fecha, asignado, entrada, salida, feriado = false }, reglas = REGLAS) {
  const r = {
    bono: 0, diurnas: 0, mixtas: 0, nocturnas: 0,
    domingo: 0, descanso: 0, feriado: 0,
    estado: 'normal', detalle: [],
  }
  const e = aMinutos(entrada)
  const s = aMinutos(salida)
  const trabajo = e != null && s != null && s > e
  const libre = asignado == null

  if (!libre && asignado.texto != null) {
    r.estado = 'revisar'
    r.detalle.push(`Horario no reconocido ("${asignado.texto}"); revisa este día manualmente`)
    return r
  }
  const incompleto = (e != null || s != null) && !trabajo

  if (libre) {
    if (incompleto) {
      r.estado = 'incompleto'
      r.detalle.push('Día libre con una sola marca: falta la entrada o la salida')
      return r
    }
    if (!trabajo) {
      r.estado = 'libre'
      return r
    }
    r.estado = 'libre-laborado'
    r.descanso = 1
    r.detalle.push('Día libre con marcaje → descanso legal laborado')
  } else {
    const ini = aMinutos(asignado.inicio)
    let fin = aMinutos(asignado.fin)
    if (fin <= ini) fin += 1440
    if (e == null && s == null) {
      r.estado = 'sin-marcaje'
      r.detalle.push('Turno asignado sin marcaje')
      return r
    }
    const noct = minutosNocturnos(ini, fin, reglas)
    r.bono = noct / 60
    if (noct) r.detalle.push(`Bono nocturno: ${noct} min del horario asignado en 19:00–04:59 → ${fmtHoras(r.bono)} h`)
    if (incompleto) {
      r.estado = 'incompleto'
      r.detalle.push('Marcaje incompleto: falta la entrada o la salida; no se calcularon horas extras')
    } else {
      tramoExtra(e, Math.min(ini, s), 'Antes de la entrada', reglas, r)
      tramoExtra(Math.max(fin, e), s, 'Después de la salida', reglas, r)
      if (diaSemana(fecha) === 0) {
        r.domingo = 1
        r.detalle.push('Domingo dentro de la rotación, laborado')
      }
    }
  }
  if (feriado && trabajo) {
    r.feriado = 1
    r.detalle.push('Feriado laborado')
  }
  return r
}

export const COLUMNAS = ['bono', 'diurnas', 'mixtas', 'nocturnas', 'domingo', 'descanso', 'feriado']

export function totalizar(resultados) {
  const t = Object.fromEntries(COLUMNAS.map((k) => [k, 0]))
  for (const r of resultados) for (const k of COLUMNAS) t[k] += r[k] || 0
  return t
}
