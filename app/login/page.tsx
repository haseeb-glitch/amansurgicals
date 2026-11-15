"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") || "/";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (res.ok && data.ok) {
        router.push(returnTo);
        router.refresh();
      } else {
        setError(data.error || "Login failed. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8f7f5",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "2.5rem",
          backgroundColor: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#1a5c3a",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              color: "#1a1a1a",
              margin: "0 0 0.25rem",
            }}
          >
            Aman Surgical
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#888", margin: 0 }}>
            Enter your access key to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="password"
            style={{
              display: "block",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#444",
              marginBottom: "0.375rem",
            }}
          >
            Access Key
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter access key"
            autoFocus
            required
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              fontSize: "0.9375rem",
              border: "1.5px solid #ddd",
              borderRadius: 10,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#1a5c3a")}
            onBlur={(e) => (e.target.style.borderColor = "#ddd")}
          />

          {error && (
            <p
              style={{
                color: "#d32f2f",
                fontSize: "0.8125rem",
                margin: "0.5rem 0 0",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: "100%",
              marginTop: "1.25rem",
              padding: "0.75rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#fff",
              backgroundColor:
                loading || !password ? "#8aab9a" : "#1a5c3a",
              border: "none",
              borderRadius: 10,
              cursor: loading || !password ? "not-allowed" : "pointer",
              transition: "background-color 0.15s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
