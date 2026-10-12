# F1 Race Control Ticker Card (`custom:f1-ticker-card`)

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/default)
[![version](https://img.shields.io/badge/version-1.4.0-e10600.svg)](https://github.com)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue.svg)](https://www.home-assistant.io)

A smooth, hardware-accelerated animated marquee ticker card for Formula 1 race control announcements, steward investigations, track limits warnings, fastest laps, DRS battles, pit stops, track status flags, weather, and FIA bulletins in Home Assistant Lovelace dashboards.

Designed specifically to match the official **Formula 1 Weekend Hub / Pit Wall** design standards with embedded official Formula 1 typography (`Formula1 Display` and `Formula1 Wide`), dynamic track status colors, and dark surface styling (`#15151e`).

---

## ✨ Features

- 🏎️ **Ultra-Smooth 60 FPS requestAnimationFrame Engine**: Unlike CSS marquees that reset or stutter on Home Assistant state changes, the custom rAF loop continuously maintains scroll position seamlessly through live/replay telemetry updates.
- 🔤 **Authentic Formula 1 Typography**: Embedded WOFF2 fonts matching `Nicxe/f1_sensor` (`Formula1 Display` for body/values and `Formula1 Wide` for titles/badges).
- 🔴 **Smart Session Mode Pill**: The status badge in the corner automatically detects session state:
  - **`⏪ REPLAY RUNNING`** / **`[REPLAY PAUSED]`** (Cyan badge): When watching a recorded session via Replay mode (`input_boolean.f1_replay_mode` or `sensor.f1_replay_status`).
  - **`🔴 LIVE SESSION`** (Red pulsing badge): During live on-track Grand Prix sessions.
  - **`🟢 BEFORE`** (Emerald badge): Pre-session or idle track state.
- 🎛️ **Full Visual UI Editor**: Configure scroll speed, titles, and pick exactly which ticker categories appear directly from the dashboard card settings UI without writing YAML.
- 🔘 **Granular Category Toggles**:
  - 🚨 **Race Control Messages**: Official race director flags, safety cars, and instructions
  - 🔍 **Steward Investigations**: Inquiries, penalties, and driver citations
  - 🛑 **Track Limits**: Corner track limits warnings and deleted laps
  - 🚦 **Track Status**: Global track flags (Clear, Yellow, VSC, Safety Car, Red Flag)
  - ⚡ **Fastest Lap**: Real-time fastest lap driver, sector time, and lap number (Purple tag)
  - ⚔️ **DRS Battles**: On-track driver battles within 1.2s DRS interval (e.g. `P1 VER vs P2 LEC (+0.88s)`)
  - 🛞 **Pit Stops**: Real-time in-pit lane notifications and total stop counts
  - 🏆 **Top 3 Leaders**: Current podium order with gaps to leader
  - 🌡️ **Track & Weather**: Track temperature, air temperature, and rainfall alerts
  - 🏁 **Lap Progress**: Current lap and total race distance
  - 📄 **FIA Decision Documents**: Published official bulletin documents (e.g. `Doc 91`)
  - 🏁 **Next Race Countdown**: Upcoming Grand Prix round & venue countdown
- ⏸️ **Hover / Touch to Pause**: Hovering with mouse or touching on mobile pauses scrolling so you can comfortably read fast-paced notices.
- 🔄 **Continuous Seamless Loop**: Dual-buffer track prevents gaps or jerky restarts.
- 📐 **Full-Width Dashboard Spanning**: Optimized for Lovelace `sections` view with `column_span: 4` to span edge-to-edge across all dashboard columns.

---

## 📦 Installation

### Option 1: HACS (Recommended)

1. Open **HACS** in your Home Assistant sidebar.
2. Click the three dots menu (**⋮**) in the top right corner and choose **Custom repositories**.
3. Paste the repository URL:
   ```text
   https://github.com/<your-username>/f1-ticker-card
   ```
4. Select Category: **Dashboard** (or **Lovelace**).
5. Click **Add**, find **F1 Race Control Ticker Card**, and click **Download**.
6. When prompted, reload your browser.

---

### Option 2: Manual Installation

1. Download [`f1-ticker-card.js`](f1-ticker-card.js) from the latest release.
2. Copy `f1-ticker-card.js` into your Home Assistant `/config/www/` directory (e.g. `/config/www/f1-ticker-card.js`).
3. Add the resource in **Home Assistant** -> **Settings** -> **Dashboards** -> **Resources** (top right menu):
   - **URL**: `/local/f1-ticker-card.js`
   - **Resource type**: `JavaScript Module`
4. Hard refresh your browser (`Ctrl+Shift+R` or clear browser cache).

---

## 🚀 Lovelace Configuration

### Full-Width Banner in Sections View (Recommended)
Place the card in a grid section with `column_span: 4` so it stretches across the entire screen:

```yaml
views:
  - title: F1 Pit Wall
    path: f1
    type: sections
    max_columns: 4
    sections:
      - type: grid
        column_span: 4
        cards:
          - type: custom:f1-ticker-card
            title: "LIVE RACE CONTROL TICKER"
            subtitle: "INCIDENTS & TRACK LIMITS"
            speed: 35
            show_race_control: true
            show_investigations: true
            show_track_limits: true
            show_track_status: true
            show_fastest_lap: true
            show_battles: true
            show_pit_stops: true
            show_leaders: false
            show_weather: false
            show_lap_count: false
            show_fia_documents: false
            show_next_race: false
```

---

## ⚙️ Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | string | `LIVE RACE CONTROL TICKER` | Primary card title in header bar |
| `subtitle` | string | `INCIDENTS & TRACK LIMITS` | Subtitle displayed next to title |
| `speed` | number | `35` | Marquee scroll speed in seconds per full cycle (10 to 120s) |
| `show_race_control` | boolean | `true` | Display official Race Control flags, safety cars, and instructions |
| `show_investigations` | boolean | `true` | Display active steward inquiries and penalty decisions |
| `show_track_limits` | boolean | `true` | Display corner track limits warnings and deleted laps |
| `show_track_status` | boolean | `true` | Display global track status flags (Clear, Yellow, VSC, SC, Red) |
| `show_fastest_lap` | boolean | `true` | Display current fastest lap driver, sector time, and lap |
| `show_battles` | boolean | `true` | Display live battles within 1.2s DRS interval |
| `show_pit_stops` | boolean | `true` | Display drivers entering pit lane and total stops |
| `show_leaders` | boolean | `false` | Display P1, P2, P3 positions and gap to leader |
| `show_weather` | boolean | `false` | Display track temperature, air temperature, and rain |
| `show_lap_count` | boolean | `false` | Display current lap number and race distance |
| `show_fia_documents` | boolean | `false` | Display published FIA bulletin classification documents |
| `show_next_race` | boolean | `false` | Display upcoming Grand Prix round & venue countdown |
| `race_control_entity` | string | `sensor.f1_race_control` | Entity ID for race control notices |
| `investigations_entity` | string | `sensor.f1_investigations` | Entity ID for steward investigations |
| `track_limits_entity` | string | `sensor.f1_track_limits` | Entity ID for track limits violations |
| `track_status_entity` | string | `sensor.f1_track_status` | Entity ID for track status |
| `driver_positions_entity` | string | `sensor.f1_driver_positions` | Entity ID for fastest laps, DRS gaps, and battles |
| `pitstops_entity` | string | `sensor.f1_pitstops` | Entity ID for pit stop records |
| `track_weather_entity` | string | `sensor.f1_track_weather` | Entity ID for track and air temperature |
| `lap_count_entity` | string | `sensor.f1_race_lap_count` | Entity ID for lap progress |
| `replay_mode_entity` | string | `input_boolean.f1_replay_mode` | Entity ID for Replay Mode boolean |
| `replay_status_entity` | string | `sensor.f1_replay_status` | Entity ID for F1 Replay engine status |
| `fia_documents_entity` | string | `sensor.f1_fia_documents` | Entity ID for FIA decision documents |
| `next_race_entity` | string | `sensor.f1_next_race` | Entity ID for upcoming race info |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
