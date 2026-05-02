import { useState, useEffect } from "react";
import { initGoogleAuth, signIn, signOut } from "./googleSheets";
import App from "./App.jsx";

function LoadingScreen() {
  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontFamily: "monospace", fontSize: 12 }}>
      …
    </div>
  );
}

function LoginScreen({ onSignIn }) {
  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: "#6366f1", textTransform: "uppercase", marginBottom: 8 }}>
          Chord Tone Mastery
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: "#f0f0f0", marginBottom: 28 }}>
          Practice Tracker
        </div>
        <button
          onClick={onSignIn}
          style={{ padding: "10px 22px", borderRadius: 6, border: "1px solid #2a2a4e", background: "#1a1a2e", color: "#a5b4fc", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}
        >
          Entrar con Google
        </button>
      </div>
    </div>
  );
}

export default function Root() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        initGoogleAuth(() => setAuthed(true));
        setReady(true);
      // Intenta login silencioso si ya autorizó antes
        if (localStorage.getItem("ctm-authed") === "true") {
          setTimeout(() => signIn(), 200);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  function handleSignIn() {
    localStorage.setItem("ctm-authed", "true");
    signIn();
  }

  function handleSignOut() {
    localStorage.removeItem("ctm-authed");
    signOut();
    setAuthed(false);
  }

  if (!ready) return <LoadingScreen />;
  if (!authed) return <LoginScreen onSignIn={handleSignIn} />;
  return <App onSignOut={handleSignOut} />;
}
