// Tipos de ausencia para un día con turno y sin marcas: los de la cabecera de la
// columna 19 del formato FO-VCH-038/16 ("Injustificada, Justificada, Permiso
// remunerado, Permiso No Remunerado, Reposo, Vacaciones").
// `columnaK` es el texto que se escribe en la columna 19 de ese día.
// `corta` es la etiqueta que se ve en la casilla del mapa.
export const TIPOS_AUSENCIA = [
  { id: 'injustificada', etiqueta: 'Injustificada', corta: 'Injustif.', columnaK: 'Injustificada' },
  { id: 'justificada', etiqueta: 'Justificada', corta: 'Justif.', columnaK: 'Justificada' },
  { id: 'permiso-remunerado', etiqueta: 'Permiso remunerado', corta: 'P. rem.', columnaK: 'Permiso remunerado' },
  { id: 'permiso-no-remunerado', etiqueta: 'Permiso no remunerado', corta: 'P. no rem.', columnaK: 'Permiso no remunerado' },
  { id: 'reposo', etiqueta: 'Reposo', corta: 'Reposo', columnaK: 'Reposo' },
  { id: 'vacaciones', etiqueta: 'Vacaciones', corta: 'Vacac.', columnaK: 'Vacaciones' },
]

export const tipoAusencia = (id) => TIPOS_AUSENCIA.find((t) => t.id === id) || null
