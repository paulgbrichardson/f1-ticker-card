/**
 * F1 Live Race Control Ticker Card (f1-ticker-card)
 * Version: 1.0.0
 * 
 * Smooth animated marquee ticker for Formula 1 race control, steward investigations,
 * track limits, flags, and FIA bulletins in Home Assistant Lovelace dashboards.
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
      show_fia_documents: false,
      show_next_race: false,
      race_control_entity: 'sensor.f1_race_control',
      investigations_entity: 'sensor.f1_investigations',
      track_limits_entity: 'sensor.f1_track_limits',
      track_status_entity: 'sensor.f1_track_status',
      fia_documents_entity: 'sensor.f1_fia_documents',
      next_race_entity: 'sensor.f1_next_race',
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
      }
      .tag-rc { background: rgba(225, 6, 0, 0.25); color: #ff6b6b; border: 1px solid rgba(225, 6, 0, 0.5); }
      .tag-inv { background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); }
      .tag-fia { background: rgba(56, 189, 248, 0.25); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.5); }
      .tag-track { background: rgba(52, 211, 153, 0.25); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.5); }
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

    const isAvailable = (s) => s && s.state !== 'unavailable' && s.state !== 'unknown';

    let items = [];
    let isLive = false;

    // 1. Race Control Messages
    if (this._config.show_race_control !== false && isAvailable(rc)) {
      items.push({ tag: 'tag-rc', label: 'RACE CONTROL', text: rc.state });
      isLive = true;
    }

    // 2. Steward Investigations
    if (this._config.show_investigations !== false && isAvailable(inv)) {
      items.push({ tag: 'tag-inv', label: 'INVESTIGATION', text: inv.state });
      isLive = true;
    }

    // 3. Track Limits
    if (this._config.show_track_limits !== false && isAvailable(tl)) {
      items.push({ tag: 'tag-rc', label: 'TRACK LIMITS', text: tl.state });
      isLive = true;
    }

    // 4. Track Status (Clear, Yellow, VSC, SC, Red)
    if (this._config.show_track_status !== false && isAvailable(track)) {
      items.push({ tag: 'tag-track', label: 'TRACK STATUS', text: track.state });
    }

    // 5. FIA Documents & Decisions (optional, default false)
    if (this._config.show_fia_documents === true && fia && fia.attributes && Array.isArray(fia.attributes.documents) && fia.attributes.documents.length > 0) {
      const docs = fia.attributes.documents.slice(-4).reverse();
      docs.forEach(d => {
        items.push({ tag: 'tag-fia', label: 'FIA DECISION', text: d.name });
      });
    }

    // 6. Next Race Info (optional, default false)
    if (this._config.show_next_race === true && nextRace && nextRace.attributes) {
      const raceName = nextRace.attributes.race_name || 'Next Grand Prix';
      const locality = nextRace.attributes.circuit_locality || '';
      items.push({ tag: 'tag-track', label: 'NEXT ROUND', text: `${raceName} (${locality})` });
    }

    // Fallback when all monitored live feeds are offline
    if (items.length === 0) {
      items.push({ tag: 'tag-track', label: 'TRACK STATUS', text: 'TRACK CLEAR • PIT LANE CLOSED' });
      items.push({ tag: 'tag-rc', label: 'RACE CONTROL', text: 'STANDBY • NO ACTIVE INCIDENTS' });
    }

    // Build items HTML
    const itemsHtml = items.map(it => `
      <span class="ticker-item">
        <span class="tag ${it.tag}">${it.label}</span>
        <span>${it.text}</span>
      </span>
      <span class="separator">◆</span>
    `).join('');

    const c1 = this.shadowRoot.getElementById('content-1');
    const c2 = this.shadowRoot.getElementById('content-2');
    if (c1 && c2 && this._lastHtml !== itemsHtml) {
      this._lastHtml = itemsHtml;
      c1.innerHTML = itemsHtml;
      c2.innerHTML = itemsHtml;
    }

    // Update Status Pill
    const pill = this.shadowRoot.getElementById('status-pill');
    const statusText = this.shadowRoot.getElementById('status-text');
    if (pill && statusText) {
      if (isLive) {
        pill.className = 'status-pill status-live';
        statusText.textContent = 'LIVE SESSION';
      } else {
        pill.className = 'status-pill status-standby';
        statusText.textContent = 'STANDBY';
      }
    }
  }

  getCardSize() {
    return 1;
  }
}

/**
 * Visual Configuration Editor for F1 Ticker Card
 */
class F1TickerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _render() {
    this.innerHTML = `
      <style>
        .card-config {
          display: flex;
          flex-direction: column;
          gap: 14px;
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
          padding: 8px 0;
        }
        .config-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 8px;
          background: var(--secondary-background-color, rgba(255, 255, 255, 0.04));
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.06));
        }
        .config-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-right: 12px;
        }
        .label-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--primary-text-color, #fff);
        }
        .label-desc {
          font-size: 0.8rem;
          color: var(--secondary-text-color, #94a3b8);
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .input-text {
          width: 100%;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.15));
          background: var(--card-background-color, #1a1a24);
          color: var(--primary-text-color, #fff);
          font-size: 0.9rem;
          box-sizing: border-box;
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

        <div class="section-header">Visible Ticker Items (Toggle On/Off)</div>

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
    description: 'Smooth animated marquee banner for live F1 race control, steward notices and track status',
    preview: true,
  });
}
