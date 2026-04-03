import { useState, useEffect, useRef } from "react";
import { storageGet, storageSet } from "./storage";
import { supabase } from "./supabase";
import { supabase } from "./supabase";

const CONCEPTS = [
  { id: 1, name: "3-Note Inversions Ascending", short: "3-inv ↑" },
  { id: 2, name: "3-Note Inversions Descending", short: "3-inv ↓" },
  { id: 3, name: "Alternating 4-Note Inversions", short: "4-inv alt" },
  { id: 4, name: "Single Skip Broken Lines", short: "Skip ×1" },
  { id: 5, name: "Double Skip Broken Lines", short: "Skip ×2" },
  { id: 6, name: "Diatonic Approach from Above", short: "Diat ↑" },
  { id: 7, name: "Chromatic Approach from Below", short: "Chrom ↓" },
  { id: 8, name: "Diatonic Above / Chromatic Below", short: "D↑ C↓" },
  { id: 9, name: "Chromatic Below / Diatonic Above", short: "C↓ D↑" },
  { id: 10, name: "Scale Passing Tone Drill", short: "Scale PT" },
  { id: 11, name: "Voice Leading + Upper Extensions", short: "Voice Lead" },
];

const CHORD_TYPES = ["m7","dom7","maj7","m7b5","dom7b9","mMaj7","dom7sus4","maj7#5","dom7#5"];
const KEYS = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const SR_INTERVALS = [1, 3, 7, 14, 30];
const CONFIDENCE_LABELS = ["—","Shaky","Okay","Solid","Locked"];
const CONFIDENCE_COLORS = ["#444","#ef4444","#f97316","#eab308","#22c55e"];
const STORAGE_KEY = "ctm-data-v2";

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function getDueLabel(dateStr, intervalIdx) {
  const ds = daysSince(dateStr);
  if (ds === null) return { label: "New", color: "#6366f1", urgent: false };
  const next = SR_INTERVALS[Math.min(intervalIdx ?? 0, SR_INTERVALS.length - 1)];
  const left = next - ds;
  if (left <= 0) return { label: "Due", color: "#ef4444", urgent: true };
  if (left === 1) return { label: "1d", color: "#f97316", urgent: false };
  if (left <= 3) return { label: `${left}d`, color: "#eab308", urgent: false };
  return { label: `${left}d`, color: "#22c55e", urgent: false };
}

function buildSeedData(existingData) {
  const today = new Date().toISOString();
  const d = { ...(existingData || {}), m7: { ...((existingData || {}).m7 || {}) } };
  for (let cid = 1; cid <= 6; cid++) {
    d.m7[cid] = { ...((d.m7[cid]) || {}) };
    KEYS.forEach(k => {
      d.m7[cid][k] = { confidence: 2, lastReviewed: today, intervalIdx: 1 };
    });
  }
  return d;
}

export default function CTMTracker({ user, onSignOut }) {
  const [activeChord, setActiveChord] = useState("m7");
  const [view, setView] = useState("review");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [showBackup, setShowBackup] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const importRef = useRef();

  useEffect(() => {
    (async () => {
      if (user) {
        // Load from Supabase
        const { data: row, error } = await supabase
          .from("practice_data")
          .select("data, updated_at")
          .eq("user_id", user.id)
          .single();
        if (row) {
          setData(row.data || {});
          setLastSaved(row.updated_at);
        } else {
          // First login — try to migrate localStorage data
          const raw = storageGet(STORAGE_KEY);
          if (raw) {
            try { const p = JSON.parse(raw); setData(p.data || {}); }
            catch { setData({}); }
          } else {
            setData({});
          }
        }
      } else {
        // Fallback: localStorage only
        const raw = storageGet(STORAGE_KEY);
        if (raw) {
          try { const p = JSON.parse(raw); setData(p.data || {}); setLastSaved(p.savedAt || null); }
          catch { setData({}); }
        } else {
          setData({});
        }
      }
      setLoading(false);
    })();
  }, [user]);

  async function save(newData) {
    setData(newData);
    const now = new Date().toISOString();

    if (user) {
      const { error } = await supabase
        .from("practice_data")
        .upsert({ user_id: user.id, data: newData, updated_at: now }, { onConflict: "user_id" });
      if (error) { showToast("⚠ Error al guardar"); return; }
    } else {
      const payload = { data: newData, savedAt: now };
      storageSet(STORAGE_KEY, JSON.stringify(payload));
    }
    setLastSaved(now);
  }

  function getEntry(chord, cid, key) {
    return data?.[chord]?.[cid]?.[key] || { confidence: 0, lastReviewed: null, intervalIdx: 0 };
  }

  function markReviewed(chord, cid, key, confidence) {
    const entry = getEntry(chord, cid, key);
    const newIdx = confidence >= 3
      ? Math.min((entry.intervalIdx ?? 0) + 1, SR_INTERVALS.length - 1)
      : 0;
    const nd = {
      ...data,
      [chord]: {
        ...(data[chord] || {}),
        [cid]: {
          ...(data[chord]?.[cid] || {}),
          [key]: { confidence, lastReviewed: new Date().toISOString(), intervalIdx: newIdx },
        },
      },
    };
    save(nd);
    showToast(confidence >= 3 ? "✓ Guardado" : "↩ Reset");
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ data, savedAt: lastSaved }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ctm-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ Backup descargado");
  }

  function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const p = JSON.parse(ev.target.result);
        save(p.data || p);
        showToast("✓ Importado");
        setShowBackup(false);
      } catch {
        showToast("⚠ Error al importar");
      }
    };
    reader.readAsText(file);
  }

  function getQueue(chord) {
    return CONCEPTS.map(c => {
      const due = KEYS.filter(k => {
        const e = getEntry(chord, c.id, k);
        const d = getDueLabel(e.lastReviewed, e.intervalIdx);
        return d.urgent || !e.lastReviewed;
      });
      return { concept: c, due, count: due.length };
    }).filter(x => x.count > 0);
  }

  function getProgress(chord) {
    let total = 0, done = 0, locked = 0;
    CONCEPTS.forEach(c => KEYS.forEach(k => {
      total++;
      const e = getEntry(chord, c.id, k);
      if (e.lastReviewed) done++;
      if (e.confidence >= 4) locked++;
    }));
    return { total, done, locked, pct: Math.round(done / total * 100) };
  }

  if (loading || !data) return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontFamily: "monospace" }}>
      cargando…
    </div>
  );

  const queue = getQueue(activeChord);
  const prog = getProgress(activeChord);

  const S = {
    page: { background: "#0a0a0f", minHeight: "100vh", fontFamily: "'Courier New',monospace", color: "#e0e0e0", padding: "24px 16px", maxWidth: 640, margin: "0 auto" },
    btn: (active, color = "#6366f1") => ({ padding: "5px 11px", borderRadius: 4, border: `1px solid ${active ? color : "#2a2a4e"}`, background: active ? "#1a1a2e" : "transparent", color: active ? "#a5b4fc" : "#888", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }),
    card: { border: "1px solid #2a2a4e", borderRadius: 8, overflow: "hidden", marginBottom: 7 },
    cardHead: { padding: "10px 14px", background: "#0f0f1a", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
    cardBody: { padding: "12px 14px", background: "#0a0a12" },
    dot: (conf) => ({ width: 5, height: 5, borderRadius: 1, background: conf && data ? CONFIDENCE_COLORS[conf] : "#2a2a4e" }),
    confBtn: (active, conf) => ({ flex: 1, padding: "5px 0", borderRadius: 4, border: `1px solid ${active ? CONFIDENCE_COLORS[conf] : "#2a2a4e"}`, background: active ? `${CONFIDENCE_COLORS[conf]}18` : "transparent", color: active ? CONFIDENCE_COLORS[conf] : "#666", cursor: "pointer", fontSize: 9, fontFamily: "monospace" }),
  };

  return (
    <div style={S.page}>
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#1a1a2e", border: "1px solid #6366f1", borderRadius: 8, padding: "10px 20px", color: "#a5b4fc", zIndex: 100, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "#6366f1", textTransform: "uppercase", marginBottom: 3 }}>Chord Tone Mastery</div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#f0f0f0" }}>Practice Tracker</h1>
          <div style={{ fontSize: 8, color: "#666", marginTop: 3 }}>
            {lastSaved
              ? `guardado ${new Date(lastSaved).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
              : "sin guardar"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button onClick={() => setShowBackup(!showBackup)} style={{ ...S.btn(showBackup), fontSize: 10 }}>backup ↕</button>
          {user && <button onClick={onSignOut} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #2a2a4e", background: "transparent", color: "#555", cursor: "pointer", fontSize: 9, fontFamily: "monospace" }}>sign out</button>}
        </div>
      </div>

      {/* Backup panel */}
      {showBackup && (
        <div style={{ marginBottom: 18, padding: 14, background: "#0f0f1a", borderRadius: 8, border: "1px solid #1a1a2e" }}>
          <div style={{ fontSize: 9, color: "#888", letterSpacing: 2, marginBottom: 10 }}>GESTIÓN DE DATOS</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <button onClick={exportData} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #22c55e40", background: "#0a1a0a", color: "#22c55e", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>↓ Exportar JSON</button>
            <button onClick={() => importRef.current.click()} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #6366f140", background: "#0a0a1a", color: "#6366f1", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>↑ Importar JSON</button>
            <button onClick={() => setConfirmSeed(true)} style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #f9731640", background: "#1a0a00", color: "#f97316", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>↺ Restaurar C1–6 m7</button>
            <input ref={importRef} type="file" accept=".json" onChange={importFile} style={{ display: "none" }} />
          </div>
          {confirmSeed && (
            <div style={{ marginTop: 10, padding: 10, background: "#1a0a00", borderRadius: 6, border: "1px solid #f9731630" }}>
              <div style={{ fontSize: 10, color: "#f97316", marginBottom: 8 }}>Restaurar C1–6 en m7 con confianza "Okay", revisado hoy. ¿Continuar?</div>
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={() => { save(buildSeedData(data)); setConfirmSeed(false); showToast("✓ C1–6 m7 restaurados"); }} style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid #f97316", background: "#f9731618", color: "#f97316", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>Sí</button>
                <button onClick={() => setConfirmSeed(false)} style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid #222", background: "transparent", color: "#444", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chord selector */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, color: "#888", letterSpacing: 3, textTransform: "uppercase", marginBottom: 7 }}>Chord Type</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {CHORD_TYPES.map(ct => (
            <button key={ct} onClick={() => setActiveChord(ct)} style={S.btn(activeChord === ct)}>{ct}</button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 18, padding: "11px 14px", background: "#0f0f1a", borderRadius: 8, border: "1px solid #1a1a2e" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 9 }}>
          <span style={{ color: "#aaa" }}>{activeChord}</span>
          <span style={{ color: "#6366f1" }}>{prog.done}/{prog.total} · {prog.locked} locked</span>
        </div>
        <div style={{ height: 3, background: "#111", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${prog.pct}%`, background: "linear-gradient(90deg,#6366f1,#a5b4fc)", transition: "width 0.4s" }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "#0f0f1a", borderRadius: 6, padding: 3, border: "1px solid #1a1a2e" }}>
        {[["review", "Hoy"], ["schedule", "Conceptos"], ["keys", "Tonalidades"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "7px 0", borderRadius: 4, background: view === v ? "#1a1a2e" : "transparent", border: view === v ? "1px solid #2a2a4e" : "1px solid transparent", color: view === v ? "#a5b4fc" : "#888", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>
            {label}
          </button>
        ))}
      </div>

      {/* VIEW: Hoy */}
      {view === "review" && (
        <div>
          {queue.length === 0
            ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 28, color: "#1a1a2e" }}>✓</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>Todo al día</div>
              </div>
            )
            : (
              <>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 10 }}>{queue.reduce((a, x) => a + x.count, 0)} combinaciones pendientes</div>
                {queue.map(({ concept, due }) => (
                  <div key={concept.id} style={S.card}>
                    <div style={S.cardHead} onClick={() => setSelectedConcept(selectedConcept === concept.id ? null : concept.id)}>
                      <span style={{ fontSize: 9, color: "#6366f1", minWidth: 18 }}>C{concept.id}</span>
                      <span style={{ fontSize: 11, color: "#ccc", flex: 1 }}>{concept.name}</span>
                      <span style={{ fontSize: 9, color: "#ef4444", background: "#1a0a0a", padding: "2px 6px", borderRadius: 3 }}>{due.length}</span>
                    </div>
                    {selectedConcept === concept.id && (
                      <div style={S.cardBody}>
                        {due.map(k => {
                          const e = getEntry(activeChord, concept.id, k);
                          return (
                            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #0f0f0f" }}>
                              <span style={{ width: 24, fontSize: 11, color: "#888", fontWeight: 700 }}>{k}</span>
                              <div style={{ display: "flex", gap: 3, flex: 1 }}>
                                {[1, 2, 3, 4].map(conf => (
                                  <button key={conf} onClick={() => markReviewed(activeChord, concept.id, k, conf)} style={S.confBtn(e.confidence === conf, conf)}>
                                    {CONFIDENCE_LABELS[conf]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )
          }
        </div>
      )}

      {/* VIEW: Conceptos */}
      {view === "schedule" && (
        <div>
          {CONCEPTS.map(c => {
            const stats = KEYS.map(k => {
              const e = getEntry(activeChord, c.id, k);
              return { k, e, due: getDueLabel(e.lastReviewed, e.intervalIdx) };
            });
            const dueCount = stats.filter(x => x.due.urgent || !x.e.lastReviewed).length;
            return (
              <div key={c.id} style={S.card}>
                <div style={S.cardHead} onClick={() => setSelectedConcept(selectedConcept === c.id ? null : c.id)}>
                  <span style={{ fontSize: 9, color: "#6366f1", minWidth: 18 }}>C{c.id}</span>
                  <span style={{ fontSize: 11, color: "#ccc", flex: 1 }}>{c.name}</span>
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    {dueCount > 0 && <span style={{ fontSize: 8, color: "#ef4444", marginRight: 4 }}>{dueCount}↑</span>}
                    {KEYS.map(k => {
                      const e = getEntry(activeChord, c.id, k);
                      return <div key={k} style={S.dot(e.lastReviewed ? e.confidence : 0)} />;
                    })}
                  </div>
                </div>
                {selectedConcept === c.id && (
                  <div style={{ ...S.cardBody, display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {stats.map(({ k, e, due }) => (
                      <div key={k} style={{ padding: "6px 8px", borderRadius: 4, border: `1px solid ${due.urgent ? "#ef444428" : "#1a1a2e"}`, background: due.urgent ? "#120808" : "#0f0f1a", minWidth: 64 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#ddd" }}>{k}</span>
                          <span style={{ fontSize: 7, color: due.color }}>{due.label}</span>
                        </div>
                        <div style={{ display: "flex", gap: 2 }}>
                          {[1, 2, 3, 4].map(conf => (
                            <button key={conf} onClick={ev => { ev.stopPropagation(); markReviewed(activeChord, c.id, k, conf); }} style={{ flex: 1, padding: "3px 0", borderRadius: 2, border: `1px solid ${e.confidence === conf ? CONFIDENCE_COLORS[conf] : "#1a1a2e"}`, background: e.confidence === conf ? `${CONFIDENCE_COLORS[conf]}18` : "transparent", color: e.confidence === conf ? CONFIDENCE_COLORS[conf] : "#666", cursor: "pointer", fontSize: 7, fontFamily: "monospace" }}>
                              {conf}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: Tonalidades */}
      {view === "keys" && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {KEYS.map(k => {
              const done = CONCEPTS.filter(c => getEntry(activeChord, c.id, k).lastReviewed).length;
              return (
                <button key={k} onClick={() => setSelectedKey(selectedKey === k ? null : k)} style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${selectedKey === k ? "#6366f1" : "#1a1a2e"}`, background: selectedKey === k ? "#1a1a2e" : "#0f0f1a", color: done === 11 ? "#22c55e" : done > 0 ? "#a5b4fc" : "#888", cursor: "pointer", fontFamily: "monospace", minWidth: 44 }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{k}</div>
                  <div style={{ fontSize: 7, color: "#888", marginTop: 2 }}>{done}/11</div>
                </button>
              );
            })}
          </div>
          {selectedKey && (
            <div style={S.card}>
              <div style={{ padding: "10px 14px", background: "#0f0f1a", fontSize: 11, color: "#a5b4fc", fontWeight: 700 }}>{selectedKey} — {activeChord}</div>
              {CONCEPTS.map(c => {
                const e = getEntry(activeChord, c.id, selectedKey);
                const due = getDueLabel(e.lastReviewed, e.intervalIdx);
                return (
                  <div key={c.id} style={{ padding: "8px 14px", borderTop: "1px solid #0f0f0f", display: "flex", alignItems: "center", gap: 8, background: "#0a0a12" }}>
                    <span style={{ fontSize: 8, color: "#6366f1", minWidth: 16 }}>C{c.id}</span>
                    <span style={{ fontSize: 10, color: "#aaa", flex: 1 }}>{c.short}</span>
                    <span style={{ fontSize: 7, color: due.color, minWidth: 24 }}>{due.label}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {[1, 2, 3, 4].map(conf => (
                        <button key={conf} onClick={() => markReviewed(activeChord, c.id, selectedKey, conf)} style={{ width: 28, padding: "3px 0", borderRadius: 3, border: `1px solid ${e.confidence === conf ? CONFIDENCE_COLORS[conf] : "#2a2a4e"}`, background: e.confidence === conf ? `${CONFIDENCE_COLORS[conf]}18` : "transparent", color: e.confidence === conf ? CONFIDENCE_COLORS[conf] : "#666", cursor: "pointer", fontSize: 7, fontFamily: "monospace" }}>
                          {CONFIDENCE_LABELS[conf][0]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 22, padding: "10px 14px", background: "#080808", borderRadius: 6, border: "1px solid #0f0f0f" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
          {[1, 2, 3, 4].map(c => (
            <span key={c} style={{ fontSize: 8, color: CONFIDENCE_COLORS[c] }}>{c} {CONFIDENCE_LABELS[c]}</span>
          ))}
        </div>
        <div style={{ fontSize: 7, color: "#666" }}>SR: 1→3→7→14→30d · Solid/Locked avanza · Shaky resetea</div>
      </div>
    </div>
  );
}
