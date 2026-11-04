import { FERIADOS } from '../data/feriados.js'
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
 * Une horario, marcaje y ajustes manuales para una quincena y calcula cada día.
 * @param {string[]} dias ISO de la quincena
 * @param {Record<string, {inicio,fin}|{texto}|null|undefined>} horarioTecnico
 * @param {Record<string, string[]>} marcasPorDia 'HH:MM' ordenadas
 * @param {Record<string, {entrada?:string, salida?:string}>} ajustes
 */
export function armarQuincena(dias, horarioTecnico, marcasPorDia, ajustes = {}, feriados = FERIADOS) {
  return dias.map((fecha) => {
    const marcas = marcasPorDia[fecha] || []
    const aj = ajustes[fecha] || {}
    const entrada = aj.entrada || marcas[0] || null
    const salida = aj.salida || (marcas.length > 1 ? marcas[marcas.length - 1] : null)
    const enHorario = Object.prototype.hasOwnProperty.call(horarioTecnico, fecha)
    const asignado = enHorario ? horarioTecnico[fecha] : { texto: 'sin horario cargado' }
    const resultado = calcularDia({ fecha, asignado, entrada, salida, feriado: feriados.includes(fecha) })
    return {
      fecha,
      asignado,
      marcas,
      entrada,
      salida,
      ajustado: Boolean(aj.entrada || aj.salida),
      resultado,
    }
  })
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
