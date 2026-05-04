"use client";

import { useEffect, useRef, memo } from "react";
import type { StoredMessage } from "@/lib/messages/store";
import { MODEL_MAP } from "@/lib/ai/models";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ProviderMark } from "@/components/brand/provider-mark";

interface MessageListProps {
  messages: StoredMessage[];
  isLoading: boolean;
  error?: Error;
  onSendPrompt?: (text: string) => void;
}

export function MessageList({ messages, isLoading, error, onSendPrompt }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  // Show sender names only when more than one human is talking. For
  // single-user threads we keep the cleaner unattributed bubble.
  const distinctSenders = new Set<string>();
  for (const m of messages) {
    if (m.role === 'user' && m.userId) distinctSenders.add(m.userId);
  }
  const showSenders = distinctSenders.size >= 2;

  if (messages.length === 0 && !error) {
    return <EmptyState onSendPrompt={onSendPrompt} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-9">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} showSender={showSenders} />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <LoadingIndicator />
        )}
        {error && <ErrorMessage error={error} />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ message, showSender }: { message: StoredMessage; showSender: boolean }) {
  const isUser = message.role === "user";
  const text = message.content;
  const senderInitial = (message.senderName?.[0] || 'U').toUpperCase();
  const model = !isUser && message.modelUsed ? MODEL_MAP.get(message.modelUsed!) : null;

  // Editorial layout: a left rail carries the speaker (model dot or
  // user initial) and the body sits in a hairline-bordered passage with
  // a small mono caption above. No rounded balloons — closer to a
  // printed exchange than a chat app.
  return (
    <article className="grid grid-cols-[28px_1fr] gap-x-4 items-start">
      {/* Left rail */}
      <div className="flex flex-col items-center pt-[3px]">
        {isUser ? (
          <div className="h-6 w-6 rounded-full border border-foreground/80 bg-foreground flex items-center justify-center shrink-0">
            <span className="text-[9px] font-semibold tracking-[0.05em] text-background">
              {showSender && message.senderName ? senderInitial : 'You'.slice(0, 1)}
            </span>
          </div>
        ) : (
          <div className="h-6 w-6 rounded-full border border-border bg-background flex items-center justify-center shrink-0">
            {model ? (
              <ProviderMark provider={model.provider} size={12} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0">
        <div className="mono mb-1.5 text-muted-foreground/80">
          {isUser ? (showSender && message.senderName ? message.senderName : 'You') : (model?.name ?? 'Assistant')}
        </div>
        <div className={cn(
          "text-[0.95rem] leading-[1.6]",
          isUser ? "text-foreground" : "text-foreground/90"
        )}>
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          ) : (
            <MarkdownContent content={text} />
          )}
        </div>
      </div>
    </article>
  );
});

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-background/50 rounded px-1.5 py-0.5 text-xs font-mono" {...props}>
                {children}
              </code>
            );
          }
          const language = className?.replace("language-", "") || "";
          return (
            <div className="my-2 rounded-lg overflow-hidden border border-border/50">
              {language && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-background/30 border-b border-border/50">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{language}</span>
                  <CopyButton text={String(children)} />
                </div>
              )}
              <pre className="overflow-x-auto p-3 bg-background/20">
                <code className="text-xs font-mono leading-relaxed" {...props}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/30 pl-3 italic text-muted-foreground my-2">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-border/50">{children}</thead>,
        th: ({ children }) => <th className="text-left px-2 py-1.5 font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1.5 border-t border-border/30">{children}</td>,
        hr: () => <hr className="my-3 border-border/30" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text.replace(/\n$/, ""));
  };

  return (
    <button
      onClick={handleCopy}
      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
    >
      Copy
    </button>
  );
}

function ErrorMessage({ error }: { error: Error }) {
  const message = error.message || "An error occurred";
  const isApiKeyError = message.toLowerCase().includes("api key") || message.toLowerCase().includes("authentication");

  return (
    <div className="grid grid-cols-[28px_1fr] gap-x-4 items-start">
      <div className="flex flex-col items-center pt-[3px]">
        <div className="h-6 w-6 rounded-full border border-[var(--clay)] bg-background flex items-center justify-center shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--clay)]" />
        </div>
      </div>
      <div className="min-w-0">
        <div className="mono mb-1.5 text-[var(--clay)]">
          {isApiKeyError ? "API key" : "Error"}
        </div>
        <p className="text-[0.95rem] leading-[1.6] text-foreground/90">
          {isApiKeyError
            ? "The API key for this model is invalid or expired. Try switching to a different model, or update your API keys in settings."
            : message}
        </p>
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-x-4 items-start">
      <div className="flex flex-col items-center pt-[3px]">
        <div className="h-6 w-6 rounded-full border border-border bg-background flex items-center justify-center shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
        </div>
      </div>
      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-foreground/50 animate-pulse" />
          <span className="h-1 w-1 rounded-full bg-foreground/50 animate-pulse [animation-delay:160ms]" />
          <span className="h-1 w-1 rounded-full bg-foreground/50 animate-pulse [animation-delay:320ms]" />
        </div>
      </div>
    </div>
  );
}

const STARTER_PROMPTS = [
  { num: "01", label: "Explain our tech stack", prompt: "What technologies and frameworks are we using in our project?" },
  { num: "02", label: "What do we know?", prompt: "What knowledge has been captured from our previous conversations?" },
  { num: "03", label: "Draft a document", prompt: "Help me draft a technical document for our project" },
  { num: "04", label: "Deployment help", prompt: "What's the best way to deploy our application?" },
];

function EmptyState({ onSendPrompt }: { onSendPrompt?: (text: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-8 pt-20 pb-16">
        <p className="mono text-muted-foreground/80 mb-8">§ 00 / Begin</p>
        <h1
          className="display text-[clamp(2.4rem,5vw,3.6rem)] text-foreground"
        >
          Ask the room.
          <br />
          <span className="display-italic">Keep what matters.</span>
        </h1>
        <p className="mt-7 max-w-[44ch] text-[1rem] leading-[1.65] text-foreground/75">
          Talk to any model. Atoms of knowledge — facts, decisions,
          processes — are quietly extracted and added to your team&rsquo;s
          memory. Future answers are sharper because the room remembers.
        </p>

        <hr className="rule my-12" />

        <p className="mono text-muted-foreground/80 mb-5">A few openings</p>
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {STARTER_PROMPTS.map((item) => (
            <li key={item.num}>
              <button
                onClick={() => onSendPrompt?.(item.prompt)}
                className="group grid w-full grid-cols-[36px_1fr_18px] items-baseline gap-4 py-4 text-left transition-colors hover:bg-muted/40 -mx-2 px-2"
              >
                <span className="mono text-muted-foreground/70 group-hover:text-[var(--clay)] transition-colors">
                  {item.num}
                </span>
                <div className="min-w-0">
                  <div className="text-[1.05rem] leading-tight text-foreground" style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.02em" }}>
                    {item.label}
                  </div>
                  <div className="text-[0.82rem] text-muted-foreground/80 mt-1.5 line-clamp-1">
                    {item.prompt}
                  </div>
                </div>
                <span className="text-muted-foreground/50 group-hover:text-foreground transition-colors">
                  <ArrowEastIcon className="h-3 w-3" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ArrowEastIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 7h10" /><path d="m8 3 4 4-4 4" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  );
}
