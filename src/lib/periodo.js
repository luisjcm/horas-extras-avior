import { FERIADOS } from '../data/feriados.js'
import { detectarCambio, mismoTurno } from './guardia.js'
import { calcularDia } from './motor.js'
import { diasEnMes, isoDe, NOMBRES_MES } from './tiempo.js'

// quincena: 1 = del 1 al 15, 2 = del 16 al fin de mes
export function diasQuincena(anio, mes, quincena) {
  const ini = quincena === 1 ? 1 : 16
  const fin = quincena === 1 ? 15 : diasEnMes(anio, mes)
  const dias = []
  for (let d = ini; d <= fin; d++) dias.push(isoDe(anio, mes, d))
  return dias
}

// Fecha de corte por defecto (campos "1. Desde" y "2. Hasta").
// 2.ª quincena: igual al formato aceptado de octubre (15 al último día del mes).
// 1.ª quincena: del 1 al 15 (PENDIENTE DE CONFIRMAR con Capital Humano).
export function corteSugerido(anio, mes, quincena) {
  return quincena === 1
    ? { desde: isoDe(anio, mes, 1), hasta: isoDe(anio, mes, 15) }
    : { desde: isoDe(anio, mes, 15), hasta: isoDe(anio, mes, diasEnMes(anio, mes)) }
}

const sinAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// "Luis Jesús Curbata Marcano" → "Luis Curbata"
export function nombreCorto(nombreCompleto) {
  const p = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean)
  if (p.length >= 4) return `${p[0]} ${p[2]}`
  if (p.length === 3) return `${p[0]} ${p[1]}`
  return p.join(' ')
}

export function nombreArchivo(nombreCompleto, anio, mes, quincena) {
  const dia = quincena === 1 ? 15 : diasEnMes(anio, mes)
  const quien = sinAcentos(nombreCorto(nombreCompleto)).replace(/[^A-Za-z0-9]+/g, '_') || 'Tecnico'
  return `Horas_extras_al_${dia}_de_${NOMBRES_MES[mes - 1]}_${quien}.xlsx`
}

// Cédula: solo dígitos → "V-25.426.448" (formato del campo 5) y "V - 25.426.448" (firma)
export function digitosCedula(texto) {
  return String(texto || '').replace(/\D/g, '')
}
export function formatoCedula(texto, separador = '-') {
  const d = digitosCedula(texto)
  if (!d) return ''
  return `V${separador}${d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

/**
 * Une horario, marcaje y ajustes del mapa para una quincena y calcula cada día.
 *
 * ajustes[fecha] (todo opcional):
 *   entrada, salida   'HH:MM' que reemplazan las marcas del Bioadmin
 *   asignado          {inicio, fin} | null (libre): reemplaza el turno del Excel
 *   cambio: false     el técnico indicó que NO es cambio de guardia (no detectar)
 *   feriado: boolean  marca o desmarca el día como feriado
 *
 * @param {string[]} dias ISO de la quincena
 * @param {Record<string, any>} horarioTecnico turnos del Excel por fecha
 * @param {Record<string, string[]>} marcasPorDia 'HH:MM' ordenadas
 * @param {Record<string, object>} ajustes
 * @param {{catalogo?: Array, feriados?: string[]}} opciones
 */
export function armarQuincena(dias, horarioTecnico, marcasPorDia, ajustes = {}, opciones = {}) {
  const { catalogo = [], feriados = FERIADOS } = Array.isArray(opciones) ? { feriados: opciones } : opciones
  return dias.map((fecha) => {
    const marcas = marcasPorDia[fecha] || []
    const aj = ajustes[fecha] || {}
    const entrada = aj.entrada || marcas[0] || null
    const salida = aj.salida || (marcas.length > 1 ? marcas[marcas.length - 1] : null)
    const enHorario = Object.prototype.hasOwnProperty.call(horarioTecnico, fecha)
    const original = enHorario ? horarioTecnico[fecha] : { texto: 'sin horario cargado' }

    let asignado = original
    let cambio = null
    let sugerencia = null
    const manual = Object.prototype.hasOwnProperty.call(aj, 'asignado')
    if (manual) {
      asignado = aj.asignado
      if (!mismoTurno(asignado, original)) cambio = { de: original, a: asignado, auto: false }
    } else if (aj.cambio !== false) {
      const det = detectarCambio(original, entrada, salida, catalogo)
      if (det?.tipo === 'auto') {
        asignado = det.turno
        cambio = { de: original, a: det.turno, auto: true }
      } else if (det?.tipo === 'sugerido') {
        sugerencia = det.turno
      }
    }

    const feriado = typeof aj.feriado === 'boolean' ? aj.feriado : feriados.includes(fecha)
    const resultado = calcularDia({ fecha, asignado, entrada, salida, feriado })
    if (cambio) {
      resultado.detalle.unshift(
        `${cambio.auto ? 'Cambio de guardia detectado' : 'Horario cambiado a mano'}: ${textoHorario(cambio.de)} → ${textoHorario(cambio.a)}`,
      )
    }
    if (original?.nota && !manual) resultado.detalle.unshift(original.nota)
    if (sugerencia && resultado.estado === 'normal') {
      resultado.estado = 'cambio-posible'
      resultado.detalle.unshift(`¿Cambio de guardia? Las marcas encajan mejor con ${textoHorario(sugerencia)}`)
    }
    return {
      fecha,
      original,
      asignado,
      marcas,
      entrada,
      salida,
      cambio,
      sugerencia,
      feriadoMarcado: feriado,
      ajustado: Boolean(aj.entrada || aj.salida),
      resultado,
    }
  })
}

export const ESTADOS_PENDIENTES = ['sin-marcaje', 'incompleto', 'revisar', 'cambio-posible']

// Línea de observación con los cambios de guardia de la quincena
export function textoCambiosGuardia(dias) {
  const c = dias.filter((d) => d.cambio)
  if (!c.length) return ''
  const partes = c.map(
    (d) => `${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)} tenía ${textoHorario(d.cambio.de)}, laboró ${textoHorario(d.cambio.a)}`,
  )
  return `Cambio de guardia: ${partes.join('; ')}.`
}

export function textoHorario(asignado) {
  if (asignado == null) return 'Libre'
  if (asignado.texto != null) return asignado.texto
  return `${asignado.inicio} a ${asignado.fin}`
}

export function textoLaborado(dia) {
  if (dia.entrada && dia.salida) return `${dia.entrada} a ${dia.salida}`
  if (dia.entrada || dia.salida) return `${dia.entrada || '--:--'} a ${dia.salida || '--:--'}`
  return dia.asignado == null ? 'Libre' : ''
}
