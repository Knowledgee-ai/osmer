"use client";

import { useChatStore } from "@/stores/chat-store";
import { getModelsGroupedByProvider, PROVIDER_COLORS } from "@/lib/ai/models";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODEL_MAP } from "@/lib/ai/models";

export function ModelSelector() {
  const { selectedModel, setSelectedModel } = useChatStore();
  const grouped = getModelsGroupedByProvider();
  const currentModel = MODEL_MAP.get(selectedModel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 whitespace-nowrap text-[0.82rem] text-foreground hover:text-[var(--clay-deep)] transition-colors focus-visible:outline-none">
        {currentModel && (
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: PROVIDER_COLORS[currentModel.provider] || '#888' }}
          />
        )}
        <span style={{ fontFamily: "var(--font-display), Georgia, serif", letterSpacing: "-0.012em" }}>
          {currentModel?.name || selectedModel}
        </span>
        <ChevronDownIcon className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {Object.entries(grouped).map(([providerName, models], i) => (
          <DropdownMenuGroup key={providerName}>
            {i > 0 && <DropdownMenuSeparator />}
            <div className="mono px-1.5 pt-1.5 pb-1 text-muted-foreground/80">
              {providerName}
            </div>
            {models.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className="flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: PROVIDER_COLORS[model.provider] || '#888' }}
                  />
                  <span className="text-[0.85rem]">{model.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="mono text-muted-foreground/70">{model.category}</span>
                  {selectedModel === model.id && (
                    <CheckIcon className="h-3 w-3 text-[var(--clay)]" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
