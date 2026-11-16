# Horas Extras · Avior IT

PWA para calcular las horas extras de la quincena a partir del **horario mensual** y el
**marcaje del Bioadmin**, y llenar el formato oficial **FO-VCH-038/16** en Excel.
Todo se procesa en el dispositivo: los archivos no se suben a ningún servidor.
La plantilla no contiene datos de personas: técnico y firmantes se escriben en la app.

## Uso
1. Escribe tus datos (nombre completo, cédula y código de empleado) y los firmantes
   (revisado por / aprobado por). Quedan guardados en el dispositivo para las próximas
   quincenas.
2. Elige mes y quincena; revisa la fecha de corte.
3. Carga el horario del mes (.xlsx) y verifica tu columna.
4. Carga el marcaje (.xlsx) del Bioadmin.
5. Revisa el **mapa de la quincena**: toca un día para cambiar el horario asignado
   (turnos del horario, Libre u otro), corregir entrada/salida, marcar feriado y ver el
   desglose. Los cambios de guardia se detectan solos y se pueden descartar.
   Los días con turno y sin marcas se resaltan: si trabajaste y el biométrico no lo
   registró, toca **Trabajé, no se registró** y corrige la hora; si no, **No trabajé** y
   elige el motivo (va en la columna 19; tipos en `src/data/ausencias.js`).
6. Observaciones opcionales (campo 20), con atajo para añadir los cambios de guardia.
7. **Generar** → **Descargar** o **Compartir**. Las firmas se hacen a mano en el impreso.

## Reglas de cálculo (`src/lib/motor.js`, `src/data/reglas.js`)
- Bono nocturno: parte del horario asignado entre 19:00 y 04:59.
- Todo lo trabajado fuera del horario asignado (antes o después) es hora extra, por tramo:
  diurna 05:00–18:59, nocturna 19:00–04:59, mixta si abarca ambas
  (con más de 4 h nocturnas cuenta como nocturna).
- Redondeo: medias horas completas + 0,5 si la fracción restante ≥ `umbralMinutos`
  (20 min, pendiente de confirmar).
- Domingo laborado en la rotación, día libre laborado y feriado laborado = 1.
- Cambio de guardia (`src/lib/guardia.js`): si lo marcado cubre menos de la mitad del
  turno asignado y otro turno del horario se cubre al menos en un 60 %, se calcula con
  ese turno. Si otro turno encaja casi completo y claramente mejor, se sugiere.

## Horario
- Si el Excel trae la columna de días de la semana y no coincide con las fechas, se
  corrige el año (p. ej. fechas con 2025 y días de 2026).
- Turnos de más de 16 h se interpretan como hora de 12 h ("05:00 - 01:00" = 05:00–13:00)
  y se avisa para confirmar.

## Desarrollo
```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # pruebas del motor
pnpm build
```

La prueba de integración usa archivos reales en `datos/` (carpeta excluida de Git por
contener datos personales): `datos/horario_octubre.xlsx` y `datos/marcaje.xlsx`.
Si no existen, esa prueba se omite.

## Despliegue
Vercel detecta Vite automáticamente (build `pnpm build`, salida `dist`). No requiere
variables de entorno.
