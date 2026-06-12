/**
 * Settings modal window — same pattern as About: small BrowserWindow, data URL HTML, dedicated preload.
 */

import type { BrowserWindow, Event } from 'electron';

const path = require('path');
const { BrowserWindow: BrowserWindowConstructor, dialog } = require('electron');

function settingsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Settings — Roku Dev Studio</title>
  <style>
    /* Align with renderer/index.html design tokens (Roku Dev Studio shell) */
    :root {
      --bg-deep: #08080c;
      --bg-primary: #0e0e14;
      --bg-secondary: #16161f;
      --bg-tertiary: #1e1e2a;
      --bg-elevated: #262635;
      --accent-purple: #8b5cf6;
      --accent-purple-dim: rgba(139, 92, 246, 0.15);
      --accent-cyan: #22d3ee;
      --accent-green: #10b981;
      --accent-green-dim: rgba(16, 185, 129, 0.15);
      --accent-red: #ef4444;
      --accent-red-dim: rgba(239, 68, 68, 0.15);
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border: rgba(139, 92, 246, 0.12);
      --border-hover: rgba(139, 92, 246, 0.25);
      --bg-hover: #2a2a38;
      --toggle-track-off: #3f3f4e;
      --toggle-track-on: var(--accent-purple);
      --toggle-thumb: #f4f4f5;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
      background: var(--bg-deep);
      color: var(--text-primary);
      padding: 18px 20px 18px;
      line-height: 1.45;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    .settings-animate-root {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform-origin: center center;
      will-change: transform, opacity;
      backface-visibility: hidden;
    }
    @media (prefers-reduced-motion: reduce) {
      .settings-animate-root {
        will-change: auto;
      }
    }
    .settings-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    .settings-header h1 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      min-width: 0;
    }
    .settings-header h1::before {
      content: '';
      width: 4px;
      height: 22px;
      border-radius: 2px;
      background: linear-gradient(180deg, var(--accent-purple), var(--accent-cyan));
      flex-shrink: 0;
    }
    /* Crumb-style separator between "Settings" and the active subsection. The
     * subsection label updates live in selectSection(); we use a chevron so
     * the relationship reads as parent to child rather than two co-equal
     * headings. */
    .settings-header-delim {
      color: var(--text-muted);
      font-weight: 400;
      font-size: 16px;
      line-height: 1;
      flex-shrink: 0;
      opacity: 0.8;
    }
    .settings-header-section {
      color: var(--text-secondary);
      font-weight: 500;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .modal-close {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      background: var(--bg-tertiary);
      border: none;
      border-radius: 6px;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
      padding: 0;
    }
    .modal-close:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .modal-close svg {
      display: block;
    }
    .settings-header .hint {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
      line-height: 1.5;
      max-width: 52ch;
    }
    .settings-main {
      flex: 1;
      display: flex;
      min-height: 0;
      align-items: stretch;
      gap: 16px;
    }
    .settings-nav {
      flex: 0 0 200px;
      width: 200px;
      min-width: 180px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      align-self: stretch;
      gap: 4px;
      padding: 12px 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow-x: hidden;
      overflow-y: auto;
      transition: border-color 0.15s;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.22);
    }
    .settings-nav:hover {
      border-color: var(--border-hover);
    }
    .settings-nav::-webkit-scrollbar {
      width: 6px;
    }
    .settings-nav::-webkit-scrollbar-track {
      background: transparent;
      margin: 4px 0;
    }
    .settings-nav::-webkit-scrollbar-thumb {
      background: var(--bg-elevated);
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .settings-nav::-webkit-scrollbar-thumb:hover {
      background: var(--bg-tertiary);
    }
    .settings-nav-item {
      text-align: left;
      padding: 11px 14px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.35;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .settings-nav-item:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .settings-nav-item.active {
      background: var(--accent-purple-dim);
      color: var(--accent-purple);
      border-color: var(--border-hover);
    }
    .settings-content {
      flex: 1;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 4px 4px 4px 0;
    }
    .settings-panel {
      display: none;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }
    .settings-panel.active {
      display: flex;
    }
    .settings-panel-fill {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .settings-panel-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 4px;
    }
    .settings-panel-scroll::-webkit-scrollbar { width: 8px; }
    .settings-panel-scroll::-webkit-scrollbar-track { background: var(--bg-primary); border-radius: 4px; }
    .settings-panel-scroll::-webkit-scrollbar-thumb { background: var(--bg-elevated); border-radius: 4px; border: 1px solid var(--border); }
    .settings-panel-scroll::-webkit-scrollbar-thumb:hover { background: var(--bg-tertiary); }
    ::-webkit-scrollbar-corner {
      background: var(--bg-primary);
    }
    .settings-panel-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 14px 0;
      letter-spacing: -0.02em;
    }
    .settings-section {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 0;
      border: 1px solid var(--border);
      transition: border-color 0.15s;
    }
    .settings-section:hover { border-color: var(--border-hover); }
    /* .general-timing-rows is a grouping div with no own spacing — the last
     * toggle row's bottom padding + border and the first timing row's top
     * padding already give the same gap as any other row-to-row transition.
     * Adding extra margin/padding here just orphaned the timing block
     * visually (see the Toast Duration gap regression). */
    .help-blurb {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 10px;
      line-height: 1.5;
    }
    .timing-row {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: nowrap;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
    }
    @media (max-width: 560px) {
      .timing-row { flex-wrap: wrap; }
      .timing-row .row-label { flex: 1 1 100% !important; }
      .timing-row .timing-field { flex: 1 1 100% !important; }
    }
    /* Strip only the divider on the last row, NOT the bottom padding —
     * stripping padding makes the last row visually shorter than its peers
     * (the doubled-up TOAST_DISPLAY_DURATION vs STATUS_MESSAGE_DURATION
     * gap). The section's own padding provides the room beneath. */
    .timing-row:last-child { border-bottom: none; }
    .timing-row .row-label {
      flex: 4 1 0;
      min-width: 0;
    }
    .timing-row .row-label strong {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.35;
    }
    .timing-row .row-label .hint-line {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
      line-height: 1.45;
    }
    .timing-field {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1 1 0;
      min-width: 0;
      max-width: 100%;
    }
    .timing-field-stack {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: stretch;
      width: fit-content;
      max-width: 100%;
    }
    .timing-field-stack .bound-label {
      text-align: left;
    }
    .timing-field-stack .input-num {
      width: 100%;
      min-width: 7rem;
      max-width: 100%;
      box-sizing: border-box;
    }
    .bound-label {
      font-size: 11px;
      font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, monospace;
      color: var(--accent-cyan);
      line-height: 1.3;
      opacity: 0.95;
    }
    .input-num {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 12px;
      font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, monospace;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-num:focus {
      outline: none;
      border-color: var(--accent-purple);
      box-shadow: 0 0 0 2px var(--accent-purple-dim);
    }
    .input-num.invalid {
      border-color: var(--accent-red);
      box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.25);
    }
    .input-num.invalid:focus {
      border-color: var(--accent-red);
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
    }
    .settings-row-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .settings-row-text {
      flex: 4 1 0;
      min-width: 0;
      padding-right: 8px;
    }
    .settings-row-text strong {
      font-size: 13px;
      color: var(--text-primary);
      font-weight: 500;
    }
    .settings-keychain-status.warn {
      color: var(--accent-yellow, #c9a227);
      font-weight: 600;
    }

    .settings-row-text .settings-row-desc {
      display: block;
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 3px;
      line-height: 1.4;
    }
    .settings-toggle-wrap {
      flex: 1 1 0;
      min-width: 52px;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .settings-toggle-input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      margin: 0;
    }
    .settings-toggle-ui {
      display: block;
      width: 46px;
      height: 26px;
      border-radius: 13px;
      background: var(--toggle-track-off);
      transition: background 0.2s ease;
      position: relative;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
    }
    .settings-toggle-ui::after {
      content: '';
      position: absolute;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--toggle-thumb);
      top: 2px;
      left: 2px;
      transition: transform 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    }
    .settings-toggle-input:checked + .settings-toggle-ui {
      background: var(--toggle-track-on);
    }
    .settings-toggle-input:checked + .settings-toggle-ui::after {
      transform: translateX(20px);
    }
    .settings-toggle-input:focus-visible + .settings-toggle-ui {
      outline: 2px solid var(--accent-purple);
      outline-offset: 3px;
    }
    .btn-timing-reset {
      flex-shrink: 0;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(139, 92, 246, 0.4);
      background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-tertiary) 100%);
      color: var(--text-primary);
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.06) inset,
        0 2px 6px rgba(0, 0, 0, 0.35);
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, color 0.15s;
    }
    .btn-timing-reset:hover {
      border-color: var(--accent-purple);
      background: linear-gradient(180deg, #32324a 0%, var(--bg-elevated) 100%);
      color: #fff;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.08) inset,
        0 0 0 1px rgba(139, 92, 246, 0.2),
        0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .btn-timing-reset:active {
      transform: translateY(1px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    }
    .section-save-dock {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 12px 0 0;
      margin-top: 10px;
      border-top: 1px solid var(--border);
    }
    .section-save-status {
      font-size: 12px;
      font-weight: 500;
      min-height: 1.2em;
      margin-right: auto;
      color: var(--accent-green);
    }
    .section-save-status.err {
      color: var(--accent-red);
    }
    .folder-scripts-block .help-blurb {
      margin-bottom: 12px;
    }
    .folder-action-row {
      display: flex;
      align-items: stretch;
      gap: 10px;
      width: 100%;
    }
    .folder-integrated {
      flex: 3 1 0;
      min-width: 0;
      display: flex;
      align-items: stretch;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      overflow: hidden;
    }
    .folder-integrated-path {
      flex: 1 1 0;
      min-width: 0;
      padding: 10px 12px;
      font-size: 12px;
      font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, monospace;
      color: var(--text-secondary);
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
    }
    .folder-integrated-path.empty {
      color: var(--text-muted);
      font-style: italic;
      white-space: normal;
    }
    .folder-integrated-btn {
      flex-shrink: 0;
      align-self: stretch;
      padding: 8px 14px;
      border: none;
      border-left: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .folder-integrated-btn:hover {
      background: var(--accent-purple-dim);
      border-left-color: var(--border-hover);
    }
    @media (max-width: 560px) {
      .folder-action-row { flex-direction: column; }
      .folder-integrated { flex: 1 1 auto; width: 100%; }
    }
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      border: none;
      font-family: inherit;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--accent-purple-dim);
      border-color: var(--accent-purple);
    }
    .btn-primary {
      background: var(--accent-purple);
      color: #fff;
    }
    .btn-primary:hover:not(:disabled) { background: #7c3aed; }
    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover:not(:disabled) {
      color: var(--text-primary);
      border-color: var(--border-hover);
      background: var(--accent-purple-dim);
    }
    .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 8px; }
    .settings-fatal {
      padding: 24px;
      color: var(--accent-red);
      font-size: 13px;
    }
    .mcp-link {
      color: var(--accent-cyan);
      text-decoration: none;
      border-bottom: 1px dashed rgba(34, 211, 238, 0.4);
    }
    .mcp-link:hover {
      border-bottom-color: var(--accent-cyan);
    }
    .mcp-inline-code {
      font-family: 'JetBrains Mono', ui-monospace, Menlo, Monaco, monospace;
      font-size: 11px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      padding: 1px 6px;
      border-radius: 4px;
      color: var(--text-primary);
    }
    .mcp-clients-list {
      display: flex;
      flex-direction: column;
    }
    .mcp-client-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    /* Same rationale as .timing-row:last-child — drop only the divider,
     * not the row padding, so every MCP client row has the same height
     * regardless of position. */
    .mcp-client-row:last-child {
      border-bottom: none;
    }
    .mcp-client-row.disabled .settings-toggle-wrap {
      cursor: not-allowed;
    }
    .mcp-client-row.disabled .settings-toggle-ui {
      opacity: 0.45;
    }
    .mcp-client-info {
      flex: 0 0 40%;
      max-width: 40%;
      min-width: 0;
      padding-right: 8px;
    }
    .mcp-client-action {
      flex: 0 0 30%;
      max-width: 30%;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }
    .mcp-client-row .settings-toggle-wrap {
      flex: 0 0 30%;
      max-width: 30%;
      justify-content: center;
    }
    .mcp-client-info strong {
      font-size: 13px;
      color: var(--text-primary);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .mcp-client-status-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .mcp-client-status-icon svg {
      display: block;
    }
    .mcp-client-status-icon.installed {
      color: var(--accent-green);
    }
    .mcp-client-status-icon.not-installed {
      color: var(--text-muted);
    }
    .mcp-client-config-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .mcp-client-config-btn:hover:not(:disabled) {
      background: var(--accent-purple-dim);
      border-color: var(--accent-purple);
      color: var(--text-primary);
    }
    .mcp-client-config-btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .mcp-client-config-btn svg {
      flex-shrink: 0;
    }
    .mcp-client-hint {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .mcp-clients-empty {
      font-size: 12px;
      color: var(--text-muted);
      padding: 8px 0 0;
    }
  </style>
</head>
<body>
  <div id="settingsAnimateRoot" class="settings-animate-root">
  <div class="settings-header">
    <h1>
      <span>Settings</span>
      <span class="settings-header-delim" aria-hidden="true">›</span>
      <span id="settingsHeaderSection" class="settings-header-section">General</span>
    </h1>
    <button type="button" class="modal-close" id="btnHeaderClose" title="Close" aria-label="Close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
  <div class="settings-main">
    <nav class="settings-nav" role="tablist" aria-label="Settings sections">
      <button type="button" class="settings-nav-item active" role="tab" aria-selected="true" data-target="general" id="nav-general">General</button>
      <button type="button" class="settings-nav-item" role="tab" aria-selected="false" data-target="action-scripts" id="nav-action-scripts">Action Scripts</button>
      <button type="button" class="settings-nav-item" role="tab" aria-selected="false" data-target="device-performance" id="nav-device-performance">Device Performance</button>
      <button type="button" class="settings-nav-item" role="tab" aria-selected="false" data-target="timing" id="nav-timing">Timing &amp; Network</button>
      <button type="button" class="settings-nav-item" role="tab" aria-selected="false" data-target="mcp-server" id="nav-mcp-server">MCP Server</button>
    </nav>
    <div class="settings-content">
      <div class="settings-panel active" data-section="general" id="panel-general" role="tabpanel" aria-labelledby="nav-general" aria-hidden="false">
        <div class="settings-panel-fill">
          <div class="settings-panel-scroll">
            <div class="settings-section">
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Developer Mode</strong>
                  <span class="settings-row-desc">Extra Logging in the Main Window (same as File → Developer Mode).</span>
                </div>
                <label class="settings-toggle-wrap" for="optDevMode">
                  <input type="checkbox" id="optDevMode" class="settings-toggle-input" role="switch" aria-label="Developer mode" aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Privacy Mode</strong>
                  <span class="settings-row-desc">Mask IPs and Serial Numbers in the UI (same as File → Privacy Mode).</span>
                </div>
                <label class="settings-toggle-wrap" for="optPrivacy">
                  <input type="checkbox" id="optPrivacy" class="settings-toggle-input" role="switch" aria-label="Privacy mode" aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Debug Logging to File</strong>
                  <span class="settings-row-desc" id="logPathHint">Writes to the log file under app user data when enabled.</span>
                </div>
                <label class="settings-toggle-wrap" for="optDebugLog">
                  <input type="checkbox" id="optDebugLog" class="settings-toggle-input" role="switch" aria-label="Debug logging to file" aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Roku Remote - Use Keyboard </strong>
                  <span class="settings-row-desc">When On, you can use Keyboard to control the Roku. Keyboard Shortcuts can be found in Remote Help Modal.</span>
                </div>
                <label class="settings-toggle-wrap" for="optKeyboardRemote">
                  <input type="checkbox" id="optKeyboardRemote" class="settings-toggle-input" role="switch" aria-label="Roku Remote - Use Keyboard " aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Auto Connect to Devices</strong>
                  <span class="settings-row-desc">When On, the app will automatically connect to devices that were stayed connected when closing the App in the previous session.</span>
                </div>
                <label class="settings-toggle-wrap" for="optAutoConnectLast">
                  <input type="checkbox" id="optAutoConnectLast" class="settings-toggle-input" role="switch" aria-label="Auto Connect to Devices" aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Auto Hide SideBar</strong>
                  <span class="settings-row-desc">When On, the SideBar which presents the Devices List will auto-toggle if SideBar is hidden in previous session.</span>
                </div>
                <label class="settings-toggle-wrap" for="optRememberSidebarToggle">
                  <input type="checkbox" id="optRememberSidebarToggle" class="settings-toggle-input" role="switch" aria-label="Auto Hide SideBar" aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Encrypt Saved Passwords with System Keychain</strong>
                  <span class="settings-row-desc">When On, each device's "Remember password" entry is encrypted via the OS keychain — your OS may prompt the first time. When Off, remembered passwords still persist across quit/relaunch but are stored unencrypted on disk.</span>
                  <span class="settings-row-desc settings-keychain-status" id="keychainStorageStatus" aria-live="polite"></span>
                </div>
                <label class="settings-toggle-wrap" for="optRememberPasswordsInKeychain">
                  <input type="checkbox" id="optRememberPasswordsInKeychain" class="settings-toggle-input" role="switch" aria-label="Persist saved passwords in system keychain" aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div id="generalTimingRows" class="general-timing-rows"></div>
            </div>
          </div>
          <div class="section-save-dock">
            <button type="button" class="btn-timing-reset" id="btnResetGeneral">Reset to Defaults</button>
            <span class="section-save-status" id="saveStatusGeneral" aria-live="polite"></span>
            <button type="button" class="btn btn-primary" id="btnSaveGeneral">Save</button>
          </div>
        </div>
      </div>
      <div class="settings-panel" data-section="action-scripts" id="panel-action-scripts" role="tabpanel" aria-labelledby="nav-action-scripts" aria-hidden="true">
        <div class="settings-panel-fill">
          <div class="settings-panel-scroll">
            <div class="settings-section folder-scripts-block">
              <p class="help-blurb">Default folder for screenshots and logs when a script needs saves. You can still pick another folder per run.</p>
              <div class="folder-action-row">
                <div class="folder-integrated">
                  <div id="folderDisplay" class="folder-integrated-path empty">No folder set</div>
                  <button type="button" class="folder-integrated-btn" id="btnBrowseFolder">Choose folder…</button>
                </div>
              </div>
            </div>
          </div>
          <div class="section-save-dock">
            <button type="button" class="btn-timing-reset" id="btnResetActionScripts">Reset to Defaults</button>
            <span class="section-save-status" id="saveStatusActionScripts" aria-live="polite"></span>
            <button type="button" class="btn btn-primary" id="btnSaveActionScripts">Save</button>
          </div>
        </div>
      </div>
      <div class="settings-panel" data-section="device-performance" id="panel-device-performance" role="tabpanel" aria-labelledby="nav-device-performance" aria-hidden="true">
        <div class="settings-panel-fill">
          <div class="settings-panel-scroll">
            <p class="help-blurb">Applies while <strong>Show Device Performance</strong> is on, the Roku has Developer Mode, and the Dev App is in the foreground. When <strong>Remember 'Show Device Performance'</strong> is on below, the Remote tab restores the quad layout per device.</p>
            <div class="settings-section device-perf-unified-list">
              <div class="settings-row-toggle">
                <div class="settings-row-text">
                  <strong>Remember 'Show Device Performance'</strong>
                  <span class="settings-row-desc">Restore whether <strong>Show Device Performance</strong> was on for each device. Turn off to always start with the just the remote until you enable it again.</span>
                </div>
                <label class="settings-toggle-wrap" for="optDevicePerfRememberQuad">
                  <input type="checkbox" id="optDevicePerfRememberQuad" class="settings-toggle-input" role="switch" aria-label="Remember Device Performance show or hide per device" aria-checked="false" />
                  <span class="settings-toggle-ui" aria-hidden="true"></span>
                </label>
              </div>
              <div id="devicePerfRows" class="device-perf-timing-rows"></div>
            </div>
          </div>
          <div class="section-save-dock">
            <button type="button" class="btn-timing-reset" id="btnResetDevicePerf">Reset to Defaults</button>
            <span class="section-save-status" id="saveStatusDevicePerf" aria-live="polite"></span>
            <button type="button" class="btn btn-primary" id="btnSaveDevicePerf">Save</button>
          </div>
        </div>
      </div>
      <div class="settings-panel" data-section="timing" id="panel-timing" role="tabpanel" aria-labelledby="nav-timing" aria-hidden="true">
        <div class="settings-panel-fill">
          <div class="settings-panel-scroll">
            <div class="settings-section">
              <div id="timingRows"></div>
            </div>
          </div>
          <div class="section-save-dock">
            <button type="button" class="btn-timing-reset" id="btnResetTiming">Reset to Defaults</button>
            <span class="section-save-status" id="saveStatusTiming" aria-live="polite"></span>
            <button type="button" class="btn btn-primary" id="btnSaveTiming">Save</button>
          </div>
        </div>
      </div>
      <div class="settings-panel" data-section="mcp-server" id="panel-mcp-server" role="tabpanel" aria-labelledby="nav-mcp-server" aria-hidden="true">
        <div class="settings-panel-fill">
          <div class="settings-panel-scroll">
            <p class="help-blurb">Expose Roku Dev Studio to AI agents via the <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" class="mcp-link">Model Context Protocol</a>. Toggle a client to add or remove its <code class="mcp-inline-code">roku-dev-studio</code> MCP Server entry; other entries are left untouched.</p>
            <div class="settings-section">
              <div id="mcpClientsList" class="mcp-clients-list" aria-live="polite"></div>
            </div>
          </div>
          <div class="section-save-dock">
            <button type="button" class="btn-timing-reset" id="btnResetMcpServer">Reset to Defaults</button>
            <span class="section-save-status" id="saveStatusMcpServer" aria-live="polite"></span>
            <button type="button" class="btn btn-primary" id="btnSaveMcpServer">Save</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
  <script>
    (function () {
      var api = window.settingsApi;
      if (!api) {
        document.body.innerHTML = '<p class="settings-fatal">Settings API unavailable.</p>';
        return;
      }

      var DEVICE_PERF_KEYS = ['DEVICE_METRICS_SAMPLE_INTERVAL_MS', 'DEVICE_METRICS_CHART_HISTORY_MS'];
      var CHART_HISTORY_MIN_MINUTES = 5;
      var CHART_HISTORY_MAX_MINUTES = 60;
      var MS_PER_MINUTE = 60000;
      var TOAST_STATUS_SEC_MIN = 2;
      var TOAST_STATUS_SEC_MAX = 10;
      var GENERAL_TIMING_KEYS = ['TOAST_DISPLAY_DURATION', 'STATUS_MESSAGE_DURATION'];
      var TIMING_KEYS = [
        'DEFAULT_RALE_PORT',
        'SCREENSHOT_DEBOUNCE_DELAY',
        'SCREENSHOT_AFTER_LAUNCH_DELAY',
        'TELNET_TIMEOUT',
        'CONNECTION_CHECK_INTERVAL'
      ];

      var folderPath = '';
      var compileDefaults = {};
      // Kept in sync with MCP_CLIENT_IDS in main/mcp-clients.ts. The renderer only
      // uses this list to filter / iterate; the source of truth for what's
      // detected is mcpClientDetections returned from main.
      var MCP_CLIENT_IDS = ['chatgpt', 'claude', 'cursor', 'vscode', 'vscode-insiders', 'vscodium', 'windsurf'];
      var mcpClientsState = {};
      MCP_CLIENT_IDS.forEach(function (id) { mcpClientsState[id] = false; });
      var mcpClientDetections = [];

      function selectSection(targetId) {
        var activeLabel = '';
        document.querySelectorAll('.settings-panel').forEach(function (panel) {
          var on = panel.getAttribute('data-section') === targetId;
          panel.classList.toggle('active', on);
          panel.setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        document.querySelectorAll('.settings-nav-item').forEach(function (btn) {
          var on = btn.getAttribute('data-target') === targetId;
          btn.classList.toggle('active', on);
          btn.setAttribute('aria-selected', on ? 'true' : 'false');
          if (on) {
            // Use the nav item's own text as the breadcrumb label so the
            // header stays in sync without a parallel id → label map.
            activeLabel = (btn.textContent || '').trim();
          }
        });
        var headerSection = document.getElementById('settingsHeaderSection');
        if (headerSection && activeLabel) headerSection.textContent = activeLabel;
      }

      document.querySelectorAll('.settings-nav-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-target');
          if (id) selectSection(id);
        });
      });

      function el(id) { return document.getElementById(id); }

      var MOTION_MS = 400;
      var MOTION_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
      var MOTION_FALLBACK_MS = MOTION_MS + 220;

      function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }

      function motionTransition() {
        return (
          'transform ' + MOTION_MS + 'ms ' + MOTION_EASE + ', opacity ' + MOTION_MS + 'ms ' + MOTION_EASE
        );
      }

      /** Uniform scale from panel center (not anchored to the header close control). */
      var SETTINGS_MOTION_MIN_SCALE = 0.92;

      function getAnimateRoot() {
        return el('settingsAnimateRoot');
      }

      function animateOpen() {
        if (prefersReducedMotion()) return;
        var root = getAnimateRoot();
        if (!root) return;
        root.style.transition = 'none';
        root.style.transformOrigin = '';
        root.style.transform = 'scale(' + SETTINGS_MOTION_MIN_SCALE + ')';
        root.style.opacity = '0';
        void root.offsetHeight;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            root.style.transition = motionTransition();
            root.style.transform = 'scale(1)';
            root.style.opacity = '1';
            var cleaned = false;
            function cleanup() {
              if (cleaned) return;
              cleaned = true;
              root.removeEventListener('transitionend', onEnd);
              root.style.transition = '';
              root.style.transform = '';
              root.style.opacity = '';
            }
            function onEnd(e) {
              if (e.target !== root || e.propertyName !== 'transform') return;
              cleanup();
            }
            root.addEventListener('transitionend', onEnd);
            setTimeout(cleanup, MOTION_FALLBACK_MS);
          });
        });
      }

      var settingsCloseStarted = false;
      function requestCloseSettingsWindow() {
        if (settingsCloseStarted) {
          api.closeWindow();
          return;
        }
        if (prefersReducedMotion()) {
          api.closeWindow();
          return;
        }
        var root = getAnimateRoot();
        if (!root) {
          api.closeWindow();
          return;
        }
        settingsCloseStarted = true;
        root.style.transition = 'none';
        root.style.transformOrigin = '';
        root.style.transform = 'scale(1)';
        root.style.opacity = '1';
        void root.offsetHeight;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            root.style.transition = motionTransition();
            root.style.transform = 'scale(' + SETTINGS_MOTION_MIN_SCALE + ')';
            root.style.opacity = '0';
            var done = false;
            function finish() {
              if (done) return;
              done = true;
              root.removeEventListener('transitionend', onEnd);
              api.closeWindow();
            }
            function onEnd(e) {
              if (e.target !== root || e.propertyName !== 'transform') return;
              finish();
            }
            root.addEventListener('transitionend', onEnd);
            setTimeout(finish, MOTION_FALLBACK_MS);
          });
        });
      }

      function syncSwitchAria(id) {
        var inp = el(id);
        if (!inp || inp.getAttribute('role') !== 'switch') return;
        inp.setAttribute('aria-checked', inp.checked ? 'true' : 'false');
      }

      function boolFromToggle(id) {
        var c = el(id);
        return !!(c && c.checked);
      }

      function setToggle(id, enabled) {
        var c = el(id);
        if (c) {
          c.checked = !!enabled;
          syncSwitchAria(id);
        }
      }

      function wireToggleAria(id) {
        var inp = el(id);
        if (!inp) return;
        inp.addEventListener('change', function () {
          syncSwitchAria(id);
        });
      }

      function renderMcpClients() {
        var container = el('mcpClientsList');
        if (!container) return;
        container.innerHTML = '';
        if (!Array.isArray(mcpClientDetections) || mcpClientDetections.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'mcp-clients-empty';
          empty.textContent = 'No supported MCP clients detected on this system.';
          container.appendChild(empty);
          return;
        }
        mcpClientDetections.forEach(function (det) {
          var id = det && det.id;
          if (!id || MCP_CLIENT_IDS.indexOf(id) === -1) return;
          var installed = !!(det && det.installed);
          var row = document.createElement('div');
          row.className = 'mcp-client-row' + (installed ? '' : ' disabled');
          row.setAttribute('data-mcp-id', id);

          var info = document.createElement('div');
          info.className = 'mcp-client-info';
          var nameLine = document.createElement('strong');
          nameLine.appendChild(document.createTextNode(String(det.label || id)));
          var statusIcon = document.createElement('span');
          statusIcon.className = 'mcp-client-status-icon ' + (installed ? 'installed' : 'not-installed');
          statusIcon.title = installed ? 'Installed' : 'Not detected';
          statusIcon.setAttribute('role', 'img');
          statusIcon.setAttribute('aria-label', installed ? 'Installed' : 'Not detected');
          statusIcon.innerHTML = installed
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18"/>' +
                '<path d="M7.5 12.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
              '</svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.5"/>' +
                '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>' +
              '</svg>';
          nameLine.appendChild(statusIcon);
          info.appendChild(nameLine);

          row.appendChild(info);

          var actionCol = document.createElement('div');
          actionCol.className = 'mcp-client-action';
          if (installed && det.configPath) {
            var openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'mcp-client-config-btn';
            openBtn.title = 'Open ' + String(det.configPath);
            openBtn.setAttribute('aria-label', 'Open MCP config file for ' + String(det.label || id));
            openBtn.innerHTML =
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<path d="M14 3h7v7M21 3l-9 9M5 5h5M5 12h7M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
              '</svg>' +
              '<span>Open Config File</span>';
            openBtn.addEventListener('click', function () {
              if (!api.openMcpConfig) return;
              openBtn.disabled = true;
              api.openMcpConfig(id).catch(function () {}).then(function () {
                openBtn.disabled = false;
              });
            });
            actionCol.appendChild(openBtn);
          } else {
            var hint = document.createElement('span');
            hint.className = 'mcp-client-hint';
            hint.textContent = 'Install ' + String(det.label || id) + ' to enable.';
            actionCol.appendChild(hint);
          }
          row.appendChild(actionCol);

          var label = document.createElement('label');
          label.className = 'settings-toggle-wrap';
          label.setAttribute('for', 'mcpToggle_' + id);
          var input = document.createElement('input');
          input.type = 'checkbox';
          input.id = 'mcpToggle_' + id;
          input.className = 'settings-toggle-input';
          input.setAttribute('role', 'switch');
          input.setAttribute('aria-label', 'Enable MCP for ' + String(det.label || id));
          input.checked = !!mcpClientsState[id];
          input.disabled = !installed;
          input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
          input.addEventListener('change', function () {
            mcpClientsState[id] = !!input.checked;
            input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
          });
          var ui = document.createElement('span');
          ui.className = 'settings-toggle-ui';
          ui.setAttribute('aria-hidden', 'true');
          label.appendChild(input);
          label.appendChild(ui);
          row.appendChild(label);

          container.appendChild(row);
        });
      }

      function setFolderDisplay(path) {
        folderPath = path || '';
        var d = el('folderDisplay');
        if (!d) return;
        if (folderPath) {
          d.textContent = folderPath;
          d.classList.remove('empty');
          d.title = folderPath;
        } else {
          d.textContent = 'No folder set';
          d.classList.add('empty');
          d.title = '';
        }
      }

      function chartHistoryMsToDisplayMinutes(ms) {
        var raw = Number(ms);
        if (!Number.isFinite(raw) || raw <= 0) return CHART_HISTORY_MIN_MINUTES;
        var m = Math.round(raw / MS_PER_MINUTE);
        return Math.min(CHART_HISTORY_MAX_MINUTES, Math.max(CHART_HISTORY_MIN_MINUTES, m));
      }

      function toastStatusMsToDisplaySec(ms) {
        var raw = Number(ms);
        if (!Number.isFinite(raw) || raw <= 0) return 5;
        var s = Math.round(raw / 1000);
        return Math.min(TOAST_STATUS_SEC_MAX, Math.max(TOAST_STATUS_SEC_MIN, s));
      }

      function buildTimingRowsForKeys(containerId, keys, state) {
        var container = el(containerId);
        if (!container) return;
        container.innerHTML = '';
        var meta = state.timingMeta || {};
        var values = state.timingOverrides || {};
        compileDefaults = state.compileDefaults || {};
        keys.forEach(function (key) {
          var m = meta[key] || { title: key, hint: '', min: 0, max: 0 };
          var row = document.createElement('div');
          row.className = 'timing-row';
          var val = values[key] != null ? values[key] : compileDefaults[key];
          if (key === 'DEVICE_METRICS_CHART_HISTORY_MS') {
            var valMin = chartHistoryMsToDisplayMinutes(val);
            row.innerHTML =
              '<div class="row-label">' +
              '<strong>' + escapeHtml(m.title) + '</strong>' +
              '<span class="hint-line">' + escapeHtml(m.hint) + '</span>' +
              '</div>' +
              '<div class="timing-field">' +
              '<div class="timing-field-stack">' +
              '<span class="bound-label">min: ' +
              CHART_HISTORY_MIN_MINUTES +
              ' min</span>' +
              '<input type="number" class="input-num" data-timing-key="' +
              escapeHtml(key) +
              '" data-input-unit="minutes" value="' +
              escapeAttr(String(valMin)) +
              '" min="' +
              CHART_HISTORY_MIN_MINUTES +
              '" max="' +
              CHART_HISTORY_MAX_MINUTES +
              '" step="1" />' +
              '<span class="bound-label">max: ' +
              CHART_HISTORY_MAX_MINUTES +
              ' min</span>' +
              '</div></div>';
          } else if (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') {
            var valSec = toastStatusMsToDisplaySec(val);
            row.innerHTML =
              '<div class="row-label">' +
              '<strong>' + escapeHtml(m.title) + '</strong>' +
              '<span class="hint-line">' + escapeHtml(m.hint) + '</span>' +
              '</div>' +
              '<div class="timing-field">' +
              '<div class="timing-field-stack">' +
              '<span class="bound-label">min: ' +
              TOAST_STATUS_SEC_MIN +
              '</span>' +
              '<input type="number" class="input-num" data-timing-key="' +
              escapeHtml(key) +
              '" data-input-unit="seconds" value="' +
              escapeAttr(String(valSec)) +
              '" min="' +
              TOAST_STATUS_SEC_MIN +
              '" max="' +
              TOAST_STATUS_SEC_MAX +
              '" step="1" />' +
              '<span class="bound-label">max: ' +
              TOAST_STATUS_SEC_MAX +
              '</span>' +
              '</div></div>';
          } else {
            row.innerHTML =
              '<div class="row-label">' +
              '<strong>' + escapeHtml(m.title) + '</strong>' +
              '<span class="hint-line">' + escapeHtml(m.hint) + '</span>' +
              '</div>' +
              '<div class="timing-field">' +
              '<div class="timing-field-stack">' +
              '<span class="bound-label">min: ' + escapeHtml(String(m.min)) + '</span>' +
              '<input type="number" class="input-num" data-timing-key="' +
              escapeHtml(key) +
              '" value="' +
              escapeAttr(String(val)) +
              '" min="' +
              m.min +
              '" max="' +
              m.max +
              '" />' +
              '<span class="bound-label">max: ' + escapeHtml(String(m.max)) + '</span>' +
              '</div></div>';
          }
          container.appendChild(row);
          var newInp = row.querySelector('input.input-num');
          if (newInp) attachTimingValidation(newInp);
        });
      }

      function buildTimingRows(state) {
        buildTimingRowsForKeys('generalTimingRows', GENERAL_TIMING_KEYS, state);
        buildTimingRowsForKeys('timingRows', TIMING_KEYS, state);
        buildTimingRowsForKeys('devicePerfRows', DEVICE_PERF_KEYS, state);
      }

      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
      function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, '&#39;');
      }

      function readTimingOverrides() {
        var out = {};
        function readKeys(keys) {
          keys.forEach(function (key) {
            var inp = document.querySelector('input.input-num[data-timing-key="' + key + '"]');
            if (!inp) return;
            var n = parseInt(String(inp.value), 10);
            if (isNaN(n)) return;
            if (key === 'DEVICE_METRICS_CHART_HISTORY_MS' && inp.getAttribute('data-input-unit') === 'minutes') {
              out[key] = n * MS_PER_MINUTE;
            } else if (
              (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') &&
              inp.getAttribute('data-input-unit') === 'seconds'
            ) {
              out[key] = n * 1000;
            } else {
              out[key] = n;
            }
          });
        }
        readKeys(TIMING_KEYS);
        readKeys(GENERAL_TIMING_KEYS);
        readKeys(DEVICE_PERF_KEYS);
        return out;
      }

      function applyDefaultsForKeys(keys) {
        keys.forEach(function (key) {
          var inp = document.querySelector('input.input-num[data-timing-key="' + key + '"]');
          if (!inp || compileDefaults[key] == null) return;
          if (key === 'DEVICE_METRICS_CHART_HISTORY_MS' && inp.getAttribute('data-input-unit') === 'minutes') {
            inp.value = String(chartHistoryMsToDisplayMinutes(compileDefaults[key]));
          } else if (
            (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') &&
            inp.getAttribute('data-input-unit') === 'seconds'
          ) {
            inp.value = String(toastStatusMsToDisplaySec(compileDefaults[key]));
          } else {
            inp.value = String(compileDefaults[key]);
          }
        });
      }

      function setSectionStatus(targetId, msg, isErr) {
        var ids = ['saveStatusGeneral', 'saveStatusActionScripts', 'saveStatusDevicePerf', 'saveStatusTiming', 'saveStatusMcpServer'];
        ids.forEach(function (id) {
          var s = el(id);
          if (!s) return;
          if (id === targetId) {
            s.textContent = msg || '';
            s.className = 'section-save-status' + (msg && isErr ? ' err' : '');
          } else {
            s.textContent = '';
            s.className = 'section-save-status';
          }
        });
      }

      /**
       * Per-panel input validation: blocks the panel's Save button and shows an
       * inline error in the section status while any timing input is empty,
       * non-numeric, or outside its [min, max] bounds. Main also clamps on save
       * as a defense-in-depth, but with the button disabled the user gets a
       * clear "fix this first" signal instead of a silent clamp.
       */
      var TIMING_PANEL_INFO = {
        General: { keys: GENERAL_TIMING_KEYS, btn: 'btnSaveGeneral', status: 'saveStatusGeneral' },
        DevicePerf: { keys: DEVICE_PERF_KEYS, btn: 'btnSaveDevicePerf', status: 'saveStatusDevicePerf' },
        Timing: { keys: TIMING_KEYS, btn: 'btnSaveTiming', status: 'saveStatusTiming' }
      };
      var TIMING_PANEL_BY_KEY = {};
      Object.keys(TIMING_PANEL_INFO).forEach(function (panelKey) {
        TIMING_PANEL_INFO[panelKey].keys.forEach(function (k) {
          TIMING_PANEL_BY_KEY[k] = panelKey;
        });
      });

      function getTimingRowLabel(inp) {
        var row = inp.closest ? inp.closest('.timing-row') : null;
        var strong = row ? row.querySelector('.row-label strong') : null;
        if (strong && strong.textContent) return strong.textContent.trim();
        return inp.getAttribute('data-timing-key') || 'Value';
      }

      function timingUnitSuffix(key) {
        if (key === 'DEVICE_METRICS_CHART_HISTORY_MS') return ' min';
        if (key === 'TOAST_DISPLAY_DURATION' || key === 'STATUS_MESSAGE_DURATION') return ' s';
        return '';
      }

      function validateTimingInput(inp) {
        var raw = String(inp.value).trim();
        if (raw === '') return { ok: false, reason: 'empty' };
        var n = Number(raw);
        // Reject NaN/Infinity and non-integers (e.g. "3.5"). Intentionally no
        // regex with backslash-escapes here: the surrounding script lives in a
        // TS template literal and unrecognized escape sequences get stripped,
        // so a /backslash-d+/ pattern would silently become /d+/ at runtime.
        if (!Number.isFinite(n) || Math.trunc(n) !== n) return { ok: false, reason: 'nan' };
        var min = parseInt(inp.getAttribute('min'), 10);
        var max = parseInt(inp.getAttribute('max'), 10);
        if (!isNaN(min) && n < min) return { ok: false, reason: 'low', min: min, max: max };
        if (!isNaN(max) && n > max) return { ok: false, reason: 'high', min: min, max: max };
        return { ok: true };
      }

      function validateTimingPanel(panelKey) {
        var info = TIMING_PANEL_INFO[panelKey];
        if (!info) return true;
        var invalid = [];
        info.keys.forEach(function (key) {
          var inp = document.querySelector('input.input-num[data-timing-key="' + key + '"]');
          if (!inp) return;
          var res = validateTimingInput(inp);
          inp.classList.toggle('invalid', !res.ok);
          if (!res.ok) invalid.push({ inp: inp, key: key, res: res });
        });
        var btn = el(info.btn);
        if (btn) btn.disabled = invalid.length > 0;
        var statusEl = el(info.status);
        if (statusEl) {
          if (invalid.length === 0) {
            if (statusEl.classList.contains('err')) {
              statusEl.textContent = '';
              statusEl.className = 'section-save-status';
            }
          } else {
            var first = invalid[0];
            var label = getTimingRowLabel(first.inp);
            var unit = timingUnitSuffix(first.key);
            var msg;
            if (first.res.reason === 'empty' || first.res.reason === 'nan') {
              msg = label + ' must be a whole number.';
            } else if (first.res.reason === 'low') {
              msg = label + ' must be at least ' + first.res.min + unit + '.';
            } else {
              msg = label + ' must be at most ' + first.res.max + unit + '.';
            }
            if (invalid.length > 1) {
              msg += ' (' + (invalid.length - 1) + ' more out of range)';
            }
            statusEl.textContent = msg;
            statusEl.className = 'section-save-status err';
          }
        }
        return invalid.length === 0;
      }

      /**
       * On blur, snap a numerically out-of-range value to the nearest bound so
       * the Save button isn't left permanently disabled. Empty / non-numeric
       * values are intentionally NOT auto-filled — the user clearly didn't
       * intend a value, so we leave the panel invalid until they pick one.
       */
      function clampInputOnBlurIfOutOfRange(inp) {
        var res = validateTimingInput(inp);
        if (res.ok) return null;
        if (res.reason !== 'low' && res.reason !== 'high') return null;
        var snap = res.reason === 'low' ? res.min : res.max;
        if (typeof snap !== 'number' || !Number.isFinite(snap)) return null;
        inp.value = String(snap);
        return { snap: snap, reason: res.reason };
      }

      function showTimingClampedNotice(inp, panelKey, clamp) {
        var info = TIMING_PANEL_INFO[panelKey];
        if (!info) return;
        var statusEl = el(info.status);
        if (!statusEl) return;
        var label = getTimingRowLabel(inp);
        var unit = timingUnitSuffix(inp.getAttribute('data-timing-key'));
        var which = clamp.reason === 'low' ? 'minimum' : 'maximum';
        statusEl.textContent = label + ' adjusted to ' + clamp.snap + unit + ' (' + which + ').';
        statusEl.className = 'section-save-status';
      }

      function attachTimingValidation(inp) {
        var key = inp.getAttribute('data-timing-key');
        var panelKey = key ? TIMING_PANEL_BY_KEY[key] : null;
        if (!panelKey) return;
        inp.addEventListener('input', function () {
          validateTimingPanel(panelKey);
        });
        inp.addEventListener('blur', function () {
          var clamp = clampInputOnBlurIfOutOfRange(inp);
          validateTimingPanel(panelKey);
          if (clamp) showTimingClampedNotice(inp, panelKey, clamp);
        });
      }

      function validateAllTimingPanels() {
        Object.keys(TIMING_PANEL_INFO).forEach(function (k) { validateTimingPanel(k); });
      }

      var keychainSnap = null;

      function describeSecretStoreStatus(status, backend, toggleOn) {
        if (!toggleOn) {
          return 'Encryption toggle is off — remembered passwords are stored as plaintext on disk.';
        }
        if (status === 'encrypted') {
          return 'Storage: encrypted via ' + (backend || 'system keychain') + '.';
        }
        if (status === 'unencrypted') {
          return 'Warning: toggle is on but this system uses basic_text — passwords are base64 plaintext on disk. Use a Linux keyring (Secret Service/KWallet) for real encryption.';
        }
        if (status === 'unavailable') {
          return 'Warning: toggle is on but the OS keychain is unavailable — passwords stay in memory for this session only.';
        }
        return 'Storage status: ' + status + (backend ? ' (' + backend + ')' : '') + '.';
      }

      function updateKeychainStatusHint(toggleOn, snapshot) {
        var hint = el('keychainStorageStatus');
        if (!hint) return;
        var snap = snapshot || {};
        var text = describeSecretStoreStatus(snap.status, snap.backend, toggleOn);
        hint.textContent = text;
        hint.className = 'settings-row-desc settings-keychain-status' + (text.indexOf('Warning') >= 0 ? ' warn' : '');
      }

      api.getState().then(function (state) {
        setToggle('optDevMode', !!state.developerModeEnabled);
        setToggle('optPrivacy', !!state.privacyModeEnabled);
        setToggle('optDebugLog', !!state.debugLoggingEnabled);
        setToggle('optKeyboardRemote', state.keyboardRemoteShortcutsEnabled === true);
        setToggle('optAutoConnectLast', state.autoConnectLastDeviceEnabled === true);
        setToggle('optRememberSidebarToggle', state.rememberSidebarToggle === true);
        setToggle('optRememberPasswordsInKeychain', state.rememberPasswordsInKeychain === true);
        keychainSnap = state.secretStoreStatus || null;
        updateKeychainStatusHint(state.rememberPasswordsInKeychain === true, keychainSnap);
        setToggle('optDevicePerfRememberQuad', state.devicePerformanceRememberQuadPerDevice === true);
        if (state.logFilePath && el('logPathHint')) {
          el('logPathHint').textContent = 'Log file: ' + state.logFilePath;
        }
        setFolderDisplay(state.actionScriptDefaultSaveFolder || '');
        mcpClientDetections = Array.isArray(state.mcpClientDetections) ? state.mcpClientDetections : [];
        var stateMcp = (state && state.mcpClients) || {};
        mcpClientsState = {};
        MCP_CLIENT_IDS.forEach(function (id) {
          mcpClientsState[id] = !!stateMcp[id];
        });
        renderMcpClients();
        buildTimingRows(state);
        validateAllTimingPanels();
      }).catch(function (e) {
        setSectionStatus('saveStatusGeneral', String(e && e.message ? e.message : e), true);
      });

      el('btnBrowseFolder').addEventListener('click', function () {
        api.pickFolder().then(function (res) {
          if (res && res.success && res.folderPath) setFolderDisplay(res.folderPath);
        });
      });
      var btnResetActionScripts = el('btnResetActionScripts');
      if (btnResetActionScripts) {
        btnResetActionScripts.addEventListener('click', function () {
          setFolderDisplay('');
        });
      }
      // Form-only reset, same contract as the other panels: flip every
      // installed client toggle off in the UI and let the user click Save
      // to actually remove the roku-dev-studio entries from disk. Not-
      // installed clients have no entry to remove, so we leave them alone.
      var btnResetMcpServer = el('btnResetMcpServer');
      if (btnResetMcpServer) {
        btnResetMcpServer.addEventListener('click', function () {
          mcpClientDetections.forEach(function (det) {
            if (!det || !det.installed) return;
            var id = det.id;
            if (MCP_CLIENT_IDS.indexOf(id) === -1) return;
            mcpClientsState[id] = false;
          });
          renderMcpClients();
        });
      }
      el('btnResetTiming').addEventListener('click', function () {
        applyDefaultsForKeys(TIMING_KEYS);
        validateTimingPanel('Timing');
      });
      var btnResetDevicePerf = el('btnResetDevicePerf');
      if (btnResetDevicePerf) {
        btnResetDevicePerf.addEventListener('click', function () {
          setToggle('optDevicePerfRememberQuad', false);
          applyDefaultsForKeys(DEVICE_PERF_KEYS);
          validateTimingPanel('DevicePerf');
        });
      }
      // Factory defaults for the General panel. Declared as an explicit map
      // (not a blanket "all false" loop) so adding a new toggle here forces
      // the author to pick a default; silent omissions would leave new
      // settings out of the Reset action. Reset DOES NOT delete persisted
      // password entries on disk; flipping the keychain toggle off just
      // stops persistence — see secret-store.ts for the rationale.
      var GENERAL_TOGGLE_DEFAULTS = {
        optDevMode: false,
        optPrivacy: false,
        optDebugLog: false,
        optKeyboardRemote: false,
        optAutoConnectLast: false,
        optRememberSidebarToggle: false,
        optRememberPasswordsInKeychain: false
      };
      var btnResetGeneral = el('btnResetGeneral');
      if (btnResetGeneral) {
        btnResetGeneral.addEventListener('click', function () {
          Object.keys(GENERAL_TOGGLE_DEFAULTS).forEach(function (id) {
            setToggle(id, GENERAL_TOGGLE_DEFAULTS[id]);
          });
          applyDefaultsForKeys(GENERAL_TIMING_KEYS);
          validateTimingPanel('General');
        });
      }
      wireToggleAria('optDevMode');
      wireToggleAria('optPrivacy');
      wireToggleAria('optDebugLog');
      wireToggleAria('optKeyboardRemote');
      wireToggleAria('optAutoConnectLast');
      wireToggleAria('optRememberSidebarToggle');
      wireToggleAria('optRememberPasswordsInKeychain');
      var optKeychain = el('optRememberPasswordsInKeychain');
      if (optKeychain) {
        optKeychain.addEventListener('change', function () {
          if (optKeychain.checked && keychainSnap && keychainSnap.status === 'unencrypted') {
            var ok = window.confirm(
              'Your system does not provide a real encryption keyring. Enabling this stores passwords as encoded plaintext on disk, not encrypted. Continue?'
            );
            if (!ok) {
              optKeychain.checked = false;
              setToggle('optRememberPasswordsInKeychain', false);
            }
          }
          updateKeychainStatusHint(!!optKeychain.checked, keychainSnap);
        });
      }
      wireToggleAria('optDevicePerfRememberQuad');

      function buildPayload() {
        return {
          developerModeEnabled: boolFromToggle('optDevMode'),
          privacyModeEnabled: boolFromToggle('optPrivacy'),
          debugLoggingEnabled: boolFromToggle('optDebugLog'),
          timingOverrides: readTimingOverrides(),
          actionScriptDefaultSaveFolder: folderPath,
          devicePerformanceRememberQuadPerDevice: boolFromToggle('optDevicePerfRememberQuad'),
          keyboardRemoteShortcutsEnabled: boolFromToggle('optKeyboardRemote'),
          autoConnectLastDeviceEnabled: boolFromToggle('optAutoConnectLast'),
          rememberSidebarToggle: boolFromToggle('optRememberSidebarToggle'),
          rememberPasswordsInKeychain: boolFromToggle('optRememberPasswordsInKeychain'),
          mcpClients: (function () {
            var out = {};
            MCP_CLIENT_IDS.forEach(function (id) {
              out[id] = !!mcpClientsState[id];
            });
            return out;
          })()
        };
      }

      function panelKeyForStatusId(statusId) {
        if (statusId === 'saveStatusGeneral') return 'General';
        if (statusId === 'saveStatusDevicePerf') return 'DevicePerf';
        if (statusId === 'saveStatusTiming') return 'Timing';
        return null;
      }

      function wireSaveButton(btnId, okMessage, statusId) {
        var btn = el(btnId);
        if (!btn) return;
        btn.addEventListener('click', function () {
          var panelKey = panelKeyForStatusId(statusId);
          if (panelKey && !validateTimingPanel(panelKey)) return;
          btn.disabled = true;
          setSectionStatus(statusId, '', false);
          api.save(buildPayload()).then(function (res) {
            btn.disabled = false;
            if (res && res.success) {
              if (res.warning) {
                setSectionStatus(statusId, String(res.warning), true);
              } else {
                setSectionStatus(statusId, okMessage, false);
              }
              if (Array.isArray(res.mcpResults) && statusId === 'saveStatusMcpServer') {
                res.mcpResults.forEach(function (r) {
                  if (r && typeof r.id === 'string' && typeof r.enabled === 'boolean') {
                    mcpClientsState[r.id] = r.enabled;
                  }
                });
                renderMcpClients();
              }
            } else {
              setSectionStatus(statusId, (res && res.error) || 'Save failed', true);
            }
            if (panelKey) validateTimingPanel(panelKey);
          }).catch(function (e) {
            btn.disabled = false;
            setSectionStatus(statusId, String(e && e.message ? e.message : e), true);
            if (panelKey) validateTimingPanel(panelKey);
          });
        });
      }

      wireSaveButton('btnSaveGeneral', 'General settings saved.', 'saveStatusGeneral');
      wireSaveButton('btnSaveActionScripts', 'Action Scripts settings saved.', 'saveStatusActionScripts');
      wireSaveButton('btnSaveDevicePerf', 'Device Performance settings saved.', 'saveStatusDevicePerf');
      wireSaveButton('btnSaveTiming', 'Timing & Network settings saved.', 'saveStatusTiming');
      wireSaveButton('btnSaveMcpServer', 'MCP Server settings saved.', 'saveStatusMcpServer');

      var headerClose = el('btnHeaderClose');
      if (headerClose) {
        headerClose.addEventListener('click', function () {
          requestCloseSettingsWindow();
        });
      }
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') requestCloseSettingsWindow();
      });

      window.requestCloseSettingsWindow = requestCloseSettingsWindow;
      animateOpen();
    })();
  </script>
</body>
</html>`;
}

/**
 * Show the Settings dialog (modal, parent = mainWindow).
 */
function showSettingsDialog(mainWindow: BrowserWindow) {
  if (!mainWindow) {
    console.error('Main window not available');
    return;
  }

  const settingsWindow = new BrowserWindowConstructor({
    width: 820,
    height: 780,
    minWidth: 640,
    minHeight: 580,
    resizable: true,
    minimizable: false,
    maximizable: true,
    modal: true,
    parent: mainWindow,
    backgroundColor: '#08080c',
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    titleBarStyle: 'default',
    frame: true,
    show: false,
    title: 'Settings'
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('close', (e: Event) => {
    const sw = settingsWindow as import('electron').BrowserWindow & { __rdsDestroying?: boolean };
    if (sw.__rdsDestroying) return;
    e.preventDefault();
    settingsWindow.webContents
      .executeJavaScript('window.requestCloseSettingsWindow && window.requestCloseSettingsWindow()')
      .catch(() => {
        sw.__rdsDestroying = true;
        settingsWindow.destroy();
      });
  });

  try {
    const html = settingsHtml();
    settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  } catch (error) {
    console.error('Error loading Settings dialog:', error);
    dialog.showErrorBox('Error', 'Failed to open Settings. Please try again.');
  }
}

export { showSettingsDialog };
