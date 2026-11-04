// Utilidades de hora y fecha (sin dependencias; las fechas se manejan en UTC).

export function aMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function aHHMM(min) {
  const v = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

export function isoDe(anio, mes, dia) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function partesIso(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return { anio: a, mes: m, dia: d }
}

// 0 = domingo … 6 = sábado
export function diaSemana(iso) {
  const { anio, mes, dia } = partesIso(iso)
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
}

export function diasEnMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

// Número de serie de Excel (días desde 1899-12-30)
export function isoASerial(iso) {
  const { anio, mes, dia } = partesIso(iso)
  return Date.UTC(anio, mes - 1, dia) / 86400000 + 25569
}

export function serialAIso(serial) {
  const d = new Date(Math.round((Math.floor(serial) - 25569) * 86400000))
  return isoDe(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

// Fracción de día de Excel → 'HH:MM'
export function fraccionAHHMM(serial) {
  const min = Math.round((serial - Math.floor(serial)) * 1440)
  return aHHMM(min)
}

export function isoADmy(iso) {
  const { anio, mes, dia } = partesIso(iso)
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`
}

export const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
