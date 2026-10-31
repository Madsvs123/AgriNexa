import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronDown, Menu, Search } from "lucide-react";
import { authApi, cropsApi, platformApi } from "@/api/client";
import { REFRESH_KEY, useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { displayName, fromNow, initials } from "@/lib/utils";
import { NotificationPanel } from "./NotificationPanel";

export function OrgSwitcher() {
  const orgs = useAuthStore((s) => s.organizations);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const setOrg = useAuthStore((s) => s.setOrg);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = orgs.find((o) => o.id === currentOrgId);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="menu-trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox">
        <span className="hide-sm">{current?.name ?? "Organization"}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="dropdown-panel" role="listbox">
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              className={o.id === currentOrgId ? "dropdown-item active" : "dropdown-item"}
              onClick={() => {
                setOrg(o.id);
                setOpen(false);
              }}
            >
              {o.id === currentOrgId ? <Check size={14} /> : null}
              {o.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Topbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandPalette = useUiStore((s) => s.setCommandPalette);
  const seasonId = useUiStore((s) => s.seasonId);
  const setSeasonId = useUiStore((s) => s.setSeasonId);
  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const seasonsQ = useQuery({
    queryKey: ["seasons"],
    queryFn: () => cropsApi.seasons(),
  });
  const notifQ = useQuery({
    queryKey: ["notifications"],
    queryFn: () => platformApi.notifications(),
  });
  const unread = (notifQ.data?.results ?? []).some((n) => !n.is_read);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!userRef.current?.contains(e.target as Node)) setUserOpen(false);
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header className="topbar">
      <button type="button" className="icon-btn mobile-only" onClick={toggleSidebar} aria-label="Open navigation">
        <Menu size={20} />
      </button>
      <button type="button" className="search-trigger" onClick={() => setCommandPalette(true)}>
        <Search size={16} />
        <span>Search fields, equipment, inventory…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="topbar-tools">
        <OrgSwitcher />
        <label className="sr-only" htmlFor="season-filter">
          Season
        </label>
        <select
          id="season-filter"
          className="select"
          style={{ width: 150, height: 40 }}
          value={seasonId ?? ""}
          onChange={(e) => setSeasonId(e.target.value || null)}
        >
          <option value="">All seasons</option>
          {(seasonsQ.data?.results ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="bell-wrap dropdown" ref={bellRef}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => setBellOpen((v) => !v)}
          >
            <Bell size={18} />
            {unread ? <span className="bell-dot" /> : null}
          </button>
          {bellOpen ? (
            <div className="dropdown-panel" style={{ width: 340, padding: 0 }}>
              <NotificationPanel
                items={(notifQ.data?.results ?? []).slice(0, 8)}
                onSeeAll={() => {
                  setBellOpen(false);
                  navigate("/notifications");
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="dropdown" ref={userRef}>
          <button type="button" className="menu-trigger" onClick={() => setUserOpen((v) => !v)}>
            <span className="avatar">{initials(user?.first_name, user?.last_name, user?.email)}</span>
            <span className="hide-sm">{displayName(user?.first_name, user?.last_name, user?.email)}</span>
            <ChevronDown size={14} />
          </button>
          {userOpen ? (
            <div className="dropdown-panel">
              <button type="button" className="dropdown-item" onClick={() => navigate("/settings/profile")}>
                Farmer profile
              </button>
              <button type="button" className="dropdown-item" onClick={() => navigate("/settings/organization")}>
                Organization
              </button>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  const refresh = localStorage.getItem(REFRESH_KEY);
                  if (refresh) void authApi.logout(refresh).catch(() => undefined);
                  logout();
                  navigate("/signin");
                }}
              >
                Sign out
              </button>
              <div className="muted" style={{ padding: "8px 10px", fontSize: 12 }}>
                {user?.email} · joined {fromNow(user?.date_joined)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
