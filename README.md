# F1 Race Control Ticker Card (`custom:f1-ticker-card`)

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/default)
[![version](https://img.shields.io/badge/version-1.0.0-e10600.svg)](https://github.com)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue.svg)](https://www.home-assistant.io)

A smooth, hardware-accelerated animated marquee ticker card for Formula 1 race control announcements, steward investigations, track limits warnings, flags, and FIA bulletins in Home Assistant Lovelace dashboards.

Designed specifically to match the official **Formula 1 Pit Wall** aesthetic with dark gradients, signature FIA badges, and red accent borders (`#e10600`).

---

## ✨ Features

- 🏎️ **Native Shadow DOM Marquee**: Hardware-accelerated CSS marquee animation that will never be stripped or broken by Home Assistant's DOMPurify sanitizer.
- 🎛️ **Full Visual UI Editor**: Configure scroll speed, titles, and pick exactly which ticker categories appear directly from the dashboard card settings UI without writing YAML.
- 🔘 **Granular Category Toggles**:
  - 🚨 Official Race Director messages & Safety Car alerts
  - 🔍 Steward Investigations & Penalty notices
  - 🛑 Track Limits violations & deleted lap times
  - 🚦 Global Track Status (Green / Clear, Yellow, VSC, Safety Car, Red Flag)
  - 📄 FIA Decision Documents (optional)
  - 🏁 Next Race Countdown & venue info (optional)
- ⏸️ **Hover / Touch to Pause**: Hovering or touching the ticker pauses scrolling so you can comfortably read fast-paced race control notices.
- 🔄 **Continuous Seamless Loop**: Dual-buffer track prevents gaps or jerky restarts.
- 📡 **Intelligent Standby Fallback**: When live race sessions are idle, the card automatically displays track status and upcoming Grand Prix countdown instead of blank text.

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

### Using the Visual Card Editor
Add a new card to your dashboard and select **F1 Race Control Ticker Card**. You can interactively:
- Customize header title and subtitle.
- Adjust marquee scroll duration (10–120 seconds).
- Toggle Race Control, Steward Investigations, Track Limits, Track Status, FIA Documents, and Next Race.

---

### YAML Configuration

#### Minimal Setup (Recommended Defaults)
```yaml
type: custom:f1-ticker-card
title: "LIVE RACE CONTROL TICKER"
subtitle: "INCIDENTS & TRACK LIMITS"
speed: 35
```

#### Customized Setup (Excluding FIA Documents & Next Race)
```yaml
type: custom:f1-ticker-card
title: "LIVE RACE CONTROL TICKER"
subtitle: "INCIDENTS & TRACK LIMITS"
speed: 30
show_race_control: true
show_investigations: true
show_track_limits: true
show_track_status: true
show_fia_documents: false
show_next_race: false
```

#### Full Setup with Custom Entity IDs
```yaml
type: custom:f1-ticker-card
title: "LIVE RACE CONTROL TICKER"
subtitle: "INCIDENTS & TRACK LIMITS"
speed: 40
show_race_control: true
show_investigations: true
show_track_limits: true
show_track_status: true
show_fia_documents: false
show_next_race: false
race_control_entity: sensor.f1_race_control
investigations_entity: sensor.f1_investigations
track_limits_entity: sensor.f1_track_limits
track_status_entity: sensor.f1_track_status
fia_documents_entity: sensor.f1_fia_documents
next_race_entity: sensor.f1_next_race
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
| `show_fia_documents` | boolean | `false` | Display published FIA bulletin classification documents |
| `show_next_race` | boolean | `false` | Display upcoming Grand Prix round & venue countdown |
| `race_control_entity` | string | `sensor.f1_race_control` | Entity ID for race control notices |
| `investigations_entity` | string | `sensor.f1_investigations` | Entity ID for steward investigations |
| `track_limits_entity` | string | `sensor.f1_track_limits` | Entity ID for track limits violations |
| `track_status_entity` | string | `sensor.f1_track_status` | Entity ID for track status |
| `fia_documents_entity` | string | `sensor.f1_fia_documents` | Entity ID for FIA decision documents |
| `next_race_entity` | string | `sensor.f1_next_race` | Entity ID for upcoming race info |

---

## 🏎️ Prerequisites & Sensors

This card is designed to pair seamlessly with the standard Home Assistant **Formula 1 integration** (installed via HACS). It connects to:
- `sensor.f1_race_control`
- `sensor.f1_investigations`
- `sensor.f1_track_limits`
- `sensor.f1_track_status`
- `sensor.f1_fia_documents`
- `sensor.f1_next_race`

If sensors are not yet active or Formula 1 is between race weekends, the card will automatically switch to **STANDBY** mode and show upcoming track schedule information.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
