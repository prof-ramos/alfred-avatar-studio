import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Simulator } from './runtime/simulator';
import { StudioStore } from './runtime/studioStore';
import { installTestBridge } from './testBridge';
import { App } from './ui/App';
import { StudioProvider } from './ui/context';

const store = new StudioStore();
const sim = new Simulator(store);
installTestBridge(sim, store);

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <div className="flex min-h-screen items-center justify-center bg-page text-fg-2">Carregando o estúdio…</div>,
);

void store.init().then(() => {
  const rt = store.project.runtime;
  sim.setEmotion({ id: rt.defaultEmotion, intensity: rt.defaultEmotion === 'neutral' ? 1 : 0.8 });
  if (rt.defaultState !== 'idle') sim.forceState(rt.defaultState);
  sim.syncAudioSettings();
  document.documentElement.dataset.ready = 'true';
  root.render(
    <StrictMode>
      <StudioProvider store={store} sim={sim}>
        <App />
      </StudioProvider>
    </StrictMode>,
  );
});
