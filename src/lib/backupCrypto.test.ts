import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, type Backup } from './backup';
import { fromBase64, toBase64 } from './base64';
import { DECRYPT_ERROR, decryptBackup, encryptBackup, isEncryptedBackup, isValidBackupPassword } from './backupCrypto';

// Pocas iteraciones: los tests prueban el formato, no el costo del KDF.
const FAST = 1000;

const backup: Backup = {
  version: BACKUP_VERSION,
  exportedAt: '2025-03-10T12:00:00.000Z',
  loans: [
    {
      id: 'l1',
      borrower: 'Ána Ñúñez',
      principal: 1_000_000_00,
      currency: 'COP',
      interestRate: 2,
      ratePeriod: 'monthly',
      interestType: 'simple',
      startDate: '2025-01-09',
      interestPeriodDays: 30,
      createdAt: 0,
    },
  ],
  payments: [{ id: 'p1', loanId: 'l1', date: '2025-02-08', amount: 100_000_00, createdAt: 0 }],
};

describe('respaldo cifrado', () => {
  it('ida y vuelta con la contraseña correcta conserva el respaldo', async () => {
    const env = await encryptBackup(backup, 'una clave larga', FAST);
    expect(isEncryptedBackup(env)).toBe(true);
    expect(JSON.stringify(env)).not.toContain('Ána');
    expect(await decryptBackup(env, 'una clave larga')).toEqual(backup);
  });

  it('el sobre sobrevive a JSON y usa sal e IV nuevos cada vez', async () => {
    const a = await encryptBackup(backup, 'una clave larga', FAST);
    const b = await encryptBackup(backup, 'una clave larga', FAST);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.data).not.toBe(b.data);
    const parsed: unknown = JSON.parse(JSON.stringify(a));
    expect(isEncryptedBackup(parsed)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const env = await encryptBackup(backup, 'una clave larga', FAST);
    await expect(decryptBackup(env, 'otra clave larga')).rejects.toThrow(DECRYPT_ERROR);
  });

  it('rechaza datos alterados', async () => {
    const env = await encryptBackup(backup, 'una clave larga', FAST);
    const bytes = fromBase64(env.data);
    bytes[0] = bytes[0]! ^ 1;
    await expect(decryptBackup({ ...env, data: toBase64(bytes) }, 'una clave larga')).rejects.toThrow(DECRYPT_ERROR);
  });

  it('reconoce solo sobres completos', async () => {
    const env = await encryptBackup(backup, 'una clave larga', FAST);
    expect(isEncryptedBackup(backup)).toBe(false);
    expect(isEncryptedBackup(null)).toBe(false);
    expect(isEncryptedBackup({ ...env, version: 2 })).toBe(false);
    expect(isEncryptedBackup({ ...env, data: '' })).toBe(false);
    expect(isEncryptedBackup({ ...env, kdf: { ...env.kdf, iterations: 0 } })).toBe(false);
    expect(isEncryptedBackup({ ...env, cipher: { name: 'AES-CBC', iv: env.cipher.iv } })).toBe(false);
  });

  it('la contraseña pide al menos 8 caracteres', () => {
    expect(isValidBackupPassword('1234567')).toBe(false);
    expect(isValidBackupPassword('12345678')).toBe(true);
  });
});

describe('base64', () => {
  it('codifica arreglos grandes sin reventar la pila', () => {
    const bytes = new Uint8Array(300_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
