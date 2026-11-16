import type { Temporal } from 'temporal-polyfill';

/** Armazenamento privado e cifrado dos documentos de verificação (§3.7). */
export interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  delete(key: string): Promise<void>;
  /** Chaves gravadas sob um prefixo (ex.: os arquivos de uma verificação). */
  list(prefix: string): Promise<string[]>;
  /** Link temporário para quem analisa. */
  signedUrl(key: string, ttlSeconds: number, now: Temporal.Instant): string;
  verifySignature(key: string, exp: string, sig: string, now: Temporal.Instant): boolean;
}
