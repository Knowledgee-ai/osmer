"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Team {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const data = await res.json();
      setTeams(data.teams || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const loadMembers = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/teams/${teamId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members || []);
    }
  }, []);

  useEffect(() => {
    if (selectedTeam) loadMembers(selectedTeam);
  }, [selectedTeam, loadMembers]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setMessage("");
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName }),
    });
    if (res.ok) {
      setNewTeamName("");
      loadTeams();
      setMessage("Team created!");
    } else {
      const data = await res.json();
      setMessage(data.error || "Failed to create team");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedTeam) return;
    setMessage("");
    const res = await fetch(`/api/teams/${selectedTeam}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteEmail("");
      loadMembers(selectedTeam);
      setMessage(`${data.member.name} added to team!`);
    } else {
      setMessage(data.error || "Failed to invite");
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Teams</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create teams and invite members to share knowledge
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/chat")}>
            Back to Chat
          </Button>
        </div>

        {message && (
          <div className="mb-4 text-sm px-3 py-2 rounded-lg bg-muted/50 text-foreground">
            {message}
          </div>
        )}

        {/* Create Team */}
        <div className="mb-8 p-4 rounded-xl border border-border">
          <h2 className="text-sm font-medium mb-3">Create a Team</h2>
          <div className="flex gap-2">
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name (e.g., Engineering)"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
            />
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
              Create
            </Button>
          </div>
        </div>

        {/* Teams List */}
        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading teams...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">{"\u{1F465}"}</div>
            <p className="text-sm text-muted-foreground">No teams yet. Create one to start sharing knowledge.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  selectedTeam === team.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80"
                }`}
                onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{team.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {team.role}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Expanded: Members + Invite */}
                {selectedTeam === team.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    {/* Members */}
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground mb-2">
                        Members ({members.length})
                      </h3>
                      <div className="space-y-2">
                        {members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-primary">
                                  {m.name[0]?.toUpperCase()}
                                </span>
                              </div>
                              <span>{m.name}</span>
                              <span className="text-xs text-muted-foreground">{m.email}</span>
                            </div>
                            <Badge variant="secondary" className="text-[9px]">
                              {m.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Invite */}
                    {team.role === "lead" && (
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-2">
                          Invite Member
                        </h3>
                        <div className="flex gap-2">
                          <Input
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="Email address"
                            className="flex-1 h-8 text-sm"
                            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                          />
                          <Button size="sm" className="h-8" onClick={handleInvite} disabled={!inviteEmail.trim()}>
                            Invite
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
