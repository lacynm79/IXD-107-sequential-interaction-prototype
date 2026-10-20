# IXD-107-sequential-interaction-prototype
Project 2 interaction prototype for IXD 107, built with Claude Code and published with GitHub Pages.

**Live site:** https://lacynm79.github.io/IXD-107-sequential-interaction-prototype/

## Five More Minutes (the sequence prototype)

One continuous, linear sequence built from the four interaction studies below. Someone is asleep. Their alarm clock goes off, and every time it's silenced it comes back angrier. The day passes in the window, the gestures escalate, and the sleeper still refuses to get up.

| Step | What you do | From study |
| --- | --- | --- |
| Opening | Tap anywhere (or press any key) to disturb the sleeper. The clock wakes up. | — |
| 1. Dawn, 6:00 | Press and hold the snooze bar until it clicks flat. Letting go early springs it back. | Sticky Snooze Bar |
| 2. Midday, 12:47 | Slap the clock four times. Each slap squishes it down, it springs back up, and the ring gets quieter. Clicking off the clock just smacks the air. | Slap the Alarm Quiet |
| 3. Sunset, 6:18 | Shake the fist side to side at the clock (three shakes by default) until the rage fills and it throws the punch. A quick tap is a weak "thud". | Shake Your Fist |
| 4. Night, 11:27 | Grab the clock and fling it into the wall. Too slow and it drops back. | Throw the Clock |
| Ending | The ring dies out, gives one last burst, the hand goes up, the sleeper sighs and rolls over. | — |

Each step only unlocks after the previous one succeeds. Between steps, a snooze lull shows the time skipping forward and the sky changing before the clock jolts back, louder and shakier. The rooster, the neighbor and the cat in the window react along the way.

**Reset:** pull the chain on the light bulb in the top-left corner (the round tag with the reset arrow).

**Tools (panels):** the panels below appear in the Claude artifact preview and in local copies, not on the public GitHub Pages site. GitHub always shows the saved defaults, the same for every visitor (auto-saved edits are ignored there); send Claude a *Copy settings* to make your values the defaults. Add `?tools` to the GitHub address to bring the panels up there for one visit.

**Versions panel:** at the top of the dock. *Auto-save my edits in this browser* (on by default) keeps your panel edits across reloads. *Save version* stores a named snapshot. *Copy all settings* copies every panel's values at once, ready to send to Claude to become the saved defaults. The list shows saved versions plus automatic snapshots (taken while you edit, at most once a minute, and before every restore), each with *Restore* and delete. Versions live in that browser only; to make values permanent for everyone, use *Copy settings* and send it to Claude.

**Triggers panel:** a collapsible panel on the left for what it takes to complete each step: hold time and bar travel for the snooze; slaps needed, minimum time between slaps, hit-area margin and how high the hand lifts between slaps; shakes needed, minimum swing distance, maximum time per swing, how close to the clock shaking starts, and when the rage fades; grab radius, minimum drag distance and minimum fling speed for the throw; the wake-up delay; and the reset light's bulb size, firefly size, chain length and reset tag size. Units and ranges are labeled, changes apply right away, *Show trigger zones* outlines the current hit area on the stage, and *Preview from* replays any step.

**Colors panel:** a collapsible panel below it. Choose an item from the menu (grouped by room, bed, sleeper, nightstand, alarm clock, window cast, reset light; ‹ › step through them), then pick its color from the full-spectrum square and rainbow hue strip, a quick swatch, a hex code, or the system picker. *Item default* resets just that item. Colors change on the stage as you pick them. The rooster and neighbor have a color for each part (body, comb, wattle, beak, eye; face and hands, hair, shirt, eyes, mouth). The window frame, the original sky artwork and the ring lines are bitmaps from the studies and keep their own colors.

**Window panel:** sets what the window shows: follow the story or lock it to dawn, day, sunset or night; turn the rooster, neighbor and cat on or off and resize them. Tabs for Dawn, Day, Sunset and Night each control that sky: the original study artwork (on by default), the sky gradient colors, and an optional sun, moon (full, half or crescent), stars, a comet that streaks across, planets and clouds, each with size, position or count and color. While you edit a tab, the window previews that time of day.

All three panels have *Restore defaults* (back to the saved values in `js/config.js`) and *Copy settings* (copies every name and value with an instruction to save them as the new defaults). Hide any panel with `SHOW_TRIGGER_PANEL` / `SHOW_COLOR_PANEL` / `SHOW_WINDOW_PANEL` in `js/config.js`.

**Motion panel (hidden):** the panel is switched off. To bring it back, set `SHOW_PANEL = true` in `js/config.js`, or add `?panel` to the page address to show it for one visit. When shown, it is a collapsible panel on the left that tunes durations, distances and motion curves (Linear, Ease In, Ease Out, Ease In-Out, Spring/Bounce) for each component, with units and ranges labeled. Changes apply to the next move. *Preview from* replays any step. *Restore defaults* returns to the saved values in `js/config.js`. *Copy settings* copies every current value along with an instruction to save them as the new defaults.

**Keyboard:** any key to start, hold Space for the snooze, Space/Enter to slap, alternate ← → to shake the fist, Space/Enter to throw.

**Sound:** all synthesized in the browser with the Web Audio API. It starts with the first tap or key press.

It's best viewed on a landscape screen. On an upright phone the whole room still fits, but it's small.

### Files

| Path | What it is |
| --- | --- |
| `index.html` | The page: one SVG bedroom with a camera group, plus the reset bulb |
| `css/style.css` | Layout and type |
| `js/config.js` | Saved defaults, the control lists for the three panels, easing curves, and color variables |
| `js/sky.js` | Draws each time of day's window sky from the Window panel settings |
| `js/versions.js` | Auto-save and saved versions (kept in the browser's local storage) |
| `js/panel.js` | The floating control panels (triggers, colors, and the hidden motion panel) |
| `js/audio.js` | Synthesized ring (from Slap the Alarm Quiet), escalation levels, sound effects |
| `js/scene.js` | Shared state and drawing: clock, hand and arm, blanket, window cast, camera, floating text |
| `js/rounds.js` | The four steps, each adapted from its study's code |
| `js/main.js` | The sequence (opening, lulls, jolts, ending), input, and the reset bulb |
| `assets/img/` | Drawings taken from the studies (see `assets/README.md`) |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

Plain HTML, CSS and JavaScript with relative paths. No build step, no dependencies, no server. Open `index.html` directly or publish the repository root with GitHub Pages (`main` / root).

## Interaction studies

The original studies are kept unchanged in their own folders. Each has an `index.html` and a README. All are single-file pages with no dependencies.

| Prototype | Folder | Live page |
| --- | --- | --- |
| Sticky Snooze Bar | [`sticky-snooze-bar/`](sticky-snooze-bar/) | https://lacynm79.github.io/IXD-107-sequential-interaction-prototype/sticky-snooze-bar/ |
| Slap the Alarm Quiet | [`slap-the-alarm-quiet/`](slap-the-alarm-quiet/) | https://lacynm79.github.io/IXD-107-sequential-interaction-prototype/slap-the-alarm-quiet/ |
| Shake Your Fist | [`shake-your-fist/`](shake-your-fist/) | https://lacynm79.github.io/IXD-107-sequential-interaction-prototype/shake-your-fist/ |
| Throw the Clock | [`throw-the-clock/`](throw-the-clock/) | https://lacynm79.github.io/IXD-107-sequential-interaction-prototype/throw-the-clock/ |

## Other pages

- Hello world page: [`hello-world/`](hello-world/), live at https://lacynm79.github.io/IXD-107-sequential-interaction-prototype/hello-world/
