import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  CloudSun,
  Droplets,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Leaf,
  Map,
  MapPinned,
  Radio,
  Settings,
  Sprout,
  Tractor,
  ClipboardList,
  Warehouse,
  ChevronDown,
} from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

const main = [
  { to: "/home", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/map", label: "Farm map", icon: Map },
  { to: "/farms", label: "Farms", icon: MapPinned },
  { to: "/fields", label: "Fields", icon: Sprout },
];

const cropChildren = [
  { to: "/crops", label: "Catalog", end: true },
  { to: "/crops/plans", label: "Seasonal plans" },
  { to: "/crops/varieties", label: "Varieties" },
  { to: "/crops/seasons", label: "Seasons" },
  { to: "/crops/rotations", label: "Rotations" },
  { to: "/crops/budget", label: "Budget" },
];

const ops = [
  { to: "/sensors", label: "Sensors", icon: Radio },
  { to: "/irrigation", label: "Irrigation", icon: Droplets },
  { to: "/weather", label: "Weather", icon: CloudSun },
  { to: "/scouting", label: "Scouting", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Warehouse },
  { to: "/equipment", label: "Equipment", icon: Tractor },
];

const insight = [
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/tasks", label: "Tasks", icon: Activity },
  { to: "/documents", label: "Documents", icon: FolderOpen },
];

function LinkItem({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cn("nav-link", isActive && "active")} onClick={onClick}>
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const cropOpenDefault = location.pathname.startsWith("/crops");
  const settingsOpenDefault = location.pathname.startsWith("/settings");
  const [cropsOpen, setCropsOpen] = useState(cropOpenDefault);
  const [settingsOpen, setSettingsOpen] = useState(settingsOpenDefault);
  const close = () => setSidebarOpen(false);

  return (
    <>
      {sidebarOpen ? <div className="sidebar-backdrop" onClick={close} /> : null}
      <aside className={cn("sidebar", sidebarOpen && "open")}>
        <div className="sidebar-brand">
          <div className="sidebar-mark">
            <Leaf size={18} />
          </div>
          <div>
            <strong>AgriNexa</strong>
            <span>Operations</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Primary">
          <div className="nav-label">Overview</div>
          {main.map((item) => (
            <LinkItem key={item.to} {...item} onClick={close} />
          ))}
          <button type="button" className="nav-group-btn" onClick={() => setCropsOpen((v) => !v)}>
            <Sprout size={18} />
            Crops
            <span className="spacer" />
            <ChevronDown size={14} style={{ transform: cropsOpen ? "rotate(180deg)" : undefined }} />
          </button>
          {cropsOpen ? (
            <div className="nav-children">
              {cropChildren.map((c) => (
                <NavLink
                  key={c.to}
                  to={c.to}
                  end={c.end}
                  className={({ isActive }) => cn(isActive && "active")}
                  onClick={close}
                >
                  {c.label}
                </NavLink>
              ))}
            </div>
          ) : null}
          <div className="nav-label">Operations</div>
          {ops.map((item) => (
            <LinkItem key={item.to} {...item} onClick={close} />
          ))}
          <div className="nav-label">Records</div>
          {insight.map((item) => (
            <LinkItem key={item.to} {...item} onClick={close} />
          ))}
          <div className="nav-label">Admin</div>
          <button type="button" className="nav-group-btn" onClick={() => setSettingsOpen((v) => !v)}>
            <Settings size={18} />
            Settings
            <span className="spacer" />
            <ChevronDown size={14} style={{ transform: settingsOpen ? "rotate(180deg)" : undefined }} />
          </button>
          {settingsOpen ? (
            <div className="nav-children">
              {[
                ["/settings", "Overview"],
                ["/settings/organization", "Organization"],
                ["/settings/team", "Team"],
                ["/settings/roles", "Roles"],
                ["/settings/invitations", "Invitations"],
                ["/settings/access", "Farm access"],
                ["/settings/profile", "Profile"],
              ].map(([to, label]) => (
                <NavLink key={to} to={to} end={to === "/settings"} className={({ isActive }) => cn(isActive && "active")} onClick={close}>
                  {label}
                </NavLink>
              ))}
            </div>
          ) : null}
        </nav>
        <div className="sidebar-foot">Precision farming, unified.</div>
      </aside>
    </>
  );
}
