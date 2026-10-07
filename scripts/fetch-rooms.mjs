// Downloads today's classroom schedules from the Penn State map and saves them
// to data/rooms.json, the fallback the site uses when it can't reach the map.
//
// Usage:  npm run fetch
import { writeFile } from "node:fs/promises";
import { fetchRooms } from "../psu-feed.js";

const data = await fetchRooms();
await writeFile(new URL("../data/rooms.json", import.meta.url), JSON.stringify(data, null, 1) + "\n");
const rooms = data.buildings.reduce((n, b) => n + b.rooms.length, 0);
console.log(`Saved ${rooms} rooms in ${data.buildings.length} buildings (${data.generated}).`);
