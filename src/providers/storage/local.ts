import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Temporal } from 'temporal-polyfill';
import { hmacHex, safeEqualHex } from '../signing';
import type { FileStorage } from './types';

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_.\-/]*$/;

/**
 * Arquivos cifrados com AES-256-GCM em disco local. Em produção, troca-se por
 * um armazenamento de objetos privado (S3) atrás da mesma interface.
 * Formato: iv (12) | tag (16) | cifrado( u16 tamanho do tipo | tipo | conteúdo ).
 */
export class LocalEncryptedStorage implements FileStorage {
  private readonly key: Buffer;
  private readonly dir: string;

  constructor(private readonly opts: { dir: string; keyHex: string; signingSecret: string; baseUrl: string }) {
    if (!/^[0-9a-fA-F]{64}$/.test(opts.keyHex)) throw new Error('FILE_ENCRYPTION_KEY deve ter 32 bytes em hexadecimal');
    this.key = Buffer.from(opts.keyHex, 'hex');
    this.dir = path.resolve(opts.dir);
  }

  private pathFor(key: string): string {
    if (!KEY_RE.test(key) || key.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')) {
      throw new Error(`chave inválida: ${key}`);
    }
    const full = path.resolve(this.dir, `${key}.enc`);
    if (!full.startsWith(this.dir + path.sep)) throw new Error(`chave inválida: ${key}`);
    return full;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const file = this.pathFor(key);
    const type = Buffer.from(contentType, 'utf8');
    const header = Buffer.alloc(2);
    header.writeUInt16BE(type.length);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(Buffer.concat([header, type, Buffer.from(bytes)])), cipher.final()]);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.concat([iv, cipher.getAuthTag(), enc]), { mode: 0o600 });
  }

  async get(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const raw = await readFile(this.pathFor(key));
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    const len = plain.readUInt16BE(0);
    return { contentType: plain.subarray(2, 2 + len).toString('utf8'), bytes: new Uint8Array(plain.subarray(2 + len)) };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  signedUrl(key: string, ttlSeconds: number, now: Temporal.Instant): string {
    this.pathFor(key);
    const exp = String(Math.floor(now.epochMilliseconds / 1000) + ttlSeconds);
    const q = new URLSearchParams({ key, exp, sig: hmacHex(this.opts.signingSecret, `file|${key}|${exp}`) });
    return `${this.opts.baseUrl}/api/interno/arquivos?${q}`;
  }

  verifySignature(key: string, exp: string, sig: string, now: Temporal.Instant): boolean {
    if (!/^\d+$/.test(exp)) return false;
    if (Math.floor(now.epochMilliseconds / 1000) > Number(exp)) return false;
    return safeEqualHex(sig, hmacHex(this.opts.signingSecret, `file|${key}|${exp}`));
  }
}
