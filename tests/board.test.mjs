import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyBoard, defaultPlacement, constrainPlacement, replaceFastener, fastenerAppearance, fillRepeat, logDose, moveCard, parseBoard, productLink, occasionsForGift, giftIsBought, undoDose } from '../src/lib/board.ts';
const medication = () => ({ id: 'med', profileId: 'pet', name: 'Test medication', strength: '', instructions: '', unit: 'mL', unitsLeft: 2, unitsPerDose: .3, dosesPerDay: 1, refillAt: .5, unitsPerRefill: 10, repeats: 2, logs: [], archived: false });
const board = () => ({ ...emptyBoard(), profiles: [{ id: 'pet', name: 'Test pet', kind: 'pet', birthday: '', species: 'Dog', color: 'sage' }], medications: [medication()] });
test('people and pets can own medications without login identities', () => {
 const state = board(); state.profiles.push({ id: 'person', name: 'Test person', kind: 'person', birthday: '2000-05-20', species: '', color: 'rose' });
 state.medications.push({ ...medication(), id: 'med2', profileId: 'person' });
 assert.equal(parseBoard(JSON.parse(JSON.stringify(state))).medications.length, 2);
});
test('logging and reversing a fractional pet dose preserves the exact supply', () => {
 const med = medication(); const logged = logDose(med, .3, new Date(Date.now() - 1000).toISOString(), 'Test dose');
 assert.equal(logged.unitsLeft, 1.7); assert.equal(med.unitsLeft, 2); assert.equal(logged.logs.length, 1);
 const restored = undoDose(logged, logged.logs[0].id); assert.equal(restored.unitsLeft, 2); assert.equal(restored.logs[0].reversed, true);
 assert.throws(() => undoDose(restored, restored.logs[0].id), /already/);
});
test('rejects invalid, future and insufficient-supply dose entries', () => {
 for (const amount of [-1, 0, NaN, Infinity, 3]) assert.throws(() => logDose(medication(), amount, new Date().toISOString()));
 assert.throws(() => logDose(medication(), .3, 'invalid'));
 assert.throws(() => logDose(medication(), .3, new Date(Date.now() + 86400000).toISOString()), /future/);
});
test('filling a repeat adds supply and consumes one repeat', () => {
 const med = fillRepeat(medication()); assert.equal(med.unitsLeft, 12); assert.equal(med.repeats, 1);
 assert.throws(() => fillRepeat({ ...med, repeats: 0 }));
});
test('rejects orphan recipients, duplicate IDs and malformed persisted data', () => {
 const state = board(); state.medications[0].profileId = 'someone-else'; assert.throws(() => parseBoard(state));
 const dup = board(); dup.profiles.push({ ...dup.profiles[0] }); assert.throws(() => parseBoard(dup));
 assert.throws(() => parseBoard(null)); assert.throws(() => parseBoard({}));
 const invalid = board(); invalid.medications[0].unitsLeft = -2; assert.throws(() => parseBoard(invalid));
});
test('lists, assignments and gift progress survive serialization', () => {
 const state = board(); state.lists.push({ id: 'list', title: 'Weekend jobs', color: 'butter', items: [{ id: 'task', text: 'Test task', done: true, assigneeId: 'pet', due: '2026-11-08' }] }); state.order.push('list');
 state.gifts.push({ id: 'gift', recipientId: 'pet', occasion: 'christmas', year: 2026, name: 'Test present', cost: 12.5, status: 'wrapped', notes: '' });
 assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(state))), state);
 const bad = structuredClone(state); bad.gifts[0].recipientId = 'missing'; assert.throws(() => parseBoard(bad));
});
test('reordering preserves cards and supports moving in either direction', () => {
 assert.deepEqual(moveCard(['a', 'b', 'c'], 'a', 'c'), ['b', 'c', 'a']);
 assert.deepEqual(moveCard(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
 assert.deepEqual(moveCard(['a', 'b', 'c'], 'missing', 'a'), ['a', 'b', 'c']);
 const state = board(); state.order.push('medications'); assert.throws(() => parseBoard(state));
});
test('expanded paper colours and built-in card colours survive reloads', () => {
 const state = board(); state.profiles[0].color = 'teal';
 state.lists.push({ id: 'colour-list', title: 'Colour test', color: 'periwinkle', items: [] }); state.order.push('colour-list');
 state.cardColors = { welcome: 'lavender', medications: 'mint', gifts: 'terracotta' };
 assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(state))), state);
 assert.throws(() => parseBoard({ ...state, cardColors: { welcome: 'invalid' } }));
 assert.throws(() => parseBoard({ ...state, cardColors: { missing: 'rose' } }));
});

test('gift links and prices persist while existing gifts remain readable', () => {
 const state = board();
 const gift = { id: 'gift-link', recipientId: 'pet', occasion: 'birthday', year: 2026, name: 'Test present', cost: 49.95, status: 'idea', notes: '' };
 state.gifts.push(gift);
 assert.doesNotThrow(() => parseBoard(state));
 gift.productUrl = productLink(' https://example.com/products/present?color=green ');
 const saved = parseBoard(JSON.parse(JSON.stringify(state)));
 assert.equal(saved.gifts[0].cost, 49.95);
 assert.equal(saved.gifts[0].productUrl, 'https://example.com/products/present?color=green');
 assert.equal(productLink(''), '');
 for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'https://user:password@example.com', 'not a link']) {
   assert.throws(() => productLink(url));
   assert.throws(() => parseBoard({ ...state, gifts: [{ ...gift, productUrl: url }] }));
 }
});

test('presents support both checkbox occasions and requested progress without counting it as bought', () => {
 const state = board();
 const gift = { id: 'requested-gift', recipientId: 'pet', occasion: 'birthday', occasions: ['birthday', 'christmas'], year: 2026, name: 'Requested present', cost: null, status: 'requested', notes: '' };
 state.gifts.push(gift);
 assert.doesNotThrow(() => parseBoard(JSON.parse(JSON.stringify(state))));
 assert.deepEqual(occasionsForGift(gift), ['birthday', 'christmas']);
 assert.equal(giftIsBought(gift), false);
 assert.equal(giftIsBought({ ...gift, status: 'bought' }), true);
 assert.equal(giftIsBought({ ...gift, status: 'wrapped' }), true);
 assert.deepEqual(occasionsForGift({ ...gift, occasions: undefined }), ['birthday']);
 assert.throws(() => parseBoard({ ...state, gifts: [{ ...gift, occasions: [] }] }));
});

test('free paper placement preserves fractional positions, rotation, overlap and fasteners', () => {
 const state = board();
 state.noteLayout = { welcome: { x: 147.375, y: 221.25, angle: -7.5, z: 8, attachment: 'tape' }, medications: { x: 147.375, y: 221.25, angle: 4, z: 9, attachment: 'pin' } };
 assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(state))).noteLayout, state.noteLayout);
 assert.equal(state.noteLayout.welcome.x, state.noteLayout.medications.x);
 for (const changed of [{ x: NaN }, { y: -1 }, { angle: 26 }, { z: 10001 }, { attachment: 'invalid' }]) {
  assert.throws(() => parseBoard({ ...state, noteLayout: { welcome: { ...state.noteLayout.welcome, ...changed } } }));
 }
 assert.throws(() => parseBoard({ ...state, noteLayout: { missing: defaultPlacement(0) } }));
 assert.equal(constrainPlacement({ ...defaultPlacement(0), x: 200.25 }).x, 200.25);
 assert.equal(constrainPlacement({ ...defaultPlacement(0), x: -2, y: 8000 }).x, 0);
 assert.equal(constrainPlacement({ ...defaultPlacement(0), y: 8000 }).y, 5000);
});
test('tearing puts notes aside without deleting contents, and restoration preserves layout', () => {
 const state = board(); state.noteLayout = { medications: { x: 102.25, y: 55.75, angle: 3, z: 4, attachment: 'loose' } };
 const original = structuredClone(state.medications);
 state.removedNotes = ['medications'];
 const saved = parseBoard(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(saved.medications, original);
 saved.removedNotes = saved.removedNotes.filter(id => id !== 'medications');
 assert.deepEqual(parseBoard(saved).noteLayout, state.noteLayout);
 assert.deepEqual(saved.removedNotes, []);
 assert.throws(() => parseBoard({ ...state, removedNotes: ['medications', 'medications'] }));
 assert.throws(() => parseBoard({ ...state, removedNotes: ['missing'] }));
 assert.doesNotThrow(() => parseBoard(board()));
});

test('a drop chooses a fresh pin or tape with persistent, off-centre appearance', () => {
 const original = { ...defaultPlacement(0), x: 147.375, angle: -3.5 };
 const pin = replaceFastener(original, () => 0);
 const tape = replaceFastener(original, () => .99);
 assert.equal(pin.attachment, 'pin'); assert.equal(tape.attachment, 'tape');
 assert.equal(pin.fastener.variant, 0); assert.equal(tape.fastener.variant, 4);
 assert.notEqual(pin.fastener.offset, 50); assert.notEqual(tape.fastener.offset, 50);
 assert.notEqual(pin.fastener.angle, tape.fastener.angle);
 assert.equal(pin.x, original.x); assert.equal(tape.angle, original.angle);
 const state = board(); state.noteLayout = { welcome: pin, medications: tape };
 assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(state))).noteLayout, state.noteLayout);
 assert.deepEqual(fastenerAppearance(tape), tape.fastener);
 assert.deepEqual(fastenerAppearance(original), fastenerAppearance(original));
 for (const invalid of [{ variant: 5 }, { offset: 90 }, { angle: 31 }, { size: 0 }]) {
  assert.throws(() => parseBoard({ ...state, noteLayout: { welcome: { ...pin, fastener: { ...pin.fastener, ...invalid } } } }));
 }
});
