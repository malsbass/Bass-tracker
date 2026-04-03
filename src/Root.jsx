import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth.jsx";
import App from "./App.jsx";

export default function Root() {
  const [user, setUser] = useState(undefined); // undefined = still loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (user === undefined) return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontFamily: "monospace", fontSize: 12 }}>
      …
    </div>
  );

  if (!user) return <Auth />;

  return <App user={user} onSignOut={handleSignOut} />;
}
