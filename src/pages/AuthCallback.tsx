import React, { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        navigate("/login");
        return;
      }
      navigate("/dashboard");
    };
    handleAuth();
  }, [navigate]);

  return <p className="text-center mt-16">Signing you in…</p>;
}
