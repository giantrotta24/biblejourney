import { AppState, type AppStateStatus } from 'react-native';

type RefreshClient = {
  auth: {
    startAutoRefresh: () => Promise<void> | void;
    stopAutoRefresh: () => Promise<void> | void;
  };
};

export function listenForAuthRefresh(client: RefreshClient): () => void {
  const sync = (state: AppStateStatus) => {
    if (state === 'active') void client.auth.startAutoRefresh();
    else void client.auth.stopAutoRefresh();
  };
  const subscription = AppState.addEventListener('change', sync);
  sync(AppState.currentState === 'active' ? 'active' : 'background');
  return () => subscription.remove();
}
