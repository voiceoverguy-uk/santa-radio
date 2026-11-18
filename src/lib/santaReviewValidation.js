export function validateSantaReview(input = {}) {
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { error: 'Choose one to five stars.' };
  if ([...body].length < 50 || [...body].length > 200) return { error: 'Please write between 50 and 200 characters.' };
  if (displayName.length > 60 || /[\r\n<>]/.test(displayName)) return { error: 'Please use a short adult first name.' };
  if (input.consent === true && !displayName) return { error: 'Add your adult first name if you would like us to feature your review.' };
  return { body, displayName, rating: input.rating, consent: input.consent === true, rewardEmail: input.rewardEmail === true };
}
