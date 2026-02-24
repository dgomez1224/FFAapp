import React, { useState } from "react";
import { getSupabaseFunctionHeaders, supabase, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [entryId, setEntryId] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Call your backend edge function to validate entry ID
    const res = await fetch(
      `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/register-entry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSupabaseFunctionHeaders(),
        },
        body: JSON.stringify({ email, entryId }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message || "Signup failed");
      return;
    }

    // Auto-login user via Supabase magic link
    const { error: supError } = await supabase.auth.signInWithOtp({ email });
    if (supError) {
      setError(supError.message);
      return;
    }

    alert("Check your email to complete login");
    navigate("/login");
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-lg">
      <h1 className="text-2xl mb-4">Sign Up</h1>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSignup} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="FPL Entry ID"
          value={entryId}
          onChange={(e) => setEntryId(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded"
        >
          Sign Up
        </button>
      </form>
    </div>
  );
}
