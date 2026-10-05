import { fromBase64, toBase64 } from './base64';
import { isRecord, type Backup } from './backup';

/**
 * Respaldo cifrado: el `Backup` serializado dentro de un sobre AES-GCM con clave PBKDF2 a
 * partir de una contraseña propia (no el PIN: el archivo sale del dispositivo y un PIN de
 * 4–6 dígitos se rompe offline). El sobre tiene su propia versión, independiente de
 * `BACKUP_VERSION`. AES-GCM autentica: contraseña incorrecta o archivo alterado ⇒ error.
 */

const ENCRYPTED_FORMAT = 'prestamos-backup-encrypted';
export const BACKUP_PASSWORD_MIN = 8;
const PBKDF2_ITERATIONS = 600_000;

export interface EncryptedBackup {
  format: typeof ENCRYPTED_FORMAT;
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

export const DECRYPT_ERROR = 'Contraseña incorrecta o archivo dañado.';

export const isValidBackupPassword = (text: string) => text.length >= BACKUP_PASSWORD_MIN;

const isBase64 = (v: unknown): v is string => typeof v === 'string' && v !== '' && /^[A-Za-z0-9+/]+={0,2}$/.test(v);

/** ¿Es un sobre cifrado bien formado? Un respaldo en claro devuelve false. */
export function isEncryptedBackup(raw: unknown): raw is EncryptedBackup {
  if (!isRecord(raw) || raw.format !== ENCRYPTED_FORMAT || raw.version !== 1) return false;
  const { kdf, cipher } = raw;
  return (
    isRecord(kdf) &&
    kdf.name === 'PBKDF2' &&
    kdf.hash === 'SHA-256' &&
    Number.isInteger(kdf.iterations) &&
    (kdf.iterations as number) > 0 &&
    isBase64(kdf.salt) &&
    isRecord(cipher) &&
    cipher.name === 'AES-GCM' &&
    isBase64(cipher.iv) &&
    isBase64(raw.data)
  );
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: KeyUsage) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

export async function encryptBackup(
  backup: Backup,
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations, 'encrypt');
  const plain = new TextEncoder().encode(JSON.stringify(backup));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return {
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(data)),
  };
}

/** Devuelve el JSON descifrado, sin validar: debe pasar por `parseBackup` como uno en claro. */
export async function decryptBackup(env: EncryptedBackup, password: string): Promise<unknown> {
  try {
    const key = await deriveKey(password, fromBase64(env.kdf.salt), env.kdf.iterations, 'decrypt');
    const iv = fromBase64(env.cipher.iv);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(env.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error(DECRYPT_ERROR);
  }
}
