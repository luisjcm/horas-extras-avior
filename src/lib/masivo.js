// Modo masivo: varios marcajes del Bioadmin (uno por técnico o uno con todos) y un
// horario compartido. Funciones puras; la interfaz está en src/modos/Masivo.jsx.
import { sugerirTecnico } from './horario.js'
import { tecnicoDesdeMarcaje } from './marcaje.js'
import { nombreArchivo } from './periodo.js'

/**
 * Une varios marcajes ya interpretados. Las marcas repetidas (archivos que se solapan)
 * cuentan una sola vez. Empleados ordenados por nombre.
 */
export function combinarMarcajes(lista = []) {
  const empleados = new Map()
  const vistas = new Set()
  const marcas = []
  let ilegibles = 0
  for (const m of lista) {
    ilegibles += m.ilegibles || 0
    for (const e of m.empleados) {
      const prev = empleados.get(e.codigo)
      if (!prev) empleados.set(e.codigo, { ...e, total: 0 })
      else if (!prev.identificacion && e.identificacion) prev.identificacion = e.identificacion
    }
    for (const x of m.marcas) {
      const k = `${x.codigo}|${x.fecha}|${x.hora}`
      if (vistas.has(k)) continue
      vistas.add(k)
      marcas.push(x)
      const e = empleados.get(x.codigo)
      if (e) e.total++
    }
  }
  return {
    archivo: lista.map((m) => m.archivo).filter(Boolean).join(', '),
    empleados: [...empleados.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    marcas,
    ilegibles,
  }
}

/**
 * Actualiza la ficha de cada técnico del marcaje combinado. Las fichas guardan lo que el
 * usuario ajustó (tildes, código, columna, días del mapa, observaciones) y se conservan
 * aunque ese técnico no esté en los archivos actuales, para recordarlo la próxima vez.
 * @param {object} combinado  resultado de combinarMarcajes
 * @param {object} previos    { [cédula]: ficha }
 * @param {object|null} horario
 * @param {object} [individual] técnico del modo individual, para heredar sus correcciones
 */
export function sincronizarTecnicos(combinado, previos = {}, horario = null, individual = null) {
  const out = { ...previos }
  for (const emp of combinado.empleados) {
    const prev = previos[emp.codigo]
    const actual = prev ? { ...prev, cedula: emp.codigo } : individual
    const t = tecnicoDesdeMarcaje(emp, actual || {})
    const columnaValida = prev?.columna && horario?.tecnicos.includes(prev.columna)
    out[emp.codigo] = {
      incluir: prev?.incluir ?? true,
      nombre: t.nombre,
      codigo: t.codigo,
      columna: columnaValida ? prev.columna : (horario && sugerirTecnico(t.nombre, horario.tecnicos)) || '',
      ajustes: prev?.ajustes || {},
      observaciones: prev?.observaciones || '',
    }
  }
  return out
}

// Columnas del horario elegidas por más de un técnico incluido → { columna: [cédulas] }
export function columnasRepetidas(fichas, cedulas) {
  const usos = {}
  for (const c of cedulas) {
    const f = fichas[c]
    if (f?.incluir && f.columna) (usos[f.columna] ||= []).push(c)
  }
  return Object.fromEntries(Object.entries(usos).filter(([, cs]) => cs.length > 1))
}

export function nombreZip(anio, mes, quincena) {
  return nombreArchivo('Help Desk', anio, mes, quincena).replace(/\.xlsx$/, '.zip')
}

// Nombres de archivo únicos: si dos técnicos comparten nombre corto, se numeran
export function nombresUnicos(nombres) {
  const vistos = {}
  return nombres.map((n) => {
    vistos[n] = (vistos[n] || 0) + 1
    return vistos[n] === 1 ? n : n.replace(/\.xlsx$/, `_${vistos[n]}.xlsx`)
  })
}
