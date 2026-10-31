import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { platformApi } from "@/api/client";
import { useUiStore } from "@/stores/uiStore";

export function SearchPalette() {
  const open = useUiStore((s) => s.commandPalette);
  const setOpen = useUiStore((s) => s.setCommandPalette);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const searchQ = useQuery({
    queryKey: ["search", q],
    queryFn: () => platformApi.search(q),
    enabled: open && q.trim().length > 1,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const groups = useMemo(() => {
    const data = searchQ.data;
    if (!data) return [];
    return [
      { label: "Farms", items: (data.farms ?? []).map((x) => ({ id: x.id, name: x.name, to: `/farms/${x.id}` })) },
      { label: "Fields", items: (data.fields ?? []).map((x) => ({ id: x.id, name: x.name, to: `/fields/${x.id}` })) },
      {
        label: "Equipment",
        items: (data.equipment ?? []).map((x) => ({ id: x.id, name: x.name, to: `/equipment/${x.id}` })),
      },
      {
        label: "Inventory",
        items: (data.inventory ?? []).map((x) => ({ id: x.id, name: x.name, to: `/inventory/${x.id}` })),
      },
      { label: "Tasks", items: (data.tasks ?? []).map((x) => ({ id: x.id, name: x.title, to: "/tasks" })) },
    ].filter((g) => g.items.length);
  }, [searchQ.data]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={() => setOpen(false)} role="presentation">
      <div className="palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <input
          className="input palette-input"
          autoFocus
          placeholder="Search North Ridge, Planter 12, MAP 11-52-0…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) {
              setOpen(false);
              navigate(`/search?q=${encodeURIComponent(q)}`);
            }
          }}
        />
        <div className="palette-results">
          {q.trim().length < 2 ? (
            <p className="muted" style={{ padding: 16 }}>
              Type at least two characters, or press Enter for the full search page.
            </p>
          ) : null}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="group-label">{g.label}</div>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setOpen(false);
                    navigate(item.to);
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ))}
          {searchQ.isFetched && q.trim().length > 1 && !groups.length ? (
            <p className="muted" style={{ padding: 16 }}>
              No matches for “{q}”. Try a farm code, SKU, or field name.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
