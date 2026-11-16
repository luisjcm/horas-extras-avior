// Detección de cambios de guardia. Funciones puras.
//
// Se compara lo marcado con el turno asignado y con los demás turnos del horario:
//  - AUTOMÁTICO: lo marcado cubre menos de la mitad del turno asignado y otro turno
//    del horario queda cubierto al menos en un 60 %. Ej.: asignado 04:30–12:30,
//    marcó 13:24–21:09 → se calcula con 13:00–21:00 (no son 7,5 h extras).
//  - SUGERIDO: el turno asignado se cubre en buena parte, pero otro turno encaja casi
//    completo (≥ 90 %) y claramente mejor (≥ 15 puntos). Se pide confirmación.
// Una llegada tardía (p. ej. turno 04:30, entrada 08:39) no es cambio de guardia
// porque ningún otro turno encaja con lo marcado.
import { solape } from './motor.js'
import { aMinutos } from './tiempo.js'

export const UMBRALES = { asignadoMax: 0.5, alternoMin: 0.6, sugeridoMin: 0.9, sugeridoVentaja: 0.15 }

function rango(turno) {
  const ini = aMinutos(turno.inicio)
  let fin = aMinutos(turno.fin)
  if (fin <= ini) fin += 1440
  return [ini, fin]
}

function cobertura(turno, e, s) {
  const [ini, fin] = rango(turno)
  return solape(e, s, ini, fin) / (fin - ini)
}

export const mismoTurno = (a, b) =>
  a === b || (a != null && b != null && a.inicio === b.inicio && a.fin === b.fin && a.texto === b.texto)

/**
 * @returns {{tipo:'auto'|'sugerido', turno:{inicio,fin}, cobertura:number}|null}
 */
export function detectarCambio(asignado, entrada, salida, catalogo, u = UMBRALES) {
  if (!asignado?.inicio || !entrada || !salida) return null
  const e = aMinutos(entrada)
  let s = aMinutos(salida)
  if (s <= e) s += 1440
  const propio = cobertura(asignado, e, s)
  let mejor = null
  for (const t of catalogo || []) {
    if (mismoTurno(t, asignado)) continue
    const c = cobertura(t, e, s)
    if (!mejor || c > mejor.cobertura) mejor = { turno: t, cobertura: c }
  }
  if (!mejor) return null
  if (propio < u.asignadoMax && mejor.cobertura >= u.alternoMin) return { tipo: 'auto', ...mejor }
  if (mejor.cobertura >= u.sugeridoMin && mejor.cobertura - propio >= u.sugeridoVentaja) {
    return { tipo: 'sugerido', ...mejor }
  }
  return null
}
