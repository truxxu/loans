/**
 * `localStorage` puede no estar disponible (modo privado, datos bloqueados), así que
 * todo acceso tolera fallos: sin almacenamiento, las preferencias duran solo la sesión.
 */

/** Prefijo de todas las claves de la app; `clearAppStorage` borra solo esas. */
const PREFIX = 'prestamos:';

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Sin almacenamiento la preferencia dura solo esta sesión.
  }
}

/** JSON guardado en `key`, o null si no existe o está corrupto. */
export function readJSON(key: string): unknown {
  try {
    return JSON.parse(readItem(key) ?? 'null');
  } catch {
    return null;
  }
}

export function clearAppStorage(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // Nada que borrar.
  }
}
