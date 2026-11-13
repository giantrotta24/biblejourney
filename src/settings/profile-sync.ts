import { profileFields, reconcileProfile, type KeyValueStorage, type ProfileRemote, type SettingsLink, type SettingsStore, type Theme } from "./settings";

export const LINK_KEY = "bible-journey:settings-link";

type Deps = { store: SettingsStore; storage: KeyValueStorage | null; timezone: () => string; applyTheme: (theme: Theme) => void };
type Session = { userId: string; remote: ProfileRemote; reconciled: boolean };

export type ProfileSync = {
  signedIn(userId: string, remote: ProfileRemote): Promise<void>;
  signedOut(): void;
  changed(): Promise<void>;
  retry(): Promise<void>;
};

export function createProfileSync({ store, storage, timezone, applyTheme }: Deps): ProfileSync {
  let active: Session | null = null;
  let running: Promise<void> | null = null;

  function readLink(): SettingsLink {
    try {
      const parsed = JSON.parse(storage?.getItem(LINK_KEY) ?? "null") as Partial<SettingsLink> | null;
      return { user: typeof parsed?.user === "string" ? parsed.user : null, dirty: parsed?.dirty === true };
    } catch {
      return { user: null, dirty: false };
    }
  }

  function writeLink(link: SettingsLink) {
    try {
      storage?.setItem(LINK_KEY, JSON.stringify(link));
    } catch {}
  }

  async function reconcile(session: Session) {
    const result = await reconcileProfile({ local: store.getSnapshot(), link: readLink(), userId: session.userId, timezone: timezone(), remote: session.remote });
    if (active !== session) return;
    store.replace(result.settings);
    applyTheme(result.settings.theme);
    writeLink(result.link);
    session.reconciled = true;
  }

  async function upload(session: Session) {
    const link = readLink();
    if (link.user !== session.userId || !link.dirty) return;
    await session.remote.save(profileFields(store.getSnapshot(), timezone()));
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
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    async signedIn(userId, remote) {
      if (active?.userId !== userId) active = { userId, remote, reconciled: false };
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
