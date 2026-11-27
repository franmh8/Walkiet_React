export const IOS_PUSH_UNAVAILABLE = 'Avisos no disponibles en esta compilación de iOS.';

// Apple may return the missing signing entitlement error in the device's language.
// It describes the installed binary, so changing accounts cannot resolve it.
export function isMissingIosPushEntitlement(cause: unknown, platform: string): boolean {
  if (platform !== 'ios') return false;
  const message = typeof cause === 'string' ? cause
    : cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' ? cause.message : '';
  return /aps-environment/i.test(message) && /no valid|missing|not found|no se encontr[oó]|no .*entitlement/i.test(message);
}
