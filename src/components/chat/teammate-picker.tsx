"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface OrgMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface ParticipantPayload {
  owner: OrgMember | null;
  participants: Array<OrgMember & { joinedAt: string }>;
}

interface TeammatePickerProps {
  open: boolean;
  conversationId: string;
  onClose: () => void;
  onChange?: (count: number) => void;
}

/**
 * Modal for inviting / removing teammates on a conversation. Used when a
 * conversation's audience is set to "Invite teammates" — controls who
 * (besides the owner) can read and post in the thread.
 */
export function TeammatePicker({ open, conversationId, onClose, onChange }: TeammatePickerProps) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [participants, setParticipants] = useState<Map<string, OrgMember>>(new Map());
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const isPersisted = !conversationId.startsWith('pending-');

  // Fetch participants on open
  useEffect(() => {
    if (!open || !isPersisted) return;
    let cancelled = false;
    fetch(`/api/conversations/${conversationId}/participants`)
      .then((r) => (r.ok ? (r.json() as Promise<ParticipantPayload>) : null))
      .then((d) => {
        if (cancelled || !d) return;
        setOwnerId(d.owner?.id ?? null);
        const map = new Map<string, OrgMember>();
        for (const p of d.participants) map.set(p.id, p);
        setParticipants(map);
        onChange?.(map.size);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, conversationId, isPersisted, onChange]);

  // Fetch org members (debounced search)
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const url = search ? `/api/users?q=${encodeURIComponent(search)}` : '/api/users';
      fetch(url, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setMembers(d.users || []);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, search]);

  const toggle = useCallback(
    async (member: OrgMember) => {
      if (!isPersisted) return; // Need a real conversation id to persist
      if (member.id === ownerId) return; // Owner is implicit
      setLoading(true);
      const isInvited = participants.has(member.id);
      const next = new Map(participants);
      if (isInvited) {
        next.delete(member.id);
        setParticipants(next);
        onChange?.(next.size);
        await fetch(`/api/conversations/${conversationId}/participants/${member.id}`, {
          method: 'DELETE',
        }).catch(() => {});
      } else {
        next.set(member.id, member);
        setParticipants(next);
        onChange?.(next.size);
        await fetch(`/api/conversations/${conversationId}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: member.id }),
        }).catch(() => {});
      }
      setLoading(false);
    },
    [isPersisted, ownerId, participants, conversationId, onChange]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite teammates</DialogTitle>
        </DialogHeader>

        {!isPersisted && (
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            Send your first message to create the conversation, then invite teammates.
          </p>
        )}

        <div className="space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              autoFocus
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {participants.size > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[...participants.values()].map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p)}
                  disabled={loading || !isPersisted}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70 disabled:opacity-60"
                  title={`Remove ${p.name}`}
                >
                  <Initial name={p.name} />
                  <span>{p.name}</span>
                  <XIcon className="h-3 w-3 opacity-60" />
                </button>
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto rounded-md border border-border/50">
            {members.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {search ? 'No matches' : 'Nobody else in your organisation yet'}
              </p>
            ) : (
              members.map((m) => {
                const isInvited = participants.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m)}
                    disabled={loading || !isPersisted}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Initial name={m.name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
                    </div>
                    {isInvited ? (
                      <span className="text-[10px] uppercase tracking-wider text-primary">
                        Invited
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        Add
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Initial({ name }: { name: string }) {
  const letter = (name?.[0] || '?').toUpperCase();
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary shrink-0">
      {letter}
    </span>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
