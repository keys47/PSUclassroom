// Loads today's classroom schedules from the Penn State map (map.psu.edu runs
// on Concept3D) and converts them to the format described in the README.
// Works in the browser and in Node 18+.
//
// The map's "Classroom Availability" layer has two child categories, Available
// and Unavailable. Each room in them carries an HTML popup with today's
// building hours and the times the room is in use. The feed only covers today.

const API = "https://api.concept3d.com";
const MAP = "1134";
// Public key the map itself sends with every request.
const KEY = "0001085cc708b9cef47080f064612ca5";
const CATEGORIES = [52156, 52157]; // Available, Unavailable

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// "7:00 am" or "09:05:00 pm" -> "HH:MM"
function to24(t) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])m$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "p") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// "UP: Willard Bldg 064" -> ["Willard Bldg", "064"]
// "UP: 101 East Classroom Building" -> ["East Classroom Building", "101"]
// "UP: HUB 117 John Bill Freeman Auditorium" -> ["HUB", "117 John Bill Freeman Auditorium"]
function splitName(full) {
  const words = full.replace(/^[A-Z]+:\s*/, "").trim().split(/\s+/);
  if (/^\d/.test(words[0])) return [words.slice(1).join(" "), words[0]];
  // Skip numbers inside parentheses, e.g. "ECoRE Bldg (West 1) 401".
  let depth = 0;
  const i = words.findIndex((w, j) => {
    const inParens = depth > 0 || w.startsWith("(");
    depth += (w.match(/\(/g)?.length ?? 0) - (w.match(/\)/g)?.length ?? 0);
    return j > 0 && !inParens && /^[A-Z]{0,2}\d/.test(w);
  });
  if (i === -1) return [words.join(" "), ""];
  return [words.slice(0, i).join(" "), words.slice(i).join(" ")];
}

function parseRoom(loc) {
  const html = loc.description ?? "";
  const hoursText = html.match(/Today's Hours of Operation<\/b><\/span><br><p>(.*?)<\/p>/)?.[1] ?? "";
  const range = hoursText.match(/^(.+?)\s+to\s+(.+)$/);
  const hours = range ? [to24(range[1]), to24(range[2])] : null;
  const busy = [...html.matchAll(/<p><b>([^<]+?)\s+-\s+([^<]+?)<\/b><\/p>/g)]
    .map(([, a, b]) => [to24(a), to24(b)])
    .filter(([a, b]) => a && b);
  const updated = html.match(/Last Updated: <\/b>([^<]+)/)?.[1]?.trim();
  const [building, room] = splitName(loc.name);
  return { building, room, hours: hours?.every(Boolean) ? hours : null, busy, updated };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function fetchRooms() {
  const locations = [];
  for (const cat of CATEGORIES) {
    const res = await fetch(`${API}/categories/${cat}?map=${MAP}&children&key=${KEY}`);
    if (!res.ok) throw new Error(`Penn State map returned ${res.status}`);
    locations.push(...((await res.json()).children?.locations ?? []));
  }
  if (!locations.length) throw new Error("Penn State map returned no rooms");

  const rooms = locations.map(parseRoom);
  // "10/07/2026 10:50 AM EDT": the date the schedules are for.
  const stamp = rooms.find((r) => r.updated)?.updated ?? "";
  const [, mm, dd, yyyy] = stamp.match(/^(\d{2})\/(\d{2})\/(\d{4})/) ?? [];
  const date = yyyy ? new Date(Date.UTC(yyyy, mm - 1, dd)) : new Date();
  const day = DAYS[yyyy ? date.getUTCDay() : date.getDay()];

  const buildings = new Map();
  for (const r of rooms) {
    const id = slug(r.building);
    if (!buildings.has(id)) buildings.set(id, { id, name: r.building, hours: { [day]: r.hours }, rooms: [] });
    const b = buildings.get(id);
    // Rooms in one building normally share hours; keep the widest span.
    const h = b.hours[day];
    if (r.hours && (!h || r.hours[0] < h[0] || r.hours[1] > h[1])) {
      b.hours[day] = h ? [r.hours[0] < h[0] ? r.hours[0] : h[0], r.hours[1] > h[1] ? r.hours[1] : h[1]] : r.hours;
    }
    b.rooms.push({ name: r.room, hours: { [day]: r.hours }, busy: { [day]: r.busy } });
  }

  for (const b of buildings.values()) {
    b.rooms.sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
  }

  return {
    sample: false,
    source: "Penn State map (map.psu.edu)",
    generated: stamp || date.toISOString().slice(0, 10),
    days: [day],
    buildings: [...buildings.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
