/**
 * SQL da liberação de repasses (§2.6). Fica num lugar só: a varredura do
 * worker e os testes do apêndice usam as mesmas consultas.
 */

/**
 * Reivindica até $2 repasses vencidos em $1 (o "agora" da aplicação), sem
 * disputa aberta, passando-os a 'releasing'. Outro processo pula o que este
 * já pegou (SKIP LOCKED).
 */
export const CLAIM_DUE_PAYOUTS_SQL = `
WITH due AS (
  SELECT p.id
    FROM payouts p
   WHERE p.status = 'held'
     AND p.release_after <= $1::timestamptz
     AND NOT EXISTS (SELECT 1 FROM disputes d
                      WHERE d.booking_id = p.booking_id AND d.status = 'open')
   ORDER BY p.release_after
   LIMIT $2
   FOR UPDATE SKIP LOCKED
)
UPDATE payouts p SET status = 'releasing'
  FROM due WHERE p.id = due.id
RETURNING p.id, p.provider_escrow_id`;

/** Marca como liberado só o que está em 'releasing'. $1 = id, $2 = agora. */
export const MARK_RELEASED_SQL = `
UPDATE payouts SET status = 'released', released_at = $2::timestamptz
 WHERE id = $1 AND status = 'releasing'
RETURNING id`;
