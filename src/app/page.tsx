import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">K</span>
          </div>
          <span className="font-bold text-lg">Knowledgee</span>
        </div>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Open App
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Now with 10+ AI models from 5 providers
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Your organization&apos;s
          <br />
          <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
            AI brain
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Chat with GPT-4o, Claude, Gemini, and Grok in one place. Every conversation
          builds your organization&apos;s knowledge base — automatically extracted,
          always available, compounding with every chat.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Start chatting free
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Product Preview */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">Knowledgee</span>
          </div>
          <div className="flex h-[400px]">
            {/* Simulated sidebar */}
            <div className="w-56 border-r border-border bg-card/50 p-3 hidden sm:block">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">K</span>
                </div>
                <span className="text-xs font-semibold">Knowledgee</span>
              </div>
              <div className="space-y-1">
                {["API Architecture Design", "Database Migration Plan", "Team Standup Notes"].map((title, i) => (
                  <div
                    key={title}
                    className={`text-[11px] px-2 py-1.5 rounded ${i === 0 ? 'bg-muted/50 text-foreground' : 'text-muted-foreground'}`}
                  >
                    {title}
                  </div>
                ))}
              </div>
            </div>
            {/* Simulated chat */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
                <span className="text-xs">Claude Sonnet 4</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground ml-2">8 context</span>
              </div>
              <div className="flex-1 p-4 space-y-4 overflow-hidden">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 text-xs max-w-[70%]">
                    What database should we use for the new microservice?
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <SparklesIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="bg-muted/30 rounded-2xl px-4 py-2 text-xs max-w-[80%] space-y-2">
                    <p>Based on your organization&apos;s context, I&apos;d recommend <strong>Neon Postgres</strong> since your team already uses it for the main app with Drizzle ORM.</p>
                    <p className="text-muted-foreground">This keeps your stack consistent and leverages existing team expertise.</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Simulated knowledge panel */}
            <div className="w-52 border-l border-border bg-card/50 p-3 hidden md:block">
              <div className="flex items-center gap-1.5 mb-3">
                <BrainIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Knowledge</span>
                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full ml-auto">24</span>
              </div>
              <div className="space-y-2">
                {[
                  { type: "fact", text: "Uses Neon Postgres with Drizzle ORM", color: "text-blue-400" },
                  { type: "decision", text: "Chose OpenRouter for multi-model routing", color: "text-purple-400" },
                  { type: "solution", text: "Use edge functions for low-latency AI", color: "text-yellow-400" },
                ].map((atom) => (
                  <div key={atom.text} className="rounded border border-border/30 p-2">
                    <span className={`text-[9px] font-medium ${atom.color}`}>{atom.type}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{atom.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Every conversation makes you smarter</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Traditional AI chats are isolated. Knowledgee connects them all — across models, people, and time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "\u{1F500}",
              title: "Multi-Model Access",
              description: "GPT-4o, Claude, Gemini, Grok, Llama — all in one interface. Switch models mid-conversation. Use the best model for each task.",
            },
            {
              icon: "\u{1F9E0}",
              title: "Self-Evolving Memory",
              description: "Knowledge is automatically extracted from every conversation. Facts, decisions, solutions — captured and available across all future chats.",
            },
            {
              icon: "\u{1F4CA}",
              title: "Knowledge Compounds",
              description: "Ask a question in a new chat and the AI already knows your tech stack, decisions, and context from previous conversations.",
            },
            {
              icon: "\u{1F465}",
              title: "Team Knowledge",
              description: "Personal, team, and company knowledge tiers. Share what matters, keep what's private. Knowledge flows upward with approval.",
            },
            {
              icon: "\u{1F512}",
              title: "Privacy First",
              description: "Locked mode for sensitive chats. Companies see knowledge atoms, not raw conversations. Full audit trail and compliance controls.",
            },
            {
              icon: "\u{1F4B0}",
              title: "BYOK — Your Keys, Your Cost",
              description: "Bring your own API keys for direct provider access. Lower latency, transparent costs, no middleman markup.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border/50 p-6 hover:border-border transition-colors"
            >
              <span className="text-2xl mb-3 block">{feature.icon}</span>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">How knowledge compounds</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Chat naturally",
              description: "Ask questions, discuss architecture, debug problems — with any AI model you choose.",
            },
            {
              step: "2",
              title: "Knowledge is extracted",
              description: "After each conversation, AI identifies facts, decisions, and solutions worth remembering.",
            },
            {
              step: "3",
              title: "Context grows",
              description: "Future conversations automatically include relevant knowledge. The AI already knows your stack, your decisions, your team.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-sm font-bold text-primary">{item.step}</span>
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Models */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">All the models you need</h2>
          <p className="text-muted-foreground">No more juggling subscriptions. One platform, every flagship model.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { name: "GPT-4o", color: "#10a37f" },
            { name: "Claude Opus 4.6", color: "#d97757" },
            { name: "Claude Sonnet 4", color: "#d97757" },
            { name: "Gemini 2.5 Pro", color: "#4285f4" },
            { name: "Grok 3", color: "#888" },
            { name: "Llama 4", color: "#0668E1" },
            { name: "o3-mini", color: "#10a37f" },
            { name: "Gemini Flash", color: "#4285f4" },
            { name: "Claude Haiku", color: "#d97757" },
            { name: "GPT-4o Mini", color: "#10a37f" },
          ].map((model) => (
            <div
              key={model.name}
              className="flex items-center gap-2 rounded-full border border-border/50 px-4 py-2 text-sm hover:border-border transition-colors"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: model.color }}
              />
              {model.name}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">
          Stop losing your AI knowledge
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Every conversation your team has with AI is generating valuable knowledge.
          Knowledgee makes sure it compounds instead of evaporating.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          Get started for free
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-[8px] font-bold text-primary">K</span>
            </div>
            <span>Knowledgee</span>
          </div>
          <span>Your organization&apos;s AI brain</span>
        </div>
      </footer>
    </div>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
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

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}
