// Schedules as written in the system map, read as Europe/Berlin wall-clock time (the machine they run on).
// Only what the text states is shown: an interval has no known phase, "daily" has no known time.

export const ZONE = "Europe/Berlin";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parse(s) {
  let m;
  if ((m = /^every (\d+) seconds?$/.exec(s))) return { kind: "interval", min: +m[1] / 60, label: s };
  if ((m = /^every (\d+) minutes?$/.exec(s))) return { kind: "interval", min: +m[1], label: s };
  if (s === "hourly") return { kind: "interval", min: 60, label: s };
  if ((m = /^(\d\d):(\d\d) daily$/.exec(s))) return { kind: "daily", h: +m[1], m: +m[2], label: s };
  if ((m = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (\d\d):(\d\d)$/.exec(s))) return { kind: "weekly", dow: DAYS.indexOf(m[1]), h: +m[2], m: +m[3], label: s };
  if (s === "daily") return { kind: "dailyAnyTime", label: s };
  if (s === "always on") return { kind: "always", label: s };
  if (s === "on demand") return { kind: "demand", label: s };
  throw new Error("unknown schedule: " + s);
}

/** Scheduled starts per day; 0 for on demand, Infinity for always on. Weekly counts as 1/7. */
export function perDay(p) {
  return p.kind === "interval" ? 1440 / p.min : p.kind === "daily" || p.kind === "dailyAnyTime" ? 1 : p.kind === "weekly" ? 1 / 7 : p.kind === "always" ? Infinity : 0;
}

/** Minute of the day (0-1439) of each fixed start, for the 24-hour ring. */
export function fixedMinutes(p) {
  return p.kind === "daily" || p.kind === "weekly" ? [p.h * 60 + p.m] : [];
}

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
/** Berlin wall clock for an instant: {y,mo,d,h,mi,s,dow} plus the zone offset in ms. */
export function berlin(date) {
  const o = {};
  for (const part of fmt.formatToParts(date)) o[part.type] = part.value;
  const w = { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second, dow: DAYS.indexOf(o.weekday) };
  w.offset = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(date.getTime() / 1000) * 1000;
  return w;
}

/** Next scheduled start after `now` as a Date, or null when the schedule has no fixed time or the job is paused.
 *  shortcut: uses today's zone offset, so a start in the hour after a DST switch can be off by 60 min; fine for a display. */
export function nextRun(p, now, state = "scheduled") {
  if (state !== "scheduled" || (p.kind !== "daily" && p.kind !== "weekly")) return null;
  const w = berlin(now);
  for (let add = 0; add <= 7; add++) {
    const dow = (w.dow + add) % 7;
    if (p.kind === "weekly" && dow !== p.dow) continue;
    const at = Date.UTC(w.y, w.mo - 1, w.d + add, p.h, p.m) - w.offset;
    if (at > now.getTime()) return new Date(at);
  }
  return null;
}

/** Plain words for the next start, from the visitor's clock. */
export function nextText(p, now, state = "scheduled") {
  if (state === "paused") return "Paused, no run scheduled";
  if (p.kind === "always") return "Always running";
  if (p.kind === "demand") return "Runs when started";
  if (p.kind === "dailyAnyTime") return "Once a day, time not fixed";
  if (p.kind === "interval") return p.min < 1.01 ? "Within a minute" : p.min >= 60 ? "Within the hour" : "Within " + p.min + " min";
  const at = nextRun(p, now, state);
  const mins = Math.round((at - now) / 60000);
  const rel = mins < 60 ? mins + " min" : Math.floor(mins / 60) + " h " + String(mins % 60).padStart(2, "0") + " min";
  const local = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return "In " + rel + ", " + local + " your time";
}

/** Upcoming fixed starts across all jobs, soonest first. */
export function upcoming(nodes, now, n = 5) {
  return nodes
    .map((x) => ({ node: x, at: nextRun(parse(x.schedule), now, x.state) }))
    .filter((x) => x.at)
    .sort((a, b) => a.at - b.at)
    .slice(0, n);
}
