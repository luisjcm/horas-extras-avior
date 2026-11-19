# Horas Extras · Avior IT

PWA para calcular las horas extras de la quincena de los técnicos de Help Desk a partir del
**horario mensual** y el **marcaje del Bioadmin**, y llenar el formato oficial
**FO-VCH-038/16 ("Reporte de Tiempo de Personal")** en Excel, sin alterar su estructura.

Producción: https://horas-extras-avior.vercel.app

## Privacidad y seguridad

La app solo procesa archivos que ya se manejan de forma interna (horario y marcaje) y no
expone información sensible:

- **Todo se procesa en el dispositivo.** Los Excel se leen y se generan en el navegador con
  JavaScript. No hay backend, base de datos, API propia ni servicios de terceros: ningún
  archivo ni dato se sube a un servidor.
- **Sin peticiones externas.** La app no carga fuentes, scripts ni recursos de otros sitios,
  y no usa analítica, cookies ni rastreo. La única descarga que hace es la plantilla vacía
  del formato, desde su propio dominio.
- **Lo que se guarda queda en el teléfono.** Los firmantes, los datos de los técnicos y la
  quincena en curso (de los dos módulos) se guardan en el almacenamiento local del navegador (`localStorage`,
  clave `he-avior:v1`) para no repetirlos cada quincena. No salen del dispositivo. **Nuevo**
  borra el marcaje y los ajustes; borrar los datos del sitio en el navegador elimina todo.
- **El repositorio no contiene datos de personas.** La plantilla está limpia (sin nombres,
  cédulas ni autores en metadatos o comentarios) y una prueba falla si vuelven a aparecer.
  Los archivos reales de prueba van en `datos/`, carpeta excluida de Git.
- **Despliegue estático.** Vercel solo sirve los archivos compilados (HTML, JS, CSS e
  iconos). No hay variables de entorno ni secretos.
- **No indexable.** El sitio responde con `X-Robots-Tag: noindex, nofollow` en todas sus
  rutas (`vercel.json`) y lo repite en una etiqueta `<meta name="robots">`, para que los
  buscadores no lo muestren en sus resultados.
- El Excel generado lo descarga o comparte el propio usuario. Las firmas se hacen a mano
  en el impreso.

## Uso

La app tiene dos módulos, que se eligen arriba en la pantalla de Captura. Los dos comparten
los **firmantes**, la **quincena** y el **horario del mes**: se cargan una sola vez.

### Individual (un técnico)

1. **Firmantes** (22. Revisado por, 23. Revisado por y 24. Aprobado por): nombre obligatorio
   y cédula opcional. Quedan guardados para las próximas quincenas.
2. **Quincena:** elige mes y quincena, y revisa la fecha de corte (editable).
3. **Horario del mes (.xlsx):** verifica tu columna; se preselecciona por tu nombre.
4. **Marcaje del Bioadmin (.xlsx):** tus datos se llenan solos y quedan en solo lectura.
   - Código → cédula · Nombre ("APELLIDOS, NOMBRES") → nombre completo ·
     Núm. Identificación → código de empleado.
   - **Corregir tildes** permite ajustar el nombre (el Bioadmin no usa tildes); se recuerda.
   - Con el formato viejo (sin Núm. Identificación) el código de empleado se escribe a mano.
   - Si el archivo trae varios trabajadores, se elige en un selector.
5. **Mapa de la quincena:** toca un día para cambiar el horario asignado (turnos del horario,
   Libre u otro), corregir entrada y salida, marcar feriado y ver el desglose del cálculo.
   - **Cambios de guardia:** se detectan solos y se pueden descartar.
   - **Días con turno y sin marcas:** se resaltan con un aviso y se explica la causa probable
     (falla general del equipo, día fuera de la descarga o solo faltan tus marcas).
     **Trabajé, no se registró** carga el horario asignado para que corrijas la hora real;
     **No trabajé** pide el motivo de la columna 19: Injustificada, Justificada, Permiso
     remunerado, Permiso no remunerado, Reposo o Vacaciones (`src/data/ausencias.js`).
   - **Marca incompleta:** atajo para completar la que falta con la hora del horario.
6. **Observaciones (campo 20, opcional):** un atajo añade lo anotado en el mapa (cambios de
   guardia, marcas cargadas a mano y ausencias).
7. **Generar → Descargar o Compartir.** Si hay días por revisar, se pide confirmación.
   **Corregir** desbloquea la edición.

### Masivo (varios técnicos con el mismo horario)

1. Firmantes, quincena y horario, igual que en el individual.
2. **Marcajes:** carga varios .xlsx a la vez (uno por técnico o uno con todo el equipo).
   Se pueden agregar más o quitar alguno. Si dos archivos repiten marcas, cuentan una vez.
3. **Técnicos:** aparece una ficha por cada trabajador de los marcajes, con sus datos del
   Bioadmin, su columna del horario (elegida por el nombre) y la casilla para incluirlo o no.
   Avisa si dos técnicos quedan con la misma columna.
4. **Revisión por técnico:** se cambia de técnico con las pestañas (el número indica días
   por revisar) y cada uno tiene su mapa y sus observaciones, con las mismas opciones del
   módulo individual.
5. **Generar** crea un formato por técnico, cada uno con él mismo en "Elaborado por".
   **Descargar** baja un .zip con todos; **Compartir** los envía juntos (si el navegador no
   puede, descarga el .zip); en cada tarjeta se puede ver la vista previa o bajar ese Excel.

Lo ajustado en cada técnico (tildes, código, columna) se recuerda para la próxima quincena.

## Reglas de cálculo (`src/lib/motor.js`, `src/data/reglas.js`)

- **Bono nocturno:** parte del horario asignado entre 19:00 y 04:59 (04:30–12:30 = 0,5;
  13:00–21:00 = 2). No depende del marcaje.
- **Horas extras:** todo lo trabajado fuera del horario asignado (antes o después), por tramo:
  diurna 05:00–18:59, nocturna 19:00–04:59, mixta si abarca ambas (con más de 4 h nocturnas
  cuenta como nocturna).
- **Redondeo:** medias horas completas + 0,5 si la fracción restante ≥ `umbralMinutos`
  (20 min, pendiente de confirmar).
- **Domingo** laborado en la rotación, **día libre laborado** (sin horas extras, pendiente de
  confirmar) y **feriado laborado** (`src/data/feriados.js`) = 1.
- **Ausencia:** el día no lleva bono ni horas extras; el motivo va en la columna 19.
- **Cambio de guardia** (`src/lib/guardia.js`): si lo marcado cubre menos de la mitad del
  turno asignado y otro turno del horario se cubre al menos en un 60 %, se calcula con ese
  turno. Si otro turno encaja casi completo y claramente mejor, se sugiere.
- **Por revisar:** turno sin marcas, una sola marca, horario no reconocido (VAC, REPOSO…) o
  posible cambio de guardia.

### Horario

- Si la columna de días de la semana no coincide con las fechas, se corrige el año
  (p. ej. fechas con 2025 y días de 2026).
- Turnos de más de 16 h se interpretan como hora de 12 h ("05:00 - 01:00" = 05:00–13:00) y
  se avisa para confirmar.

## Stack

| Área | Tecnología |
|---|---|
| Interfaz | React 18, Tailwind CSS 3, iconos lucide-react |
| Compilación | Vite 5 (`@vitejs/plugin-react`), PostCSS + Autoprefixer |
| Excel | JSZip 3 + `DOMParser` del navegador (lectura, escritura y .zip del modo masivo) |
| PWA | `manifest.webmanifest` y service worker propio (`public/sw.js`, network-first, uso sin señal) |
| Persistencia | `localStorage` con migración defensiva del estado (`src/lib/estado.js`) |
| Pruebas | Vitest 2 + jsdom |
| Gestor de paquetes | pnpm (Node 18 o superior) |
| Hosting | Vercel (sitio estático) |

**Por qué JSZip y no una librería de hojas de cálculo:** el formato se llena editando
directamente el XML de la hoja, solo los valores de las celdas. Así se conservan intactos el
logo, los estilos, los comentarios, las fórmulas y el área de impresión, que SheetJS u
openpyxl eliminan al reescribir el archivo.

## Estructura

```
src/
  App.jsx                    marco: cabecera, selector de módulo y avisos
  modos/Individual.jsx       módulo individual
  modos/Masivo.jsx           módulo masivo
  components/                MapaQuincena, VistaResultado, secciones comunes, ui
  lib/motor.js               cálculo puro por día y totales
  lib/guardia.js             detección de cambios de guardia
  lib/periodo.js             quincena, ajustes del mapa, textos del formato
  lib/horario.js             lectura del horario mensual
  lib/marcaje.js             lectura del marcaje y datos del técnico
  lib/masivo.js              combinar marcajes y fichas de técnicos (modo masivo)
  lib/archivos.js            descarga, compartir y .zip
  lib/formato.js             llenado del FO-VCH-038/16 (edición del XML)
  lib/estado.js              estado inicial y migración
  data/                      reglas, feriados y tipos de ausencia
  assets/                    plantilla del formato y logo
public/                      manifest, service worker e iconos
tests/                       pruebas del motor, formato, estado y casos reales
```

## Desarrollo

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test
pnpm build
```

La prueba de integración usa archivos reales en `datos/` (`datos/horario_octubre.xlsx` y
`datos/marcaje.xlsx`). Si no existen, se omite.

## Despliegue

Vercel detecta Vite automáticamente (build `pnpm build`, salida `dist`). `vercel.json`
añade `X-Robots-Tag: noindex` a todas las rutas y marca `sw.js` como `no-cache` para que el
navegador busque la versión nueva del service worker en cada visita.

---

Desarrollado por **HelpDesk Avior**.
