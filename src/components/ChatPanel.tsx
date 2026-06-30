"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  loading?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChatContext = Record<string, any>;

const SUGGESTED_QUESTIONS = [
  "Summarize the financial health",
  "What are the biggest risks in recent news?",
  "Has debt been increasing?",
  "Any politician trades worth noting?",
];

export function ChatPanel({
  ticker,
  onClose,
}: {
  ticker: string;
  onClose: () => void;
}) {
  const [context, setContext] = useState<ChatContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch data snapshot once on open
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chat/context?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) { setContextError(data.error); return; }
        setContext(data);
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: `I have a fresh data snapshot for **${data.companyName}** (${ticker}). Ask me anything about the financials, recent news, or disclosed politician trades — I'll cite my sources.`,
            sources: [],
          },
        ]);
      })
      .catch(() => {
        if (!cancelled) setContextError("Failed to load company data. Try again.");
      });
    return () => { cancelled = true; };
  }, [ticker]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !context || sending) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };
      const thinkingMsg: ChatMessage = {
        id: "thinking",
        role: "assistant",
        content: "",
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setInput("");
      setSending(true);

      // Build the message array to send (exclude the greeting, exclude loading)
      const history = [...messages.filter((m) => m.id !== "greeting" && !m.loading), userMsg];

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker,
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
              sources: m.sources,
            })),
            context,
          }),
        });

        const data = await res.json();
        setMessages((prev) => [
          ...prev.filter((m) => !m.loading),
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply || data.error || "Sorry, no response generated.",
            sources: data.sources ?? [],
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev.filter((m) => !m.loading),
          {
            id: `a-err-${Date.now()}`,
            role: "assistant",
            content: "Network error — please try again.",
            sources: [],
          },
        ]);
      } finally {
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [context, messages, sending, ticker]
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const companyName = (context?.companyName as string | undefined) || ticker;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed bottom-24 right-4 z-40 flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        width: "clamp(320px, 90vw, 400px)",
        height: "clamp(400px, 70vh, 560px)",
        borderColor: `rgb(var(--t-border) / 0.8)`,
        backgroundColor: `rgb(var(--t-card))`,
      }}
      data-testid="chat-panel"
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-3"
        style={{ borderColor: `rgb(var(--t-border) / 0.5)` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono"
            style={{
              background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.6))`,
              color: `rgb(var(--t-bg))`,
            }}
          >
            AI
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: `rgb(var(--t-text))` }}>
              Ask about {companyName}
            </div>
            <div className="text-[10px]" style={{ color: `rgb(var(--t-muted))` }}>
              {context ? `Data loaded · ${ticker}` : contextError ? "Error loading data" : "Loading data…"}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-sm transition hover:bg-t-border/20"
          style={{ color: `rgb(var(--t-muted))` }}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
      >
        {/* Context loading / error */}
        {!context && !contextError && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <div
              className="h-8 w-8 rounded-full border-2 animate-spin"
              style={{
                borderColor: `rgb(var(--t-border))`,
                borderTopColor: `rgb(var(--t-accent))`,
              }}
            />
            <p className="text-xs" style={{ color: `rgb(var(--t-muted))` }}>
              Fetching {ticker} data snapshot…
            </p>
          </div>
        )}

        {contextError && (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: `rgb(var(--t-danger) / 0.3)`,
              backgroundColor: `rgb(var(--t-danger) / 0.08)`,
              color: `rgb(var(--t-danger))`,
            }}
          >
            {contextError}
          </div>
        )}

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={msg.role === "assistant" ? "assistant-message" : "user-message"}
            >
              <div
                className={`max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}
              >
                {/* Bubble */}
                <div
                  className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.8))`,
                          color: `rgb(var(--t-bg))`,
                        }
                      : {
                          backgroundColor: `rgb(var(--t-surface))`,
                          border: `1px solid rgb(var(--t-border) / 0.6)`,
                          color: `rgb(var(--t-text))`,
                        }
                  }
                >
                  {msg.loading ? (
                    <span
                      className="flex items-center gap-1.5 py-0.5"
                      style={{ color: `rgb(var(--t-muted))` }}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ backgroundColor: `rgb(var(--t-muted))` }} />
                      <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ backgroundColor: `rgb(var(--t-muted))` }} />
                      <span className="inline-block h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ backgroundColor: `rgb(var(--t-muted))` }} />
                    </span>
                  ) : (
                    renderContent(msg.content)
                  )}
                </div>

                {/* Source citations */}
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-0.5" data-testid="chat-sources">
                    {msg.sources.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          borderColor: `rgb(var(--t-accent) / 0.25)`,
                          backgroundColor: `rgb(var(--t-accent) / 0.06)`,
                          color: `rgb(var(--t-accent))`,
                        }}
                      >
                        ↗ {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Suggested questions — only shown before any user message */}
        {context && messages.filter((m) => m.role === "user").length === 0 && (
          <div className="pt-1 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide px-0.5" style={{ color: `rgb(var(--t-dim))` }}>
              Try asking
            </p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="block w-full text-left rounded-xl border px-3 py-2 text-xs transition hover-card"
                style={{
                  borderColor: `rgb(var(--t-border) / 0.6)`,
                  backgroundColor: `rgb(var(--t-surface))`,
                  color: `rgb(var(--t-muted))`,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={onSubmit}
        className="flex shrink-0 items-center gap-2 border-t px-3 py-3"
        style={{ borderColor: `rgb(var(--t-border) / 0.5)` }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
          }}
          placeholder={context ? `Ask about ${ticker}…` : "Loading data…"}
          disabled={!context || sending}
          className="flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition"
          style={{
            borderColor: `rgb(var(--t-border))`,
            color: `rgb(var(--t-text))`,
          }}
          onFocus={(e) => {
            (e.target as HTMLElement).style.borderColor = `rgb(var(--t-accent) / 0.6)`;
            (e.target as HTMLElement).style.boxShadow = `0 0 0 2px rgb(var(--t-accent) / 0.1)`;
          }}
          onBlur={(e) => {
            (e.target as HTMLElement).style.borderColor = `rgb(var(--t-border))`;
            (e.target as HTMLElement).style.boxShadow = ``;
          }}
        />
        <button
          type="submit"
          disabled={!context || !input.trim() || sending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40"
          style={{
            background: `linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent) / 0.7))`,
            color: `rgb(var(--t-bg))`,
          }}
          aria-label="Send"
        >
          {sending ? (
            <span className="h-3.5 w-3.5 rounded-full border-2 animate-spin"
              style={{ borderColor: `rgb(var(--t-bg) / 0.3)`, borderTopColor: `rgb(var(--t-bg))` }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M13 1L1 5.5L6 7M13 1L8.5 13L6 7M13 1L6 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>

      {/* Disclaimer */}
      <div
        className="shrink-0 border-t px-3 py-1.5 text-center text-[9px]"
        style={{
          borderColor: `rgb(var(--t-border) / 0.4)`,
          color: `rgb(var(--t-dim))`,
        }}
      >
        Research only · not financial advice · answers based solely on cited data
      </div>
    </motion.div>
  );
}

// Lightweight markdown-ish renderer: **bold**, newlines → <br>
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        return (
          <span key={i}>
            {p.split("\n").map((line, j, arr) => (
              <span key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}
