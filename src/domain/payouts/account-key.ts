/** Chave da subconta do professor, decifrada na hora de falar com o provedor (nunca vai para log). */
import { openSecret, SUBACCOUNT_KEY_LABEL } from '@/lib/secret-box';
import type { Deps } from '../deps';

export function accountKey(deps: Deps, sealed: Buffer | null): string | undefined {
  return sealed ? openSecret(deps.config.fileEncryptionKeyHex, SUBACCOUNT_KEY_LABEL, sealed) : undefined;
}
