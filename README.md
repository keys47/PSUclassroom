# Open Classroom Finder

A small static website for finding Penn State general-purpose classrooms that are
free to study in during a time window. It pulls together the same information
as the "Classroom Availability" filter on the [Penn State map](https://map.psu.edu/?id=1134).
Instead of checking rooms one at a time, you pick a day and time range and get
every room that is free for the whole window.

## Features

- Pick a day, a start and end time, and optionally a building and a minimum number of seats.
- Rooms free for the whole window are listed first, sorted by how long they stay free afterward.
- Each room has a day timeline: grey blocks are classes, and the green band is your window.
- The **Now** button fills in the next hour for today.
- A room only counts as free if its building is open for the whole window.

## Run it

It's plain HTML/CSS/JS with no build step. Serve the folder with any static server:

```sh
npm start          # or: python3 -m http.server
```

You can also host it for free with GitHub Pages: Settings → Pages → deploy from this branch.

## Data

The site reads `data/rooms.json`:

```jsonc
{
  "sample": false,                 // true shows the "sample data" banner
  "source": "Penn State map",      // shown in the footer
  "generated": "2026-10-07",
  "buildings": [
    {
      "id": "1134",
      "name": "Building name",
      "hours": { "mon": ["07:00", "22:00"], "sat": null, ... },  // null = closed
      "rooms": [
        {
          "name": "101",
          "capacity": 40,
          "busy": { "mon": [["08:00", "08:50"], ["10:10", "11:00"]], ... }
        }
      ]
    }
  ]
}
```

**The file in the repo is generated sample data, not real schedules.** The
cloud environment that built this site couldn't reach `map.psu.edu`, so the
real API hasn't been wired up yet.

### Finding the real data source

Run this on your own computer:

```sh
npm install
npm run capture
```

A browser opens on the Penn State map. Turn on the **Classroom Availability**
filter and click a few buildings and rooms, then close the window. Every JSON
response the map loaded is saved to `captures/`, and `captures/index.json`
lists the URLs. Those URLs show which API serves the room schedules. From there,
a script can fetch them and convert them into `data/rooms.json`.
