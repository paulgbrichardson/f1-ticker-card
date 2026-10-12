/**
 * F1 Live Race Control Ticker Card (f1-ticker-card)
 * Version: 1.1.0
 * 
 * Hardware-accelerated marquee ticker for Formula 1 race control, steward investigations,
 * track limits, fastest laps, DRS battles, pit stops, track status, weather, and FIA bulletins.
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
      show_investigations: true,
      show_track_limits: true,
      show_track_status: true,
      show_fastest_lap: true,
      show_battles: true,
      show_pit_stops: true,
      show_leaders: false,
      show_weather: false,
      show_lap_count: false,
      show_fia_documents: false,
      show_next_race: false,
    };
  }

  setConfig(config) {
    this._config = Object.assign({
      title: 'LIVE RACE CONTROL TICKER',
      subtitle: 'INCIDENTS & TRACK LIMITS',
      speed: 35,
      show_race_control: true,
      show_investigations: true,
      show_track_limits: true,
      show_track_status: true,
      show_fastest_lap: true,
      show_battles: true,
      show_pit_stops: true,
      show_leaders: false,
      show_weather: false,
      show_lap_count: false,
      show_fia_documents: false,
      show_next_race: false,
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
        font-family: 'F1 Barlow Condensed', 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      ha-card {
        background: linear-gradient(135deg, #161622 0%, #0e0e15 100%);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-left: 4px solid #e10600;
        border-radius: var(--ha-card-border-radius, 10px);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        position: relative;
        width: 100%;
        box-sizing: border-box;
      }
      .header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 14px;
        background: rgba(0, 0, 0, 0.35);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .title-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .fia-badge {
        background: #e10600;
        color: #fff;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .title-text {
        font-size: 0.88rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #fff;
        text-transform: uppercase;
      }
      .subtitle-text {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #94a3b8;
        text-transform: uppercase;
      }
      .status-pill {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 9999px;
      }
      .status-live {
        background: rgba(225, 6, 0, 0.2);
        border: 1px solid #e10600;
        color: #ff4d4d;
      }
      .status-replay {
        background: rgba(56, 189, 248, 0.2);
        border: 1px solid #38bdf8;
        color: #38bdf8;
      }
      .status-standby {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #34d399;
      }
      .pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 6px currentColor;
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      .ticker-container {
        position: relative;
        overflow: hidden;
        height: 38px;
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.2);
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
        font-size: 0.92rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        color: #e2e8f0;
      }
      .tag {
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 1px 6px;
        border-radius: 3px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .tag-rc { background: rgba(225, 6, 0, 0.25); color: #ff6b6b; border: 1px solid rgba(225, 6, 0, 0.5); }
      .tag-inv { background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); }
      .tag-fia { background: rgba(56, 189, 248, 0.25); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.5); }
      .tag-track { background: rgba(52, 211, 153, 0.25); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.5); }
      .tag-fastest { background: rgba(168, 85, 247, 0.25); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.5); }
      .tag-battle { background: rgba(249, 115, 22, 0.25); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.5); }
      .tag-pit { background: rgba(56, 189, 248, 0.25); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.5); }
      .tag-gold { background: rgba(234, 179, 8, 0.25); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.5); }
      .tag-weather { background: rgba(96, 165, 250, 0.25); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.5); }
      .tag-lap { background: rgba(148, 163, 184, 0.25); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.5); }
      .separator {
        color: rgba(255, 255, 255, 0.2);
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

    // 1. Determine Replay vs Live vs Standby status
    const isReplay = (replayMode && replayMode.state === 'on') ||
      (replayStatus && (replayStatus.state === 'playing' || replayStatus.state === 'paused'));

    let items = [];
    let isLive = false;

    // Drivers list from positions sensor
    const drivers = (positions && positions.attributes && Array.isArray(positions.attributes.drivers))
      ? positions.attributes.drivers
      : [];

    // 2. Race Control Messages
    if (this._config.show_race_control !== false && isAvailable(rc)) {
      items.push({ tag: 'tag-rc', label: '🚨 RACE CONTROL', text: rc.state });
      isLive = true;
    }

    // 3. Steward Investigations
    if (this._config.show_investigations !== false && isAvailable(inv)) {
      items.push({ tag: 'tag-inv', label: '🔍 INVESTIGATION', text: inv.state });
      isLive = true;
    }

    // 4. Track Limits
    if (this._config.show_track_limits !== false && isAvailable(tl)) {
      items.push({ tag: 'tag-rc', label: '🛑 TRACK LIMITS', text: tl.state });
      isLive = true;
    }

    // 5. Track Status (Clear, Yellow, VSC, SC, Red)
    if (this._config.show_track_status !== false && isAvailable(track)) {
      items.push({ tag: 'tag-track', label: '🚦 TRACK STATUS', text: track.state });
      if (track.state && track.state.toUpperCase() !== 'CLEAR' && track.state.toUpperCase() !== 'UNKNOWN') {
        isLive = true;
      }
    }

    // 6. Fastest Lap
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

    // 7. On-Track Battles (intervals < 1.2s / DRS range)
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

    // 8. Pit Stops & In-Pit Notifications
    if (this._config.show_pit_stops !== false) {
      const inPitDrivers = drivers.filter(d => d.in_pit === true).map(d => d.tla || d.name);
      if (inPitDrivers.length > 0) {
        items.push({
          tag: 'tag-pit',
          label: '🛞 IN PIT',
          text: `${inPitDrivers.join(', ')} in pit lane`
        });
        isLive = true;
      } else if (isAvailable(pitstops) && pitstops.state !== '0') {
        items.push({
          tag: 'tag-pit',
          label: '🛞 PIT STOPS',
          text: `${pitstops.state} pit stops recorded`
        });
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

    // 10. Race Leaders (Top 3)
    if (this._config.show_leaders === true && drivers.length >= 3) {
      const p1 = drivers[0];
      const p2 = drivers[1];
      const p3 = drivers[2];
      items.push({
        tag: 'tag-gold',
        label: '🏆 LEADERS',
        text: `P1 ${p1.tla} • P2 ${p2.tla} (${p2.gap_to_leader || '+0.0s'}) • P3 ${p3.tla} (${p3.gap_to_leader || '+0.0s'})`
      });
    }

    // 11. Track Weather
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

    // 12. FIA Decision Documents (optional)
    if (this._config.show_fia_documents === true && isAvailable(fia)) {
      items.push({ tag: 'tag-fia', label: '📄 FIA DECISION', text: `Doc ${fia.state}` });
    }

    // 13. Next Race Countdown (optional)
    if (this._config.show_next_race === true && isAvailable(nextRace)) {
      items.push({ tag: 'tag-track', label: '🏁 NEXT GP', text: nextRace.state });
    }

    // Fallback if no items currently active
    if (items.length === 0) {
      if (isAvailable(track)) {
        items.push({ tag: 'tag-track', label: 'TRACK STATUS', text: track.state });
      }
      if (isAvailable(nextRace)) {
        items.push({ tag: 'tag-fia', label: 'NEXT RACE', text: nextRace.state });
      }
      items.push({ tag: 'tag-rc', label: 'STANDBY', text: 'No active on-track sessions or incidents' });
    }

    // Update Status Pill
    const statusPill = this.shadowRoot.getElementById('status-pill');
    const statusText = this.shadowRoot.getElementById('status-text');

    if (statusPill && statusText) {
      if (isReplay) {
        statusPill.className = 'status-pill status-replay';
        statusText.textContent = (replayStatus && replayStatus.state === 'paused') ? 'REPLAY (PAUSED)' : 'REPLAY';
      } else if (isLive) {
        statusPill.className = 'status-pill status-live';
        statusText.textContent = 'LIVE SESSION';
      } else {
        statusPill.className = 'status-pill status-standby';
        statusText.textContent = 'STANDBY';
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

        <div class="section-header">Core Track & Safety Feeds</div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🚨 Race Control Messages</span>
            <span class="label-desc">Official race director instructions, flags & safety cars</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_race_control" ${this._config.show_race_control !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🔍 Steward Investigations</span>
            <span class="label-desc">Driver incident inquiries and penalty notifications</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_investigations" ${this._config.show_investigations !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🛑 Track Limits</span>
            <span class="label-desc">Corner limits violations and deleted lap warnings</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_track_limits" ${this._config.show_track_limits !== false ? 'checked' : ''}>
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

        <div class="section-header">Race Action & Telemetry Feeds</div>

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
            <span class="label-desc">Cars entering/exiting pit lane and total stop counts</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_pit_stops" ${this._config.show_pit_stops !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🏆 Top 3 Leaders</span>
            <span class="label-desc">P1, P2, P3 positions and gap to leader</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_leaders" ${this._config.show_leaders === true ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

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

        <div class="section-header">FIA Documents & Schedule</div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">📄 FIA Decision Documents</span>
            <span class="label-desc">Official FIA published bulletin documents & classifications</span>
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
      show_investigations: this.querySelector('#show_investigations').checked,
      show_track_limits: this.querySelector('#show_track_limits').checked,
      show_track_status: this.querySelector('#show_track_status').checked,
      show_fastest_lap: this.querySelector('#show_fastest_lap').checked,
      show_battles: this.querySelector('#show_battles').checked,
      show_pit_stops: this.querySelector('#show_pit_stops').checked,
      show_leaders: this.querySelector('#show_leaders').checked,
      show_weather: this.querySelector('#show_weather').checked,
      show_lap_count: this.querySelector('#show_lap_count').checked,
      show_fia_documents: this.querySelector('#show_fia_documents').checked,
      show_next_race: this.querySelector('#show_next_race').checked,
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
    description: 'Smooth animated marquee banner for live F1 race control, steward notices, fastest laps, DRS battles and track status',
    preview: true,
  });
}
