// Roku Secret Screens modal (opened from Remote tab and Query / Device Queries footer)

import {
  openModalOverlayActiveFromOpener,
  closeModalWithOriginMotion
} from '../../modules/utils/modal-origin-motion.js';
import { attachBackdropClickToClose } from '../../modules/utils/modal-backdrop-click.js';

interface SecretSegment {
  label: string;
  keys: string[];
}

interface SecretScreenDef {
  id: string;
  title: string;
  segments: SecretSegment[];
  reboot?: boolean;
  dangerButton?: boolean;
}

function repeatKeys(key: string, n: number): string[] {
  return Array.from({ length: n }, () => key);
}

const SECRET_SCREENS_ORDERED: SecretScreenDef[] = [
  {
    id: 'developerSettings',
    title: 'Developer Settings',
    segments: [
      { label: 'Home×3', keys: repeatKeys('Home', 3) },
      { label: 'Up×2', keys: repeatKeys('Up', 2) },
      { label: 'Right', keys: ['Right'] },
      { label: 'Left', keys: ['Left'] },
      { label: 'Right', keys: ['Right'] },
      { label: 'Left', keys: ['Left'] },
      { label: 'Right', keys: ['Right'] }
    ]
  },
  {
    id: 'secretScreen',
    title: 'Secret Screen',
    segments: [
      { label: 'Home×5', keys: repeatKeys('Home', 5) },
      { label: 'Fwd×3', keys: repeatKeys('Fwd', 3) },
      { label: 'Rev×2', keys: repeatKeys('Rev', 2) }
    ]
  },
  {
    id: 'secretScreen2',
    title: 'Secret Screen 2',
    segments: [
      { label: 'Home×5', keys: repeatKeys('Home', 5) },
      { label: 'Up', keys: ['Up'] },
      { label: 'Right', keys: ['Right'] },
      { label: 'Down', keys: ['Down'] },
      { label: 'Left', keys: ['Left'] },
      { label: 'Up', keys: ['Up'] }
    ]
  },
  {
    id: 'wifiSecret',
    title: 'Wi-Fi Secret Screen',
    segments: [
      { label: 'Home×5', keys: repeatKeys('Home', 5) },
      { label: 'Up', keys: ['Up'] },
      { label: 'Down', keys: ['Down'] },
      { label: 'Up', keys: ['Up'] },
      { label: 'Down', keys: ['Down'] },
      { label: 'Up', keys: ['Up'] }
    ]
  },
  {
    id: 'antennaSecret',
    title: 'Antenna Secret Screen',
    segments: [
      { label: 'Home×5', keys: repeatKeys('Home', 5) },
      { label: 'Fwd', keys: ['Fwd'] },
      { label: 'Down', keys: ['Down'] },
      { label: 'Rev', keys: ['Rev'] },
      { label: 'Down', keys: ['Down'] },
      { label: 'Fwd', keys: ['Fwd'] }
    ]
  },
  {
    id: 'channelInfo',
    title: 'Channel Info',
    segments: [
      { label: 'Home×3', keys: repeatKeys('Home', 3) },
      { label: 'Up×2', keys: repeatKeys('Up', 2) },
      { label: 'Left', keys: ['Left'] },
      { label: 'Right', keys: ['Right'] },
      { label: 'Left', keys: ['Left'] },
      { label: 'Right', keys: ['Right'] },
      { label: 'Left', keys: ['Left'] }
    ]
  },
  {
    id: 'network',
    title: 'Network',
    segments: [
      { label: 'Home×5', keys: repeatKeys('Home', 5) },
      { label: 'Right', keys: ['Right'] },
      { label: 'Left', keys: ['Left'] },
      { label: 'Right', keys: ['Right'] },
      { label: 'Left', keys: ['Left'] },
      { label: 'Right', keys: ['Right'] }
    ]
  },
  {
    id: 'deviceReboot',
    title: 'Reboot',
    reboot: true,
    dangerButton: true,
    segments: [
      { label: 'Home×5', keys: repeatKeys('Home', 5) },
      { label: 'Up', keys: ['Up'] },
      { label: 'Rev×2', keys: repeatKeys('Rev', 2) },
      { label: 'Fwd×2', keys: repeatKeys('Fwd', 2) }
    ]
  }
];

const KEY_GAP_MS = 350;
const HOME_SETTLE_MS = 750;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function blurSecretScreensOpenButtons() {
  document.querySelectorAll('.secret-screens-open-btn').forEach((el) => (el as HTMLElement).blur());
}

function closeSecretScreensModal(modal: HTMLElement) {
  if (!modal || !modal.classList.contains('active')) return;
  sequenceCancelGen++;
  closeModalWithOriginMotion(modal, () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => blurSecretScreensOpenButtons(), 0);
  });
}

function getActiveDeviceApi(): QueriesDeviceApi | null {
  const active = document.querySelector('.tab-panel.active') as HTMLElement | null;
  if (!active || active.id === 'welcomePanel') return null;
  return active.rokuDevStudioApi ?? null;
}

function setSequenceButtonsDisabled(modal: HTMLElement, disabled: boolean) {
  modal.querySelectorAll('.secret-sequence-btn').forEach((b) => {
    (b as HTMLButtonElement).disabled = disabled;
  });
}

function clearSegmentProgress(block: HTMLElement | null) {
  if (!block) return;
  block.querySelectorAll('.secret-segment').forEach((el) => {
    el.classList.remove('secret-segment-active', 'secret-segment-done', 'secret-segment-key-tick');
  });
}

function updateSegmentHighlights(block: HTMLElement, activeIndex: number) {
  const segs = [...block.querySelectorAll('.secret-segment')];
  segs.forEach((el, i) => {
    el.classList.toggle('secret-segment-active', i === activeIndex);
    el.classList.toggle('secret-segment-done', i < activeIndex);
  });
}

function pulseSegmentKey(segEl: HTMLElement) {
  segEl.classList.remove('secret-segment-key-tick');
  void segEl.offsetWidth;
  segEl.classList.add('secret-segment-key-tick');
}

function renderSecretScreensList(mountEl: HTMLElement) {
  mountEl.replaceChildren();

  const maxSegs = Math.max(...SECRET_SCREENS_ORDERED.map((d) => d.segments.length));
  mountEl.style.setProperty('--seg-max', String(maxSegs));

  for (const def of SECRET_SCREENS_ORDERED) {
    const card = document.createElement('div');
    card.className = 'secret-screen-card';
    card.dataset.secretSequence = def.id;

    const head = document.createElement('div');
    head.className = 'secret-screen-card-head';

    const title = document.createElement('span');
    title.className = 'secret-screen-card-title';
    title.textContent = def.title;

    head.appendChild(title);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-sm secret-sequence-btn ${def.dangerButton ? 'btn-danger' : 'btn-primary'}`;
    btn.dataset.secretSequence = def.id;
    btn.innerHTML =
      '<span class="icon icon-xs"><svg><use href="#icon-play"/></svg></span> ' + 'Run Sequence';
    head.appendChild(btn);

    const row = document.createElement('div');
    row.className = 'secret-screen-segments';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `${def.title} Key Sequence`);

    for (const seg of def.segments) {
      const box = document.createElement('span');
      box.className = 'secret-segment';
      box.textContent = seg.label;
      row.appendChild(box);
    }

    card.appendChild(head);
    card.appendChild(row);
    mountEl.appendChild(card);
  }
}

function getSecretDef(sequenceId: string): SecretScreenDef | undefined {
  return SECRET_SCREENS_ORDERED.find((d) => d.id === sequenceId);
}

let sequenceInFlight = false;
let sequenceCancelGen = 0;

async function sendSecretSequence(modal: HTMLElement, sequenceId: string, block: HTMLElement | null) {
  const def = getSecretDef(sequenceId);
  if (!def?.segments?.length) return;

  const cardBlock =
    block || (modal.querySelector(`.secret-screen-card[data-secret-sequence="${sequenceId}"]`) as HTMLElement | null);
  if (!cardBlock) return;

  if (def.reboot) {
    const ok = window.confirm('This sends the key sequence that reboots the Roku. Continue?');
    if (!ok) return;
  }

  if (sequenceInFlight) return;
  const api = getActiveDeviceApi();
  if (!api || typeof api.keypress !== 'function') {
    return;
  }

  const runBaseline = sequenceCancelGen;
  sequenceInFlight = true;
  setSequenceButtonsDisabled(modal, true);
  clearSegmentProgress(cardBlock);

  try {
    if (runBaseline !== sequenceCancelGen) return;
    const homeFirst = await api.keypress('Home');
    if (homeFirst && homeFirst.success === false) {
      clearSegmentProgress(cardBlock);
      return;
    }
    await delay(HOME_SETTLE_MS);
    if (runBaseline !== sequenceCancelGen) return;

    for (let s = 0; s < def.segments.length; s++) {
      if (runBaseline !== sequenceCancelGen) return;
      updateSegmentHighlights(cardBlock, s);
      const segEl = cardBlock.querySelectorAll('.secret-segment')[s] as HTMLElement | undefined;
      const segment = def.segments[s];

      for (let k = 0; k < segment.keys.length; k++) {
        if (runBaseline !== sequenceCancelGen) return;
        if (segEl) pulseSegmentKey(segEl);

        const key = segment.keys[k];
        const result = await api.keypress!(key);
        if (result && result.success === false) {
          clearSegmentProgress(cardBlock);
          return;
        }
        if (s < def.segments.length - 1 || k < segment.keys.length - 1) {
          await delay(KEY_GAP_MS);
        }
      }
    }

    if (runBaseline !== sequenceCancelGen) return;
    cardBlock.querySelectorAll('.secret-segment').forEach((el) => {
      el.classList.add('secret-segment-done');
      el.classList.remove('secret-segment-active', 'secret-segment-key-tick');
    });
  } catch {
    clearSegmentProgress(cardBlock);
  } finally {
    sequenceInFlight = false;
    setSequenceButtonsDisabled(modal, false);
  }
}

export function setupSecretScreens(panel: HTMLElement) {
  const modal = document.getElementById('secretScreensModal');

  if (modal instanceof HTMLElement) {
    const modalEl = modal;
    panel.querySelectorAll('.secret-screens-open-btn').forEach((openBtn) => {
      openBtn.addEventListener('click', (e) => {
        modalEl.querySelectorAll('.secret-screen-card').forEach((card) => clearSegmentProgress(card as HTMLElement));
        const opener = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
        openModalOverlayActiveFromOpener(modalEl, opener, () => {
          modalEl.setAttribute('aria-hidden', 'false');
          if (opener) setTimeout(() => opener.blur(), 0);
        });
      });
    });
  }

  if (modal instanceof HTMLElement && !modal.dataset.secretScreensBound) {
    const modalEl = modal;
    modalEl.dataset.secretScreensBound = '1';

    const mount = modalEl.querySelector('#secretScreensListMount');
    if (mount) {
      renderSecretScreensList(mount as HTMLElement);
    }

    const closeBtn = modalEl.querySelector('.secret-screens-modal-close');
    closeBtn?.addEventListener('click', () => closeSecretScreensModal(modalEl));

    attachBackdropClickToClose(modalEl, () => closeSecretScreensModal(modalEl));

    modalEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.secret-sequence-btn') as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      const id = btn.dataset.secretSequence;
      if (!id) return;
      e.preventDefault();
      const block = btn.closest('.secret-screen-card') as HTMLElement | null;
      sendSecretSequence(modalEl, id, block);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl.classList.contains('active')) {
        closeSecretScreensModal(modalEl);
      }
    });
  }
}
