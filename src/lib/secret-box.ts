/**
 * Cifra segredos curtos guardados no banco (ex.: chave da subconta do
 * professor no Asaas) com AES-256-GCM. A chave é derivada (HKDF) de
 * FILE_ENCRYPTION_KEY com um rótulo próprio, para não reutilizar a mesma
 * chave dos documentos. Formato: iv (12) | tag (16) | texto cifrado.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

function keyFor(masterHex: string, label: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(masterHex)) throw new Error('FILE_ENCRYPTION_KEY ausente ou inválida');
  return Buffer.from(hkdfSync('sha256', Buffer.from(masterHex, 'hex'), Buffer.alloc(0), label, 32));
}

export function sealSecret(masterHex: string, label: string, plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(masterHex, label), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function openSecret(masterHex: string, label: string, sealed: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', keyFor(masterHex, label), sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString('utf8');
}

export const SUBACCOUNT_KEY_LABEL = 'reforce:asaas-subconta';
