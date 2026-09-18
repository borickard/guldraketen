"use client";

import { useMemo, useState } from "react";
import { Tag, DEFAULT_TAG_TYPES, TAG_COLORS, chipTextColor } from "./tagTypes";

interface Props {
  videoUrls: string[];
  tags: Tag[];
  videoTags: Record<string, string[]>;
  onClose: () => void;
  onChange: () => void; // refetch tags + video-tags in parent
}

type TriState = "all" | "some" | "none";

export default function TagPicker({ videoUrls, tags, videoTags, onClose, onChange }: Props) {
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState(DEFAULT_TAG_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const knownTypes = useMemo(() => {
    const set = new Set<string>(DEFAULT_TAG_TYPES);
    for (const t of tags) set.add(t.type);
    return Array.from(set);
  }, [tags]);

  const grouped = useMemo(() => {
    const byType = new Map<string, Tag[]>();
    for (const t of tags) {
      (byType.get(t.type) ?? byType.set(t.type, []).get(t.type)!).push(t);
    }
    // Stable order: defaults first, then custom types alphabetically.
    const order = [...DEFAULT_TAG_TYPES, ...[...byType.keys()].filter((t) => !DEFAULT_TAG_TYPES.includes(t)).sort()];
    return order.filter((t) => byType.has(t)).map((type) => ({ type, list: byType.get(type)! }));
  }, [tags]);

  function stateFor(tagId: string): TriState {
    let has = 0;
    for (const u of videoUrls) if ((videoTags[u] ?? []).includes(tagId)) has++;
    if (has === 0) return "none";
    if (has === videoUrls.length) return "all";
    return "some";
  }

  async function toggle(tag: Tag) {
    if (busyTag) return;
    const cur = stateFor(tag.id);
    const action = cur === "all" ? "remove" : "add";
    setBusyTag(tag.id);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.id, video_urls: videoUrls, action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fel");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunde inte uppdatera");
    } finally {
      setBusyTag(null);
    }
  }

  async function createAndAssign(e: React.FormEvent) {
    e.preventDefault();
    const type = (newType === "__custom__" ? customType : newType).trim();
    const name = newName.trim();
    if (!name || !type) return;
    setCreating(true);
    setErr(null);
    try {
      const color = TAG_COLORS[(tags.length + 1) % TAG_COLORS.length];
      const res = await fetch("/api/dashboard/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunde inte skapa tagg");
      // Assign the new tag to the targets immediately.
      await fetch("/api/dashboard/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: data.id, video_urls: videoUrls, action: "add" }),
      });
      setNewName("");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunde inte skapa tagg");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="tp-backdrop" onClick={onClose} role="presentation" />
      <div className="tp-modal" role="dialog" aria-modal="true" aria-label="Tagga inlägg">
        <header className="tp-head">
          <h2 className="tp-title">
            Tagga {videoUrls.length === 1 ? "inlägg" : `${videoUrls.length} inlägg`}
          </h2>
          <button type="button" className="tp-close" onClick={onClose} aria-label="Stäng">×</button>
        </header>

        <div className="tp-body">
          {grouped.length === 0 && <p className="tp-empty">Inga taggar ännu — skapa en nedan.</p>}
          {grouped.map(({ type, list }) => (
            <div key={type} className="tp-group">
              <p className="tp-group-label">{type}</p>
              <div className="tp-tags">
                {list.map((tag) => {
                  const st = stateFor(tag.id);
                  const bg = tag.color ?? "#8A8A8A";
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`tp-tag tp-tag--${st}`}
                      style={st !== "none" ? { background: bg, color: chipTextColor(bg), borderColor: bg } : { borderColor: bg, color: "#1C1B19" }}
                      onClick={() => toggle(tag)}
                      disabled={busyTag === tag.id}
                    >
                      {st === "all" ? "✓ " : st === "some" ? "– " : ""}{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <form className="tp-create" onSubmit={createAndAssign}>
          <p className="tp-create-label">Skapa ny tagg</p>
          <div className="tp-create-row">
            <input
              className="tp-input"
              type="text"
              placeholder="Taggnamn"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
            />
            <select className="tp-select" value={newType} onChange={(e) => setNewType(e.target.value)} disabled={creating}>
              {knownTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Ny typ…</option>
            </select>
            {newType === "__custom__" && (
              <input
                className="tp-input tp-input--type"
                type="text"
                placeholder="Typnamn"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                disabled={creating}
              />
            )}
            <button type="submit" className="tp-add-btn" disabled={creating || !newName.trim()}>
              {creating ? "Skapar…" : "Skapa & tagga"}
            </button>
          </div>
        </form>

        {err && <p className="tp-err">{err}</p>}
      </div>
    </>
  );
}

const css = `
  .tp-backdrop { position: fixed; inset: 0; background: rgba(28,27,25,0.55); z-index: 200; }
  .tp-modal {
    position: fixed; inset: 8vh 50% auto auto; transform: translateX(50%);
    width: min(560px, 92vw); max-height: 84vh; display: flex; flex-direction: column;
    background: #EBE7E2; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: 201; overflow: hidden; font-family: 'Barlow', sans-serif; color: #1C1B19;
  }
  .tp-head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.3rem; background: #fff; border-bottom: 1px solid rgba(28,27,25,0.1); }
  .tp-title { font-family: 'Barlow Condensed', sans-serif; font-size: 1.35rem; font-weight: 700; line-height: 1; }
  .tp-close { background: none; border: 0; font-size: 26px; line-height: 1; color: #888; cursor: pointer; width: 32px; height: 32px; border-radius: 4px; }
  .tp-close:hover { background: rgba(28,27,25,0.06); color: #1C1B19; }
  .tp-body { flex: 1; overflow-y: auto; padding: 1rem 1.3rem; }
  .tp-empty { font-size: 13px; color: rgba(28,27,25,0.55); }
  .tp-group { margin-bottom: 1rem; }
  .tp-group-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(28,27,25,0.55); font-weight: 700; margin-bottom: 0.4rem; }
  .tp-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tp-tag {
    font-family: 'Barlow', sans-serif; font-size: 12.5px; font-weight: 600;
    padding: 0.35rem 0.7rem; border-radius: 999px; border: 1.5px solid; background: #fff;
    cursor: pointer; transition: opacity 0.12s;
  }
  .tp-tag:disabled { opacity: 0.5; cursor: default; }
  .tp-tag--none { background: #fff; }
  .tp-create { background: #fff; border-top: 1px solid rgba(28,27,25,0.1); padding: 0.9rem 1.3rem; }
  .tp-create-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(28,27,25,0.55); font-weight: 700; margin-bottom: 0.5rem; }
  .tp-create-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .tp-input { flex: 1; min-width: 120px; font-family: 'Barlow', sans-serif; font-size: 13px; padding: 0.5rem 0.7rem; background: #fff; border: 1.5px solid rgba(28,27,25,0.15); border-radius: 4px; color: #1C1B19; outline: none; }
  .tp-input--type { flex: 0 0 130px; }
  .tp-input:focus { border-color: #1C1B19; }
  .tp-select { font-family: 'Barlow', sans-serif; font-size: 13px; padding: 0.5rem 0.6rem; background: #fff; border: 1.5px solid rgba(28,27,25,0.15); border-radius: 4px; color: #1C1B19; cursor: pointer; }
  .tp-add-btn { font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; padding: 0.5rem 0.9rem; background: #1C1B19; color: #EDF8FB; border: 0; border-radius: 4px; cursor: pointer; }
  .tp-add-btn:disabled { opacity: 0.5; cursor: default; }
  .tp-err { color: #b03030; font-size: 12.5px; padding: 0.5rem 1.3rem 0.9rem; background: #fff; margin: 0; }
`;
