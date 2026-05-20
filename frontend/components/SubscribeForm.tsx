"use client";

import { FormEvent, useState } from "react";

/** UI label → stored in Postgres / scraper `brand` field */
const BRAND_OPTIONS = [
  { label: "Supreme", value: "Supreme" },
  { label: "Nike SNKRS", value: "Nike" },
  { label: "StockX", value: "StockX" },
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
      <div className="mx-auto max-w-lg rounded-xl bg-[#1a1a1a] p-6 ring-1 ring-zinc-800 sm:p-8">
        <p className="text-center text-lg font-medium leading-relaxed text-green-400">
          ✅ You&apos;re subscribed! You&apos;ll get email alerts for: {list}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl bg-[#1a1a1a] p-6 ring-1 ring-zinc-800 sm:p-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-300">Email address</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-700 bg-[#111] px-3 py-3 text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <p className="text-xs text-zinc-500">
          One field — email only. Alerts are sent when we detect a new drop for
          your brands.
        </p>

        <div>
          <p className="mb-3 text-sm font-medium text-zinc-300">
            Alert me for:
          </p>
          <div className="flex flex-wrap gap-2">
            {BRAND_OPTIONS.map(({ label, value }) => {
              const on = brandPrefs.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleBrand(value)}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    on
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-zinc-600 bg-transparent text-zinc-400 hover:border-zinc-500"
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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3.5 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
          <p className="text-center text-sm text-red-400">{error}</p>
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
