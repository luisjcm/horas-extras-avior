import { sugerirTecnico } from '../lib/horario.js'
import { combinarMarcajes, sincronizarTecnicos } from '../lib/masivo.js'

export const vibrar = (ms = 30) => navigator.vibrate?.(ms)

// Lleva la vista al primer campo con error y le da el foco (el campo puede aparecer un instante después)
export function enfocarPrimero(id) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    const ahora = document.getElementById(id)
    if (!el) ahora?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ahora?.focus?.({ preventScroll: true })
  }, 300)
}

// El horario del mes es común a los dos módulos: al cargarlo se ajusta la columna del
// técnico individual y la de cada técnico del modo masivo.
export function conHorario(s, horario) {
  return {
    ...s,
    horario,
    columna: sugerirTecnico(s.tecnico.nombre, horario.tecnicos),
    masivo: {
      ...s.masivo,
      tecnicos: sincronizarTecnicos(combinarMarcajes(s.masivo.marcajes), s.masivo.tecnicos, horario, s.tecnico),
    },
  }
}
