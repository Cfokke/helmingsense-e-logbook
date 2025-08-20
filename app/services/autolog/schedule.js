// app/services/autolog/schedule.js
// Utilities to schedule an action exactly at top-of-hour ticks (UTC).

export function nextTopOfHourMs(from = new Date()) {
  const d = new Date(from.getTime());
  d.setUTCMinutes(0, 0, 0);                 // snap to hour start
  if (from.getUTCMinutes() !== 0 || from.getUTCSeconds() !== 0 || from.getUTCMilliseconds() !== 0) {
    d.setUTCHours(d.getUTCHours() + 1);     // move to next hour start if not already at :00
  }
  return d.getTime();
}

export function msUntil(tsMs, from = Date.now()) {
  return Math.max(0, tsMs - from);
}

export function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
