// Store da aplicação: projeto ativo, lista de projetos, preferências de visualização
// e salvamento automático. Fica fora do React; componentes assinam via useSyncExternalStore.
import { cloneProject, createDefaultProject, newId, parseProjectJson } from '../domain/project';
import type { Project } from '../domain/types';
import { openRepository, type ProjectRepository, type ProjectSummary } from '../storage/projectStore';

export type ViewMode = 'robot' | 'display' | 'pixel';
export type PixelScale = 1 | 2 | 4;

export interface ViewPrefs {
  mode: ViewMode;
  pixelScale: PixelScale;
  pixelGrid: boolean;
  showOverlays: boolean;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

export interface StudioState {
  ready: boolean;
  persistent: boolean;
  project: Project;
  projects: ProjectSummary[];
  view: ViewPrefs;
  saveStatus: SaveStatus;
  selectedAnimationId: string | null;
  toasts: Toast[];
}

const DEFAULT_VIEW: ViewPrefs = { mode: 'robot', pixelScale: 2, pixelGrid: true, showOverlays: true };
const SAVE_DEBOUNCE_MS = 300;

type Listener = () => void;

export class StudioStore {
  private state: StudioState;
  private listeners = new Set<Listener>();
  private repo: ProjectRepository | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private toastSeq = 0;

  constructor() {
    const project = createDefaultProject();
    this.state = {
      ready: false,
      persistent: true,
      project,
      projects: [],
      view: DEFAULT_VIEW,
      saveStatus: 'idle',
      selectedAnimationId: Object.keys(project.animations)[0] ?? null,
      toasts: [],
    };
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getState = (): StudioState => this.state;

  /** Acesso direto ao projeto atual, usado pelo laço de renderização sem passar pelo React. */
  get project(): Project {
    return this.state.project;
  }

  private set(patch: Partial<StudioState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  async init(repo?: ProjectRepository): Promise<void> {
    this.repo = repo ?? (await openRepository());
    const view = { ...DEFAULT_VIEW, ...((await this.repo.getMeta<Partial<ViewPrefs>>('view')) ?? {}) };
    const activeId = await this.repo.getMeta<string>('activeProjectId');
    let project = activeId ? await this.repo.get(activeId) : undefined;
    if (!project) {
      const list = await this.repo.list();
      project = list[0] ? await this.repo.get(list[0].id) : undefined;
    }
    if (!project) {
      project = createDefaultProject();
      await this.repo.put(project);
    }
    await this.repo.setMeta('activeProjectId', project.project.id);
    this.set({
      ready: true,
      persistent: this.repo.persistent,
      project,
      view,
      projects: await this.repo.list(),
      selectedAnimationId: Object.keys(project.animations)[0] ?? null,
    });
    if (!this.repo.persistent) {
      this.toast('error', 'IndexedDB indisponível: os projetos não serão salvos. Exporte um backup em JSON.');
    }
  }

  toast(kind: Toast['kind'], text: string): void {
    const t: Toast = { id: ++this.toastSeq, kind, text };
    this.set({ toasts: [...this.state.toasts, t].slice(-4) });
    setTimeout(() => this.dismissToast(t.id), kind === 'error' ? 7000 : 3500);
  }

  dismissToast(id: number): void {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  /** Aplica uma alteração ao projeto e agenda o salvamento automático. */
  update(mutator: (draft: Project) => void): void {
    const draft = cloneProject(this.state.project);
    mutator(draft);
    draft.project.updatedAt = new Date().toISOString();
    this.set({ project: draft, saveStatus: 'saving' });
    this.scheduleSave();
  }

  setView(patch: Partial<ViewPrefs>): void {
    const view = { ...this.state.view, ...patch };
    this.set({ view });
    void this.repo?.setMeta('view', view);
  }

  selectAnimation(id: string | null): void {
    this.set({ selectedAnimationId: id });
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.repo) return;
    try {
      await this.repo.put(this.state.project);
      this.set({ saveStatus: 'saved', projects: await this.repo.list() });
    } catch {
      this.set({ saveStatus: 'error' });
      this.toast('error', 'Falha ao salvar o projeto no IndexedDB.');
    }
  }

  private async activate(project: Project): Promise<void> {
    if (!this.repo) return;
    await this.repo.put(project);
    await this.repo.setMeta('activeProjectId', project.project.id);
    this.set({
      project,
      projects: await this.repo.list(),
      saveStatus: 'saved',
      selectedAnimationId: Object.keys(project.animations)[0] ?? null,
    });
  }

  async newProject(name: string): Promise<void> {
    await this.flush();
    await this.activate(createDefaultProject(name.trim() || 'Novo avatar'));
  }

  async duplicateProject(): Promise<void> {
    await this.flush();
    const copy = cloneProject(this.state.project);
    const now = new Date().toISOString();
    copy.project = { id: newId('alfred'), name: `${copy.project.name} (cópia)`.slice(0, 80), createdAt: now, updatedAt: now };
    await this.activate(copy);
  }

  async selectProject(id: string): Promise<void> {
    if (!this.repo || id === this.state.project.project.id) return;
    await this.flush();
    const p = await this.repo.get(id);
    if (p) await this.activate(p);
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.repo) return;
    await this.repo.delete(id);
    const list = await this.repo.list();
    if (id === this.state.project.project.id) {
      const next = list[0] ? await this.repo.get(list[0].id) : undefined;
      await this.activate(next ?? createDefaultProject());
    } else {
      this.set({ projects: list });
    }
  }

  renameProject(name: string): void {
    const clean = name.replace(/[<>\u0000-\u001f\u007f]/g, '').slice(0, 80);
    if (!clean.trim()) return;
    this.update((d) => {
      d.project.name = clean;
    });
  }

  /** Importa um projeto JSON. Retorna a lista de erros (vazia em caso de sucesso). */
  async importProject(text: string): Promise<string[]> {
    const result = parseProjectJson(text);
    if (!result.ok) return result.errors;
    const p = result.project;
    if (this.repo && (await this.repo.get(p.project.id))) {
      p.project.id = newId('alfred');
      p.project.name = `${p.project.name} (importado)`.slice(0, 80);
    }
    await this.flush();
    await this.activate(p);
    this.toast('success', result.migrated ? 'Projeto importado e migrado para o schema atual.' : 'Projeto importado.');
    return [];
  }

  exportJson(): string {
    return JSON.stringify(this.state.project, null, 2);
  }
}
