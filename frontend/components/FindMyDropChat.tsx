"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  brandBadgeClass,
  formatPrice,
  type DropRow,
} from "@/lib/dropDisplay";
import { dropsMentionedInResponse } from "@/lib/findDropMatch";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  matchedDrops?: DropRow[];
};

type Props = {
  drops: DropRow[];
};

const MAX_HISTORY = 4;

export function FindMyDropChat({ drops }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const panelEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    panelEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || streaming) return;

    setError(null);
    setInput("");
    setStreaming(true);
    setStreamText("");

    const history = messages.slice(-MAX_HISTORY);

    try {
      const res = await fetch("/api/find-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, drops, history }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }

      if (!res.body) {
        throw new Error("No response stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamText(full);
      }

      const matchedDrops = dropsMentionedInResponse(full, drops);

      setMessages((prev) => {
        const next: ChatMessage[] = [
          ...prev,
          { role: "user", content: query },
          { role: "assistant", content: full, matchedDrops },
        ];
        return next.slice(-MAX_HISTORY);
      });
      setStreamText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reach Find My Drop."
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {open ? (
        <div
          className="fixed bottom-24 right-4 z-50 flex w-[min(100vw-2rem,380px)] flex-col border-4 border-black bg-[#fff8f0] shadow-pop-lg sm:right-6"
          role="dialog"
          aria-label="Find My Drop chat"
        >
          <div className="flex items-center justify-between border-b-4 border-black bg-[#ffe600] px-4 py-3">
            <div>
              <p className="font-serif text-lg font-bold italic">Find My Drop</p>
              <p className="text-xs font-bold uppercase tracking-wide text-black/70">
                AI picks from live feed
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-2 border-black bg-white px-2 py-1 text-sm font-extrabold hover:bg-black hover:text-white"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && !streaming ? (
              <p className="font-serif text-sm italic text-neutral-600">
                Try &quot;Travis Scott collabs under $200&quot; or &quot;chunky
                retro runners in white&quot;
              </p>
            ) : null}

            {messages.map((msg, i) => (
              <div key={`${msg.role}-${i}`} className="flex flex-col gap-2">
                <div
                  className={`max-w-[95%] border-4 border-black px-3 py-2 text-sm font-medium leading-relaxed ${
                    msg.role === "user"
                      ? "ml-auto bg-[#2d5bff] text-white"
                      : "mr-auto bg-white"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "assistant" && msg.matchedDrops?.length ? (
                  <div className="flex flex-col gap-2">
                    {msg.matchedDrops.map((drop) => (
                      <DropMiniCard key={drop.id} drop={drop} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {streaming && streamText ? (
              <div className="mr-auto max-w-[95%] border-4 border-black bg-white px-3 py-2 text-sm font-medium leading-relaxed">
                {streamText}
                <span className="animate-pulse">▌</span>
              </div>
            ) : null}

            {streaming && !streamText ? (
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                Searching drops…
              </p>
            ) : null}

            {error ? (
              <p className="border-4 border-black bg-[#ff2d6f] px-3 py-2 text-xs font-bold text-white">
                {error}
              </p>
            ) : null}

            <div ref={panelEndRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="flex gap-2 border-t-4 border-black bg-white p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
              placeholder="Describe what you're looking for…"
              className="min-w-0 flex-1 border-4 border-black bg-[#fff8f0] px-3 py-2 text-sm font-medium placeholder:italic placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#ffe600]"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="shrink-0 border-4 border-black bg-[#ff2d6f] px-3 py-2 text-xs font-extrabold uppercase text-white hover:bg-[#e82663] disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 border-4 border-black bg-[#ffe600] px-4 py-3 font-extrabold uppercase tracking-wide shadow-pop transition hover:-translate-y-0.5 hover:shadow-pop-lg sm:right-6"
      >
        🔍 Find My Drop
      </button>
    </>
  );
}

function DropMiniCard({ drop }: { drop: DropRow }) {
  return (
    <a
      href={drop.product_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 border-4 border-black bg-white p-2 transition hover:bg-[#ffe600]"
    >
      <div className="h-14 w-14 shrink-0 border-2 border-black bg-[#ffe600]">
        {drop.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drop.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl">
            👟
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={`inline-block border border-black px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${brandBadgeClass(drop.brand)}`}
        >
          {drop.brand}
        </span>
        <p className="mt-1 line-clamp-2 text-xs font-bold leading-snug">
          {drop.name}
        </p>
        <p className="text-sm font-extrabold text-[#ff2d6f]">
          {formatPrice(drop.price)}
        </p>
      </div>
    </a>
  );
}
