import { describe, it, expect } from 'vitest';
import { StudioStore } from '../runtime/studioStore';
import { Simulator } from '../runtime/simulator';
import { MemoryRepository } from '../storage/projectStore';
import { createDefaultProject } from '../domain/project';
import { clientToLogical } from '../input/coords';
import { CircularContactFilter } from '../input/gestures';

describe('Auditoria: reprodução do comportamento observado (não são critérios de aceite)', () => {
  it('borda direita gera coordenada 240 e é aceita pelo filtro', () => {
    const p = clientToLogical(240, 120, {left:0, top:0, width:240, height:240});
    expect(p.x).toBe(240);
    expect(new CircularContactFilter().filter({...p, phase:'down', timestamp:0, source:'mouse'})).not.toBeNull();
  });
  it('seleção de emoção não integra o JSON exportado', async () => {
    const s = new StudioStore(); await s.init(new MemoryRepository());
    const sim = new Simulator(s);
    sim.setEmotion({id:'sad', intensity:0.35});
    expect(sim.effectiveEmotion).toEqual({id:'sad', intensity:0.35});
    expect(JSON.parse(s.exportJson()).runtime.defaultEmotion).toBe('neutral');
    sim.dispose();
  });
  it('importar defaults de estado/emoção não os aplica ao runtime existente', async () => {
    const s = new StudioStore(); await s.init(new MemoryRepository());
    const sim = new Simulator(s);
    const p = createDefaultProject('Auditoria', 'audit-defaults');
    p.runtime.defaultState='sleep'; p.runtime.defaultEmotion='sad';
    expect(await s.importProject(JSON.stringify(p))).toEqual([]);
    expect(s.project.runtime.defaultState).toBe('sleep');
    expect(sim.currentState).toBe('idle');
    expect(sim.effectiveEmotion.id).toBe('neutral');
    sim.dispose();
  });
});
