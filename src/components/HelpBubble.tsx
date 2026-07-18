import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BDC_HELP_QUICK_QUESTIONS } from "@/lib/app-knowledge";
import { askAppHelp } from "@/lib/app-help.server";

type HelpMessage = { role: "user" | "assistant"; content: string };

const OPENER: HelpMessage = {
  role: "assistant",
  content:
    "Hi! Ask me anything about this app. For example what a screen does, what a status on your idea means, or when a change shows up on the phone.",
};

// Always-available floating help chat, bottom right on every signed-in screen.
export function HelpBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HelpMessage[]>([OPENER]);
  const [input, setInput] = useState("");

  const ask = useMutation({
    mutationFn: (next: HelpMessage[]) =>
      // The opener is UI-only; the server sees the real conversation.
      askAppHelp({ data: { messages: next.slice(1).slice(-10) } }),
    onSuccess: (result) =>
      setMessages((current) => [...current, { role: "assistant", content: result.message }]),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Help is unavailable right now."),
  });

  function send() {
    sendQuestion(input);
  }

  function sendQuestion(value: string) {
    const text = value.trim();
    if (!text || ask.isPending) return;
    const next: HelpMessage[] = [...messages, { role: "user", content: text.slice(0, 1000) }];
    setMessages(next);
    setInput("");
    ask.mutate(next);
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        aria-label="Open app help"
        title="Questions about this app? Ask here."
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full border border-primary/30 p-0 shadow-lg"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[75vh] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <span className="text-sm font-semibold">App help</span>
          <p className="text-[11px] text-muted-foreground">Ask what a screen, status, or task means.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setOpen(false)}
          aria-label="Close help"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2">
            {BDC_HELP_QUICK_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => sendQuestion(question)}
                className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                {question}
              </button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {ask.isPending && (
          <div className="flex justify-start" role="status" aria-label="Help is thinking">
            <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">…</div>
          </div>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-border p-2"
      >
        <input
          aria-label="Your question about the app"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about the app…"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none"
          maxLength={1000}
        />
        <Button type="submit" size="sm" disabled={ask.isPending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
