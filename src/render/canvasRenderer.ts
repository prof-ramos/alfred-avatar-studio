// CanvasRenderer: desenha a pose do avatar no canvas lógico de 240 × 240 (PRD §7.2).
import type { FacePose } from '../domain/avatarEngine';
import { DISPLAY_CENTER, DISPLAY_RADIUS, DISPLAY_SIZE } from '../domain/profile';
import type { AvatarConfig } from '../domain/types';
import { quantizeRgb565InPlace } from './rgb565';

export type BackgroundMode = 'square' | 'circle' | 'transparent';

export interface RenderOptions {
  background: BackgroundMode;
  rgb565: boolean;
  /** Ícone adicional desenhado sobre o rosto (pacote ESPHome). */
  extraIcon?: 'mute' | 'none';
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const DEG = Math.PI / 180;

function eyePath(ctx: Ctx, shape: AvatarConfig['parameters']['eyes']['shape'], cx: number, cy: number, w: number, h: number): void {
  ctx.beginPath();
  if (shape === 'elliptic') {
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  const r = shape === 'rounded' ? Math.min(w, h) / 2 : Math.min(8, w / 2, h / 2);
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
}

function drawEyes(ctx: Ctx, avatar: AvatarConfig, pose: FacePose): { topL: number; topR: number; cxL: number; cxR: number } {
  const e = avatar.parameters.eyes;
  const w = e.width * pose.eyeScale;
  const fullH = e.height * pose.eyeScale * pose.eyeScaleY;
  const dx = e.spacing / 2 + e.width / 2;
  const cy = DISPLAY_CENTER + e.offsetY + pose.gazeY;
  const cxL = DISPLAY_CENTER - dx + pose.gazeX;
  const cxR = DISPLAY_CENTER + dx + pose.gazeX;

  const drawOne = (cx: number, open: number) => {
    const h = fullH * open;
    if (h < 3) {
      // Pálpebra fechada: traço horizontal levemente curvo.
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, cy);
      ctx.quadraticCurveTo(cx, cy + 4, cx + w / 2, cy);
      ctx.lineWidth = Math.max(2, avatar.strokeWidth);
      ctx.lineCap = 'round';
      ctx.stroke();
      return;
    }
    eyePath(ctx, e.shape, cx, cy, w, h);
    ctx.fill();
  };
  drawOne(cxL, pose.eyeOpenL);
  drawOne(cxR, pose.eyeOpenR);
  return { topL: cy - fullH / 2, topR: cy - fullH / 2, cxL, cxR };
}

function drawBrows(ctx: Ctx, avatar: AvatarConfig, pose: FacePose, eyes: ReturnType<typeof drawEyes>): void {
  const b = avatar.parameters.eyebrows;
  if (b.thickness <= 0) return;
  const len = avatar.parameters.eyes.width * 0.8;
  ctx.lineWidth = b.thickness;
  ctx.lineCap = 'round';

  const drawOne = (cx: number, top: number, lift: number, tiltDeg: number, side: -1 | 1) => {
    const y = top - 10 - b.elevation - lift;
    // Ponta interna fica do lado do centro do rosto (side = -1 esquerda, +1 direita).
    const innerX = cx - side * (len / 2);
    const outerX = cx + side * (len / 2);
    const drop = Math.tan(tiltDeg * DEG) * (len / 2);
    const innerY = y + drop;
    const outerY = y - drop;
    ctx.beginPath();
    ctx.moveTo(outerX, outerY);
    ctx.quadraticCurveTo(cx, y - b.curvature * 8, innerX, innerY);
    ctx.stroke();
  };
  drawOne(eyes.cxL, eyes.topL, pose.browLiftL, pose.browTiltL, -1);
  drawOne(eyes.cxR, eyes.topR, pose.browLiftR, pose.browTiltR, 1);
}

function drawMouth(ctx: Ctx, avatar: AvatarConfig, pose: FacePose): void {
  const m = avatar.parameters.mouth;
  const w = m.width * pose.mouthWidthScale;
  if (w < 1) return;
  const h = Math.max(4, m.height);
  const cx = DISPLAY_CENTER + pose.gazeX * 0.3;
  const cy = DISPLAY_CENTER + m.offsetY + pose.gazeY * 0.3;
  const curve = pose.mouthCurve * h;
  const skew = pose.mouthSkew * h * 0.6;
  const lx = cx - w / 2;
  const rx = cx + w / 2;
  const ly = cy - skew;
  const ry = cy + skew * 0.3;
  const open = pose.mouthOpen;

  ctx.lineWidth = avatar.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (m.style === 'oval') {
    const rh = Math.max(2, h * (0.25 + open * 0.9)) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + curve * 0.2, w / 2, rh, pose.mouthSkew * 0.15, 0, Math.PI * 2);
    if (open > 0.05) ctx.fill();
    else ctx.stroke();
    return;
  }

  if (open <= 0.05) {
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    if (m.style === 'segment') {
      // Segmento dinâmico: linha reta com cantos levemente dobrados pela curvatura.
      ctx.lineTo(lx + w * 0.15, cy + curve * 0.6);
      ctx.lineTo(rx - w * 0.15, cy + curve * 0.6);
      ctx.lineTo(rx, ry);
    } else {
      ctx.quadraticCurveTo(cx, cy + curve, rx, ry);
    }
    ctx.stroke();
    return;
  }

  // Boca aberta: forma preenchida entre o lábio superior e o inferior.
  const depth = h * (0.4 + open * 1.4);
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(cx, cy + curve * 0.5 - depth * 0.15, rx, ry);
  ctx.quadraticCurveTo(cx, cy + curve + depth, lx, ly);
  ctx.closePath();
  ctx.fill();
}

function drawIndicator(ctx: Ctx, avatar: AvatarConfig, pose: FacePose): void {
  const p = pose.indicatorPhase;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = avatar.accentColor;
  ctx.fillStyle = avatar.accentColor;
  ctx.lineCap = 'round';
  switch (pose.indicator) {
    case 'listening': {
      ctx.globalAlpha = 0.25 + 0.5 * (1 - p);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(DISPLAY_CENTER, DISPLAY_CENTER, 104 + p * 8, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'thinking': {
      for (let i = 0; i < 3; i++) {
        const active = Math.floor(p * 3) === i;
        ctx.globalAlpha = active ? 1 : 0.35;
        ctx.beginPath();
        ctx.arc(DISPLAY_CENTER - 14 + i * 14, 40, active ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'executing': {
      ctx.lineWidth = 4;
      const a = p * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(DISPLAY_CENTER, 200, 10, a, a + Math.PI * 1.4);
      ctx.stroke();
      break;
    }
    case 'connecting': {
      ctx.lineWidth = 3;
      const bars = 1 + Math.floor(p * 3);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = i < bars ? 1 : 0.25;
        ctx.beginPath();
        ctx.arc(DISPLAY_CENTER, 210, 6 + i * 6, -Math.PI * 0.75, -Math.PI * 0.25);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(DISPLAY_CENTER, 210, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'success': {
      ctx.lineWidth = 4;
      ctx.globalAlpha = p;
      ctx.beginPath();
      ctx.moveTo(DISPLAY_CENTER - 9, 200);
      ctx.lineTo(DISPLAY_CENTER - 2, 207);
      ctx.lineTo(DISPLAY_CENTER + 10, 193);
      ctx.stroke();
      break;
    }
    case 'error': {
      ctx.strokeStyle = '#F87171';
      ctx.lineWidth = 4;
      ctx.globalAlpha = p;
      ctx.beginPath();
      ctx.moveTo(DISPLAY_CENTER - 7, 193);
      ctx.lineTo(DISPLAY_CENTER + 7, 207);
      ctx.moveTo(DISPLAY_CENTER + 7, 193);
      ctx.lineTo(DISPLAY_CENTER - 7, 207);
      ctx.stroke();
      break;
    }
    case 'sleep': {
      ctx.font = 'bold 16px sans-serif';
      ctx.globalAlpha = 0.4 + 0.6 * Math.sin(p * Math.PI);
      ctx.fillText('z', 168, 70 - p * 8);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Z', 182, 56 - p * 8);
      break;
    }
    case 'charging':
    case 'low_battery': {
      const low = pose.indicator === 'low_battery';
      const x = DISPLAY_CENTER - 14;
      const y = 193;
      ctx.lineWidth = 2;
      ctx.strokeStyle = low ? '#F87171' : avatar.accentColor;
      ctx.strokeRect(x, y, 26, 13);
      ctx.fillStyle = low ? '#F87171' : avatar.accentColor;
      ctx.fillRect(x + 26, y + 4, 3, 5);
      const level = low ? (p < 0.5 ? 0.15 : 0) : Math.min(1, 0.25 + p);
      ctx.fillRect(x + 2, y + 2, 22 * level, 9);
      break;
    }
    case 'none':
      break;
  }
  ctx.restore();
}

function drawMuteIcon(ctx: Ctx, avatar: AvatarConfig): void {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = avatar.accentColor;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const x = DISPLAY_CENTER;
  const y = 196;
  ctx.beginPath();
  ctx.roundRect(x - 5, y - 12, 10, 16, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 2, 9, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.moveTo(x, y + 7);
  ctx.lineTo(x, y + 11);
  ctx.stroke();
  ctx.strokeStyle = '#F87171';
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 14);
  ctx.lineTo(x + 12, y + 10);
  ctx.stroke();
  ctx.restore();
}

/** Desenha um quadro completo no contexto informado (que deve ter 240 × 240 pixels). */
export function renderFrame(ctx: Ctx, avatar: AvatarConfig, pose: FacePose, opts: RenderOptions): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
  ctx.globalAlpha = 1;

  if (opts.background === 'square') {
    ctx.fillStyle = avatar.background;
    ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
  } else if (opts.background === 'circle') {
    ctx.fillStyle = avatar.background;
    ctx.beginPath();
    ctx.arc(DISPLAY_CENTER, DISPLAY_CENTER, DISPLAY_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  if (pose.breath !== 1) {
    ctx.translate(DISPLAY_CENTER, DISPLAY_CENTER);
    ctx.scale(pose.breath, pose.breath);
    ctx.translate(-DISPLAY_CENTER, -DISPLAY_CENTER);
  }

  ctx.fillStyle = avatar.primaryColor;
  ctx.strokeStyle = avatar.primaryColor;
  if (avatar.glow) {
    ctx.shadowColor = avatar.primaryColor;
    ctx.shadowBlur = 8;
  }
  const eyes = drawEyes(ctx, avatar, pose);
  drawBrows(ctx, avatar, pose, eyes);
  drawMouth(ctx, avatar, pose);
  ctx.restore();

  ctx.save();
  drawIndicator(ctx, avatar, pose);
  if (opts.extraIcon === 'mute') drawMuteIcon(ctx, avatar);
  ctx.restore();

  if (opts.rgb565) {
    const img = ctx.getImageData(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    quantizeRgb565InPlace(img.data);
    ctx.putImageData(img, 0, 0);
  }
}
