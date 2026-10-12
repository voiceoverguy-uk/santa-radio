// A carried name is only a search request, never proof of a recording.
export function santaMessageRequestedName(value) {
  if (typeof value !== 'string') return '';
  const name = value.normalize('NFKC').trim();
  return /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 '_-]{0,79}$/u.test(name) ? name : '';
}
