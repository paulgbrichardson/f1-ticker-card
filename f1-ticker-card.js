/**
 * F1 Live Race Control Ticker Card (f1-ticker-card)
 * Version: 1.8.0
 * 
 * Hardware-accelerated continuous 60fps single-message conveyor ticker.
 * Natively matches Nicxe/f1_sensor design system with authentic Formula 1 typography,
 * fully-rounded capsule status pills, theme-matched color variables, and graceful incoming message loading.
 * 
 * Features Single-Pass Retirement, Adaptive Speed Governor, and Replay Time-Travel:
 * Automatically detects playback position jumps, backwards rewinds (-30s), forward fast-forward,
 * and session swaps — instantly emptying stale future telemetry and loading fresh snapshot data
 * from the exact new timestamp.
 */

// Automated font loader matching Nicxe/f1_sensor
async function ensureF1Fonts() {
  if (typeof window === 'undefined') return;
  if (window._f1FontsLoaded || document.querySelector('style[data-f1-fonts]')) {
    window._f1FontsLoaded = true;
    return;
  }

  // 1. Injected @font-face definition from f1_sensor bundle
  try {
    const res = await fetch('/local/f1-sensor-live-data-card/f1-sensor-live-data-card.js');
    if (res.ok) {
      const text = await res.text();
      const start = text.indexOf('@font-face');
      const end = text.indexOf('`;', start);
      if (start !== -1 && end !== -1) {
        const fontCss = text.substring(start, end).trim();
        const style = document.createElement('style');
        style.setAttribute('data-f1-fonts', 'true');
        style.id = 'f1-sensor-official-fonts';
        style.textContent = fontCss;
        document.head.appendChild(style);
        window._f1FontsLoaded = true;
        return;
      }
    }
  } catch (e) {
    console.debug('Could not stream fonts from f1-sensor-live-data-card bundle:', e);
  }

  // 2. Fallback to F1 Barlow Condensed and Google Fonts
  const fontUrl = '/local/f1-sensor-live-data-card/fonts/barlow-condensed-latin-700-normal.woff2';
  const fallbackStyle = document.createElement('style');
  fallbackStyle.setAttribute('data-f1-fonts', 'true');
  fallbackStyle.textContent = `
    @font-face {
      font-family: 'F1 Barlow Condensed';
      src: url('${fontUrl}') format('woff2');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(fallbackStyle);

  if (!document.querySelector('link[href*="Barlow+Condensed"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;0,900&display=swap';
    document.head.appendChild(link);
  }
}

// Kick off font loading
ensureF1Fonts();

class F1TickerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._scrollPos = 0;
    this._lastTime = null;
    this._animFrame = null;
    this._isPaused = false;
    this._activeItems = new Map();
    this._retiredSignatures = new Set();
    this._currentSpeed = null;
    this._lastPlaybackPos = null;
    this._lastSessionId = null;
    this._wasReplayMode = null;
    this._tick = this._tick.bind(this);
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
      race_control_entity: 'sensor.f1_race_control',
      track_status_entity: 'sensor.f1_track_status',
      driver_positions_entity: 'sensor.f1_driver_positions',
      pitstops_entity: 'sensor.f1_pitstops',
      track_weather_entity: 'sensor.f1_track_weather',
      lap_count_entity: 'sensor.f1_race_lap_count',
      fia_documents_entity: 'sensor.f1_fia_documents',
      next_race_entity: 'sensor.f1_next_race',
      replay_mode_entity: 'input_boolean.f1_replay_mode',
      replay_status_entity: 'sensor.f1_replay_status',
      session_status_entity: 'sensor.f1_session_status',
    }, config || {});

    ensureF1Fonts();
    this._renderBase();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateContent();
  }

  connectedCallback() {
    ensureF1Fonts();
    if (!this._animFrame) {
      this._lastTime = performance.now();
      this._animFrame = requestAnimationFrame(this._tick);
    }
  }

  disconnectedCallback() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  _renderBase() {
    const style = `
      :host {
        display: block;
        width: 100%;
        color: var(--f1-text, var(--primary-text-color, #e9edf3));
        font-family: 'Formula1 Display', 'Formula1 Wide', 'F1 Barlow Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 1rem;
        line-height: 1.5;
        box-sizing: border-box;

        /* F1 Sensor Theme Colors matching Nicxe/f1_sensor */
        --f1-status-info: #38bdf8;
        --f1-status-warning: #f59e0b;
        --f1-status-yellow: #ffd60a;
        --f1-status-success: #34c759;
        --f1-status-danger: #ff3b30;
        --f1-status-orange: #ff9500;
        --f1-status-purple: #a855f7;
        --f1-status-neutral: #94a3b8;
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
        padding: 8px 14px;
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
        font-family: 'Formula1 Wide', 'Formula1 Display', 'F1 Barlow Condensed', sans-serif !important;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 2px 7px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .title-text {
        font-family: 'Formula1 Wide', 'Formula1 Display', 'F1 Barlow Condensed', sans-serif !important;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--f1-text, var(--primary-text-color, #e9edf3));
        text-transform: uppercase;
      }
      .subtitle-text {
        font-family: 'Formula1 Display', 'Formula1 Wide', 'F1 Barlow Condensed', sans-serif !important;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--f1-muted, var(--secondary-text-color, #b9c1ce));
        text-transform: uppercase;
      }

      /* Official F1 Status Pills matching Nicxe/f1_sensor rc-status-pill / ls-status-pill */
      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 24px;
        padding: 3px 12px;
        border-radius: 999px; /* Round pill corners */
        font-family: 'Formula1 Wide', 'Formula1 Display', sans-serif !important;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        white-space: nowrap;
        border: 1px solid color-mix(in srgb, currentColor 46%, transparent);
        background: color-mix(in srgb, currentColor 14%, transparent);
        transition: all 0.25s ease;
      }
      .status-replay-running {
        color: #34c759; /* Green playing state matching f1_sensor rc-status-pill.playing */
      }
      .status-replay-paused {
        color: #f59e0b; /* Amber paused state matching f1_sensor rc-status-pill.paused */
      }
      .status-replay-seeking {
        color: #ff9500; /* Orange seeking state matching f1_sensor rc-status-pill.loading */
      }
      .status-live {
        color: #ff3b30; /* Red live session indicator */
      }
      .status-before {
        color: #38bdf8; /* Blue standby/before state matching f1_sensor ready */
      }
      .pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 6px currentColor;
        animation: pulse 1.5s infinite ease-in-out;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.35; transform: scale(0.8); }
      }

      /* Single-Message Conveyor Marquee Viewport */
      .ticker-container {
        position: relative;
        overflow: hidden;
        height: 40px;
        display: flex;
        align-items: center;
        background: var(--f1-panel, rgba(127, 127, 127, 0.04));
        width: 100%;
        cursor: default;
        user-select: none;
      }
      .ticker-idle-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        pointer-events: none;
        opacity: 0.75;
        transition: opacity 0.25s ease;
        z-index: 1;
        font-family: 'Formula1 Wide', 'Formula1 Display', sans-serif !important;
        font-size: 0.7rem;
        letter-spacing: 0.05em;
        user-select: none;
      }
      .ticker-idle-overlay.hidden {
        opacity: 0;
        visibility: hidden;
      }
      .ticker-track {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        will-change: transform;
        position: relative;
        z-index: 2;
        width: max-content;
      }
      .ticker-unit {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
      }
      .ticker-gap {
        display: inline-block;
        flex-shrink: 0;
        height: 1px;
      }
      .ticker-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: 'Formula1 Display', 'Formula1 Wide', sans-serif !important;
        font-size: 0.92rem;
        font-weight: 500;
        letter-spacing: 0.03em;
        color: var(--f1-text, var(--primary-text-color, #e9edf3));
        white-space: nowrap;
      }

      /* Category Tags matching Nicxe/f1_sensor capsule pill standard */
      .tag {
        font-family: 'Formula1 Wide', 'Formula1 Display', sans-serif !important;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 2px 9px;
        border-radius: 999px; /* Fully rounded capsule pill corners */
        border: 1px solid color-mix(in srgb, currentColor 46%, transparent);
        background: color-mix(in srgb, currentColor 14%, transparent);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }

      /* Color-matched tags from f1_sensor design system */
      .tag-rc {
        color: #ff3b30;
      }
      .tag-track-clear {
        color: #34c759;
      }
      .tag-track-yellow {
        color: #ffd60a;
      }
      .tag-track-sc, .tag-track-vsc {
        color: #ff9500;
      }
      .tag-track-red {
        color: #ff3b30;
        animation: pulse-red 1.2s infinite ease-in-out;
      }
      @keyframes pulse-red {
        0%, 100% { box-shadow: 0 0 4px rgba(255, 59, 48, 0.3); }
        50% { box-shadow: 0 0 10px rgba(255, 59, 48, 0.7); }
      }
      .tag-track-blue {
        color: #38bdf8;
      }
      .tag-fastest {
        color: #a855f7;
      }
      .tag-battle {
        color: #f59e0b;
      }
      .tag-pit {
        color: #38bdf8;
      }
      .tag-neutral {
        color: #34c759;
      }
      .tag-weather {
        color: #38bdf8;
      }
      .tag-fia, .tag-lap {
        color: #94a3b8;
      }

      .separator {
        color: var(--f1-divider, rgba(127, 127, 127, 0.35));
        font-size: 0.65rem;
        margin: 0 16px;
        user-select: none;
        flex-shrink: 0;
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
          <div class="status-pill status-before" id="status-pill">
            <span id="status-text">BEFORE</span>
          </div>
        </div>
        <div class="ticker-container" id="ticker-box">
          <div class="ticker-idle-overlay" id="ticker-idle">
            <span class="tag tag-clear">🟢 TRACK CLEAR</span>
            <span class="ticker-text">MONITORING RACE CONTROL</span>
          </div>
          <div class="ticker-track" id="ticker-track"></div>
        </div>
      </ha-card>
    `;

    const box = this.shadowRoot.getElementById('ticker-box');
    if (box) {
      box.addEventListener('mouseenter', () => { this._isPaused = true; });
      box.addEventListener('mouseleave', () => {
        this._isPaused = false;
        this._lastTime = performance.now();
      });
      box.addEventListener('touchstart', () => { this._isPaused = true; }, { passive: true });
      box.addEventListener('touchend', () => {
        this._isPaused = false;
        this._lastTime = performance.now();
      }, { passive: true });
    }

    this._trackElem = this.shadowRoot.getElementById('ticker-track');

    if (!this._animFrame) {
      this._lastTime = performance.now();
      this._animFrame = requestAnimationFrame(this._tick);
    }
  }

  _tick(now) {
    if (!this._lastTime) this._lastTime = now;
    const dt = Math.min(0.1, (now - this._lastTime) / 1000);
    this._lastTime = now;

    if (!document.hidden && !this._isPaused && this._trackElem) {
      const realUnits = Array.from(this._trackElem.querySelectorAll('.ticker-unit:not([data-id="gap"])'));
      const activeCount = realUnits.length;

      // Handle idle overlay state
      const idleOverlay = this.shadowRoot.getElementById('ticker-idle');
      if (activeCount === 0 && this._trackElem.children.length === 0) {
        if (idleOverlay) idleOverlay.classList.remove('hidden');
      } else {
        if (idleOverlay) idleOverlay.classList.add('hidden');
      }

      if (this._trackElem.children.length > 0) {
        const baseSpeed = parseInt(this._config?.speed, 10) || 40;
        let targetSpeed = baseSpeed;
        if (activeCount >= 3) {
          targetSpeed = Math.min(75, baseSpeed + (activeCount - 2) * 12);
        }

        if (this._currentSpeed === null) this._currentSpeed = baseSpeed;
        this._currentSpeed += (targetSpeed - this._currentSpeed) * Math.min(1, dt * 4);

        this._scrollPos += this._currentSpeed * dt;

        // Handle items as they exit the left edge of the screen
        while (this._trackElem.firstElementChild) {
          const firstChild = this._trackElem.firstElementChild;
          const itemWidth = firstChild.getBoundingClientRect().width;
          if (this._scrollPos >= itemWidth && itemWidth > 0) {
            this._scrollPos -= itemWidth;
            this._trackElem.removeChild(firstChild);

            const id = firstChild.getAttribute('data-id');
            const sig = firstChild.getAttribute('data-sig');

            if (id === 'gap') {
              // Entrance gap exited left edge: simply continue
              continue;
            }

            // Real telemetry unit: record signature as permanently retired
            if (sig) {
              this._retiredSignatures.add(sig);
              if (this._retiredSignatures.size > 80) {
                const oldest = this._retiredSignatures.values().next().value;
                this._retiredSignatures.delete(oldest);
              }
            }
          } else {
            break;
          }
        }

        this._trackElem.style.transform = `translate3d(-${this._scrollPos.toFixed(2)}px, 0, 0)`;
      }
    }

    this._animFrame = requestAnimationFrame(this._tick);
  }

  _getContainerWidth() {
    const box = this.shadowRoot.getElementById('ticker-box');
    return (box && box.offsetWidth > 0) ? box.offsetWidth : (window.innerWidth || 1200);
  }

  _appendWithEntranceGap(newUnit) {
    const containerWidth = this._getContainerWidth();

    // 1. Calculate current screen-space right edge of existing items
    let currentTrackWidth = 0;
    Array.from(this._trackElem.children).forEach(el => {
      currentTrackWidth += el.getBoundingClientRect().width;
    });

    const currentScreenRight = currentTrackWidth - this._scrollPos;

    // 2. If existing content ends inside visible screen (or track is empty),
    // inject an entrance gap so newUnit starts beyond the right edge of the screen!
    if (currentScreenRight < containerWidth) {
      const neededGap = Math.ceil(containerWidth - currentScreenRight + 40);
      const gap = document.createElement('div');
      gap.className = 'ticker-gap';
      gap.setAttribute('data-id', 'gap');
      gap.style.width = `${neededGap}px`;
      this._trackElem.appendChild(gap);
    }

    // 3. Append the new item!
    this._trackElem.appendChild(newUnit);
  }

  _createItemElement(item) {
    const unit = document.createElement('div');
    unit.className = 'ticker-unit';
    unit.setAttribute('data-id', item.id);
    unit.setAttribute('data-sig', `${item.id}::${item.text}`);
    unit.innerHTML = `
      <span class="ticker-item">
        <span class="tag ${item.tag}">${item.label}</span>
        <span class="ticker-text">${item.text}</span>
      </span>
      <span class="separator">◆</span>
    `;
    return unit;
  }

  _updateItemElement(unit, item) {
    if (!unit || !item) return;
    const textEl = unit.querySelector('.ticker-text');
    if (textEl && textEl.textContent !== item.text) {
      textEl.textContent = item.text;
      unit.setAttribute('data-sig', `${item.id}::${item.text}`);
    }
    const tagEl = unit.querySelector('.tag');
    if (tagEl) {
      if (tagEl.className !== `tag ${item.tag}`) {
        tagEl.className = `tag ${item.tag}`;
      }
      if (tagEl.textContent !== item.label) {
        tagEl.textContent = item.label;
      }
    }
  }

  _syncTrack(items) {
    if (!this._trackElem) return;

    // 1. Filter out items that have already completed their single pass with this exact signature
    const unretiredItems = items.filter(item => {
      const sig = `${item.id}::${item.text}`;
      return !this._retiredSignatures.has(sig);
    });

    this._activeItems = new Map(unretiredItems.map(item => [item.id, item]));

    // 2. Manage Idle Overlay
    const idleOverlay = this.shadowRoot.getElementById('ticker-idle');
    const currentUnits = Array.from(this._trackElem.querySelectorAll('.ticker-unit:not([data-id="gap"])'));

    if (unretiredItems.length === 0 && currentUnits.length === 0) {
      if (idleOverlay) idleOverlay.classList.remove('hidden');
      return;
    }

    if (idleOverlay) {
      idleOverlay.classList.add('hidden');
    }

    // 3. Track is empty: add all incoming items with entrance gap (starts beyond right edge)
    if (currentUnits.length === 0) {
      unretiredItems.forEach(item => {
        const newUnit = this._createItemElement(item);
        this._appendWithEntranceGap(newUnit);
      });
      return;
    }

    // 4. Track is already moving: update existing units in-place if their signature evolved
    const existingIds = new Set();
    currentUnits.forEach(child => {
      const id = child.getAttribute('data-id');
      if (id && this._activeItems.has(id)) {
        existingIds.add(id);
        const latest = this._activeItems.get(id);
        this._updateItemElement(child, latest);
      }
    });

    // 5. Add brand new unretired items to the entrance of the ticker (beyond right edge)
    unretiredItems.forEach(item => {
      if (!existingIds.has(item.id)) {
        const newUnit = this._createItemElement(item);
        this._appendWithEntranceGap(newUnit);
      }
    });
  }

  _updateContent() {
    if (!this._hass || !this.shadowRoot) return;

    const rc = this._hass.states[this._config.race_control_entity];
    const track = this._hass.states[this._config.track_status_entity];
    const fia = this._hass.states[this._config.fia_documents_entity];
    const nextRace = this._hass.states[this._config.next_race_entity];
    const positions = this._hass.states[this._config.driver_positions_entity];
    const weather = this._hass.states[this._config.track_weather_entity];
    const lapCount = this._hass.states[this._config.lap_count_entity];
    const replayMode = this._hass.states[this._config.replay_mode_entity] || this._hass.states['input_boolean.f1_replay_mode'];
    const replayStatus = this._hass.states[this._config.replay_status_entity] || this._hass.states['sensor.f1_replay_status'];
    const replayPlayer = this._hass.states['media_player.f1_replay_player'];
    const sessionStatus = this._hass.states[this._config.session_status_entity] || this._hass.states['sensor.f1_session_status'];

    const isAvailable = (s) => s && s.state !== 'unavailable' && s.state !== 'unknown';
    const isPureNumber = (val) => {
      if (val === null || val === undefined) return true;
      const s = String(val).trim();
      return /^-?\d+(\.\d+)?$/.test(s);
    };

    // 1. Determine Replay vs Live vs Before Mode matching f1_sensor
    const isReplayMode = (
      (replayMode && replayMode.state === 'on') ||
      (replayStatus && isAvailable(replayStatus) && ['playing', 'paused', 'running', 'seeking', 'loading'].includes(replayStatus.state.toLowerCase())) ||
      (replayPlayer && isAvailable(replayPlayer) && ['playing', 'paused'].includes(replayPlayer.state.toLowerCase()))
    );

    // 2. Intelligent Replay Seek & Jump-Back Detection
    let seekDetected = false;
    let isSeeking = false;

    if (isReplayMode) {
      const pos = Number(
        (replayStatus && replayStatus.attributes && replayStatus.attributes.playback_position_s !== undefined)
          ? replayStatus.attributes.playback_position_s
          : ((replayPlayer && replayPlayer.attributes && replayPlayer.attributes.playback_position_s !== undefined)
            ? replayPlayer.attributes.playback_position_s
            : ((replayPlayer && replayPlayer.attributes && replayPlayer.attributes.media_position !== undefined)
              ? replayPlayer.attributes.media_position
              : null))
      );

      const sessionId = String(
        (replayStatus && replayStatus.attributes && replayStatus.attributes.selected_session_id)
          || (replayPlayer && replayPlayer.attributes && replayPlayer.attributes.selected_session_id)
          || ''
      );

      const replayState = (replayStatus && replayStatus.state) ? replayStatus.state.toLowerCase() : '';
      if (replayState === 'seeking' || replayState === 'loading') {
        isSeeking = true;
        seekDetected = true;
      }

      // Detect if user loaded a different replay session
      if (this._lastSessionId !== null && sessionId && sessionId !== this._lastSessionId) {
        seekDetected = true;
      }

      // Detect jump backwards (even by > 2s) or large jump forward (> 10s)
      if (!isNaN(pos) && this._lastPlaybackPos !== null && !isNaN(this._lastPlaybackPos)) {
        const delta = pos - this._lastPlaybackPos;
        if (delta < -2 || delta > 10) {
          seekDetected = true;
        }
      }

      if (!isNaN(pos)) this._lastPlaybackPos = pos;
      if (sessionId) this._lastSessionId = sessionId;
    } else {
      // Switched out of replay mode into live session
      if (this._wasReplayMode === true) {
        seekDetected = true;
      }
      this._lastPlaybackPos = null;
      this._lastSessionId = null;
    }
    this._wasReplayMode = isReplayMode;

    // If jump or seek detected, EMPTY the ticker completely and clear retired memory!
    if (seekDetected && this._trackElem) {
      this._trackElem.innerHTML = '';
      this._scrollPos = 0;
      this._activeItems.clear();
      this._retiredSignatures.clear();
      this._currentSpeed = null;
      this._lastTime = performance.now();
    }

    // 3. Status Pill Label & Theme Tone
    let badgeClass = 'status-before';
    let badgeHtml = 'BEFORE';

    if (isReplayMode) {
      const isPaused = (
        (replayStatus && (replayStatus.state.toLowerCase() === 'paused' || (replayStatus.attributes && replayStatus.attributes.paused === true))) ||
        (replayPlayer && replayPlayer.state.toLowerCase() === 'paused')
      );

      if (isSeeking) {
        badgeClass = 'status-replay-seeking';
        badgeHtml = '<span class="pulse-dot"></span> [SEEKING]';
      } else if (isPaused) {
        badgeClass = 'status-replay-paused';
        badgeHtml = '[REPLAY PAUSED]';
      } else {
        badgeClass = 'status-replay-running';
        badgeHtml = '<span class="pulse-dot"></span> REPLAY RUNNING';
      }
    } else {
      // Live Mode
      const isLiveActive = sessionStatus && isAvailable(sessionStatus) && ['live', 'started'].includes(sessionStatus.state.toLowerCase());
      if (isLiveActive) {
        badgeClass = 'status-live';
        badgeHtml = '<span class="pulse-dot"></span> LIVE SESSION';
      } else {
        badgeClass = 'status-before';
        badgeHtml = 'BEFORE';
      }
    }

    // Drivers list from positions sensor
    const drivers = (positions && positions.attributes && Array.isArray(positions.attributes.drivers))
      ? positions.attributes.drivers
      : [];

    const items = [];

    // 4. Race Control Messages (Text details only, compact trimmed & capped to latest 2)
    if (this._config.show_race_control !== false && isAvailable(rc)) {
      const cleanRcText = (raw) => {
        return (raw || '').trim()
          .replace(/INCIDENT INVOLVING CAR /gi, 'CAR ')
          .replace(/INCIDENT UNDER INVESTIGATION/gi, 'INVESTIGATION')
          .replace(/INCIDENT NOTED/gi, 'NOTED')
          .replace(/NO FURTHER ACTION REQUIRED/gi, 'NO FURTHER ACTION')
          .replace(/TURN (\d+)/gi, 'T$1')
          .replace(/\s+/g, ' ')
          .trim();
      };

      if (rc.attributes && Array.isArray(rc.attributes.history) && rc.attributes.history.length > 0) {
        // Capped to latest 2 newest notices to prevent clutter
        const recentMsgs = rc.attributes.history.slice(0, 2);
        recentMsgs.forEach(m => {
          const text = cleanRcText(m.message);
          if (!isPureNumber(text) && text.length > 1 && text.toUpperCase() !== 'OFFLINE' && text.toUpperCase() !== 'NONE') {
            const key = m.event_id || text;
            items.push({ id: `rc-${key}`, tag: 'tag-rc', label: '🚨 RACE CONTROL', text });
          }
        });
      } else {
        const text = cleanRcText(rc.state);
        if (!isPureNumber(text) && text.length > 1 && text.toUpperCase() !== 'OFFLINE' && text.toUpperCase() !== 'NONE') {
          items.push({ id: `rc-${text}`, tag: 'tag-rc', label: '🚨 RACE CONTROL', text });
        }
      }
    }

    // 5. Track Status with Dynamic Color Coding matching f1_sensor
    if (this._config.show_track_status !== false && isAvailable(track)) {
      const rawTrack = track.state.trim().toUpperCase();
      if (!isPureNumber(rawTrack) && rawTrack !== 'UNKNOWN') {
        const trackConf = this._getTrackStatusConfig(rawTrack);
        items.push({
          id: 'track-status',
          tag: trackConf.tag,
          label: trackConf.label,
          text: trackConf.text,
        });
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
          id: 'fastest-lap',
          tag: 'tag-fastest',
          label: '⚡ FASTEST LAP',
          text: `${flDriver.tla || flDriver.name} - ${time}${lapStr}`,
        });
      }
    }

    // 7. On-Track Battles (Suppressed under yellow/SC/VSC, capped to Top 1 closest duel <= 1.0s)
    const rawTrackUpper = (track && track.state) ? track.state.trim().toUpperCase() : 'CLEAR';
    const isFlagActive = ['YELLOW', 'SC', 'VSC', 'RED'].includes(rawTrackUpper);

    if (this._config.show_battles !== false && drivers.length > 1 && !isFlagActive) {
      let battleCount = 0;
      for (let i = 1; i < drivers.length && battleCount < 1; i++) { // Cap to single closest duel!
        const ahead = drivers[i - 1];
        const curr = drivers[i];
        const interval = curr.interval_to_position_ahead || '';
        if (interval.startsWith('+')) {
          const val = parseFloat(interval.replace('+', '').replace('s', ''));
          if (!isNaN(val) && val <= 1.0 && val > 0) {
            const formattedInterval = `+${val.toFixed(1)}s`;
            items.push({
              id: `battle-${ahead.tla}-${curr.tla}`,
              tag: 'tag-battle',
              label: '⚔️ DRS BATTLE',
              text: `P${ahead.current_position} ${ahead.tla} vs P${curr.current_position} ${curr.tla} (${formattedInterval})`,
            });
            battleCount++;
          }
        }
      }
    }

    // 8. Pit Stops (Only active cars in pit lane)
    if (this._config.show_pit_stops !== false) {
      const inPitDrivers = drivers.filter(d => d.in_pit === true).map(d => d.tla || d.name);
      if (inPitDrivers.length > 0) {
        items.push({
          id: 'pit-stops',
          tag: 'tag-pit',
          label: '🛞 IN PIT',
          text: `${inPitDrivers.join(', ')} IN PIT`,
        });
      }
    }

    // 9. Lap Count
    if (this._config.show_lap_count === true && isAvailable(lapCount)) {
      const total = lapCount.attributes && lapCount.attributes.total_laps ? ` / ${lapCount.attributes.total_laps}` : '';
      items.push({
        id: 'lap-count',
        tag: 'tag-lap',
        label: '🏁 LAP',
        text: `${lapCount.state}${total}`,
      });
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
          id: 'weather',
          tag: 'tag-weather',
          label: '🌡️ WEATHER',
          text: wParts.join(' • '),
        });
      }
    }

    // 11. FIA Decision Documents
    if (this._config.show_fia_documents === true && isAvailable(fia)) {
      const title = (fia.attributes && fia.attributes.name) ? fia.attributes.name : null;
      if (title && !isPureNumber(title)) {
        items.push({ id: `fia-${title}`, tag: 'tag-fia', label: '📄 FIA DECISION', text: title });
      }
    }

    // 12. Next Race Countdown
    if (this._config.show_next_race === true && isAvailable(nextRace)) {
      const rName = (nextRace.attributes && nextRace.attributes.race_name) ? nextRace.attributes.race_name : null;
      const rLoc = (nextRace.attributes && nextRace.attributes.circuit_locality) ? nextRace.attributes.circuit_locality : null;
      if (rName) {
        const text = rLoc ? `${rName} (${rLoc})` : rName;
        items.push({ id: 'next-race', tag: 'tag-neutral', label: '🏁 NEXT GP', text: text });
      }
    }

    // Fallback if no items currently active
    if (items.length === 0) {
      if (isSeeking) {
        items.push({ id: 'fallback-seeking', tag: 'tag-track-sc', label: '↶ REPLAY SEEK', text: 'Synchronizing timeline to new timestamp...' });
      } else {
        if (isAvailable(track) && !isPureNumber(track.state)) {
          const trackConf = this._getTrackStatusConfig(track.state);
          items.push({ id: 'fallback-track', tag: trackConf.tag, label: trackConf.label, text: trackConf.text });
        }
        if (isAvailable(nextRace) && nextRace.attributes && nextRace.attributes.race_name) {
          items.push({ id: 'fallback-next', tag: 'tag-neutral', label: '🏁 NEXT GP', text: nextRace.attributes.race_name });
        }
        if (isReplayMode) {
          items.push({ id: 'fallback-replay', tag: 'tag-neutral', label: '↶ REPLAY', text: 'No active incident notices for current replay session' });
        } else {
          items.push({ id: 'fallback-before', tag: 'tag-neutral', label: 'BEFORE', text: 'Waiting for live track session to start' });
        }
      }
    }

    // Update Status Badge in Header
    const statusPill = this.shadowRoot.getElementById('status-pill');
    if (statusPill) {
      statusPill.className = `status-pill ${badgeClass}`;
      statusPill.innerHTML = badgeHtml;
    }

    // Sync track items
    this._syncTrack(items);
  }

  _getTrackStatusConfig(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (s.includes('RED')) {
      return {
        tag: 'tag-track-red',
        label: '🛑 RED FLAG',
        text: s.includes('FLAG') ? s : 'RED FLAG - SESSION SUSPENDED',
      };
    }
    if (s === 'SC' || (s.includes('SAFETY') && !s.includes('VIRTUAL'))) {
      return {
        tag: 'tag-track-sc',
        label: '⚠️ SAFETY CAR',
        text: s.includes('SAFETY') ? s : 'SAFETY CAR DEPLOYED',
      };
    }
    if (s === 'VSC' || s.includes('VIRTUAL')) {
      return {
        tag: 'tag-track-vsc',
        label: '⚠️ VSC',
        text: s.includes('VSC') || s.includes('VIRTUAL') ? s : 'VIRTUAL SAFETY CAR DEPLOYED',
      };
    }
    if (s.includes('YELLOW')) {
      return {
        tag: 'tag-track-yellow',
        label: '⚑ YELLOW FLAG',
        text: s.includes('FLAG') ? s : 'YELLOW FLAG',
      };
    }
    if (s.includes('BLUE')) {
      return {
        tag: 'tag-track-blue',
        label: '⚑ BLUE FLAG',
        text: s,
      };
    }
    return {
      tag: 'tag-track-clear',
      label: '✓ TRACK STATUS',
      text: s === 'CLEAR' || s === 'GREEN' ? 'TRACK CLEAR' : s,
    };
  }

  getCardSize() {
    return 1;
  }
}

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
          <label class="label-title">Scroll Speed (px/sec, default: 35)</label>
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
            <span class="label-desc">Dynamic color-coded track state flags (Clear, Yellow, VSC, SC, Red)</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_track_status" ${this._config.show_track_status !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">⚡ Fastest Lap</span>
            <span class="label-desc">Current fastest lap driver, sector time & lap number in signature purple</span>
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
    description: 'Ultra-smooth 60fps continuous ticker for live F1 race control, steward notices, fastest laps, DRS battles and track status with official Formula 1 typography',
    preview: true,
  });
}
