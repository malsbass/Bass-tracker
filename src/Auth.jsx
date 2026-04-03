import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account.");
    }

    setLoading(false);
  }

  const S = {
    page: { background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", padding: 24 },
    box: { width: "100%", maxWidth: 360, border: "1px solid #1a1a2e", borderRadius: 12, padding: 32, background: "#0f0f1a" },
    label: { display: "block", fontSize: 9, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
    input: { width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #2a2a4e", background: "#0a0a12", color: "#e0e0e0", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box", outline: "none" },
    btn: { width: "100%", padding: "10px 0", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, fontFamily: "monospace", cursor: "pointer", marginTop: 8 },
    toggle: { background: "none", border: "none", color: "#6366f1", fontSize: 10, fontFamily: "monospace", cursor: "pointer", padding: 0 },
  };

  return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: "#6366f1", textTransform: "uppercase", marginBottom: 4 }}>Chord Tone Mastery</div>
        <h1 style={{ margin: "0 0 28px", fontSize: 17, fontWeight: 700, color: "#f0f0f0" }}>Practice Tracker</h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Password</label>
            <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <div style={{ fontSize: 10, color: "#ef4444", marginBottom: 12 }}>{error}</div>}
          {message && <div style={{ fontSize: 10, color: "#22c55e", marginBottom: 12 }}>{message}</div>}

          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <span style={{ fontSize: 10, color: "#555" }}>
            {mode === "login" ? "No account? " : "Already have one? "}
          </span>
          <button style={S.toggle} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMessage(null); }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
