# Open Classroom Finder

A small static website for finding Penn State general-purpose classrooms that are
free to study in during a time window. It pulls together the same information
as the "Classroom Availability" filter on the [Penn State map](https://map.psu.edu/?id=1134).
Instead of checking rooms one at a time, you pick a day and time range and get
every room that is free for the whole window.

## Features

- Pick a day, a start and end time, and optionally a building and a minimum number of seats.
- Only rooms free for the whole window are listed. By default they're sorted by the **longest open
  stretch**: the uninterrupted free block around your window, longest first. You can also sort by
  how long a room stays open from your start time, or by total free time that day.
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

The schedules come from the same feed as the **Classroom Availability** layer on the
[Penn State map](https://map.psu.edu/?id=1134). That map runs on Concept3D, and the layer
lists about 380 University Park classrooms. For each room it gives today's building hours
and the times the room is in use.

- `psu-feed.js` downloads that feed and converts it to the format below. The site calls it
  directly in the browser on every page load, so the data is always current.
- If the map can't be reached, the site falls back to the saved copy in `data/rooms.json`
  and shows a banner if that copy is from a different day. Refresh the copy with
  `npm run fetch` (Node 18+).

What the feed doesn't have:

- **Other days.** The map only publishes today's schedule, so the day picker only offers today.
- **Seat counts.** The "Min seats" filter is hidden unless the data includes `capacity`.

`data/rooms.json` format:

```jsonc
{
  "sample": false,                 // true shows the "sample data" banner
  "source": "Penn State map",      // shown in the footer
  "generated": "10/07/2026 10:50 AM EDT",
  "days": ["wed"],                 // days the data covers; limits the day picker
  "buildings": [
    {
      "id": "willard-bldg",
      "name": "Willard Bldg",
      "hours": { "wed": ["07:00", "23:00"] },  // null = closed
      "rooms": [
        {
          "name": "064",
          "capacity": 40,                      // optional
          "hours": { "wed": ["07:00", "23:00"] }, // optional, overrides the building's
          "busy": { "wed": [["09:05", "10:20"], ["11:15", "12:05"]] }
        }
      ]
    }
  ]
}
```

`npm run capture` (needs `npm install`) opens the map in a browser and saves every JSON
response it loads to `captures/`. It's useful if the map's feed changes and
`psu-feed.js` needs updating.
