// Legacy form URL retained for old test fixtures; verification never submits it.
export const BREVO_FORM_URL = 'https://ca61f856.sibforms.com/serve/MUIFALS9-stwC29HOAmz9w7wZgVWtRf7GMFcM0rfGW3XphZO-64RGdnXzZP1oUuEcbL3dtq7sgOersrva7RcSXqWPNBrfDlEFJBr2iEUcVuQtYVonByHO7TpLu3DC0_mpLXM2HETM5mQwW9gf-jxEtiOXQZU56FHHA3_RfU9B-OFn4UTzsX2Dd3IEwoCyXHKmkH5ONcaOOoN9bAM';
export const MESSAGE_ACCESS_KEY = 'santa-message-access';
export const ACCESS_REQUEST_TIMEOUT_MS = 30000;

export function validateAccessFields(fields) {
  const errors = {};
  for (const [name, label] of [['FIRSTNAME', 'first name'], ['LASTNAME', 'surname']]) {
    const value = fields[name]?.trim() || '';
    if (!value) errors[name] = `Please enter your ${label}.`;
    else if (value.length > 200) errors[name] = `Please keep your ${label} under 201 characters.`;
  }
  const email = fields.EMAIL?.trim() || '';
  if (!email) errors.EMAIL = 'Please enter your email address.';
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.EMAIL = 'Please enter a valid email address, such as name@example.com.';
  }
  return errors;
}

// Provider errors are text only, never HTML inserted into the page.
function plainText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300) || fallback;
}

export class MessageAccessError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'MessageAccessError';
    this.fieldErrors = fieldErrors;
  }
}

export async function submitMessageAccess(fields, signal) {
  const body = fields.action === 'confirm-code' ? { action: fields.action, verificationId: fields.verificationId, code: fields.code } : Object.fromEntries(['FIRSTNAME', 'LASTNAME', 'EMAIL'].map(name => [name, fields[name].trim()]));
  if (fields.action !== 'confirm-code') { body.action = 'request-code'; body.marketingOptIn = fields.marketingOptIn === true; body.studio_check = fields.studio_check || ''; }
  // Only code confirmation can issue the server's verified access cookie.
  const response = await fetch('/api/santa-message-access', {
    method: 'POST', body: JSON.stringify(body), signal, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'error', cache: 'no-store',
  });
  if (response.type === 'opaque' || response.type === 'opaqueredirect') {
    throw new MessageAccessError('We couldn’t confirm your details were accepted. Please try again.');
  }
  let data;
  try { data = await response.json(); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new MessageAccessError('The recording studio received an unexpected response. Please try again.');
  }
  signal.throwIfAborted();
  // An HTTP 200, a truthy string or a legacy redirect is NOT acceptance.
  if (response.ok && fields.action === 'confirm-code' && data?.success === true) return data;
  if (response.ok && fields.action !== 'confirm-code' && data?.state === 'verification' &&
      /^[a-f0-9-]{36}$/.test(data.verificationId || '')) return data;
  const fieldErrors = {};
  const supportedFields = ['FIRSTNAME', 'LASTNAME', 'EMAIL'];
  const submittedFields = [...supportedFields, 'email_address_check', 'locale'];
  const providerErrors = data?.errors;
  const unsupportedFields = providerErrors && typeof providerErrors === 'object' && !Array.isArray(providerErrors)
    ? Object.keys(providerErrors).filter(field => !submittedFields.includes(field))
    : [];
  for (const field of supportedFields) {
    if (data?.errors && Object.hasOwn(data.errors, field)) {
      fieldErrors[field] = plainText(data.errors[field], 'Please check this field and try again.');
    }
  }
  if (unsupportedFields.length) {
    throw new MessageAccessError(
      unsupportedFields.includes('CHILD_DATE_OF_BIRTH')
        ? 'The recording studio’s Brevo form still requires a child’s date of birth. This website only collects adult contact details. Please contact Santa Radio so we can correct the form settings.'
        : 'The recording studio’s signup form requires an extra field that this website doesn’t collect. Please contact Santa Radio so we can correct the form settings.',
      fieldErrors,
    );
  }
  throw new MessageAccessError(
    plainText(data?.message, 'Your details could not be accepted. Please check them and try again.'),
    fieldErrors,
  );
}
