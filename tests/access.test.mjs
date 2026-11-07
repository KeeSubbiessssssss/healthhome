import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isHouseholdOwner, invitationEmail, invitationHash, invitationToken, checkInvitation } from '../src/lib/access-policy.ts';

test('only the verified personal owner email can bootstrap a household', () => {
  assert.equal(isHouseholdOwner({ email: ' Kee.Sublime@gmail.com ', emailVerified: true }), true);
  for (const user of [{ email: 'kee.sublime@gmail.com', emailVerified: false }, { email: 'kpike@educomit.com.au', emailVerified: true }, { email: 'someone@example.com', emailVerified: true }]) assert.equal(isHouseholdOwner(user), false);
});
test('invitations use unpredictable 256-bit tokens and store only their hash', () => {
  const tokens = Array.from({ length: 50 }, invitationToken);
  assert.equal(new Set(tokens).size, tokens.length);
  for (const token of tokens) { assert.match(token, /^[A-Za-z0-9_-]{43}$/); assert.match(invitationHash(token), /^[a-f0-9]{64}$/); assert.notEqual(invitationHash(token), token); }
  for (const bad of ['', null, {}, 'a'.repeat(42), 'a'.repeat(44), '../invalid']) assert.throws(() => invitationHash(bad));
});
test('only the invited, verified email can redeem an unexpired unused invitation', () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const invite = { email: 'person@example.com', expiresAt: new Date('2026-11-14T00:00:00Z'), acceptedAt: null, revokedAt: null };
  const user = { email: 'PERSON@example.com', emailVerified: true };
  assert.doesNotThrow(() => checkInvitation(invite, user, now));
  assert.throws(() => checkInvitation(invite, { ...user, emailVerified: false }, now));
  assert.throws(() => checkInvitation(invite, { ...user, email: 'other@example.com' }, now));
  for (const invalid of [{ acceptedAt: now }, { revokedAt: now }, { expiresAt: now }, { expiresAt: new Date(now.getTime() - 1) }]) assert.throws(() => checkInvitation({ ...invite, ...invalid }, user, now));
});
test('invitation email input is bounded and normalised without alias guessing', () => {
  assert.equal(invitationEmail(' Person+home@Example.com '), 'person+home@example.com');
  for (const bad of ['', 'not-an-email', 'x@y', 'x\r\n@example.com', 'a'.repeat(250)+'@example.com', 42]) assert.throws(() => invitationEmail(bad));
});
