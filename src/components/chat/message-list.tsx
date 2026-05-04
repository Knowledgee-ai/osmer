"use client";

import { useEffect, useRef, memo } from "react";
import type { StoredMessage } from "@/lib/messages/store";
import { MODEL_MAP, PROVIDER_COLORS } from "@/lib/ai/models";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

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

  if (messages.length === 0 && !error) {
    return <EmptyState onSendPrompt={onSendPrompt} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
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

const MessageBubble = memo(function MessageBubble({ message }: { message: StoredMessage }) {
  const isUser = message.role === "user";
  const text = message.content;

  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <SparklesIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[85%]",
          isUser && "items-end"
        )}
      >
        {!isUser && message.modelUsed && (() => {
          const model = MODEL_MAP.get(message.modelUsed!);
          return model ? (
            <div className="flex items-center gap-1.5 mb-0.5 ml-1">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: PROVIDER_COLORS[model.provider] || '#888' }}
              />
              <span className="text-[10px] text-muted-foreground">{model.name}</span>
            </div>
          ) : null;
        })()}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          ) : (
            <MarkdownContent content={text} />
          )}
        </div>
      </div>
      {isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <UserIcon className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
    </div>
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
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
        <AlertIcon className="h-3.5 w-3.5 text-destructive" />
      </div>
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className="rounded-2xl px-4 py-2.5 text-sm bg-destructive/5 border border-destructive/20">
          <p className="font-medium text-destructive text-xs mb-1">
            {isApiKeyError ? "API Key Error" : "Error"}
          </p>
          <p className="text-muted-foreground text-xs">
            {isApiKeyError
              ? "The API key for this model is invalid or expired. Try switching to a different model, or update your API keys in settings."
              : message}
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <SparklesIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-1.5 py-2">
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}

const STARTER_PROMPTS = [
  { icon: "\u{1F4BB}", label: "Explain our tech stack", prompt: "What technologies and frameworks are we using in our project?" },
  { icon: "\u{1F9E0}", label: "What do we know?", prompt: "What knowledge has been captured from our previous conversations?" },
  { icon: "\u{1F4DD}", label: "Draft a document", prompt: "Help me draft a technical document for our project" },
  { icon: "\u{1F680}", label: "Deployment help", prompt: "What's the best way to deploy our application?" },
];

function EmptyState({ onSendPrompt }: { onSendPrompt?: (text: string) => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-lg px-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <SparklesIcon className="h-8 w-8 text-primary/60" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Welcome to Osmer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Chat with any AI model. Your knowledge compounds with every conversation.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STARTER_PROMPTS.map((item) => (
            <button
              key={item.label}
              onClick={() => onSendPrompt?.(item.prompt)}
              className="flex items-start gap-2.5 text-left p-3 rounded-xl border border-border/50 hover:border-border hover:bg-muted/30 transition-all group"
            >
              <span className="text-lg mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-medium group-hover:text-foreground transition-colors">{item.label}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{item.prompt}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
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
