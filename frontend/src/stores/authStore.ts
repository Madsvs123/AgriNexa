import { create } from "zustand";
import type { Organization, User } from "@/types";

export const REFRESH_KEY = "agrinexa_session";
const ORG_KEY = "agrinexa_org";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  organizations: Organization[];
  currentOrgId: string | null;
  bootstrapped: boolean;
  login: (payload: {
    access: string;
    refresh: string;
    user: User;
    organizations: Organization[];
  }) => void;
  logout: () => void;
  setOrg: (id: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setBootstrapped: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  organizations: [],
  currentOrgId: localStorage.getItem(ORG_KEY),
  bootstrapped: false,
  login: ({ access, refresh, user, organizations }) => {
    localStorage.setItem(REFRESH_KEY, refresh);
    const existing = get().currentOrgId;
    const orgId =
      (existing && organizations.some((o) => o.id === existing) ? existing : null) ??
      organizations[0]?.id ??
      null;
    if (orgId) localStorage.setItem(ORG_KEY, orgId);
    set({ user, accessToken: access, organizations, currentOrgId: orgId });
  },
  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ORG_KEY);
    set({ user: null, accessToken: null, organizations: [], currentOrgId: null, bootstrapped: true });
  },
  setOrg: (id) => {
    localStorage.setItem(ORG_KEY, id);
    set({ currentOrgId: id });
  },
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  setOrganizations: (organizations) => {
    const existing = get().currentOrgId;
    const orgId =
      (existing && organizations.some((o) => o.id === existing) ? existing : null) ??
      organizations[0]?.id ??
      null;
    if (orgId) localStorage.setItem(ORG_KEY, orgId);
    set({ organizations, currentOrgId: orgId });
  },
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
}));
