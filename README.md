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
5. Revisa los días: toca uno para ver el desglose o corregir entrada/salida.
6. **Generar** → **Descargar** o **Compartir**. Las firmas se hacen a mano en el impreso.

## Reglas de cálculo (`src/lib/motor.js`, `src/data/reglas.js`)
- Bono nocturno: parte del horario asignado entre 19:00 y 04:59.
- Todo lo trabajado fuera del horario asignado (antes o después) es hora extra, por tramo:
  diurna 05:00–18:59, nocturna 19:00–04:59, mixta si abarca ambas
  (con más de 4 h nocturnas cuenta como nocturna).
- Redondeo: medias horas completas + 0,5 si la fracción restante ≥ `umbralMinutos`
  (20 min, pendiente de confirmar).
- Domingo laborado en la rotación, día libre laborado y feriado laborado = 1.

## Desarrollo
```powershell
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
