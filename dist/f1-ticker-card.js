/**
 * F1 Live Race Control Ticker Card (f1-ticker-card)
 * Version: 2.2.0
 * 
 * Hardware-accelerated continuous 60fps single-message conveyor ticker.
 * Fully unified with the Nicxe/f1_sensor Weekend Hub design language:
 * - Shared .wh-shell triple-gradient carbon chassis & 4px red left indicator stripe
 * - Authentic Formula 1 Display typography with responsive clamp scaling
 * - Mobile container queries (@container max-width: 680px) for seamless pitwall & phone viewports
 * - Standardized status pill badge (.wh-live-badge) with exact Weekend Hub success tokens & solid glowing dot
 * - Dynamic Idle Track Status Engine: idle overlay always mirrors actual track status (VSC, SC, Yellow, Red, Clear)
 * - Integrated Header Spoiler Toggle (.wh-spoiler-btn): standalone spoiler protection toggle directly in card header
 * - Preserves high-performance Single-Pass Retirement, Adaptive Speed Governor, and Replay Time-Travel.
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
      kicker: 'RACE CONTROL FEED',
      title: 'LIVE RACE CONTROL TICKER',
      subtitle: 'INCIDENTS & TRACK LIMITS',
      speed: 35,
      show_spoiler_toggle: true,
      spoiler_entity: 'switch.f1_no_spoiler_mode',
      spoiler_label: 'SPOILER MODE',
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
      kicker: 'RACE CONTROL FEED',
      title: 'LIVE RACE CONTROL TICKER',
      subtitle: 'INCIDENTS & TRACK LIMITS',
      speed: 35,
      show_spoiler_toggle: true,
      spoiler_entity: 'switch.f1_no_spoiler_mode',
      spoiler_label: 'SPOILER MODE',
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
        box-sizing: border-box;
        font-family: var(--f1-card-body-font-family, 'Formula1 Display', sans-serif);

        /* Nicxe/f1_sensor Weekend Hub Theme Tokens */
        --f1-card-bg: #0b0b0d;
        --f1-card-bg-soft: #131315;
        --f1-card-bg-end: #0a0a0a;
        --f1-card-text: #f5f5f5;
        --f1-card-muted: rgba(255, 255, 255, 0.65);
        --f1-card-soft: rgba(255, 255, 255, 0.42);
        --f1-card-border: rgba(255, 255, 255, 0.08);
        --f1-card-divider: rgba(255, 255, 255, 0.08);
        --f1-card-divider-strong: rgba(255, 255, 255, 0.12);
        --f1-card-chip: rgba(255, 255, 255, 0.06);
        --f1-card-panel: rgba(255, 255, 255, 0.04);
        --f1-card-panel-soft: rgba(255, 255, 255, 0.025);
        --f1-card-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        --f1-card-display-font-family: 'Formula1 Display', sans-serif;
        --f1-card-body-font-family: 'Formula1 Display', sans-serif;
        --f1-card-label-font-family: 'Formula1 Display', sans-serif;

        --f1-marker-red: #ff3b30;
        --f1-marker-yellow: #ffd60a;
        --f1-marker-green: #34c759;
        --f1-marker-blue: #0a84ff;
        --f1-marker-purple: #8b5cf6;
        --f1-marker-orange: #ff9500;

        --f1-status-info: #38bdf8;
        --f1-status-info-text: #bfdbfe;
        --f1-status-info-bg: rgba(59, 130, 246, 0.14);
        --f1-status-info-border: rgba(96, 165, 250, 0.28);
        --f1-status-warning: #f59e0b;
        --f1-status-warning-text: #fde68a;
        --f1-status-warning-bg: rgba(251, 191, 36, 0.10);
        --f1-status-warning-border: rgba(251, 191, 36, 0.24);
        --f1-status-success: #34c759;
        --f1-status-success-text: #86efac;
        --f1-status-success-bg: rgba(52, 199, 89, 0.16);
        --f1-status-success-border: rgba(52, 199, 89, 0.34);
        --f1-status-danger: #ff3b30;
        --f1-status-danger-text: #fca5a5;
        --f1-status-danger-bg: rgba(255, 59, 48, 0.14);
        --f1-status-danger-border: rgba(255, 59, 48, 0.32);
        --f1-status-neutral: #a3a3a3;
        --f1-status-neutral-text: #d4d4d8;
        --f1-status-neutral-bg: rgba(163, 163, 163, 0.12);
        --f1-status-neutral-border: rgba(163, 163, 163, 0.36);
        --f1-status-purple: #8b5cf6;
        --f1-status-purple-text: #d8b4fe;
        --f1-status-purple-bg: rgba(139, 92, 246, 0.22);
        --f1-status-purple-border: rgba(139, 92, 246, 0.45);
        --f1-status-orange: #f97316;
        --f1-status-orange-text: #fed7aa;
        --f1-status-orange-bg: rgba(249, 115, 22, 0.14);
        --f1-status-orange-border: rgba(249, 115, 22, 0.30);
      }

      * {
        box-sizing: border-box;
      }

      ha-card {
        padding: 0;
        background: transparent;
        border: 0;
        box-shadow: none;
      }

      /* Authentic Weekend Hub Outer Shell (.wh-shell) */
      .wh-shell {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--f1-card-border);
        border-radius: var(--ha-card-border-radius, 12px);
        background:
          linear-gradient(110deg, transparent 0 47%, var(--f1-card-panel-soft) 47% 48%, transparent 48% 100%),
          radial-gradient(circle at 93% -8%, rgba(255, 59, 48, 0.22), transparent 38%),
          linear-gradient(155deg, var(--f1-card-bg) 0%, var(--f1-card-bg-soft) 68%, var(--f1-card-bg-end) 100%);
        box-shadow: var(--f1-card-shadow);
        color: var(--f1-card-text);
        container-type: inline-size;
      }

      .wh-shell::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        background: var(--f1-marker-red);
        z-index: 5;
      }

      /* Weekend Hub Header Architecture (.wh-header) */
      .wh-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: 16px;
        padding: clamp(14px, 2.5vw, 22px) clamp(16px, 3.2vw, 28px) 14px;
        border-bottom: 1px solid var(--f1-card-divider);
      }

      .wh-kicker {
        color: var(--f1-marker-red);
        font-family: var(--f1-card-label-font-family, 'Formula1 Display', sans-serif);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }

      .wh-title {
        margin: 5px 0 2px;
        font-family: var(--f1-card-display-font-family, 'Formula1 Display', sans-serif);
        font-size: clamp(20px, 3.2vw, 32px);
        font-weight: 800;
        letter-spacing: -0.02em;
        line-height: 1;
        text-transform: uppercase;
        color: var(--f1-card-text);
      }

      .wh-subtitle {
        color: var(--f1-card-muted);
        font-family: var(--f1-card-body-font-family, 'Formula1 Display', sans-serif);
        font-size: 11px;
        line-height: 1.4;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .wh-subtitle:empty,
      .wh-kicker:empty {
        display: none;
      }

      /* Standardized Weekend Hub Status Badge (.wh-live-badge) */
      .wh-live-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 26px;
        padding: 0 10px;
        border: 1px solid var(--f1-card-divider-strong);
        border-radius: 999px;
        background: var(--f1-card-chip);
        color: var(--f1-card-muted);
        font-family: var(--f1-card-display-font-family, 'Formula1 Display', sans-serif);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .wh-live-badge.live,
      .wh-live-badge.replay-running {
        border-color: var(--f1-status-success-border);
        background: var(--f1-status-success-bg);
        color: var(--f1-status-success-text);
      }

      .wh-live-badge.replay-paused,
      .wh-live-badge.replay-seeking,
      .wh-live-badge.before {
        border-color: var(--f1-card-divider-strong);
        background: var(--f1-card-chip);
        color: var(--f1-card-muted);
      }

      .wh-live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 10px currentColor;
      }

      /* Header Actions & Spoiler Toggle */
      .wh-header-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .wh-spoiler-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 26px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid var(--f1-card-divider-strong);
        background: var(--f1-card-chip);
        color: var(--f1-card-muted);
        font-family: var(--f1-card-display-font-family, 'Formula1 Display', sans-serif);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        -webkit-font-smoothing: antialiased;
      }

      .wh-spoiler-btn:hover {
        border-color: rgba(255, 255, 255, 0.25);
        color: var(--f1-card-text);
        transform: translateY(-1px);
      }

      .wh-spoiler-btn:active {
        transform: translateY(1px);
      }

      .wh-spoiler-btn.active {
        border-color: var(--f1-status-danger-border);
        background: var(--f1-status-danger-bg);
        color: var(--f1-status-danger-text);
        box-shadow: 0 0 12px rgba(255, 59, 48, 0.22);
      }

      .wh-spoiler-btn.active:hover {
        border-color: rgba(255, 59, 48, 0.5);
      }

      .wh-spoiler-icon {
        --mdc-icon-size: 14px;
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .wh-spoiler-btn.active .wh-spoiler-icon {
        color: var(--f1-marker-red);
      }

      /* Responsive Container Queries matching Weekend Hub */
      @container (max-width: 680px) {
        .wh-header {
          grid-template-columns: 1fr;
          gap: 10px;
          padding: 14px 16px 12px;
        }
        .wh-header-actions {
          justify-content: flex-start;
        }
        .wh-live-badge {
          justify-self: start;
        }
        .wh-title {
          font-size: 20px;
        }
      }

      @container (max-width: 420px) {
        .wh-header {
          padding: 12px 14px 10px;
        }
        .wh-header-actions {
          gap: 6px;
        }
        .wh-spoiler-btn,
        .wh-live-badge {
          font-size: 8px;
          padding: 0 8px;
          min-height: 24px;
        }
        .wh-title {
          font-size: 18px;
        }
      }

      /* Single-Message Conveyor Marquee Viewport */
      .ticker-container {
        position: relative;
        overflow: hidden;
        height: 42px;
        display: flex;
        align-items: center;
        background: var(--f1-card-panel-soft);
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
        opacity: 0.95;
        transition: opacity 0.25s ease;
        z-index: 1;
        user-select: none;
      }

      .ticker-idle-overlay .ticker-text {
        font-family: var(--f1-card-body-font-family, 'Formula1 Display', sans-serif) !important;
        font-size: 0.86rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        color: var(--f1-card-text);
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
        font-family: var(--f1-card-body-font-family, 'Formula1 Display', sans-serif) !important;
        font-size: 0.88rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--f1-card-text);
        white-space: nowrap;
      }

      /* Official Capsule Pills for Ticker Bulletins */
      .tag {
        font-family: var(--f1-card-display-font-family, 'Formula1 Display', sans-serif) !important;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 3px 10px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
        background: color-mix(in srgb, currentColor 12%, transparent);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }

      .tag-rc {
        color: var(--f1-status-danger);
      }
      .tag-blue-flag {
        color: var(--f1-status-info);
      }
      .tag-track-limits {
        color: var(--f1-status-warning);
      }
      .tag-track-clear {
        color: var(--f1-status-success);
      }
      .tag-track-yellow {
        color: var(--f1-marker-yellow);
      }
      .tag-track-sc, .tag-track-vsc {
        color: var(--f1-marker-orange);
      }
      .tag-track-red {
        color: var(--f1-marker-red);
        animation: pulse-red 1.2s infinite ease-in-out;
      }
      @keyframes pulse-red {
        0%, 100% { box-shadow: 0 0 4px rgba(255, 59, 48, 0.3); }
        50% { box-shadow: 0 0 10px rgba(255, 59, 48, 0.7); }
      }
      .tag-track-blue {
        color: var(--f1-marker-blue);
      }
      .tag-fastest {
        color: var(--f1-status-purple);
      }
      .tag-battle {
        color: var(--f1-status-warning);
      }
      .tag-pit {
        color: var(--f1-status-info);
      }
      .tag-neutral {
        color: var(--f1-status-success);
      }
      .tag-weather {
        color: var(--f1-status-info);
      }
      .tag-fia, .tag-lap {
        color: var(--f1-status-neutral);
      }

      .separator {
        color: var(--f1-card-divider-strong);
        font-size: 0.65rem;
        margin: 0 16px;
        user-select: none;
        flex-shrink: 0;
      }

      /* Compact styling for high-frequency bulletins (blue flags, track limits) */
      .ticker-unit.unit-compact .ticker-item {
        font-size: 0.80rem;
        gap: 6px;
      }
      .ticker-unit.unit-compact .tag {
        font-size: 0.62rem;
        padding: 2px 8px;
      }
      .ticker-unit.unit-compact .separator {
        margin: 0 10px;
      }
    `;

    this.shadowRoot.innerHTML = `
      <style>${style}</style>
      <ha-card>
        <section class="wh-shell">
          <header class="wh-header">
            <div>
              <div class="wh-kicker" id="kicker-text">${this._config.kicker || 'RACE CONTROL FEED'}</div>
              <h2 class="wh-title" id="title-text">${this._config.title || 'LIVE RACE CONTROL TICKER'}</h2>
              <div class="wh-subtitle" id="subtitle-text">${this._config.subtitle !== undefined && this._config.subtitle !== null ? this._config.subtitle : 'INCIDENTS & TRACK LIMITS'}</div>
            </div>
            <div class="wh-header-actions">
              <button class="wh-spoiler-btn" id="spoiler-toggle" type="button" title="Toggle Spoiler Mode">
                <ha-icon class="wh-spoiler-icon" id="spoiler-icon" icon="mdi:eye-outline"></ha-icon>
                <span id="spoiler-label">${(this._config.spoiler_label || 'SPOILER MODE').toUpperCase()}: OFF</span>
              </button>
              <div class="wh-live-badge before" id="status-pill">
                <span class="wh-live-dot"></span>
                <span id="status-text">BEFORE</span>
              </div>
            </div>
          </header>
          <div class="ticker-container" id="ticker-box">
            <div class="ticker-idle-overlay" id="ticker-idle">
              <span class="tag tag-track-clear" id="idle-tag">🟢 TRACK CLEAR</span>
              <span class="ticker-text" id="idle-text">MONITORING RACE CONTROL</span>
            </div>
            <div class="ticker-track" id="ticker-track"></div>
          </div>
        </section>
      </ha-card>
    `;

    const spoilerBtn = this.shadowRoot.getElementById('spoiler-toggle');
    if (spoilerBtn) {
      spoilerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!this._hass) return;
        const entityId = this._config.spoiler_entity || 'switch.f1_no_spoiler_mode';
        this._hass.callService('switch', 'toggle', { entity_id: entityId });
      });
    }

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
    unit.className = 'ticker-unit' + (item.is_compact ? ' unit-compact' : '');
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
    if (item.is_compact) {
      unit.classList.add('unit-compact');
    } else {
      unit.classList.remove('unit-compact');
    }
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

    // 3. Status Pill Label & Theme Tone matching Weekend Hub Card
    let badgeClass = '';
    let badgeText = 'READY';

    if (isReplayMode) {
      const isPaused = (
        (replayStatus && (replayStatus.state.toLowerCase() === 'paused' || (replayStatus.attributes && replayStatus.attributes.paused === true))) ||
        (replayPlayer && replayPlayer.state.toLowerCase() === 'paused')
      );

      if (isSeeking) {
        badgeClass = 'replay-seeking';
        badgeText = 'REPLAY SEEKING';
      } else if (isPaused) {
        badgeClass = 'replay-paused';
        badgeText = 'REPLAY PAUSED';
      } else {
        badgeClass = 'live';
        badgeText = 'REPLAY RUNNING';
      }
    } else {
      // Live Mode
      const isLiveActive = sessionStatus && isAvailable(sessionStatus) && ['live', 'started'].includes(sessionStatus.state.toLowerCase());
      if (isLiveActive) {
        badgeClass = 'live';
        badgeText = 'LIVE';
      } else {
        badgeClass = 'before';
        badgeText = 'READY';
      }
    }

    // 4. Determine Current Track Status (Enum strings, numeric codes 1,2,4,5,6,7, and RC bulletins)
    let currentTrackStatus = 'CLEAR';
    if (track && isAvailable(track)) {
      const s = String(track.state || '').trim().toUpperCase();
      if (!isPureNumber(s)) {
        currentTrackStatus = s;
      } else if (s === '1') {
        currentTrackStatus = 'CLEAR';
      } else if (s === '2') {
        currentTrackStatus = 'YELLOW';
      } else if (s === '4') {
        currentTrackStatus = 'SC';
      } else if (s === '5') {
        currentTrackStatus = 'RED';
      } else if (s === '6' || s === '7') {
        currentTrackStatus = 'VSC';
      }
    }

    // Inspect active race control notices for safety car/VSC/red flags if track sensor reports CLEAR
    if (currentTrackStatus === 'CLEAR' || currentTrackStatus === 'UNKNOWN') {
      const checkRcText = (msg) => {
        const u = String(msg || '').toUpperCase();
        if (u.includes('VIRTUAL SAFETY CAR') || u.includes('VSC')) {
          if (!u.includes('ENDED') && !u.includes('ENDING') && !u.includes('CLEAR')) return 'VSC';
        }
        if (u.includes('SAFETY CAR') && !u.includes('VIRTUAL')) {
          if (!u.includes('IN THIS LAP') && !u.includes('ENDING') && !u.includes('CLEAR')) return 'SC';
        }
        if (u.includes('RED FLAG')) return 'RED';
        if (u.includes('YELLOW FLAG')) return 'YELLOW';
        return null;
      };

      if (rc && isAvailable(rc)) {
        let rcFlag = checkRcText(rc.state);
        if (!rcFlag && rc.attributes && Array.isArray(rc.attributes.history) && rc.attributes.history.length > 0) {
          rcFlag = checkRcText(rc.attributes.history[0].message);
        }
        if (rcFlag) currentTrackStatus = rcFlag;
      }
    }

    const trackConf = this._getTrackStatusConfig(currentTrackStatus);

    // Dynamically update Idle Overlay so tracker status ALWAYS matches actual track status
    const idleTag = this.shadowRoot.getElementById('idle-tag');
    const idleText = this.shadowRoot.getElementById('idle-text');
    if (idleTag && idleText) {
      idleTag.className = `tag ${trackConf.tag}`;
      idleTag.textContent = trackConf.label;
      idleText.textContent = (currentTrackStatus === 'CLEAR')
        ? 'MONITORING RACE CONTROL'
        : trackConf.text;
    }

    // Drivers list from positions sensor
    const drivers = (positions && positions.attributes && Array.isArray(positions.attributes.drivers))
      ? positions.attributes.drivers
      : [];

    const items = [];

    // 4. Race Control Messages (Text details only, compact trimmed & deduplicated)
    if (this._config.show_race_control !== false && isAvailable(rc)) {
      const seenRcIds = new Set();
      if (rc.attributes && Array.isArray(rc.attributes.history) && rc.attributes.history.length > 0) {
        // Inspect up to 5 newest notices, deduplicating repetitive alerts (e.g. repeated blue flags for same car)
        for (const m of rc.attributes.history.slice(0, 5)) {
          const parsed = this._parseRcMessage(m.message, m.event_id);
          if (parsed && !isPureNumber(parsed.text) && parsed.text.length > 1) {
            if (!seenRcIds.has(parsed.id)) {
              seenRcIds.add(parsed.id);
              items.push(parsed);
              if (items.filter(it => it.tag.startsWith('tag-rc') || it.tag === 'tag-blue-flag' || it.tag === 'tag-track-limits').length >= 2) {
                break; // Cap to 2 newest active race control bulletins
              }
            }
          }
        }
      } else {
        const parsed = this._parseRcMessage(rc.state);
        if (parsed && !isPureNumber(parsed.text) && parsed.text.length > 1) {
          items.push(parsed);
        }
      }
    }

    // 5. Track Status with Dynamic Color Coding matching f1_sensor
    if (this._config.show_track_status !== false && currentTrackStatus !== 'CLEAR' && currentTrackStatus !== 'UNKNOWN') {
      items.push({
        id: 'track-status',
        tag: trackConf.tag,
        label: trackConf.label,
        text: trackConf.text,
      });
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
    const isFlagActive = ['YELLOW', 'SC', 'VSC', 'RED'].includes(currentTrackStatus);

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

    // Fallback notice if user is seeking
    if (items.length === 0 && isSeeking) {
      items.push({ id: 'fallback-seeking', tag: 'tag-track-sc', label: '↶ REPLAY SEEK', text: 'Synchronizing timeline to new timestamp...' });
    }

    // Update Header Texts & Status Badge
    const titleEl = this.shadowRoot.getElementById('title-text');
    if (titleEl && titleEl.textContent !== (this._config.title || 'LIVE RACE CONTROL TICKER')) {
      titleEl.textContent = this._config.title || 'LIVE RACE CONTROL TICKER';
    }
    const subtitleEl = this.shadowRoot.getElementById('subtitle-text');
    const subText = this._config.subtitle !== undefined && this._config.subtitle !== null ? this._config.subtitle : 'INCIDENTS & TRACK LIMITS';
    if (subtitleEl && subtitleEl.textContent !== subText) {
      subtitleEl.textContent = subText;
    }
    const kickerEl = this.shadowRoot.getElementById('kicker-text');
    const kickText = this._config.kicker !== undefined && this._config.kicker !== null ? this._config.kicker : 'RACE CONTROL FEED';
    if (kickerEl && kickerEl.textContent !== kickText) {
      kickerEl.textContent = kickText;
    }

    const statusPill = this.shadowRoot.getElementById('status-pill');
    if (statusPill) {
      statusPill.className = ('wh-live-badge ' + badgeClass).trim();
      statusPill.innerHTML = `<span class="wh-live-dot"></span><span id="status-text">${badgeText}</span>`;
    }

    // Update Spoiler Toggle Button
    const spoilerEntityId = this._config.spoiler_entity || 'switch.f1_no_spoiler_mode';
    const spoilerState = this._hass.states[spoilerEntityId];
    const spoilerBtn = this.shadowRoot.getElementById('spoiler-toggle');
    const spoilerIcon = this.shadowRoot.getElementById('spoiler-icon');
    const spoilerLabel = this.shadowRoot.getElementById('spoiler-label');
    const spoilerTitle = (this._config.spoiler_label || 'SPOILER MODE').trim().toUpperCase();

    if (spoilerBtn) {
      if (this._config.show_spoiler_toggle === false) {
        spoilerBtn.style.display = 'none';
      } else {
        spoilerBtn.style.display = 'inline-flex';
        const isSpoilerOn = spoilerState ? spoilerState.state === 'on' : false;
        const targetLabel = `${spoilerTitle}: ${isSpoilerOn ? 'ON' : 'OFF'}`;
        if (isSpoilerOn) {
          if (!spoilerBtn.classList.contains('active')) spoilerBtn.classList.add('active');
          if (spoilerIcon && spoilerIcon.getAttribute('icon') !== 'mdi:eye-off') spoilerIcon.setAttribute('icon', 'mdi:eye-off');
          if (spoilerLabel && spoilerLabel.textContent !== targetLabel) spoilerLabel.textContent = targetLabel;
        } else {
          if (spoilerBtn.classList.contains('active')) spoilerBtn.classList.remove('active');
          if (spoilerIcon && spoilerIcon.getAttribute('icon') !== 'mdi:eye-outline') spoilerIcon.setAttribute('icon', 'mdi:eye-outline');
          if (spoilerLabel && spoilerLabel.textContent !== targetLabel) spoilerLabel.textContent = targetLabel;
        }
      }
    }

    // Sync track items
    this._syncTrack(items);
  }

  _parseRcMessage(rawMsg, eventId) {
    const raw = (rawMsg || '').trim();
    if (!raw || ['OFFLINE', 'NONE', 'UNKNOWN'].includes(raw.toUpperCase())) {
      return null;
    }

    // 1. Blue flag detection & compacting
    if (/BLUE\s+FLAG/i.test(raw)) {
      const driverMatch = raw.match(/CAR\s+(\d+)(?:\s*\(([A-Z]{3})\))?/i);
      let driverStr = '';
      let carKey = 'unknown';
      if (driverMatch) {
        const carNo = driverMatch[1];
        const tla = driverMatch[2];
        driverStr = tla ? `${tla} (#${carNo})` : `CAR #${carNo}`;
        carKey = carNo;
      } else {
        driverStr = raw
          .replace(/WAVED\s+BLUE\s+FLAG\s+FOR/gi, '')
          .replace(/BLUE\s+FLAG\s+FOR/gi, '')
          .replace(/BLUE\s+FLAG\s*-/gi, '')
          .replace(/TIMED\s+AT\s+\d+:\d+:\d+/gi, '')
          .trim();
        carKey = driverStr;
      }
      return {
        id: `rc-blue-${carKey}`,
        tag: 'tag-blue-flag',
        label: '🟦 BLUE FLAG',
        text: driverStr,
        is_compact: true
      };
    }

    // 2. Track limits / lap time deleted & compacting
    if (/TRACK\s+LIMITS?/i.test(raw) || (/DELETED/i.test(raw) && /TIME/i.test(raw))) {
      const driverMatch = raw.match(/CAR\s+(\d+)(?:\s*\(([A-Z]{3})\))?/i);
      const turnMatch = raw.match(/(?:AT\s+)?TURN\s+(\d+)/i);
      const lapMatch = raw.match(/LAP\s+(\d+)/i);

      let carStr = '';
      let carKey = 'unknown';
      if (driverMatch) {
        const carNo = driverMatch[1];
        const tla = driverMatch[2];
        carStr = tla ? `${tla} (#${carNo})` : `CAR #${carNo}`;
        carKey = carNo;
      }

      const turnStr = turnMatch ? `T${turnMatch[1]}` : '';
      const lapStr = lapMatch ? `(L${lapMatch[1]})` : '';

      const parts = [];
      if (carStr) parts.push(carStr);
      if (turnStr) parts.push(turnStr);
      if (/DELETED/i.test(raw)) {
        parts.push('LAP DELETED');
      } else {
        parts.push('TRACK LIMITS');
      }

      const formattedText = parts.filter(p => !p.startsWith('(')).join(' • ') + (lapStr ? ` ${lapStr}` : '');
      const key = eventId || `${carKey}-${turnStr || 'tl'}`;

      return {
        id: `rc-tl-${key}`,
        tag: 'tag-track-limits',
        label: '⚠️ TRACK LIMITS',
        text: formattedText,
        is_compact: true
      };
    }

    // 3. Standard Race Control incidents
    const cleanText = raw
      .replace(/INCIDENT INVOLVING CAR /gi, 'CAR ')
      .replace(/INCIDENT UNDER INVESTIGATION/gi, 'INVESTIGATION')
      .replace(/INCIDENT NOTED/gi, 'NOTED')
      .replace(/NO FURTHER ACTION REQUIRED/gi, 'NO FURTHER ACTION')
      .replace(/TURN (\d+)/gi, 'T$1')
      .replace(/\s+/g, ' ')
      .trim();

    const key = eventId || cleanText;
    return {
      id: `rc-${key}`,
      tag: 'tag-rc',
      label: '🚨 RACE CONTROL',
      text: cleanText,
      is_compact: false
    };
  }

  _getTrackStatusConfig(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (s.includes('RED') || s === '5') {
      return {
        tag: 'tag-track-red',
        label: '🛑 RED FLAG',
        text: 'RED FLAG - SESSION SUSPENDED',
      };
    }
    if (s === 'SC' || s === '4' || (s.includes('SAFETY') && !s.includes('VIRTUAL'))) {
      return {
        tag: 'tag-track-sc',
        label: '⚠️ SAFETY CAR',
        text: 'SAFETY CAR DEPLOYED',
      };
    }
    if (s === 'VSC' || s === '6' || s === '7' || s.includes('VIRTUAL')) {
      return {
        tag: 'tag-track-vsc',
        label: '⚠️ VSC',
        text: 'VIRTUAL SAFETY CAR DEPLOYED',
      };
    }
    if (s.includes('YELLOW') || s === '2') {
      return {
        tag: 'tag-track-yellow',
        label: '⚑ YELLOW FLAG',
        text: 'YELLOW FLAG IN SECTOR',
      };
    }
    if (s.includes('BLUE')) {
      return {
        tag: 'tag-track-blue',
        label: '⚑ BLUE FLAG',
        text: 'BLUE FLAGS IN OPERATION',
      };
    }
    return {
      tag: 'tag-track-clear',
      label: '🟢 TRACK CLEAR',
      text: 'MONITORING RACE CONTROL',
    };
  }

  getCardSize() {
    return 1;
  }
}

class F1TickerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    if (!this._rendered) {
      this._renderBase();
      this._rendered = true;
    } else {
      this._updateContent();
    }
  }

  _isFocused(element) {
    if (!element) return false;
    try {
      if (element.matches && element.matches(':focus')) return true;
      if (document.activeElement === element) return true;
      const root = element.getRootNode();
      if (root && root.activeElement === element) return true;
    } catch (e) {}
    return false;
  }

  _updateContent() {
    if (!this._config) return;
    const textFields = ['kicker', 'title', 'subtitle', 'speed', 'spoiler_entity', 'spoiler_label'];
    textFields.forEach(id => {
      const el = this.querySelector(`#${id}`);
      if (el && !this._isFocused(el)) {
        const val = this._config[id] ?? '';
        if (el.value !== String(val)) {
          el.value = val;
        }
      }
    });

    const boolFields = [
      'show_spoiler_toggle',
      'show_race_control',
      'show_track_status',
      'show_fastest_lap',
      'show_battles',
      'show_pit_stops',
      'show_weather',
      'show_lap_count',
      'show_fia_documents',
      'show_next_race'
    ];
    boolFields.forEach(id => {
      const el = this.querySelector(`#${id}`);
      if (el) {
        const checked = this._config[id] === true || (this._config[id] !== false && !['show_weather', 'show_lap_count', 'show_fia_documents', 'show_next_race'].includes(id));
        if (el.checked !== checked) {
          el.checked = checked;
        }
      }
    });
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
          <label class="label-title">Header Kicker</label>
          <input type="text" class="input-text" id="kicker" value="${this._config.kicker || 'RACE CONTROL FEED'}" placeholder="RACE CONTROL FEED">
        </div>
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

        <div class="section-header">Spoiler Protection</div>

        <div class="config-row">
          <div class="config-label">
            <span class="label-title">🛡️ Header Spoiler Toggle</span>
            <span class="label-desc">Show interactive No Spoiler Mode pill button directly in card header</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="show_spoiler_toggle" ${this._config.show_spoiler_toggle !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="input-group">
          <label class="label-title">Spoiler Switch Entity</label>
          <input type="text" class="input-text" id="spoiler_entity" value="${this._config.spoiler_entity || 'switch.f1_no_spoiler_mode'}" placeholder="switch.f1_no_spoiler_mode">
        </div>

        <div class="input-group">
          <label class="label-title">Spoiler Button Label</label>
          <input type="text" class="input-text" id="spoiler_label" value="${this._config.spoiler_label || 'SPOILER MODE'}" placeholder="SPOILER MODE">
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
      kicker: this.querySelector('#kicker')?.value ?? '',
      title: this.querySelector('#title')?.value ?? '',
      subtitle: this.querySelector('#subtitle')?.value ?? '',
      speed: parseInt(this.querySelector('#speed')?.value, 10) || 35,
      show_spoiler_toggle: this.querySelector('#show_spoiler_toggle')?.checked ?? true,
      spoiler_entity: this.querySelector('#spoiler_entity')?.value ?? 'switch.f1_no_spoiler_mode',
      spoiler_label: this.querySelector('#spoiler_label')?.value ?? 'SPOILER MODE',
      show_race_control: this.querySelector('#show_race_control')?.checked ?? true,
      show_track_status: this.querySelector('#show_track_status')?.checked ?? true,
      show_fastest_lap: this.querySelector('#show_fastest_lap')?.checked ?? true,
      show_battles: this.querySelector('#show_battles')?.checked ?? true,
      show_pit_stops: this.querySelector('#show_pit_stops')?.checked ?? true,
      show_weather: this.querySelector('#show_weather')?.checked ?? false,
      show_lap_count: this.querySelector('#show_lap_count')?.checked ?? false,
      show_fia_documents: this.querySelector('#show_fia_documents')?.checked ?? false,
      show_next_race: this.querySelector('#show_next_race')?.checked ?? false,
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
  console.info(
    '%c F1-TICKER-CARD %c v2.2.0 ',
    'color: white; background: #e10600; font-weight: 700;',
    'color: #040711; background: #38bdf8; font-weight: 700;'
  );
}

