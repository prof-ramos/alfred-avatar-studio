import { describe, it, expect } from 'vitest';
import { StudioStore } from '../runtime/studioStore';
import { Simulator } from '../runtime/simulator';
import { MemoryRepository } from '../storage/projectStore';
import { createDefaultProject } from '../domain/project';
import { clientToLogical } from '../input/coords';
import { CircularContactFilter } from '../input/gestures';

describe('Contrato do simulador', () => {
  it.each([[240, 120], [120, 240], [-1, 120], [120, -1]])('rejeita a borda externa (%i, %i)', (x, y) => {
    const rect = { left: 0, top: 0, width: 240, height: 240 };
    const filter = new CircularContactFilter();
    const down = { phase: 'down', timestamp: 0, source: 'mouse' } as const;
    const outside = clientToLogical(x, y, rect);
    expect(filter.filter({ ...down, ...outside })).toBeNull();

    const inside = clientToLogical(239.9, 120, rect);
    expect(inside).toEqual({ x: 239, y: 120 });
    expect(filter.filter({ ...down, ...inside })).not.toBeNull();
    expect(filter.filter({ ...down, ...outside, phase: 'move' })).toMatchObject({
      ...inside, phase: 'cancel',
    });
  });
  it('seleção de emoção não integra o JSON exportado', async () => {
    const s = new StudioStore(); await s.init(new MemoryRepository());
    const sim = new Simulator(s);
    sim.setEmotion({id:'sad', intensity:0.35});
    expect(sim.effectiveEmotion).toEqual({id:'sad', intensity:0.35});
    expect(JSON.parse(s.exportJson()).runtime.defaultEmotion).toBe('neutral');
    sim.dispose();
  });
  it('aplica e exporta os valores iniciais do projeto importado', async () => {
    const s = new StudioStore(); await s.init(new MemoryRepository());
    const sim = new Simulator(s);
    const p = createDefaultProject('Auditoria', 'audit-defaults');
    p.runtime.defaultState='sleep'; p.runtime.defaultEmotion='sad';
    expect(await s.importProject(JSON.stringify(p))).toEqual([]);
    expect(s.project.runtime.defaultState).toBe('sleep');
    expect(sim.currentState).toBe('sleep');
    expect(sim.effectiveEmotion).toEqual({ id: 'sad', intensity: 0.8 });
    expect(JSON.parse(s.exportJson()).runtime).toEqual(p.runtime);
    sim.dispose();
  });
});
