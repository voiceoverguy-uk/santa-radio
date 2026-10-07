// Public subscription endpoint from the owner's supplied Brevo form.
export const BREVO_FORM_URL = 'https://ca61f856.sibforms.com/serve/MUIFALS9-stwC29HOAmz9w7wZgVWtRf7GMFcM0rfGW3XphZO-64RGdnXzZP1oUuEcbL3dtq7sgOersrva7RcSXqWPNBrfDlEFJBr2iEUcVuQtYVonByHO7TpLu3DC0_mpLXM2HETM5mQwW9gf-jxEtiOXQZU56FHHA3_RfU9B-OFn4UTzsX2Dd3IEwoCyXHKmkH5ONcaOOoN9bAM';
export const MESSAGE_ACCESS_KEY = 'santa-message-access';
export const ACCESS_REQUEST_TIMEOUT_MS = 15000;

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
  const body = new FormData();
  for (const name of ['FIRSTNAME', 'LASTNAME', 'EMAIL']) body.append(name, fields[name].trim());
  body.append('email_address_check', fields.email_address_check || '');
  body.append('locale', 'en');
  // Multipart FormData is a simple CORS request: no custom headers or preflight.
  const response = await fetch(`${BREVO_FORM_URL}?isAjax=1`, {
    method: 'POST', body, signal, mode: 'cors', credentials: 'omit',
    redirect: 'error', cache: 'no-store',
  });
  if (response.type === 'opaque' || response.type === 'opaqueredirect') {
    throw new MessageAccessError('We couldn’t confirm your details were accepted. Please try again.');
  }
  let data;
  try { data = await response.json(); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new MessageAccessError('The message desk received an unexpected response. Please try again.');
  }
  signal.throwIfAborted();
  // An HTTP 200, a truthy string or a legacy redirect is NOT acceptance.
  if (response.ok && data?.success === true) return;
  const fieldErrors = {};
  for (const field of ['FIRSTNAME', 'LASTNAME', 'EMAIL']) {
    if (data?.errors && Object.hasOwn(data.errors, field)) {
      fieldErrors[field] = plainText(data.errors[field], 'Please check this field and try again.');
    }
  }
  throw new MessageAccessError(
    plainText(data?.message, 'Your details could not be accepted. Please check them and try again.'),
    fieldErrors,
  );
}
