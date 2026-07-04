/**
 * Fake "Roku" identity for the Sideload Relay.
 *
 * When the relay's debug proxy is on, RDS mimics a real developer-enabled Roku
 * so VS Code's BrightScript extension can discover it over SSDP and its
 * roku-debug pre-flight (`GET /query/device-info`) passes without depending on
 * any real device being reachable. The identity is deliberately distinctive
 * (serial + model name) so RDS can filter its own advertisement back out of its
 * device discovery — it must never list itself as a target.
 */

'use strict';

/** Distinctive synthetic serial — 12 chars like a real Roku serial, but obviously ours. */
export const RELAY_FAKE_SERIAL = 'RDSRELAY0001';
export const RELAY_FAKE_MODEL_NAME = 'Roku Dev Studio Relay';
export const RELAY_FAKE_DEVICE_NAME = 'Roku Dev Studio Relay';
export const RELAY_FAKE_UDN = `uuid:roku:ecp:${RELAY_FAKE_SERIAL}`;
/** Reported OS version — recent enough that roku-debug picks the debug protocol path. */
export const RELAY_FAKE_SOFTWARE_VERSION = '13.0.0';

/**
 * A Roku-shaped `/query/device-info` XML that reports developer mode ON and
 * permissive ECP, so roku-debug's launch pre-flight validates. Real debugging
 * still flows to the primary device via the 8081/8085 TCP proxies.
 */
export function syntheticDeviceInfoXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<device-info>',
    `  <udn>${RELAY_FAKE_SERIAL}</udn>`,
    `  <serial-number>${RELAY_FAKE_SERIAL}</serial-number>`,
    `  <device-id>${RELAY_FAKE_SERIAL}</device-id>`,
    '  <vendor-name>Roku</vendor-name>',
    `  <model-name>${RELAY_FAKE_MODEL_NAME}</model-name>`,
    '  <model-number>RDS01</model-number>',
    '  <model-region>US</model-region>',
    '  <is-tv>false</is-tv>',
    '  <is-stick>false</is-stick>',
    '  <screen-size>0</screen-size>',
    '  <ui-resolution>1080p</ui-resolution>',
    '  <network-type>ethernet</network-type>',
    `  <friendly-device-name>${RELAY_FAKE_DEVICE_NAME}</friendly-device-name>`,
    `  <friendly-model-name>${RELAY_FAKE_MODEL_NAME}</friendly-model-name>`,
    `  <default-device-name>${RELAY_FAKE_DEVICE_NAME}</default-device-name>`,
    `  <user-device-name>${RELAY_FAKE_DEVICE_NAME}</user-device-name>`,
    '  <developer-enabled>true</developer-enabled>',
    '  <keyed-developer-id>rds-sideload-relay</keyed-developer-id>',
    '  <ecp-setting-mode>permissive</ecp-setting-mode>',
    '  <search-enabled>true</search-enabled>',
    `  <software-version>${RELAY_FAKE_SOFTWARE_VERSION}</software-version>`,
    '  <software-build>4210</software-build>',
    '  <secure-device>true</secure-device>',
    '  <language>en</language>',
    '  <country>US</country>',
    '  <supports-suspend>false</supports-suspend>',
    '  <supports-find-remote>false</supports-find-remote>',
    '  <supports-private-listening>false</supports-private-listening>',
    '  <power-mode>PowerOn</power-mode>',
    '</device-info>'
  ].join('\n');
}

/**
 * True when a discovered device is actually the relay's own SSDP advertisement,
 * so RDS can drop it from discovery results and never target itself.
 */
export function isRelaySelfDevice(d: { serialNumber?: unknown; modelName?: unknown } | null | undefined): boolean {
  if (!d) return false;
  return d.serialNumber === RELAY_FAKE_SERIAL || d.modelName === RELAY_FAKE_MODEL_NAME;
}
