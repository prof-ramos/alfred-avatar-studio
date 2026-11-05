// DeviceViewport: modos Robô (SVG), Display e Pixel, com área segura e indicadores (PRD §4.1).
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { SAFE_AREA_MARGIN } from '../domain/profile';
import type { InputSource, TouchPhase } from '../domain/types';
import { useDiag, useSim, useStore } from './context';

const POINTER_SOURCE: Record<string, InputSource> = { mouse: 'mouse', touch: 'touch', pen: 'pen' };

function useCanvasInput() {
  const { sim } = useSim();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvasRef.current = el;
      sim.attachCanvas(el);
    },
    [sim],
  );

  const send = (phase: TouchPhase, e: ReactPointerEvent<HTMLCanvasElement>) => {
    const el = canvasRef.current;
    if (!el) return false;
    return sim.handlePointer(phase, e.clientX, e.clientY, el.getBoundingClientRect(), POINTER_SOURCE[e.pointerType] ?? 'mouse');
  };

  const handlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (send('down', e)) e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (sim.contactActive) send('move', e);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (sim.contactActive) send('up', e);
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (sim.contactActive) send('cancel', e);
    },
  };
  return { setCanvas, handlers };
}

function TouchMarker() {
  const diag = useDiag();
  const t = diag.lastTouch;
  if (!t) return null;
  return (
    <circle
      key={`${t.timestamp}-${t.phase}`}
      cx={t.x}
      cy={t.y}
      r={t.phase === 'up' || t.phase === 'cancel' ? 10 : 7}
      className={t.phase === 'cancel' ? 'touch-marker touch-marker-cancel' : 'touch-marker'}
    />
  );
}

/** Camada de sobreposição em coordenadas lógicas 240 × 240 (não entra nas exportações). */
function Overlay({ circleGuide }: { circleGuide: boolean }) {
  const { state } = useStore();
  const { snap } = useSim();
  const { showSafeArea } = state.project.device;
  const st = snap.status;
  return (
    <svg viewBox="0 0 240 240" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {circleGuide && <circle cx="120" cy="120" r="119.5" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="4 3" />}
      {showSafeArea && (
        <circle
          data-testid="safe-area-overlay"
          cx="120"
          cy="120"
          r={120 - SAFE_AREA_MARGIN}
          fill="none"
          stroke="#FBBF24"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}
      {state.view.showOverlays && (
        <g data-testid="status-overlay" opacity="0.85" fill="#E2E8F0" stroke="#E2E8F0">
          {/* Wi-Fi */}
          <g transform="translate(92 18)" data-testid="status-wifi" data-on={st.wifi}>
            <path d="M0 6 Q6 0 12 6" fill="none" strokeWidth="1.4" opacity={st.wifi ? 1 : 0.3} />
            <path d="M2.5 8.5 Q6 5 9.5 8.5" fill="none" strokeWidth="1.4" opacity={st.wifi ? 1 : 0.3} />
            <circle cx="6" cy="10.5" r="1.1" stroke="none" />
            {!st.wifi && <path d="M0 0 L12 12" stroke="#F87171" strokeWidth="1.4" />}
          </g>
          {/* Bateria */}
          <g transform="translate(110 20)" data-testid="status-battery">
            <rect x="0" y="0" width="16" height="8" rx="1.5" fill="none" strokeWidth="1" />
            <rect x="16.5" y="2.5" width="1.5" height="3" stroke="none" />
            <rect
              x="1.5"
              y="1.5"
              width={13 * (st.battery / 100)}
              height="5"
              stroke="none"
              fill={st.battery <= 15 ? '#F87171' : st.charging ? '#4ADE80' : '#E2E8F0'}
            />
          </g>
          {/* Microfone */}
          <g transform="translate(134 17)" data-testid="status-mic" data-muted={st.micMuted} opacity={st.micMuted ? 1 : 0.35}>
            <rect x="2" y="0" width="5" height="8" rx="2.5" fill="none" strokeWidth="1.2" />
            <path d="M0 6 Q4.5 11 9 6 M4.5 9.5 V12" fill="none" strokeWidth="1.2" />
            {st.micMuted && <path d="M-1 0 L10 12" stroke="#F87171" strokeWidth="1.4" />}
          </g>
        </g>
      )}
      <TouchMarker />
    </svg>
  );
}

function DisplayCanvas({ cssSize, round, pixelated }: { cssSize: number; round: boolean; pixelated: boolean }) {
  const { setCanvas, handlers } = useCanvasInput();
  return (
    <canvas
      ref={setCanvas}
      width={240}
      height={240}
      data-testid="display-canvas"
      aria-label="Tela circular do Alfred (240 × 240)"
      style={{ width: cssSize, height: cssSize, imageRendering: pixelated ? 'pixelated' : 'auto', touchAction: 'none' }}
      className={`block cursor-crosshair select-none ${round ? 'rounded-full' : ''}`}
      {...handlers}
    />
  );
}

function RobotBody({ showLegs }: { showLegs: boolean }) {
  const { sim, snap } = useSim();
  const height = showLegs ? 470 : 410;
  return (
    <svg
      data-testid="robot-body"
      viewBox={`0 0 400 ${height}`}
      width={400}
      height={height}
      className="absolute inset-0"
      aria-label="Corpo do robô Spotpear Ball V2"
    >
      <defs>
        <radialGradient id="shell" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#E7E9EE" />
          <stop offset="100%" stopColor="#B8BDC7" />
        </radialGradient>
        <radialGradient id="bezel" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1F2937" />
          <stop offset="100%" stopColor="#030712" />
        </radialGradient>
      </defs>
      {showLegs && (
        <g data-testid="robot-legs" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="2">
          <path d="M130 340 L92 452 Q90 462 102 462 L124 462 Q134 462 136 452 L162 356 Z" />
          <path d="M270 340 L308 452 Q310 462 298 462 L276 462 Q266 462 264 452 L238 356 Z" />
          <path d="M188 372 L186 456 Q186 466 196 466 L204 466 Q214 466 214 456 L212 372 Z" fill="#C7CBD2" />
        </g>
      )}
      <circle cx="200" cy="200" r="180" fill="url(#shell)" stroke="#9CA3AF" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="136" fill="url(#bezel)" />
      <circle cx="200" cy="200" r="122" fill="#000" />
      {/* Grade do alto-falante */}
      <g fill="#9CA3AF">
        {[-24, -12, 0, 12, 24].map((dx) => (
          <circle key={dx} cx={200 + dx} cy={358} r="2.6" />
        ))}
      </g>
      {/* Botão físico Boot (GPIO 0) na parte superior */}
      <g
        data-testid="gpio0-button"
        role="button"
        tabIndex={0}
        aria-label="Botão físico Boot (GPIO 0)"
        aria-pressed={snap.pttDown}
        className="cursor-pointer outline-none"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          sim.pttPress('hardware_button');
        }}
        onPointerUp={() => sim.pttRelease('hardware_button')}
        onPointerCancel={() => sim.pttRelease('hardware_button')}
      >
        <rect x="172" y={snap.pttDown ? 6 : 2} width="56" height="20" rx="8" fill={snap.pttDown ? '#7DD3FC' : '#CBD5E1'} stroke="#64748B" strokeWidth="2" />
        <text x="200" y={snap.pttDown ? 20 : 16} textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">
          BOOT
        </text>
      </g>
    </svg>
  );
}

export function DeviceViewport() {
  const { state } = useStore();
  const { mode, pixelScale, pixelGrid } = state.view;
  const { showLegs } = state.project.device;

  if (mode === 'robot') {
    const h = showLegs ? 470 : 410;
    return (
      <div data-testid="device-viewport" data-mode="robot" className="relative" style={{ width: 400, height: h }}>
        <RobotBody showLegs={showLegs} />
        <div className="absolute" style={{ left: 80, top: 80, width: 240, height: 240 }}>
          <DisplayCanvas cssSize={240} round pixelated={false} />
          <Overlay circleGuide={false} />
        </div>
      </div>
    );
  }

  if (mode === 'display') {
    return (
      <div data-testid="device-viewport" data-mode="display" className="rounded-full bg-black p-4 shadow-[0_0_0_10px_#111827,0_10px_40px_rgba(0,0,0,0.6)]">
        <div className="relative" style={{ width: 240, height: 240 }}>
          <DisplayCanvas cssSize={240} round pixelated={false} />
          <Overlay circleGuide={false} />
        </div>
      </div>
    );
  }

  const size = 240 * pixelScale;
  return (
    <div data-testid="device-viewport" data-mode="pixel" data-scale={pixelScale} className="relative" style={{ width: size, height: size }}>
      <DisplayCanvas cssSize={size} round={false} pixelated />
      {pixelGrid && pixelScale >= 2 && (
        <div
          data-testid="pixel-grid"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
            backgroundSize: `${pixelScale}px ${pixelScale}px`,
          }}
        />
      )}
      <Overlay circleGuide />
    </div>
  );
}

/** Mantém o laço de renderização ativo enquanto o componente estiver montado. */
export function useRenderLoop() {
  const { sim } = useSim();
  useEffect(() => {
    sim.start();
    return () => sim.stopLoop();
  }, [sim]);
}
