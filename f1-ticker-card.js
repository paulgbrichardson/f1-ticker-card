/**
 * F1 Live Race Control Ticker Card (f1-ticker-card)
 * Version: 1.2.0
 * 
 * Hardware-accelerated marquee ticker matching official F1 Weekend Hub standards
 * for typography ('F1 Barlow Condensed'), palette, borders, surfaces, and chip status pills.
 */

class F1TickerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static getConfigElement() {
    return document.createElement('f1-ticker-card-editor');
  }

  static getStubConfig() {
    return {
      title: 'LIVE RACE CONTROL TICKER',
      subtitle: 'INCIDENTS & TRACK LIMITS',
      speed: 35,
      show_race_control: true,
      show_track_status: true,
      show_fastest_lap: true,
      show_battles: true,
      show_pit_stops: true,
      show_weather: false,
      show_lap_count: false,
      show_fia_documents: false,
      show_next_race: false,
      show_investigations: false,
      show_track_limits: false,
    };
  }

  setConfig(config) {
    this._config = Object.assign({
      title: 'LIVE RACE CONTROL TICKER',
      subtitle: 'INCIDENTS & TRACK LIMITS',
      speed: 35,
      show_race_control: true,
      show_track_status: true,
      show_fastest_lap: true,
      show_battles: true,
      show_pit_stops: true,
      show_weather: false,
      show_lap_count: false,
      show_fia_documents: false,
      show_next_race: false,
      show_investigations: false,
      show_track_limits: false,
      race_control_entity: 'sensor.f1_race_control',
      investigations_entity: 'sensor.f1_investigations',
      track_limits_entity: 'sensor.f1_track_limits',
      track_status_entity: 'sensor.f1_track_status',
      driver_positions_entity: 'sensor.f1_driver_positions',
      pitstops_entity: 'sensor.f1_pitstops',
      track_weather_entity: 'sensor.f1_track_weather',
      lap_count_entity: 'sensor.f1_race_lap_count',
      fia_documents_entity: 'sensor.f1_fia_documents',
      next_race_entity: 'sensor.f1_next_race',
      replay_mode_entity: 'input_boolean.f1_replay_mode',
      replay_status_entity: 'sensor.f1_replay_status',
    }, config || {});
    this._renderBase();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateContent();
  }

  _renderBase() {
    const style = `
      :host {
        display: block;
        width: 100%;
        color: var(--f1-text, var(--primary-text-color, #e9edf3));
        font-family: 'F1 Barlow Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 1rem;
        line-height: 1.5;
        box-sizing: border-box;
      }
      * {
        box-sizing: border-box;
      }
      ha-card {
        background: var(--f1-surface, var(--ha-card-background, var(--card-background-color, #15151e)));
        border: 1px solid var(--f1-border, #6c7480);
        border-top: 3px solid var(--f1-accent, #e10600);
        border-radius: var(--f1-card-radius, var(--ha-card-border-radius, 14px));
        color: var(--f1-text, var(--primary-text-color, #e9edf3));
        box-shadow: none;
        overflow: hidden;
        position: relative;
        width: 100%;
      }
      .header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 14px;
        background: var(--f1-panel, rgba(127, 127, 127, 0.07));
        border-bottom: 1px solid var(--f1-divider, rgba(127, 127, 127, 0.25));
      }
      .title-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .fia-badge {
        background: var(--f1-accent, #e10600);
        color: #fff;
        font-family: 'F1 Barlow Condensed', sans-serif;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        padding: 2px 7px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .title-text {
        font-family: 'F1 Barlow Condensed', sans-serif;
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: 0.025em;
        color: var(--f1-text, var(--primary-text-color, #e9edf3));
        text-transform: uppercase;
      }
      .subtitle-text {
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--f1-muted, var(--secondary-text-color, #b9c1ce));
        text-transform: uppercase;
      }

      /* F1 Weekend Hub standard chip style */
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 2px 8px;
        border: 1px solid currentColor;
        border-radius: 5px;
        font-family: 'F1 Barlow Condensed', sans-serif;
      }
      .status-live {
        color: #d93636;
        background: rgba(217, 54, 54, 0.16);
      }
      .status-replay {
        color: #3978d5;
        background: rgba(57, 120, 213, 0.14);
      }
      .status-standby {
        color: #75dc94;
        background: rgba(117, 220, 148, 0.14);
      }
      .pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .status-live .pulse-dot {
        box-shadow: 0 0 6px currentColor;
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.35; transform: scale(0.8); }
      }

      .ticker-container {
        position: relative;
        overflow: hidden;
        height: 38px;
        display: flex;
        align-items: center;
        background: var(--f1-panel, rgba(127, 127, 127, 0.04));
        width: 100%;
      }
      .ticker-track {
        display: flex;
        white-space: nowrap;
        will-change: transform;
        animation: tickerScroll var(--ticker-duration, 35s) linear infinite;
      }
      .ticker-container:hover .ticker-track {
        animation-play-state: paused;
      }
      @keyframes tickerScroll {
        0% { transform: translate3d(0, 0, 0); }
        100% { transform: translate3d(-50%, 0, 0); }
      }
      .ticker-content {
        display: inline-flex;
        align-items: center;
        gap: 24px;
        padding-right: 24px;
      }
      .ticker-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--f1-text, var(--primary-text-color, #e9edf3));
        font-family: 'F1 Barlow Condensed', sans-serif;
      }

      /* F1 Weekend Hub standard chip tags */
      .tag {
        font-family: 'F1 Barlow Condensed', sans-serif;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 1px 6px;
        border: 1px solid currentColor;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .tag-rc { color: #d93636; background: rgba(217, 54, 54, 0.14); }
      .tag-track { color: #75dc94; background: rgba(117, 220, 148, 0.14); }
      .tag-fastest { color: #c59aff; background: rgba(197, 154, 255, 0.14); }
      .tag-battle { color: #f6d65c; background: rgba(246, 214, 92, 0.14); }
      .tag-pit { color: #56aaff; background: rgba(86, 170, 255, 0.14); }
      .tag-gold { color: #f6d65c; background: rgba(246, 214, 92, 0.14); }
      .tag-weather { color: #3978d5; background: rgba(57, 120, 213, 0.14); }
      .tag-lap { color: var(--f1-muted, #b9c1ce); background: rgba(127, 127, 127, 0.14); }
      .tag-fia { color: var(--f1-muted, #b9c1ce); background: rgba(127, 127, 127, 0.14); }

      .separator {
        color: var(--f1-divider, rgba(127, 127, 127, 0.35));
        font-size: 0.8rem;
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <ha-card>
        <div class="header-bar">
          <div class="title-group">
            <span class="fia-badge">FIA</span>
            <span class="title-text">${this._config.title}</span>
            <span class="subtitle-text">${this._config.subtitle}</span>
          </div>
          <div class="status-pill status-standby" id="status-pill">
            <span class="pulse-dot"></span>
            <span id="status-text">STANDBY</span>
          </div>
        </div>
        <div class="ticker-container" id="ticker-box">
          <div class="ticker-track" id="ticker-track" style="--ticker-duration: ${this._config.speed || 35}s;">
            <div class="ticker-content" id="content-1">Connecting to FIA Race Control stream...</div>
            <div class="ticker-content" id="content-2">Connecting to FIA Race Control stream...</div>
          </div>
        </div>
      </ha-card>
    `;
  }

  _updateContent() {
    if (!this._hass || !this.shadowRoot) return;

    const rc = this._hass.states[this._config.race_control_entity];
    const inv = this._hass.states[this._config.investigations_entity];
    const tl = this._hass.states[this._config.track_limits_entity];
    const track = this._hass.states[this._config.track_status_entity];
    const fia = this._hass.states[this._config.fia_documents_entity];
    const nextRace = this._hass.states[this._config.next_race_entity];
    const positions = this._hass.states[this._config.driver_positions_entity];
    const pitstops = this._hass.states[this._config.pitstops_entity];
    const weather = this._hass.states[this._config.track_weather_entity];
    const lapCount = this._hass.states[this._config.lap_count_entity];
    const replayMode = this._hass.states[this._config.replay_mode_entity];
    const replayStatus = this._hass.states[this._config.replay_status_entity];

    const isAvailable = (s) => s && s.state !== 'unavailable' && s.state !== 'unknown';
    // Helper to check if a string is just a numeric count (like '1', '3', '0')
    const isPureNumber = (val) => {
      if (val === null || val === undefined) return true;
      const s = String(val).trim();
      return /^-?\d+(\.\d+)?$/.test(s);
    };

    // 1. Determine Replay vs Live vs Standby status
    const isReplay = (replayMode && replayMode.state === 'on') ||
      (replayStatus && (replayStatus.state === 'playing' || replayStatus.state === 'paused'));

    let items = [];
    let isLive = false;

    // Drivers list from positions sensor
    const drivers = (positions && positions.attributes && Array.isArray(positions.attributes.drivers))
      ? positions.attributes.drivers
      : [];

    // 2. Race Control Messages (Only include if actual text detail, not a pure number)
    if (this._config.show_race_control !== false && isAvailable(rc)) {
      const text = rc.state.trim();
      if (!isPureNumber(text) && text.length > 1 && text.toUpperCase() !== 'OFFLINE' && text.toUpperCase() !== 'NONE') {
        items.push({ tag: 'tag-rc', label: '🚨 RACE CONTROL', text: text });
        isLive = true;
      }
    }

    // 3. Track Status (Clear, Yellow, VSC, SC, Red)
    if (this._config.show_track_status !== false && isAvailable(track)) {
      const state = track.state.trim().toUpperCase();
      if (!isPureNumber(state) && state !== 'UNKNOWN') {
        items.push({ tag: 'tag-track', label: '🚦 TRACK STATUS', text: state });
        if (state !== 'CLEAR') {
          isLive = true;
        }
      }
    }

    // 4. Fastest Lap (Rich detail: Driver, Lap Time, Lap #)
    if (this._config.show_fastest_lap !== false && drivers.length > 0) {
      const flDriver = drivers.find(d => d.fastest_lap === true);
      if (flDriver) {
        const time = flDriver.fastest_lap_time || flDriver.best_lap_time || '';
        const lap = flDriver.fastest_lap_lap || flDriver.best_lap_lap || '';
        const lapStr = lap ? ` (Lap ${lap})` : '';
        items.push({
          tag: 'tag-fastest',
          label: '⚡ FASTEST LAP',
          text: `${flDriver.tla || flDriver.name} - ${time}${lapStr}`
        });
        isLive = true;
      }
    }

    // 5. On-Track Battles (Intervals < 1.2s / DRS range with specific drivers & gap)
    if (this._config.show_battles !== false && drivers.length > 1) {
      let battleCount = 0;
      for (let i = 1; i < drivers.length && battleCount < 3; i++) {
        const ahead = drivers[i - 1];
        const curr = drivers[i];
        const interval = curr.interval_to_position_ahead || '';
        if (interval.startsWith('+')) {
          const val = parseFloat(interval.replace('+', '').replace('s', ''));
          if (!isNaN(val) && val <= 1.2 && val > 0) {
            items.push({
              tag: 'tag-battle',
              label: '⚔️ DRS BATTLE',
              text: `P${ahead.current_position} ${ahead.tla} vs P${curr.current_position} ${curr.tla} (${interval})`
            });
            battleCount++;
            isLive = true;
          }
        }
      }
    }

    // 6. Pit Stops (ONLY show cars actively in pit lane; omit useless numeric counts like '0')
    if (this._config.show_pit_stops !== false) {
      const inPitDrivers = drivers.filter(d => d.in_pit === true).map(d => d.tla || d.name);
      if (inPitDrivers.length > 0) {
        items.push({
          tag: 'tag-pit',
          label: '🛞 IN PIT',
          text: `${inPitDrivers.join(', ')} in pit lane`
        });
        isLive = true;
      }
    }

    // 7. Steward Investigations (Only if actual descriptive text exists, never a bare count)
    if (this._config.show_investigations === true && isAvailable(inv)) {
      const text = (inv.attributes && inv.attributes.message) ? inv.attributes.message : inv.state.trim();
      if (!isPureNumber(text) && text.length > 1) {
        items.push({ tag: 'tag-rc', label: '🔍 INVESTIGATION', text: text });
        isLive = true;
      }
    }

    // 8. Track Limits (Only if actual descriptive event text exists, never a bare count)
    if (this._config.show_track_limits === true && isAvailable(tl)) {
      const text = (tl.attributes && tl.attributes.message) ? tl.attributes.message : tl.state.trim();
      if (!isPureNumber(text) && text.length > 1) {
        items.push({ tag: 'tag-rc', label: '🛑 TRACK LIMITS', text: text });
        isLive = true;
      }
    }

    // 9. Lap & Session Progress
    if (this._config.show_lap_count === true && isAvailable(lapCount)) {
      const total = lapCount.attributes && lapCount.attributes.total_laps ? ` / ${lapCount.attributes.total_laps}` : '';
      items.push({
        tag: 'tag-lap',
        label: '🏁 LAP',
        text: `${lapCount.state}${total}`
      });
      isLive = true;
    }

    // 10. Track Weather
    if (this._config.show_weather === true && isAvailable(weather) && weather.attributes) {
      const tTrack = weather.attributes.track_temperature;
      const tAir = weather.attributes.air_temperature;
      const rain = weather.attributes.rainfall;
      const wParts = [];
      if (tTrack !== undefined) wParts.push(`Track: ${tTrack}°C`);
      if (tAir !== undefined) wParts.push(`Air: ${tAir}°C`);
      if (rain !== undefined && rain > 0) wParts.push(`Rain: ${rain}mm`);
      if (wParts.length > 0) {
        items.push({
          tag: 'tag-weather',
          label: '🌡️ WEATHER',
          text: wParts.join(' • ')
        });
      }
    }

    // 11. FIA Decision Documents (Use full document title, never just a document number)
    if (this._config.show_fia_documents === true && isAvailable(fia)) {
      const title = (fia.attributes && fia.attributes.name) ? fia.attributes.name : null;
      if (title && !isPureNumber(title)) {
        items.push({ tag: 'tag-fia', label: '📄 FIA DECISION', text: title });
      }
    }

    // 12. Next Race Countdown (Formatted race name and location, not raw timestamp)
    if (this._config.show_next_race === true && isAvailable(nextRace)) {
      const rName = (nextRace.attributes && nextRace.attributes.race_name) ? nextRace.attributes.race_name : null;
      const rLoc = (nextRace.attributes && nextRace.attributes.circuit_locality) ? nextRace.attributes.circuit_locality : null;
      if (rName) {
        const text = rLoc ? `${rName} (${rLoc})` : rName;
        items.push({ tag: 'tag-track', label: '🏁 NEXT GP', text: text });
      }
    }

    // Fallback if no items currently active
    if (items.length === 0) {
      if (isAvailable(track) && !isPureNumber(track.state)) {
        items.push({ tag: 'tag-track', label: 'TRACK STATUS', text: track.state.toUpperCase() });
      }
      if (isAvailable(nextRace) && nextRace.attributes && nextRace.attributes.race_name) {
        items.push({ tag: 'tag-fia', label: 'NEXT GP', text: nextRace.attributes.race_name });
      }
      items.push({ tag: 'tag-track', label: 'STANDBY', text: 'No active track sessions or incident notices' });
    }

    // Update Status Pill
    const statusPill = this.shadowRoot.getElementById('status-pill');
    const statusText = this.shadowRoot.getElementById('status-text');

    if (statusPill && statusText) {
      if (isReplay) {
        statusPill.className = 'status-pill status-replay';
        statusText.innerHTML = (replayStatus && replayStatus.state === 'paused') ? '↶ REPLAY (PAUSED)' : '↶ REPLAY';
      } else if (isLive) {
        statusPill.className = 'status-pill status-live';
        statusText.innerHTML = '<span class="pulse-dot"></span> LIVE SESSION';
      } else {
        statusPill.className = 'status-pill status-standby';
        statusText.innerHTML = '✓ STANDBY';
      }
    }

    // Generate HTML for marquee items
    const html = items.map(item => `
      <span class="ticker-item">
        <span class="tag ${item.tag}">${item.label}</span>
        <span>${item.text}</span>
      </span>
      <span class="separator">•</span>
    `).join('');

    const c1 = this.shadowRoot.getElementById('content-1');
    const c2 = this.shadowRoot.getElementById('content-2');
    if (c1 && c2 && c1.innerHTML !== html) {
      c1.innerHTML = html;
      c2.innerHTML = html;
    }
  }

  getCardSize() {
    return 1;
  }
}

/**
 * Visual UI Editor for F1TickerCard
 */
class F1TickerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    this._renderBase();
  }

  _renderBase() {
    this.innerHTML = `
      <style>
        .card-config {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 8px 0;
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .config-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }
        .config-label {
          display: flex;
          flex-direction: column;
        }
        .label-title {
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--primary-text-color, #fff);
        }
        .label-desc {
          font-size: 0.76rem;
          color: var(--secondary-text-color, #94a3b8);
        }
        .input-text {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 8px 10px;
          color: #fff;
          font-size: 0.9rem;
          outline: none;
        }
        .input-text:focus {
          border-color: #e10600;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 46px;
          height: 24px;
          flex-shrink: 0;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #4b5563;
          transition: .2s;
          border-radius: 24px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 18px; width: 18px;
          left: 3px; bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #e10600;
        }
        input:checked + .slider:before {
          transform: translateX(22px);
        }
        .section-header {
          font-weight: 800;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #e10600;
          margin-top: 10px;
          margin-bottom: -4px;
        }
      </style>
      <div class="card-config">
        <div class="input-group">
          <label class="label-title">Card Header Title</label>
          <input type="text" class="input-text" id="title" value="${this._config.title || ''}" placeholder="LIVE RACE CONTROL TICKER">
        </div>
        <div class="input-group">
          <label class="label-title">Subtitle</label>
          <input type="text" class="input-text" id="subtitle" value="${this._config.subtitle || ''}" placeholder="INCIDENTS & TRACK LIMITS">
        </div>
        <div class="input-group">
          <label class="label-title">Scroll Speed (seconds per loop: 15–90s)</label>
          <input type="number" class="input-text" id="speed" min="10" max="120" value="${this._config.speed || 35}">
        </div>

        <div class="section-header">Live Action & Safety Feeds</div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🚨 Race Control Messages</span>
            <span class="label-desc">Official race director instructions, flags & safety cars (text details only)</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_race_control" ${this._config.show_race_control !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🚦 Track Status</span>
            <span class="label-desc">Global track state flags (Clear, Yellow, VSC, SC, Red)</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_track_status" ${this._config.show_track_status !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">⚡ Fastest Lap</span>
            <span class="label-desc">Current fastest lap driver, sector time & lap number</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_fastest_lap" ${this._config.show_fastest_lap !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">⚔️ DRS Battles</span>
            <span class="label-desc">Live intervals and overtakes under 1.2s DRS delta</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_battles" ${this._config.show_battles !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🛞 Pit Stops</span>
            <span class="label-desc">Cars currently in the pit lane (omits bare numeric counts)</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_pit_stops" ${this._config.show_pit_stops !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="section-header">Optional Environmental & Bulletin Feeds</div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🌡️ Track & Weather</span>
            <span class="label-desc">Track temperature, air temperature and rainfall alerts</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_weather" ${this._config.show_weather === true ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🏁 Lap Count & Progress</span>
            <span class="label-desc">Current lap number and total race distance</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_lap_count" ${this._config.show_lap_count === true ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">📄 FIA Decision Documents</span>
            <span class="label-desc">Official published FIA document titles (e.g. Doc 91 - Championship Points)</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_fia_documents" ${this._config.show_fia_documents === true ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🏁 Next Race Countdown</span>
            <span class="label-desc">Upcoming Grand Prix round name & venue location</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_next_race" ${this._config.show_next_race === true ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;

    this.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => this._valueChanged());
      input.addEventListener('input', () => {
        if (input.type === 'text' || input.type === 'number') this._valueChanged();
      });
    });
  }

  _valueChanged() {
    if (!this._config) return;
    const newConfig = Object.assign({}, this._config, {
      title: this.querySelector('#title').value,
      subtitle: this.querySelector('#subtitle').value,
      speed: parseInt(this.querySelector('#speed').value, 10) || 35,
      show_race_control: this.querySelector('#show_race_control').checked,
      show_track_status: this.querySelector('#show_track_status').checked,
      show_fastest_lap: this.querySelector('#show_fastest_lap').checked,
      show_battles: this.querySelector('#show_battles').checked,
      show_pit_stops: this.querySelector('#show_pit_stops').checked,
      show_weather: this.querySelector('#show_weather').checked,
      show_lap_count: this.querySelector('#show_lap_count').checked,
      show_fia_documents: this.querySelector('#show_fia_documents').checked,
      show_next_race: this.querySelector('#show_next_race').checked,
      show_investigations: false,
      show_track_limits: false,
    });

    const event = new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

if (!customElements.get('f1-ticker-card-editor')) {
  customElements.define('f1-ticker-card-editor', F1TickerCardEditor);
}

if (!customElements.get('f1-ticker-card')) {
  customElements.define('f1-ticker-card', F1TickerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'f1-ticker-card',
    name: 'F1 Race Control Ticker Card',
    description: 'Hardware-accelerated marquee banner for live F1 race control, steward notices, fastest laps, DRS battles and track status matching F1 Weekend Hub standards',
    preview: true,
  });
}
