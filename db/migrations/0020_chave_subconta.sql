-- Chave de API da subconta do professor no Asaas, cifrada (AES-256-GCM com
-- chave derivada de FILE_ENCRYPTION_KEY). O Asaas só deixa consultar e liberar
-- a retenção (Conta Escrow) com a chave da própria subconta (26/11).
ALTER TABLE teacher_payment_accounts ADD COLUMN api_key_ciphertext bytea;
