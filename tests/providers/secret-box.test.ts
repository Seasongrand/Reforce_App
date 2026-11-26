/** Segredos curtos cifrados no banco: ida e volta, rótulo separado e adulteração detectada. */
import { describe, expect, it } from 'vitest';
import { openSecret, sealSecret } from '@/lib/secret-box';

const KEY = 'ab'.repeat(32);

describe('secret-box', () => {
  it('cifra e decifra; o texto não aparece no cifrado; cada vez sai diferente', () => {
    const a = sealSecret(KEY, 'rótulo', '$aact_segredo_123');
    const b = sealSecret(KEY, 'rótulo', '$aact_segredo_123');
    expect(openSecret(KEY, 'rótulo', a)).toBe('$aact_segredo_123');
    expect(a.toString('utf8')).not.toContain('segredo');
    expect(a.equals(b)).toBe(false);
  });

  it('outro rótulo, outra chave ou cifrado adulterado não abrem', () => {
    const a = sealSecret(KEY, 'rótulo', 'x');
    expect(() => openSecret(KEY, 'outro', a)).toThrow();
    expect(() => openSecret('cd'.repeat(32), 'rótulo', a)).toThrow();
    const bad = Buffer.from(a); bad[bad.length - 1]! ^= 1;
    expect(() => openSecret(KEY, 'rótulo', bad)).toThrow();
    expect(() => sealSecret('', 'rótulo', 'x')).toThrow(/FILE_ENCRYPTION_KEY/);
  });
});
