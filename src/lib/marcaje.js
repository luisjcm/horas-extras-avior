// Interpreta el reporte de asistencia (Bioadmin):
//   Código | Nombre | Puesto | Hora Marca ("16-10-2026 12:51:25") [| Núm. Identificación]
// Código = cédula del trabajador. Núm. Identificación (formato nuevo) = código de empleado.
import { normalizar } from './horario.js'
import { fraccionAHHMM, isoDe, serialAIso } from './tiempo.js'
import { ErrorArchivo } from './xlsxLectura.js'

const dos = (n) => String(n).padStart(2, '0')
const RE_FECHA_HORA = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?$/i

// → { fecha: 'AAAA-MM-DD', hora: 'HH:MM' } | null
export function interpretarHoraMarca(v) {
  if (typeof v === 'number' && v > 30000) return { fecha: serialAIso(v), hora: fraccionAHHMM(v) }
  const m = RE_FECHA_HORA.exec(String(v ?? '').trim())
  if (!m) return null
  let h = Number(m[4])
  const ampm = m[6]?.toLowerCase()
  if (ampm === 'p' && h < 12) h += 12
  if (ampm === 'a' && h === 12) h = 0
  return { fecha: isoDe(Number(m[3]), Number(m[2]), Number(m[1])), hora: `${dos(h)}:${m[5]}` }
}

export function interpretarMarcaje(filas) {
  let rCab = -1
  let col = {}
  for (let r = 0; r < Math.min(filas.length, 30) && rCab < 0; r++) {
    const fila = filas[r] || []
    const idx = {}
    fila.forEach((v, c) => {
      const t = normalizar(v)
      if (t.includes('identificacion')) idx.identificacion = c
      else if (t === 'codigo' || t === 'cod' || t === 'id') idx.codigo = c
      else if (t === 'nombre' || t === 'nombres') idx.nombre = c
      else if (t === 'puesto' || t === 'cargo') idx.puesto = c
      else if (t.includes('hora marca') || t === 'marca' || t === 'fecha hora') idx.marca = c
    })
    if (idx.marca != null) {
      rCab = r
      col = idx
    }
  }
  if (rCab < 0) throw new ErrorArchivo('No se encontró la columna "Hora Marca" en el marcaje.')

  const empleados = new Map()
  const marcas = []
  let ilegibles = 0
  for (let r = rCab + 1; r < filas.length; r++) {
    const fila = filas[r] || []
    if (fila[col.marca] == null) continue
    const hm = interpretarHoraMarca(fila[col.marca])
    if (!hm) {
      ilegibles++
      continue
    }
    const codigo = String(fila[col.codigo] ?? '').trim() || 'sin-codigo'
    if (!empleados.has(codigo)) {
      empleados.set(codigo, {
        codigo,
        nombre: String(fila[col.nombre] ?? '').trim(),
        puesto: String(fila[col.puesto] ?? '').trim(),
        identificacion: '',
        total: 0,
      })
    }
    const emp = empleados.get(codigo)
    emp.total++
    if (!emp.identificacion && col.identificacion != null) emp.identificacion = String(fila[col.identificacion] ?? '').trim()
    marcas.push({ codigo, ...hm })
  }
  if (!marcas.length) throw new ErrorArchivo('El marcaje no tiene marcas legibles.')
  return { empleados: [...empleados.values()], marcas, ilegibles }
}

// → { 'AAAA-MM-DD': ['HH:MM', ...] } ordenadas y sin duplicados
export function marcasPorDia(marcaje, codigo) {
  const out = {}
  for (const m of marcaje?.marcas || []) {
    if (codigo && m.codigo !== codigo) continue
    ;(out[m.fecha] ||= []).push(m.hora)
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].sort()
  return out
}

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

// "CURBATA MARCANO, LUIS JESUS" → "Luis Jesus Curbata Marcano"
// El Bioadmin escribe "APELLIDOS, NOMBRES" en mayúsculas y sin tildes.
export function nombrePropio(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const [apellidos, nombres] = t.includes(',') ? t.split(',', 2).map((x) => x.trim()) : ['', t]
  return [nombres, apellidos]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es')
    .split(' ')
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase('es') + w.slice(1)))
    .join(' ')
}

/**
 * Datos del técnico tomados del marcaje. Si el técnico ya había corregido su nombre
 * (por ejemplo, tildes: "Jesús") y es la misma persona, se conserva su versión.
 * @returns {{nombre:string, cedula:string, codigo:string}}
 */
export function tecnicoDesdeMarcaje(emp, actual = {}) {
  const cedula = String(emp?.codigo || '').replace(/\D/g, '')
  const nombre = nombrePropio(emp?.nombre)
  const mismo =
    cedula && String(actual.cedula || '').replace(/\D/g, '') === cedula && normalizar(actual.nombre) === normalizar(nombre)
  return {
    nombre: mismo ? actual.nombre.trim() : nombre,
    cedula,
    // Sin Núm. Identificación (formato viejo) se conserva el código escrito antes por esa persona
    codigo: emp?.identificacion || (mismo || String(actual.cedula || '').replace(/\D/g, '') === cedula ? actual.codigo || '' : ''),
  }
}

// Qué días trae el archivo del Bioadmin (de cualquier empleado), para explicar
// por qué un día está vacío: fuera de la descarga, nadie marcó, o solo falta el técnico.
export function coberturaMarcaje(marcaje) {
  const fechas = [...new Set((marcaje?.marcas || []).map((m) => m.fecha))].sort()
  return {
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
    fechas,
    empleados: marcaje?.empleados?.length || 0,
  }
}

// Sugiere el empleado del marcaje según cédula o nombre escritos.
export function sugerirEmpleado(empleados, cedula, nombre) {
  if (!empleados?.length) return ''
  if (empleados.length === 1) return empleados[0].codigo
  const dig = String(cedula || '').replace(/\D/g, '')
  const porCodigo = empleados.find((e) => dig && e.codigo.replace(/\D/g, '') === dig)
  if (porCodigo) return porCodigo.codigo
  const escrito = new Set(normalizar(nombre).split(' '))
  const porNombre = empleados.find((e) => normalizar(e.nombre).replace(',', '').split(' ').every((t) => !t || escrito.has(t)))
  return porNombre?.codigo || ''
}
