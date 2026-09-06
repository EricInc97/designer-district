"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { timeShort, relative } from "@/lib/format";
import type { TicketMessage } from "@/lib/types";

type Props = {
  ticketId: string;
  currentUserId: string;
  /** Staff messages render on the opposite side and carry the house badge. */
  asStaff: boolean;
  initialMessages: TicketMessage[];
  locked?: boolean;
};

export default function TicketChat({
  ticketId,
  currentUserId,
  asStaff,
  initialMessages,
  locked = false,
}: Props) {
  const [messages, setMessages] = useState<TicketMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live updates. Postgres changes on this ticket only, the filter runs
  // server-side, so other tickets never reach this client.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`ticket:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const incoming = payload.new as TicketMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: currentUserId,
        is_staff: asStaff,
        body,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setSending(false);
      return;
    }

    // Realtime usually beats this, so de-dupe on id rather than appending blind.
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, data as TicketMessage],
    );
    setDraft("");
    setSending(false);
  }

  return (
    <div className="flex h-[32rem] flex-col overflow-hidden rounded-xl border border-rule bg-paper-raised">
      <div
        ref={scrollRef}
        className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-ink-faint">
            No messages yet.
          </p>
        )}

        {messages.map((message) => {
          // "Mine" is by role, not by user id, every staff member shares a
          // side of the thread so the customer sees one consistent voice.
          const mine = asStaff ? message.is_staff : !message.is_staff;

          return (
            <div
              key={message.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%]">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    mine
                      ? "bg-ink text-paper rounded-br-sm"
                      : "bg-paper-sunken text-ink rounded-bl-sm"
                  }`}
                >
                  {message.body}
                </div>
                <p
                  className={`mt-1 text-[10px] text-ink-faint ${
                    mine ? "text-right" : "text-left"
                  }`}
                >
                  {message.is_staff && !asStaff && "Designer District · "}
                  <time dateTime={message.created_at} title={relative(message.created_at)}>
                    {timeShort(message.created_at)}
                  </time>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {locked ? (
        <p className="border-t border-rule px-5 py-4 text-center text-xs text-ink-faint">
          This ticket is closed. Open a new one if you still need help.
        </p>
      ) : (
        <form onSubmit={send} className="border-t border-rule p-3">
          {error && (
            <p role="alert" className="px-2 pb-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(e);
                }
              }}
              rows={1}
              placeholder="Write a message…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint transition-colors"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-paper hover:opacity-90 disabled:opacity-40 transition-colors"
              aria-label="Send message"
            >
              <SendHorizonal size={16} aria-hidden />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
