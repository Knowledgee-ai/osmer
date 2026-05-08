import { UploadZone } from '@/components/onboarding/upload-zone';
import { CrawlStep } from '@/components/onboarding/crawl-step';
import { ProgressFeed } from '@/components/onboarding/progress-feed';

export const metadata = { title: 'Seed your company memory · Osmer' };

export default function OnboardingPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <header>
        <h1 className="font-serif text-3xl mb-2">Seed your company memory</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Three ways. Use any or all of them.
        </p>
      </header>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-3">
          1 — Documents
        </h2>
        <UploadZone />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-3">
          2 — Your website
        </h2>
        <CrawlStep />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-3">
          3 — Voice introduction
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400 mb-3">
          A 25&#8209;minute conversation with Osmer that captures everything an
          AI Employee needs to sound like you. Your verbatim answers become
          the seed knowledge.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/chat/onboarding/voice?flow=founder_interview"
            className="rounded-sm bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Start founder interview
          </a>
          <a
            href="/chat/onboarding/voice?flow=employee_intro"
            className="rounded-sm border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-900 transition"
          >
            Quick team intro (5 min)
          </a>
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-3">
          Activity
        </h2>
        <ProgressFeed />
      </section>
    </div>
  );
}
