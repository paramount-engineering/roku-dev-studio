/**
 * Renderer side of RCE live video preview (design doc §7). Signaling (the Janus WebSocket) runs in
 * the main process — see `main/ipc/rce-video-handlers.ts` for why — and hands the SDP offer to this
 * module over IPC; the actual `RTCPeerConnection` lives here, since Electron's renderer is Chromium
 * and has one natively.
 */

import { rendererError } from '../utils/logger.js';

export type RceVideoStatus = 'connecting' | 'reconnecting' | 'stopped' | 'error';

export interface RceVideoHandle {
  /** Tear down the peer connection and tell main to stop the Janus session. Idempotent. */
  stop(): void;
  /** Draw the current video frame to an off-screen canvas and return a PNG data URL, or `null`
   *  if the stream has no frame yet (not enough metadata loaded). */
  captureFrame(): string | null;
}

/**
 * Wire a `<video>` element to a running RCE device's live stream. Starts the main-process Janus
 * session immediately; the video's `srcObject` is set once the offer/answer/ICE exchange completes
 * and the first track arrives. Call `stop()` on panel teardown/device disconnect — it does not stop
 * the underlying cloud device, only this viewing session (design doc §7).
 */
export function attachRceVideo(
  videoEl: HTMLVideoElement,
  accountName: string,
  deviceId: number,
  onStatus?: (status: RceVideoStatus, error?: string) => void
): RceVideoHandle {
  let pc: RTCPeerConnection | null = null;
  let stopped = false;

  const offerCleanup = window.roku.onRceVideoOffer(
    async (payload: { name: string; deviceId: number; offer: { type: string; sdp: string }; iceServers: unknown[] }) => {
      if (stopped || payload.name !== accountName || payload.deviceId !== deviceId) return;
      // A reconnect sent a fresh offer — the old peer connection's session is dead either way.
      pc?.close();
      const peer = new RTCPeerConnection({ iceServers: (payload.iceServers as RTCIceServer[]) ?? [] });
      pc = peer;

      // Accumulate every received track into one persistent MediaStream rather than trusting
      // `e.streams[0]` and reassigning `srcObject` wholesale on each `ontrack` — Janus's streaming
      // plugin doesn't reliably give the audio and video m-lines from one mountpoint the same
      // `msid`/stream, so a naive `videoEl.srcObject = e.streams[0]` on every event can clobber an
      // already-attached audio track with a separate video-only stream (or vice versa) once the
      // second `ontrack` fires — the video plays, but there's no audio track behind it, so the
      // volume slider has nothing to attenuate. Confirmed against a live offer: the real SDP bundles
      // separate `audio`/`video` m-lines (`a=group:BUNDLE a v`), exactly the shape this bites.
      const remoteStream = new MediaStream();
      videoEl.srcObject = remoteStream;
      peer.ontrack = (e) => {
        if (pc !== peer) return; // superseded by a newer offer while this one was still negotiating
        if (!remoteStream.getTracks().includes(e.track)) remoteStream.addTrack(e.track);
      };
      peer.onicecandidate = (e) => {
        if (pc !== peer) return;
        if (e.candidate) void window.roku.rceVideoCandidate(accountName, deviceId, e.candidate.toJSON());
      };
      peer.onicegatheringstatechange = () => {
        if (pc !== peer) return;
        if (peer.iceGatheringState === 'complete') void window.roku.rceVideoCandidatesComplete(accountName, deviceId);
      };

      try {
        await peer.setRemoteDescription(payload.offer as RTCSessionDescriptionInit);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        if (pc !== peer) return; // stopped/superseded while awaiting the above
        await window.roku.rceVideoAnswer(accountName, deviceId, { type: answer.type, sdp: answer.sdp ?? '' });
      } catch (error: unknown) {
        rendererError('[RCE video] SDP negotiation failed:', error);
        onStatus?.('error', error instanceof Error ? error.message : String(error));
      }
    }
  );

  const statusCleanup = window.roku.onRceVideoStatus((payload: { name: string; deviceId: number; status: string; error?: string }) => {
    if (payload.name !== accountName || payload.deviceId !== deviceId) return;
    onStatus?.(payload.status as RceVideoStatus, payload.error);
  });

  void window.roku.rceVideoStart(accountName, deviceId);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      offerCleanup();
      statusCleanup();
      pc?.close();
      pc = null;
      videoEl.srcObject = null;
      void window.roku.rceVideoStop(accountName, deviceId);
    },
    captureFrame(): string | null {
      if (!videoEl.videoWidth || !videoEl.videoHeight) return null;
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(videoEl, 0, 0);
      return canvas.toDataURL('image/png');
    }
  };
}
