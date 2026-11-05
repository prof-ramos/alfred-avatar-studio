import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Simulator } from '../runtime/simulator';
import type { StudioStore } from '../runtime/studioStore';

interface Ctx {
  store: StudioStore;
  sim: Simulator;
}

const StudioContext = createContext<Ctx | null>(null);

export function StudioProvider({ store, sim, children }: Ctx & { children: ReactNode }) {
  return <StudioContext.Provider value={{ store, sim }}>{children}</StudioContext.Provider>;
}

function useCtx(): Ctx {
  const c = useContext(StudioContext);
  if (!c) throw new Error('StudioProvider ausente');
  return c;
}

export function useStore() {
  const { store } = useCtx();
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { store, state };
}

export function useSim() {
  const { sim } = useCtx();
  const snap = useSyncExternalStore(sim.subscribe, sim.getSnapshot);
  return { sim, snap };
}

export function useDiag() {
  const { sim } = useCtx();
  return useSyncExternalStore(sim.subscribeDiag, sim.getDiagSnapshot);
}

export function useSimRef(): Simulator {
  return useCtx().sim;
}
