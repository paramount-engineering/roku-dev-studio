/**
 * Augment `dataset` / `DOMStringMap` for known `data-*` hooks in the HTML renderer template.
 * Merge-safe with other `declare global` blocks.
 */
import type { DeviceInnerTabId } from './device-panel-dom.js';

declare global {
  interface DOMStringMap {
    /** `.inner-tab` buttons — target id for `data-inner-content` pane */
    innerTab?: DeviceInnerTabId;
    /** `.inner-tab-content` regions */
    innerContent?: DeviceInnerTabId;

    /** `.tab-panel` root from `createDevicePanel` */
    ip?: string;
    isRemote?: string;
    serverUrl?: string;
    locationId?: string;

    /** Device tab button (`.tab`) */
    tabId?: string;
    deviceKey?: string;

    /** Template wiring (toolbar / older fragments) */
    panel?: string;
    tab?: string;
    section?: string;
    rokuAction?: string;

    /** ECP / quick remote / devapp key buttons */
    key?: string;
    /** HDMI / app launch shortcuts */
    app?: string;

    /** Queries tab */
    query?: string;
    post?: string;
    telnetCmd?: string;

    /** Telnet console */
    option?: string;
    lineIndex?: string;

    /** Warnings / inspector */
    warning?: string;
    action?: string;

    /** Panel header ECP state */
    ecpMode?: string;
    ecpVariant?: string;
  }
}

export {};
