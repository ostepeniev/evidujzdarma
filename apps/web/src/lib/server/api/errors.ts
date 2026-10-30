/**
 * Katalog kódů chyb EET API v1 (S8, rozd. 3.7). Je to kontrakt: kód se nemění ani nemizí bez nové verze API,
 * test drží snímek katalogu. `message` je anglicky pro vývojáře, české texty jsou jen v UI.
 */
export const ERROR_CATALOG = {
  // celý požadavek
  invalid_request: { http: 400, when: "Invalid JSON, batch size or a field (see `field`)." },
  invalid_token: { http: 401, when: "Missing or unknown token, or a token that is not an integration token." },
  token_revoked: { http: 401, when: "The integration was disconnected by the owner." },
  insufficient_scope: { http: 403, when: "The token lacks the scope this route needs." },
  account_closed: { http: 403, when: "The account is closed: new sales are refused, reading works for 30 days." },
  environment_not_ready: { http: 403, when: "A live token while the account is not in production mode." },
  unit_not_found: { http: 404, when: "The unit does not exist, belongs to another account or is outside the token's units." },
  sale_not_found: { http: 404, when: "The sale does not exist or was not created by this integration." },
  original_not_found: { http: 404, when: "Refund: the original sale does not exist or was not created by this integration." },
  idempotency_conflict: { http: 409, when: "A sale with this id exists with a different body." },
  external_ref_conflict: { http: 409, when: "The externalRef is already used by another sale of this integration." },
  payload_too_large: { http: 413, when: "The body is larger than 1 MB." },
  refund_exceeds_original: { http: 422, when: "Refund: more than is left of the original (quantity, amount, evidenced amount or credit)." },
  original_is_refund: { http: 422, when: "Refund: the original is itself a refund." },
  rate_limited: { http: 429, when: "More than 120 requests per minute per token; see Retry-After." },
  internal_error: { http: 500, when: "Unexpected server error; retry with the same ids – the API is idempotent." },
  // jednotlivá tržba v results[].error (požadavek sám je 200)
  sale_in_future: { http: 422, when: "results[].error: soldAt is more than 10 minutes in the future." },
  sale_too_old: { http: 422, when: "results[].error: soldAt is older than 45 days." },
  amount_out_of_range: { http: 422, when: "results[].error: an amount exceeds the EET limit 99 999 999.99 CZK." },
  unit_not_ready: { http: 422, when: "results[].error: the unit has no FS unit number (id_provozovny) yet." },
  certificate_missing: { http: 422, when: "results[].error: no valid certificate for the environment; the sale waits in the queue." },
  certificate_expired: { http: 422, when: "results[].error: the certificate expired; the sale waits in the queue." },
  sequence_conflict: { http: 422, when: "results[].error: the client-supplied sequence is already used by another sale." },
  sale_blocked: { http: 422, when: "results[].error: the sale waits for the owner (account data); it is kept and sent once fixed." },
  fs_rejected: { http: 422, when: "results[].error: FS rejected the sale (see fsCode)." },
  fs_unavailable: { http: 503, when: "results[].error with retryable: true; FS did not answer, the queue retries – the request itself is 200." },
} as const;

export type ApiErrorCode = keyof typeof ERROR_CATALOG;

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly field?: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.status = ERROR_CATALOG[code].http;
  }
}

/** Chyba jedné tržby v `results[].error`. */
export interface SaleErrorV1 {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  field?: string;
  fsCode?: number;
}
