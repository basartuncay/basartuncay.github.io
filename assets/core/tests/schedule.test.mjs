// node assets/core/tests/schedule.test.mjs
import assert from "node:assert/strict";
import { parse, nextRun, nextText, perDay, berlin, upcoming } from "../schedule.js";
import data from "../nodes.js";

for (const n of data.nodes) parse(n.schedule); // every real schedule parses

// 22 Nov 2026 is a Sunday; 12:00 UTC = 13:00 Berlin (CET, +1)
const now = new Date(Date.UTC(2026, 10, 22, 12, 0));
assert.equal(berlin(now).h, 13);
assert.equal(berlin(now).dow, 0);
assert.equal(nextRun(parse("20:00 daily"), now).toISOString(), "2026-11-22T19:00:00.000Z");
assert.equal(nextRun(parse("10:30 daily"), now).toISOString(), "2026-11-23T09:30:00.000Z"); // already passed today
assert.equal(nextRun(parse("Sun 21:00"), now).toISOString(), "2026-11-22T20:00:00.000Z");
const late = new Date(Date.UTC(2026, 10, 22, 21, 0)); // Sun 22:00 Berlin
assert.equal(nextRun(parse("Sun 21:00"), late).toISOString(), "2026-11-29T20:00:00.000Z");
const summer = new Date(Date.UTC(2026, 6, 1, 12, 0)); // CEST, +2
assert.equal(nextRun(parse("20:00 daily"), summer).toISOString(), "2026-07-01T18:00:00.000Z");
assert.equal(nextRun(parse("10:30 daily"), now, "paused"), null);
assert.equal(nextRun(parse("hourly"), now), null);
assert.equal(nextText(parse("on demand"), now), "Runs when started");
assert.equal(nextText(parse("daily"), now), "Once a day, time not fixed");
assert.equal(nextText(parse("every 60 seconds"), now), "Within a minute");
assert.equal(perDay(parse("every 10 minutes")), 144);
const up = upcoming(data.nodes, now);
assert.equal(up[0].node.id, "library-booking"); // 20:00 is the first fixed start after 13:00
assert.ok(!up.some((x) => x.node.state === "paused"));
console.log("schedule: all checks pass");
