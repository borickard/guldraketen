"use client";

import { useMemo, useState } from "react";
import { Tag, DEFAULT_TAG_TYPES, TAG_COLORS } from "./tagTypes";

interface Props {
  tags: Tag[];
  onClose: () => void;
  onChange: () => void;
}

export default function TagManager({ tags, onClose, onChange }: Props) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState(DEFAULT_TAG_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const knownTypes = useMemo(() => {
    const set = new Set<string>(DEFAULT_TAG_TYPES);
    for (const t of tags) set.add(t.type);
    return Array.from(set);
  }, [tags]);

  const grouped = useMemo(() => {
    const byType = new Map<string, Tag[]>();
    for (const t of tags) (byType.get(t.type) ?? byType.set(t.type, []).get(t.type)!).push(t);
    const order = [...DEFAULT_TAG_TYPES, ...[...byType.keys()].filter((t) => !DEFAULT_TAG_TYPES.includes(t)).sort()];
    return order.filter((t) => byType.has(t)).map((type) => ({ type, list: byType.get(type)! }));
  }, [tags]);

  async function patch(id: string, payload: Record<string, string>) {
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fel");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunde inte uppdatera");
    }
  }

  async function remove(tag: Tag) {
    if (!window.confirm(`Ta bort taggen "${tag.name}"? Den tas bort från alla inlägg.`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tag.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fel");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunde inte ta bort");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const type = (newType === "__custom__" ? customType : newType).trim();
    const name = newName.trim();
    if (!name || !type) return;
    setBusy(true);
    setErr(null);
    try {
      const color = TAG_COLORS[tags.length % TAG_COLORS.length];
      const res = await fetch("/api/dashboard/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, color }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Kunde inte skapa");
      setNewName("");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunde inte skapa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="tm-backdrop" onClick={onClose} role="presentation" />
      <div className="tm-modal" role="dialog" aria-modal="true" aria-label="Hantera taggar">
        <header className="tm-head">
          <h2 className="tm-title">Hantera taggar</h2>
          <button type="button" className="tm-close" onClick={onClose} aria-label="Stäng">×</button>
        </header>

        <div className="tm-body">
          {grouped.length === 0 && <p className="tm-empty">Inga taggar ännu.</p>}
          {grouped.map(({ type, list }) => (
            <div key={type} className="tm-group">
              <p className="tm-group-label">{type}</p>
              {list.map((tag) => (
                <div key={tag.id} className="tm-row">
                  <button
                    type="button"
                    className="tm-swatch"
                    style={{ background: tag.color ?? "#8A8A8A" }}
                    title="Byt färg"
                    onClick={() => {
                      const idx = TAG_COLORS.indexOf(tag.color ?? "");
                      const next = TAG_COLORS[(idx + 1) % TAG_COLORS.length];
                      patch(tag.id, { color: next });
                    }}
                  />
                  <input
                    className="tm-name"
                    defaultValue={tag.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== tag.name) patch(tag.id, { name: v });
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  <button type="button" className="tm-del" onClick={() => remove(tag)} aria-label="Ta bort">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <form className="tm-create" onSubmit={create}>
          <p className="tm-create-label">Ny tagg</p>
          <div className="tm-create-row">
            <input className="tm-input" type="text" placeholder="Taggnamn" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={busy} />
            <select className="tm-select" value={newType} onChange={(e) => setNewType(e.target.value)} disabled={busy}>
              {knownTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Ny typ…</option>
            </select>
            {newType === "__custom__" && (
              <input className="tm-input tm-input--type" type="text" placeholder="Typnamn" value={customType} onChange={(e) => setCustomType(e.target.value)} disabled={busy} />
            )}
            <button type="submit" className="tm-add" disabled={busy || !newName.trim()}>{busy ? "Skapar…" : "Skapa"}</button>
          </div>
        </form>

        {err && <p className="tm-err">{err}</p>}
      </div>
    </>
  );
}

const css = `
  .tm-backdrop { position: fixed; inset: 0; background: rgba(28,27,25,0.55); z-index: 200; }
  .tm-modal {
    position: fixed; inset: 8vh 50% auto auto; transform: translateX(50%);
    width: min(520px, 92vw); max-height: 84vh; display: flex; flex-direction: column;
    background: #EBE7E2; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: 201; overflow: hidden; font-family: 'Barlow', sans-serif; color: #1C1B19;
  }
  .tm-head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.3rem; background: #fff; border-bottom: 1px solid rgba(28,27,25,0.1); }
  .tm-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.35rem; font-weight: 700; line-height: 1; }
  .tm-close { background: none; border: 0; font-size: 26px; line-height: 1; color: #888; cursor: pointer; width: 32px; height: 32px; border-radius: 4px; }
  .tm-close:hover { background: rgba(28,27,25,0.06); color: #1C1B19; }
  .tm-body { flex: 1; overflow-y: auto; padding: 1rem 1.3rem; }
  .tm-empty { font-size: 13px; color: rgba(28,27,25,0.55); }
  .tm-group { margin-bottom: 1rem; }
  .tm-group-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(28,27,25,0.55); font-weight: 700; margin-bottom: 0.4rem; }
  .tm-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 5px; }
  .tm-swatch { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid rgba(28,27,25,0.2); cursor: pointer; flex-shrink: 0; }
  .tm-name { flex: 1; font-family: 'Barlow', sans-serif; font-size: 13.5px; padding: 0.4rem 0.6rem; background: #fff; border: 1.5px solid rgba(28,27,25,0.12); border-radius: 4px; color: #1C1B19; outline: none; }
  .tm-name:focus { border-color: #1C1B19; }
  .tm-del { background: none; border: 0; color: #999; cursor: pointer; padding: 4px; border-radius: 4px; display: inline-flex; }
  .tm-del:hover { color: #b03030; background: rgba(176,48,48,0.08); }
  .tm-create { background: #fff; border-top: 1px solid rgba(28,27,25,0.1); padding: 0.9rem 1.3rem; }
  .tm-create-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(28,27,25,0.55); font-weight: 700; margin-bottom: 0.5rem; }
  .tm-create-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .tm-input { flex: 1; min-width: 120px; font-family: 'Barlow', sans-serif; font-size: 13px; padding: 0.5rem 0.7rem; background: #fff; border: 1.5px solid rgba(28,27,25,0.15); border-radius: 4px; color: #1C1B19; outline: none; }
  .tm-input--type { flex: 0 0 130px; }
  .tm-input:focus { border-color: #1C1B19; }
  .tm-select { font-family: 'Barlow', sans-serif; font-size: 13px; padding: 0.5rem 0.6rem; background: #fff; border: 1.5px solid rgba(28,27,25,0.15); border-radius: 4px; color: #1C1B19; cursor: pointer; }
  .tm-add { font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; padding: 0.5rem 0.9rem; background: #1C1B19; color: #EDF8FB; border: 0; border-radius: 4px; cursor: pointer; }
  .tm-add:disabled { opacity: 0.5; cursor: default; }
  .tm-err { color: #b03030; font-size: 12.5px; padding: 0.5rem 1.3rem 0.9rem; background: #fff; margin: 0; }
`;
