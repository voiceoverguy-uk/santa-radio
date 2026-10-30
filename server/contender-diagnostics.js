// Emit only allowlisted literals. Never include an Error, message, stack, code,
// request object, connection configuration or voter information in the event.
const stages = new Set([
  'request_setup', 'request_signing', 'rate_limit_storage', 'competition_state',
  'ballot_cookie', 'ballot_restore', 'competition_management', 'vote_signing',
  'demo_submission',
]);
const connectivityCodes = new Set([
  'DATABASE_NOT_CONFIGURED', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND',
  'EAI_AGAIN', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
  '28P01', '28000', '3D000', '53300', '53400', '57P01', '57P02', '57P03',
  '57014', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export function contenderFailureDiagnostic(error, stage) {
  const safeStage = stages.has(stage) ? stage : 'request_setup';
  const code = error?.code;
  let category = 'unclassified';
  if (code === 'CONTENDERS_SIGNING_UNAVAILABLE' ||
      ['request_signing', 'vote_signing'].includes(safeStage)) category = 'signing_configuration';
  else if (code === 'CONTENDERS_SETTINGS_MISSING') category = 'competition_settings';
  else if (['42P01', '42703', '3F000'].includes(code)) category = 'missing_schema';
  else if (code === '42501') category = 'permissions';
  else if (connectivityCodes.has(code) || (typeof code === 'string' && /^08[A-Z0-9]{3}$/.test(code))) {
    category = 'db_connectivity';
  }
  return { event: 'christmas_contenders_unavailable', stage: safeStage, category };
}
