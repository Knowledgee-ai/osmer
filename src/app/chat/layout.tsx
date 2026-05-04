/**
 * Wraps every `/chat/*` route in the editorial paper theme so the app
 * shell — sidebar, chat panel, knowledge panel, sub-pages — picks up
 * the same ink/clay/paper palette as the landing without each page
 * having to opt in.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="paper" className="h-full bg-background text-foreground">
      {children}
    </div>
  );
}
