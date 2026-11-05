import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createDefaultProject } from '../domain/project';
import { openRepository } from '../storage/projectStore';
import { StudioStore } from './studioStore';

beforeEach(() => {
  // Banco limpo a cada teste.
  globalThis.indexedDB = new IDBFactory();
});

describe('persistência de projetos (IndexedDB)', () => {
  it('recupera o projeto após "recarregar" a página', async () => {
    const a = new StudioStore();
    await a.init();
    a.update((d) => {
      d.avatar.parameters.eyes.width = 77;
      d.avatar.primaryColor = '#FF0000';
    });
    a.setView({ mode: 'pixel', pixelScale: 4 });
    await a.flush();

    const b = new StudioStore();
    await b.init();
    expect(b.project.avatar.parameters.eyes.width).toBe(77);
    expect(b.project.avatar.primaryColor).toBe('#FF0000');
    expect(b.getState().view.mode).toBe('pixel');
    expect(b.getState().view.pixelScale).toBe(4);
  });

  it('cria, duplica, alterna e exclui projetos', async () => {
    const s = new StudioStore();
    await s.init();
    const firstId = s.project.project.id;
    await s.newProject('Segundo');
    s.update((d) => (d.avatar.parameters.mouth.width = 99));
    await s.duplicateProject();
    expect(s.project.project.name).toBe('Segundo (cópia)');
    expect(s.project.avatar.parameters.mouth.width).toBe(99);
    expect(s.getState().projects).toHaveLength(3);

    await s.selectProject(firstId);
    expect(s.project.avatar.parameters.mouth.width).toBe(42);
    await s.deleteProject(firstId);
    expect(s.getState().projects).toHaveLength(2);
    expect(s.project.project.id).not.toBe(firstId);
  });

  it('importa preservando a integridade e renomeia em caso de colisão', async () => {
    const s = new StudioStore();
    await s.init();
    const original = createDefaultProject('Importável', 'importavel-1');
    original.avatar.parameters.eyes.shape = 'softRect';
    expect(await s.importProject(JSON.stringify(original))).toEqual([]);
    expect(s.project).toEqual(original);

    expect(await s.importProject(JSON.stringify(original))).toEqual([]);
    expect(s.project.project.id).not.toBe('importavel-1');
    expect(s.project.project.name).toContain('(importado)');
  });

  it('rejeita importação inválida sem alterar o projeto atual', async () => {
    const s = new StudioStore();
    await s.init();
    const before = s.project;
    const errors = await s.importProject('{"schemaVersion":2,"project":{"id":"x","name":"<script>"}}');
    expect(errors.length).toBeGreaterThan(0);
    expect(s.project).toBe(before);
  });

  it('usa armazenamento em memória quando o IndexedDB falta', async () => {
    const saved = globalThis.indexedDB;
    // @ts-expect-error simulação de ambiente sem IndexedDB
    delete globalThis.indexedDB;
    const repo = await openRepository();
    expect(repo.persistent).toBe(false);
    globalThis.indexedDB = saved;
  });
});
