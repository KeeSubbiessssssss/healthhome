import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityGroups } from '../src/lib/schedule-layout.ts';
const item = (id, startTime, endTime = '') => ({ id, startTime, endTime });
const ids = groups => groups.map(lanes => lanes.map(lane => lane.map(a => a.id)));
test('overlapping times share a group in separate lanes; touching boundaries do not overlap', () => {
 assert.deepEqual(ids(activityGroups([item('later', '18:00', '19:00'), item('dance', '16:00', '18:00'), item('gym', '15:45', '19:15')])), [[['gym'], ['dance', 'later']]]);
 assert.deepEqual(ids(activityGroups([item('a', '09:00', '10:00'), item('b', '10:00', '11:00')])), [[['a']], [['b']]]);
});
test('three simultaneous activities retain three readable lanes, and later activities reset', () => {
 assert.deepEqual(ids(activityGroups([item('a', '09:00', '12:00'), item('b', '10:00', '11:00'), item('c', '10:30', '11:30'), item('d', '13:00', '14:00')])), [[['a'], ['b'], ['c']], [['d']]]);
});
test('activities without end times do not get an invented duration or mutate input', () => {
 const input = [item('b', '09:30'), item('a', '09:00')];
 assert.deepEqual(ids(activityGroups(input)), [[['a']], [['b']]]);
 assert.equal(input[0].id, 'b');
 assert.deepEqual(ids(activityGroups([item('a', '09:00'), item('b', '09:00')])), [[['a'], ['b']]]);
 assert.deepEqual(activityGroups([]), []);
});

test('overlap geometry preserves proportional starts, lengths and shared interval', async () => {
 const { timedActivityLayout } = await import('../src/lib/schedule-layout.ts');
 const a = item('a', '15:45', '19:15'); const b = item('b', '16:00', '18:00');
 const layout = timedActivityLayout([[a], [b]], { a: 140, b: 120 });
 const first = layout.items[0]; const second = layout.items[1];
 assert.equal(second.top, 15);
 assert.equal(first.height, 210); assert.equal(second.height, 120);
 assert.equal(second.top / first.height, 15 / 210);
 assert.equal(layout.height, first.height);
});
