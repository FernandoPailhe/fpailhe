import { getLocalUserId } from "../infrastructure/identity";

/** Identidad local anónima (segura en SSR: cae a un id en memoria). */
export function useCurrentUser() {
  return { userId: getLocalUserId(), isAnonymous: true, status: "ready" as const };
}
