import { fetchRooms } from "./psu-feed.js";

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

const duration = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

// Higher score sorts first.
const SORTS = {
  // Length of the uninterrupted free block that contains the window.
  stretch: (s) => s.freeUntil - s.freeFrom,
  // How long the room stays free from the chosen start time.
  ahead: (s, start) => s.freeUntil - start,
  // Total class-free time while the building is open that day.
  day: (s) => s.freeAllDay,
};

// Returns how a room relates to [start, end) on a given day, or null if the
// building is closed for any part of the window or a class overlaps it.
function roomStatus(building, room, day, start, end) {
  const hours = room.hours?.[day] ?? building.hours?.[day];
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
  const busyTotal = busy.reduce(
    (sum, [a, b]) => sum + Math.max(0, Math.min(b, close) - Math.max(a, open)), 0);
  return {
    freeFrom: before ? before[1] : open,
    freeUntil: after ? after[0] : close,
    freeAllDay: close - open - busyTotal,
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
  const score = SORTS[$("sort").value] ?? SORTS.stretch;
  matches.sort((x, y) => score(y.status, start) - score(x.status, start)
    || y.status.freeUntil - x.status.freeUntil
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
    if (room.url) {
      const link = document.createElement("a");
      link.href = room.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = "Open on the Penn State map";
      link.textContent = `${b.name} ${room.name}`;
      name.append(link);
    } else {
      name.textContent = `${b.name} ${room.name}`;
    }
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = [
      room.capacity ? `${room.capacity} seats` : null,
      `${duration(status.freeUntil - status.freeFrom)} open (${fmt(status.freeFrom)}–${fmt(status.freeUntil)})`,
      $("sort").value === "day" ? `${duration(status.freeAllDay)} free all day` : null,
    ].filter(Boolean).join(" · ");
    head.append(name, meta);
    li.append(head, timeline(status, start, end));
    list.append(li);
  }
}

function setNow() {
  const d = new Date();
  const today = DAYS[d.getDay()];
  const days = [...$("day").options].map((o) => o.value);
  $("day").value = days.includes(today) ? today : days[0];
  const start = Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5;
  const end = Math.min(start + 60, 23 * 60 + 55);
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  $("start").value = hhmm(start);
  $("end").value = hhmm(end);
  render();
}

// Live schedules from the Penn State map, or the saved copy if that fails.
async function load() {
  try {
    return { ...(await fetchRooms()), live: true };
  } catch (err) {
    console.warn("Live data unavailable, using saved copy:", err);
    const res = await fetch("data/rooms.json");
    return res.json();
  }
}

async function init() {
  data = await load();

  $("sample-banner").hidden = !data.sample;
  $("source").textContent = `Data: ${data.source ?? "unknown"}`
    + (data.generated ? ` (${data.live ? "live, " : "saved copy, "}updated ${data.generated})` : "");

  // The Penn State feed only covers today, so only offer the days we have.
  if (data.days) {
    for (const opt of [...$("day").options]) {
      if (!data.days.includes(opt.value)) opt.remove();
    }
  }
  $("day").disabled = $("day").options.length < 2;
  $("stale-banner").hidden = $("day").options.length !== 1
    || $("day").options[0].value === DAYS[new Date().getDay()];

  // The feed has no seat counts; hide that filter when no room has one.
  $("capacity").closest("label").hidden =
    !data.buildings.some((b) => b.rooms.some((r) => r.capacity));

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
