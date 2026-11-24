import { createHash, timingSafeEqual } from 'node:crypto';

// A 256-bit randomly generated review password is stored only by the owner and
// Play Console. The server receives its digest; it is never in the client bundle.
export function validReviewCredentials(fields, digest = process.env.SANTA_TRACKER_REVIEW_PASSWORD_SHA256) {
  if (!fields || Array.isArray(fields) || Object.keys(fields).some(key => !['action', 'username', 'password'].includes(key)) ||
      fields.action !== 'review-login' || fields.username !== 'play-review' ||
      typeof fields.password !== 'string' || fields.password.length < 32 || fields.password.length > 128 ||
      typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) return false;
  return timingSafeEqual(createHash('sha256').update(fields.password).digest(), Buffer.from(digest, 'hex'));
}
