export interface AccessCheck {
  allowed(userId: string): Promise<boolean>;
}

export function memoryAccess(users: Iterable<string> | "everyone" = []): AccessCheck {
  const everyone = users === "everyone";
  const invited = new Set(everyone ? [] : users);
  return {
    async allowed(userId) {
      return everyone || invited.has(userId);
    },
  };
}
