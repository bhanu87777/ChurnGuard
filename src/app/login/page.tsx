"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@churnguard.app");
  const [password, setPassword] = useState("demo1234");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Registration failed");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) throw new Error("Invalid email or password");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand text-2xl text-brand-fg">
            ⚡
          </div>
          <h1 className="text-2xl font-semibold">
            Churn<span className="text-brand">Guard</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Spot at-risk customers before they cancel.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border bg-surface p-6"
        >
          {mode === "register" && (
            <Field
              label="Name"
              value={name}
              onChange={setName}
              type="text"
              placeholder="Your name"
            />
          )}
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="you@company.com"
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="••••••••"
          />

          {error && (
            <p className="rounded-md border border-high/30 bg-high/10 px-3 py-2 text-sm text-high">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-brand-fg transition hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>

          <p className="text-center text-sm text-muted">
            {mode === "login" ? "No account?" : "Already have one?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="text-brand hover:underline"
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Demo login is pre-filled — just click Sign in.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground outline-none transition focus:border-brand"
      />
    </label>
  );
}
