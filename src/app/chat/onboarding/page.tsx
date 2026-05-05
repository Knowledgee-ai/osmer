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
        <p className="text-sm text-stone-500">Coming next week. We&rsquo;ll email you when it&rsquo;s ready.</p>
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
