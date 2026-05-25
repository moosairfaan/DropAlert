"use client";

import { FormEvent, useState } from "react";

import { BRAND_OPTIONS, labelForBrand } from "@/lib/brands";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [brandPrefs, setBrandPrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [welcomeWarning, setWelcomeWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleBrand(value: string) {
    setBrandPrefs((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setWelcomeWarning(null);

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

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        welcomeEmailSent?: boolean;
      };

      if (res.ok) {
        setSuccess(true);
        if (data.welcomeEmailSent === false) {
          setWelcomeWarning(
            "You're subscribed, but we couldn't send a confirmation email. Check spam or try again later."
          );
        }
        return;
      }

      const msg =
        data.error ??
        data.detail ??
        `Request failed (${res.status}). Check your connection and try again.`;
      setError(msg);
    } catch {
      setError(
        "Could not reach the server. If you're testing locally, run npm run dev from the frontend folder."
      );
    } finally {
      setLoading(false);
    }
  }

  const submitDisabled =
    loading || !email.trim() || brandPrefs.length === 0;

  if (success) {
    const list = brandPrefs.map(labelForBrand).join(", ");
    return (
      <div className="mx-auto max-w-lg border-4 border-black bg-[#00d4aa] p-6 shadow-pop sm:p-8">
        <p className="font-serif text-xl font-bold italic text-black">
          You&apos;re in.
        </p>
        <p className="mt-2 text-sm font-bold leading-relaxed text-black">
          Email alerts for: {list}
        </p>
        <p className="mt-3 text-sm font-medium text-black/80">
          Check your inbox for a confirmation email from DropAlert.
        </p>
        {welcomeWarning ? (
          <p className="mt-3 text-sm font-bold text-[#ff2d6f]">{welcomeWarning}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg border-4 border-black bg-white p-6 shadow-pop sm:p-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="font-serif text-lg font-bold italic text-black">
            Your email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border-4 border-black bg-[#fff8f0] px-3 py-3 text-base font-bold text-black placeholder:font-normal placeholder:italic placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#ffe600]"
          />
        </label>
        <p className="text-xs font-medium italic text-neutral-600">
          One field. We email you when we spot a new drop for your brands.
        </p>

        <div>
          <p className="mb-3 font-sans text-sm font-extrabold uppercase tracking-wide text-black">
            Alert me for
          </p>
          <div className="flex flex-wrap gap-2">
            {BRAND_OPTIONS.map(({ label, value, on }) => {
              const selected = brandPrefs.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleBrand(value)}
                  className={`rounded-lg border-4 px-3 py-2 text-sm font-extrabold transition-transform ${
                    selected
                      ? `${on} -translate-y-0.5`
                      : "border-black bg-white text-black hover:bg-[#ffe600]"
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
          className="flex w-full items-center justify-center gap-2 border-4 border-black bg-[#ff2d6f] py-3.5 font-extrabold uppercase tracking-wide text-white shadow-pop transition hover:bg-[#e82663] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner />
              <span>Subscribing…</span>
            </>
          ) : (
            "Get alerts"
          )}
        </button>

        {error ? (
          <p className="text-center text-sm font-bold text-[#ff2d6f]">{error}</p>
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
