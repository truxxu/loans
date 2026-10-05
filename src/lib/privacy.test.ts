// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIVACY_SETTINGS,
  hashPin,
  isValidPin,
  loadPinAttempts,
  loadPrivacySettings,
  lockoutMs,
  NO_ATTEMPTS,
  registerFailure,
  savePinAttempts,
  savePrivacySettings,
  shouldLock,
  verifyPin,
} from './privacy';

beforeEach(() => localStorage.clear());

describe('PIN', () => {
  it('acepta de 4 a 6 dígitos y nada más', () => {
    expect(['1234', '12345', '123456'].every(isValidPin)).toBe(true);
    expect(['123', '1234567', '12a4', ' 1234', ''].some(isValidPin)).toBe(false);
  });

  it('guarda un hash con sal, no el PIN, y lo verifica', async () => {
    const stored = await hashPin('2580');
    expect(JSON.stringify(stored)).not.toContain('2580');
    expect(stored.length).toBe(4);
    expect(await verifyPin('2580', stored)).toBe(true);
    expect(await verifyPin('2581', stored)).toBe(false);
    expect(await verifyPin('25800', stored)).toBe(false);
  });

  it('el mismo PIN da hashes distintos (sal aleatoria)', async () => {
    const [a, b] = await Promise.all([hashPin('1111'), hashPin('1111')]);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('shouldLock', () => {
  it('bloquea solo si estuvo oculta al menos el tiempo configurado', () => {
    expect(shouldLock(null, 1_000_000, 0)).toBe(false);
    expect(shouldLock(1_000, 60_999, 60_000)).toBe(false);
    expect(shouldLock(1_000, 61_000, 60_000)).toBe(true);
    expect(shouldLock(1_000, 1_000, 0)).toBe(true);
  });
});

describe('intentos fallidos', () => {
  it('cinco intentos libres, luego esperas crecientes con tope', () => {
    expect([1, 4].map(lockoutMs)).toEqual([0, 0]);
    expect([5, 6, 7, 8, 20].map(lockoutMs)).toEqual([30_000, 60_000, 300_000, 900_000, 900_000]);
  });

  it('registerFailure cuenta y fija hasta cuándo esperar', () => {
    let a = NO_ATTEMPTS;
    for (let i = 0; i < 4; i++) a = registerFailure(a, 1_000);
    expect(a).toEqual({ failed: 4, lockedUntil: 1_000 });
    expect(registerFailure(a, 1_000)).toEqual({ failed: 5, lockedUntil: 31_000 });
  });

  it('se persisten', () => {
    savePinAttempts({ failed: 6, lockedUntil: 123 });
    expect(loadPinAttempts()).toEqual({ failed: 6, lockedUntil: 123 });
  });
});

describe('loadPrivacySettings', () => {
  it('sin datos o con JSON corrupto: valores por defecto', () => {
    expect(loadPrivacySettings()).toEqual(DEFAULT_PRIVACY_SETTINGS);
    localStorage.setItem('prestamos:privacy', '{no es json');
    expect(loadPrivacySettings()).toEqual(DEFAULT_PRIVACY_SETTINGS);
  });

  it('descarta campos inválidos uno por uno', () => {
    localStorage.setItem('prestamos:privacy', JSON.stringify({ pin: { salt: 'x' }, lockAfterMs: 42, hideAmounts: true }));
    expect(loadPrivacySettings()).toEqual({ ...DEFAULT_PRIVACY_SETTINGS, hideAmounts: true });
  });

  it('ida y vuelta', async () => {
    const settings = { pin: await hashPin('123456'), lockAfterMs: 0, hideAmounts: true };
    savePrivacySettings(settings);
    expect(loadPrivacySettings()).toEqual(settings);
  });
});
