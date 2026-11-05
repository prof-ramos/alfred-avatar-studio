import { describe, expect, it } from 'vitest';
import { createDefaultProject, parseProjectJson, validateProject } from './project';

describe('validação de projetos', () => {
  it('aceita o projeto padrão sem alterações (ida e volta)', () => {
    const p = createDefaultProject('Teste', 'teste-1');
    const r = parseProjectJson(JSON.stringify(p));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project).toEqual(p);
  });

  it('aceita o exemplo do PRD §8.1 preenchendo campos opcionais', () => {
    const prd = {
      $schema: 'https://alfred-studio.local/schemas/project-v1.4.json',
      schemaVersion: 2,
      project: { id: 'alfred-classic-v1', name: 'Alfred Classic', createdAt: '2026-11-05T10:00:00Z', updatedAt: '2026-11-05T10:00:00Z' },
      device: {
        profile: 'XIAOZHI_ROBOT_BALL_128',
        width: 240,
        height: 240,
        shape: 'circle',
        targetFps: 30,
        colorPreview: 'rgb565',
        showLegs: true,
        showSafeArea: false,
        gestureThresholds: { longPressMs: 500, movementTolerancePx: 6, swipeMinDistancePx: 24 },
      },
      avatar: {
        background: '#000000',
        primaryColor: '#7DD3FC',
        accentColor: '#38BDF8',
        glow: true,
        parameters: {
          eyes: { shape: 'rounded', width: 48, height: 48, spacing: 36, eyelidOpen: 1.0 },
          eyebrows: { tilt: 0, elevation: 0, thickness: 4 },
          mouth: { style: 'curve', width: 42, openness: 0.0, curvature: 0.3 },
        },
      },
      runtime: { defaultState: 'idle', defaultEmotion: 'neutral', randomSeed: 42, soundEnabled: true },
      emotions: {},
      animations: {},
      bindings: [],
    };
    const r = validateProject(prd);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.device.colorPreview).toBe('rgb565');
      expect(r.project.avatar.strokeWidth).toBe(4);
    }
  });

  it.each([
    ['não é objeto', '[1,2,3]'],
    ['JSON malformado', '{"schemaVersion": 2,'],
    ['versão desconhecida', '{"schemaVersion": 99}'],
  ])('rejeita %s', (_, text) => {
    expect(parseProjectJson(text).ok).toBe(false);
  });

  it('rejeita tipos errados, cores inválidas e perfil desconhecido', () => {
    const p = createDefaultProject() as unknown as Record<string, any>;
    p.avatar.primaryColor = 'red';
    p.avatar.parameters.eyes.width = '48';
    p.device.profile = 'OUTRO';
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toContain('avatar.primaryColor');
      expect(r.errors.join('\n')).toContain('avatar.parameters.eyes.width');
      expect(r.errors.join('\n')).toContain('device.profile');
    }
  });

  it('rejeita marcação HTML em textos', () => {
    const p = createDefaultProject() as unknown as Record<string, any>;
    p.project.name = '<img src=x onerror=alert(1)>';
    expect(validateProject(p).ok).toBe(false);
  });

  it('descarta chaves desconhecidas e __proto__', () => {
    const text = JSON.stringify(createDefaultProject()).replace('"avatar":{', '"avatar":{"__proto__":{"polluted":true},"extra":1,');
    const r = parseProjectJson(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.project.avatar as unknown as Record<string, unknown>).extra).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    }
  });

  it('rejeita vínculos de gesto para animações inexistentes', () => {
    const p = createDefaultProject();
    p.bindings = [{ gesture: 'tap', action: 'animation:nao-existe' }];
    expect(validateProject(p).ok).toBe(false);
  });

  it('rejeita quadros-chave fora da duração', () => {
    const p = createDefaultProject();
    p.animations.surpresa.keyframes[0].t = 99_999;
    expect(validateProject(p).ok).toBe(false);
  });
});

describe('migração de schema', () => {
  it('migra a versão 1 para a versão 2', () => {
    const v1 = {
      schemaVersion: 1,
      project: { id: 'antigo', name: 'Alfred v1' },
      device: { profile: 'XIAOZHI_ROBOT_BALL_128', targetFps: 15 },
      avatar: { background: '#000000', color: '#FF8800', face: { eyes: { width: 30 }, mouth: { curvature: -0.2 } } },
      runtime: { randomSeed: 7 },
    };
    const r = validateProject(v1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.migrated).toBe(true);
      expect(r.project.schemaVersion).toBe(2);
      expect(r.project.avatar.primaryColor).toBe('#FF8800');
      expect(r.project.avatar.parameters.eyes.width).toBe(30);
      expect(r.project.avatar.parameters.mouth.curvature).toBe(-0.2);
      expect(r.project.device.targetFps).toBe(15);
      expect(r.project.device.showLegs).toBe(true);
      expect(r.project.runtime.randomSeed).toBe(7);
      expect(r.project.bindings.length).toBeGreaterThan(0);
    }
  });
});
