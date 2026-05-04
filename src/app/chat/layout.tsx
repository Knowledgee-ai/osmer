import { ChatThemeShell } from "@/components/chat/theme-shell";

/**
 * Wraps every `/chat/*` route in a theme shell that flips between
 * paper (light) and ink (dark) based on the user's settings. Falls
 * back to paper before hydration so the first paint matches the rest
 * of the app — see ChatThemeShell.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <ChatThemeShell>{children}</ChatThemeShell>;
}
