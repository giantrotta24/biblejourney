import {
  DEFAULT_SETTINGS,
  SETTINGS_LINK_KEY,
  isTheme,
  isTranslation,
  type KeyValueStorage,
  type ProfileFields,
  type ProfileRemote,
  type Settings,
  type SettingsLink,
  type SettingsStore,
  type Theme,
} from './settings';

type Deps = {
  store: SettingsStore;
  storage: KeyValueStorage | null;
  applyTheme: (theme: Theme) => void;
};

type Session = { userId: string; remote: ProfileRemote; reconciled: boolean };

export type ProfileSync = {
  signedIn(userId: string, remote: ProfileRemote): Promise<void>;
  signedOut(): void;
  changed(): Promise<void>;
  retry(): Promise<void>;
};

function fieldsOf(settings: Settings): ProfileFields {
  return { theme: settings.theme, link_translation: settings.linkTranslation };
}

export async function reconcileProfile({
  local,
  link,
  userId,
  remote,
  localTouched,
}: {
  local: Settings;
  link: SettingsLink;
  userId: string;
  remote: ProfileRemote;
  localTouched: boolean;
}): Promise<{ settings: Settings; link: SettingsLink }> {
  const anotherUser = link.user !== userId;
  if (link.dirty || (anotherUser && localTouched)) {
    await remote.save(fieldsOf(local));
    return { settings: local, link: { user: userId, dirty: false } };
  }

  const row = await remote.load();
  const linked = { user: userId, dirty: false };
  if (!row) {
    await remote.save(fieldsOf(local));
    return { settings: local, link: linked };
  }
  return {
    settings: {
      theme: isTheme(row.theme) ? row.theme : DEFAULT_SETTINGS.theme,
      linkTranslation: isTranslation(row.link_translation) ? row.link_translation : local.linkTranslation,
    },
    link: linked,
  };
}

export function createProfileSync({ store, storage, applyTheme }: Deps): ProfileSync {
  let active: Session | null = null;
  let running: Promise<void> | null = null;

  function readLink(): SettingsLink {
    try {
      const parsed = JSON.parse(storage?.getItem(SETTINGS_LINK_KEY) ?? 'null') as Partial<SettingsLink> | null;
      return { user: typeof parsed?.user === 'string' ? parsed.user : null, dirty: parsed?.dirty === true };
    } catch {
      return { user: null, dirty: false };
    }
  }

  function writeLink(link: SettingsLink) {
    try {
      storage?.setItem(SETTINGS_LINK_KEY, JSON.stringify(link));
    } catch {
      // The next sign-in reconciles again.
    }
  }

  async function reconcile(session: Session): Promise<boolean> {
    const snapshot = store.getSnapshot();
    const result = await reconcileProfile({
      local: snapshot,
      link: readLink(),
      userId: session.userId,
      remote: session.remote,
      localTouched: store.localTouched(),
    });
    if (active !== session) return false;
    if (store.getSnapshot() !== snapshot) {
      writeLink({ user: session.userId, dirty: true });
      return true;
    }
    store.replace(result.settings);
    applyTheme(result.settings.theme);
    writeLink(result.link);
    session.reconciled = true;
    return false;
  }

  async function upload(session: Session): Promise<boolean> {
    const link = readLink();
    if (link.user !== session.userId || !link.dirty) return false;
    const snapshot = store.getSnapshot();
    await session.remote.save(fieldsOf(snapshot));
    if (active !== session) return false;
    if (store.getSnapshot() !== snapshot) return true;
    writeLink({ user: session.userId, dirty: false });
    return false;
  }

  function retry(): Promise<void> {
    const session = active;
    if (!session) return Promise.resolve();
    running ??= (async () => {
      try {
        let again = true;
        while (again && active === session) {
          again = false;
          if (!session.reconciled) again = await reconcile(session);
          else again = await upload(session);
        }
      } catch {
        // The next retry, or the next sign-in, tries again.
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    async signedIn(userId, remote) {
      if (active?.userId !== userId) active = { userId, remote, reconciled: false };
      else active.remote = remote;
      await running;
      await retry();
    },
    signedOut() {
      active = null;
      writeLink({ user: null, dirty: false });
    },
    async changed() {
      const link = readLink();
      if (link.user) writeLink({ ...link, dirty: true });
      await running;
      await retry();
    },
    retry,
  };
}
