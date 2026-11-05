// Gerenciador de projetos: IndexedDB, duplicação e importação/exportação JSON (PRD §4, §9.1).
import { useRef, useState } from 'react';
import { exportProjectJson, triggerDownload } from '../../export/assetExporter';
import { MAX_IMPORT_BYTES } from '../../domain/project';
import { useStore } from '../context';
import { Button, Section } from '../controls';

export function ProjectPanel() {
  const { store, state } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const activeId = state.project.project.id;

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setErrors([]);
    if (file.size > MAX_IMPORT_BYTES) {
      setErrors(['Arquivo maior que 2 MB']);
      return;
    }
    const errs = await store.importProject(await file.text());
    setErrors(errs);
    if (errs.length) store.toast('error', 'Importação rejeitada: o arquivo não é um projeto válido.');
  };

  return (
    <div className="space-y-4">
      <Section title="Projeto atual">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="project-name" className="text-sm text-slate-300">
            Nome
          </label>
          <input
            id="project-name"
            data-testid="project-name"
            value={state.project.project.name}
            maxLength={80}
            onChange={(e) => store.renameProject(e.target.value)}
            className="w-44 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button testId="project-duplicate" onClick={() => void store.duplicateProject()}>
            Duplicar
          </Button>
          <Button testId="project-export-json-2" onClick={() => triggerDownload(exportProjectJson(store.project))}>
            Exportar JSON
          </Button>
          <Button testId="project-import" onClick={() => fileRef.current?.click()}>
            Importar JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            data-testid="project-import-input"
            className="hidden"
            onChange={(e) => {
              void onImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {errors.length > 0 && (
          <div role="alert" data-testid="import-errors" className="rounded-md border border-red-700 bg-red-950/50 p-2 text-xs text-red-200">
            <p className="mb-1 font-semibold">Importação rejeitada:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            {errors.length > 10 && <p>…e mais {errors.length - 10} erro(s).</p>}
          </div>
        )}
      </Section>

      <Section title="Novo projeto">
        <div className="flex gap-1.5">
          <input
            data-testid="project-new-name"
            value={newName}
            maxLength={80}
            placeholder="Nome do avatar"
            onChange={(e) => setNewName(e.target.value.replace(/[<>\u0000-\u001f]/g, ''))}
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
          <Button
            testId="project-new"
            variant="primary"
            onClick={() => {
              void store.newProject(newName);
              setNewName('');
            }}
          >
            Criar
          </Button>
        </div>
      </Section>

      <Section title={`Projetos salvos (${state.projects.length})`}>
        <ul data-testid="project-list" className="space-y-1">
          {state.projects.map((p) => (
            <li
              key={p.id}
              data-testid="project-item"
              data-active={p.id === activeId}
              className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm ${
                p.id === activeId ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800'
              }`}
            >
              <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => void store.selectProject(p.id)} data-testid={`project-open-${p.id}`}>
                {p.name}
                <span className="block text-xs text-slate-500">{new Date(p.updatedAt).toLocaleString('pt-BR')}</span>
              </button>
              <Button
                variant="ghost"
                testId={`project-delete-${p.id}`}
                title="Excluir projeto"
                onClick={() => {
                  if (window.confirm(`Excluir o projeto “${p.name}”? Esta ação não pode ser desfeita.`)) void store.deleteProject(p.id);
                }}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
        {!state.persistent && <p className="text-xs text-amber-300">Armazenamento local indisponível: exporte um backup em JSON.</p>}
      </Section>
    </div>
  );
}
