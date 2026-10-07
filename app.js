"use strict";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const $ = (id) => document.getElementById(id);

let data = null;

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const fmt = (min) => {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${m}${suffix}`;
};

// Returns how a room relates to [start, end) on a given day, or null if the
// building is closed for any part of the window or a class overlaps it.
function roomStatus(building, room, day, start, end) {
  const hours = building.hours?.[day];
  if (!hours) return null;
  const open = toMin(hours[0]);
  const close = toMin(hours[1]);
  if (start < open || end > close) return null;

  const busy = (room.busy?.[day] ?? [])
    .map(([a, b]) => [toMin(a), toMin(b)])
    .sort((x, y) => x[0] - y[0]);
  if (busy.some(([a, b]) => a < end && b > start)) return null;

  const before = busy.filter(([, b]) => b <= start).pop();
  const after = busy.find(([a]) => a >= end);
  return {
    freeFrom: before ? before[1] : open,
    freeUntil: after ? after[0] : close,
    open,
    close,
    busy,
  };
}

function timeline(status, start, end) {
  const span = status.close - status.open;
  const pct = (m) => ((m - status.open) / span) * 100;
  const bar = document.createElement("div");
  bar.className = "timeline";
  bar.title = `Open ${fmt(status.open)}–${fmt(status.close)}`;
  for (const [a, b] of status.busy) {
    const seg = document.createElement("span");
    seg.className = "busy";
    seg.style.left = `${pct(a)}%`;
    seg.style.width = `${pct(b) - pct(a)}%`;
    seg.title = `Class ${fmt(a)}–${fmt(b)}`;
    bar.append(seg);
  }
  const win = document.createElement("span");
  win.className = "window";
  win.style.left = `${pct(start)}%`;
  win.style.width = `${pct(end) - pct(start)}%`;
  bar.append(win);
  return bar;
}

function render() {
  if (!data) return;
  const day = $("day").value;
  const start = toMin($("start").value || "00:00");
  const end = toMin($("end").value || "00:00");
  const buildingId = $("building").value;
  const minSeats = Number($("capacity").value) || 0;
  const list = $("results");
  list.replaceChildren();

  if (end <= start) {
    $("summary").textContent = "Pick an end time after the start time.";
    return;
  }

  const matches = [];
  for (const b of data.buildings) {
    if (buildingId && b.id !== buildingId) continue;
    for (const room of b.rooms) {
      if ((room.capacity ?? 0) < minSeats) continue;
      const status = roomStatus(b, room, day, start, end);
      if (status) matches.push({ b, room, status });
    }
  }
  // Rooms that stay free longest after the window come first.
  matches.sort((x, y) => y.status.freeUntil - x.status.freeUntil
    || x.b.name.localeCompare(y.b.name)
    || x.room.name.localeCompare(y.room.name, undefined, { numeric: true }));

  $("summary").textContent = matches.length
    ? `${matches.length} room${matches.length === 1 ? "" : "s"} free from ${fmt(start)} to ${fmt(end)}`
    : `No rooms are free for the whole window from ${fmt(start)} to ${fmt(end)}.`;

  for (const { b, room, status } of matches) {
    const li = document.createElement("li");
    li.className = "room";
    const head = document.createElement("div");
    head.className = "room-head";
    const name = document.createElement("strong");
    name.textContent = `${b.name} ${room.name}`;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = [
      room.capacity ? `${room.capacity} seats` : null,
      `free ${fmt(status.freeFrom)}–${fmt(status.freeUntil)}`,
    ].filter(Boolean).join(" · ");
    head.append(name, meta);
    li.append(head, timeline(status, start, end));
    list.append(li);
  }
}

function setNow() {
  const d = new Date();
  $("day").value = DAYS[d.getDay()];
  const start = Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5;
  const end = Math.min(start + 60, 23 * 60 + 55);
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  $("start").value = hhmm(start);
  $("end").value = hhmm(end);
  render();
}

async function init() {
  const res = await fetch("data/rooms.json");
  data = await res.json();

  $("sample-banner").hidden = !data.sample;
  $("source").textContent = `Data: ${data.source ?? "unknown"}${data.generated ? ` (updated ${data.generated})` : ""}`;

  const select = $("building");
  for (const b of [...data.buildings].sort((x, y) => x.name.localeCompare(y.name))) {
    select.append(new Option(b.name, b.id));
  }

  $("filters").addEventListener("input", render);
  $("now").addEventListener("click", setNow);
  setNow();
}

init().catch((err) => {
  $("summary").textContent = `Couldn't load room data: ${err.message}`;
});
