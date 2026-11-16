// Tipos de ausencia para un día con turno y sin marcas.
// `columnaK` es lo que se escribe en la columna 19 ("Tipo de ausencia") del formato.
// PENDIENTE DE CONFIRMAR con la jefatura (pregunta 5): si la columna lleva texto o un
// código. Si piden código, basta con cambiar `columnaK` aquí.
export const TIPOS_AUSENCIA = [
  { id: 'inasistencia', etiqueta: 'Inasistencia', corta: 'Falta', columnaK: 'Inasistencia' },
  { id: 'permiso', etiqueta: 'Permiso', corta: 'Permiso', columnaK: 'Permiso' },
  { id: 'reposo', etiqueta: 'Reposo médico', corta: 'Reposo', columnaK: 'Reposo' },
  { id: 'vacaciones', etiqueta: 'Vacaciones', corta: 'Vacac.', columnaK: 'Vacaciones' },
  { id: 'otro', etiqueta: 'Otro', corta: 'Otro', columnaK: 'Otro' },
]

export const tipoAusencia = (id) => TIPOS_AUSENCIA.find((t) => t.id === id) || null
