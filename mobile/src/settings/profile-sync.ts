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
}: {
  local: Settings;
  link: SettingsLink;
  userId: string;
  remote: ProfileRemote;
}): Promise<{ settings: Settings; link: SettingsLink }> {
  if (link.user !== userId || link.dirty) {
    await remote.save(fieldsOf(local));
    return { settings: local, link: { user: userId, dirty: false } };
  }

  const row = await remote.load();
  if (!row) {
    await remote.save(fieldsOf(local));
    return { settings: local, link };
  }
  return {
    settings: {
      theme: isTheme(row.theme) ? row.theme : DEFAULT_SETTINGS.theme,
      linkTranslation: isTranslation(row.link_translation) ? row.link_translation : local.linkTranslation,
    },
    link,
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

  async function reconcile(session: Session) {
    const result = await reconcileProfile({
      local: store.getSnapshot(),
      link: readLink(),
      userId: session.userId,
      remote: session.remote,
    });
    if (active !== session) return;
    store.replace(result.settings);
    applyTheme(result.settings.theme);
    writeLink(result.link);
    session.reconciled = true;
  }

  async function upload(session: Session) {
    const link = readLink();
    if (link.user !== session.userId || !link.dirty) return;
    await session.remote.save(fieldsOf(store.getSnapshot()));
    if (active === session) writeLink({ user: session.userId, dirty: false });
  }

  function retry(): Promise<void> {
    const session = active;
    if (!session) return Promise.resolve();
    running ??= (async () => {
      try {
        if (!session.reconciled) await reconcile(session);
        else await upload(session);
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
