"use client";

import { FormEvent, useState } from "react";

const BRAND_OPTIONS = [
  { label: "Supreme", value: "Supreme", on: "border-rose-400 bg-rose-500 text-white ring-rose-300" },
  { label: "Nike SNKRS", value: "Nike", on: "border-violet-400 bg-violet-600 text-white ring-violet-300" },
  { label: "StockX", value: "StockX", on: "border-emerald-400 bg-emerald-500 text-white ring-emerald-300" },
] as const;

function labelForValue(value: string): string {
  const opt = BRAND_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [brandPrefs, setBrandPrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleBrand(value: string) {
    setBrandPrefs((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (brandPrefs.length === 0) {
      setError("Select at least one brand.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          brandPrefs,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.status === 200) {
        setSuccess(true);
        return;
      }

      if (res.status === 400) {
        setError(data.error ?? "Invalid request.");
        return;
      }

      setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const submitDisabled = loading || !email.trim();

  if (success) {
    const list = brandPrefs.map(labelForValue).join(", ");
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-gradient-to-br from-emerald-50 to-cyan-50 p-6 ring-2 ring-emerald-300 sm:p-8">
        <p className="text-center text-lg font-bold leading-relaxed text-emerald-700">
          ✅ You&apos;re subscribed! You&apos;ll get email alerts for: {list}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-inner ring-2 ring-violet-100 sm:p-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-bold text-violet-800">Email address</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border-2 border-violet-200 bg-violet-50/50 px-3 py-3 font-medium text-violet-950 placeholder:text-violet-400 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
        </label>
        <p className="text-xs font-medium text-violet-600/80">
          One field — email only. We email you when we spot a new drop for your
          brands.
        </p>

        <div>
          <p className="mb-3 text-sm font-bold text-violet-800">Alert me for:</p>
          <div className="flex flex-wrap gap-2">
            {BRAND_OPTIONS.map(({ label, value, on }) => {
              const selected = brandPrefs.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleBrand(value)}
                  className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                    selected
                      ? `${on} ring-2 scale-105`
                      : "border-violet-200 bg-violet-50 text-violet-600 hover:border-violet-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 via-violet-600 to-cyan-500 py-3.5 font-bold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner />
              <span>Subscribing...</span>
            </>
          ) : (
            "Start Getting Email Alerts"
          )}
        </button>

        {error ? (
          <p className="text-center text-sm font-semibold text-rose-600">{error}</p>
        ) : null}
      </form>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
