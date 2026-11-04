import { useEffect, useRef, useState } from 'react'

// Estado autoguardado en localStorage. `migrate` repara datos guardados con
// estructura antigua o incompleta antes de usarlos.
export function usePersistentState(key, initialFn, migrate = (x) => x) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return migrate(JSON.parse(raw))
    } catch {
      /* datos dañados: se empieza de cero */
    }
    return initialFn()
  })
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch {
        /* almacenamiento lleno o bloqueado: se sigue en memoria */
      }
    }, 250)
    return () => clearTimeout(timer.current)
  }, [key, state])
  return [state, setState]
}
