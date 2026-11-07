import type { WeeklyActivity } from "./board";

const minutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
// An activity without an end is a point in time: don't invent a duration.
const end = (activity: WeeklyActivity) => activity.endTime ? minutes(activity.endTime) : minutes(activity.startTime) + 1;

export function activityGroups(activities: WeeklyActivity[]): WeeklyActivity[][][] {
  const sorted = [...activities].sort((a, b) => minutes(a.startTime) - minutes(b.startTime) || end(b) - end(a) || a.id.localeCompare(b.id));
  const groups: WeeklyActivity[][][] = [];
  let lanes: WeeklyActivity[][] = [];
  let groupEnd = -1;
  for (const activity of sorted) {
    const start = minutes(activity.startTime);
    if (start >= groupEnd) { lanes = []; groups.push(lanes); groupEnd = -1; }
    let lane = lanes.find(lane => end(lane[lane.length - 1]) <= start);
    if (!lane) { lane = []; lanes.push(lane); }
    lane.push(activity);
    groupEnd = Math.max(groupEnd, end(activity));
  }
  return groups;
}
