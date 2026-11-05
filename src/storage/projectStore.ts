// ProjectManager (camada de persistência): IndexedDB via `idb` (PRD §7.2, §10 RF-09).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project } from '../domain/types';

const DB_NAME = 'alfred-avatar-studio';
const DB_VERSION = 1;

interface StudioDB extends DBSchema {
  projects: { key: string; value: Project };
  meta: { key: string; value: unknown };
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | undefined>;
  put(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  readonly persistent: boolean;
}

function summarize(p: Project): ProjectSummary {
  return { id: p.project.id, name: p.project.name, updatedAt: p.project.updatedAt };
}

class IdbRepository implements ProjectRepository {
  readonly persistent = true;
  constructor(private readonly db: IDBPDatabase<StudioDB>) {}

  async list() {
    const all = await this.db.getAll('projects');
    return all.map(summarize).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  get(id: string) {
    return this.db.get('projects', id);
  }
  async put(project: Project) {
    await this.db.put('projects', project, project.project.id);
  }
  async delete(id: string) {
    await this.db.delete('projects', id);
  }
  async getMeta<T>(key: string) {
    return (await this.db.get('meta', key)) as T | undefined;
  }
  async setMeta(key: string, value: unknown) {
    await this.db.put('meta', value, key);
  }
}

/** Alternativa em memória quando o IndexedDB não está disponível (ex.: navegação privada restrita). */
export class MemoryRepository implements ProjectRepository {
  readonly persistent = false;
  private projects = new Map<string, Project>();
  private meta = new Map<string, unknown>();

  async list() {
    return [...this.projects.values()].map(summarize).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  async get(id: string) {
    const p = this.projects.get(id);
    return p ? (JSON.parse(JSON.stringify(p)) as Project) : undefined;
  }
  async put(project: Project) {
    this.projects.set(project.project.id, JSON.parse(JSON.stringify(project)) as Project);
  }
  async delete(id: string) {
    this.projects.delete(id);
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta(key: string, value: unknown) {
    this.meta.set(key, value);
  }
}

export async function openRepository(): Promise<ProjectRepository> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB indisponível');
    // Sem keyPath: a chave é informada explicitamente em put() (project.project.id).
    const db = await openDB<StudioDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects');
        if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta');
      },
    });
    return new IdbRepository(db);
  } catch {
    return new MemoryRepository();
  }
}
