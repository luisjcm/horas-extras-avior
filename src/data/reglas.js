// Reglas de cálculo indicadas por la jefatura (corrección del 03/11/2026).
// Todos los valores están en minutos desde las 00:00.
export const REGLAS = {
  // Franja nocturna: 19:00 a 04:59. Diurna: 05:00 a 18:59.
  nocheInicio: 19 * 60,
  nocheFin: 5 * 60,
  // Fracción mínima (min) para contar media hora extra.
  // PENDIENTE DE CONFIRMAR: los datos reales lo ubican entre 20 y 24 min.
  umbralMinutos: 20,
  // Hora extra mixta con más de 4 h nocturnas se considera nocturna.
  maxNocturnoMixta: 4 * 60,
}
