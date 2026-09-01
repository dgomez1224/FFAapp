import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { getCaptainSessionToken } from "../lib/captainSession";
import { getProxiedImageUrl } from "../lib/playerImage";

type PlayerMessage = {
  id: string;
  player_name: string;
  player_position: string | null;
  player_image_url: string | null;
  native_language: string;
  language_flag?: string;
  language_label?: string;
  trigger_event: string;
  trigger_label?: string;
  content: string;
  content_original?: string | null;
  content_translation: string | null;
  is_translated?: boolean;
  is_read: boolean;
  created_at: string;
  reply_content: string | null;
  player_response?: string | null;
  source_gameweek: number | null;
};

export default function MessagesPage() {
  const navigate = useNavigate();
  const token = useMemo(() => getCaptainSessionToken(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<PlayerMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadInbox() {
    if (!token) {
      navigate("/sign-in", { replace: true });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-messages?token=${encodeURIComponent(token)}`,
        { headers: getSupabaseFunctionHeaders() },
      );
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to load messages");
      const rows: PlayerMessage[] = payload.messages || [];
      setMessages(rows);
      setUnreadCount(payload.unread_count || 0);
      setSelectedId((prev) => prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id || null);
    } catch (err: any) {
      setError(err.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  const selected = messages.find((row) => row.id === selectedId) || null;

  async function markRead(id: string) {
    if (!token) return;
    await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-messages/read?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setMessages((prev) => prev.map((row) => (row.id === id ? { ...row, is_read: true } : row)));
    setUnreadCount((count) => Math.max(0, count - (messages.find((row) => row.id === id && !row.is_read) ? 1 : 0)));
  }

  async function sendReply() {
    if (!token || !selected || !reply.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-messages/reply?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, content: reply.trim() }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to reply");
      setMessages((prev) => prev.map((row) => (row.id === selected.id ? { ...row, ...payload.message, is_read: true } : row)));
      setReply("");
    } catch (err: any) {
      setError(err.message || "Failed to reply");
    } finally {
      setSaving(false);
    }
  }

  async function removeMessage(id: string) {
    if (!token) return;
    await fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-messages/delete?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { ...getSupabaseFunctionHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const next = messages.filter((row) => row.id !== id);
    setMessages(next);
    setSelectedId(next[0]?.id || null);
  }

  if (loading) {
    return <Card className="p-6"><p className="text-sm text-muted-foreground">Checking the dressing-room phones…</p></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Player Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">Notes from your squad after signings, minutes, and match nights.</p>
        </div>
        {unreadCount > 0 ? <Badge>{unreadCount} unread</Badge> : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {messages.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No messages yet. They arrive after waivers and once players have minutes.</p>
          ) : (
            messages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => {
                  setSelectedId(message.id);
                  setShowTranslation(false);
                  if (!message.is_read) markRead(message.id);
                }}
                className={`mb-1 flex w-full items-start gap-3 rounded-md p-3 text-left hover:bg-muted ${selectedId === message.id ? "bg-muted" : ""}`}
              >
                {message.player_image_url ? (
                  <img src={getProxiedImageUrl(message.player_image_url) || message.player_image_url} alt="" className="h-10 w-10 rounded-full object-cover border" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted border" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-sm ${message.is_read ? "font-medium" : "font-bold"}`}>{message.player_name}</p>
                    {!message.is_read ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{message.content}</p>
                </div>
              </button>
            ))
          )}
        </Card>

        <Card className="p-5 min-h-[24rem]">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a message to read it.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selected.player_image_url ? (
                    <img src={getProxiedImageUrl(selected.player_image_url) || selected.player_image_url} alt="" className="h-14 w-14 rounded-full object-cover border" />
                  ) : null}
                  <div>
                    <h2 className="text-xl font-semibold">{selected.player_name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {selected.player_position || "Squad"} · {selected.language_flag || ""} {selected.language_label || selected.native_language}
                      {selected.source_gameweek ? ` · GW ${selected.source_gameweek}` : ""}
                    </p>
                    {selected.is_translated ? (
                      <p className="text-[11px] text-muted-foreground">Translated to English</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Spoken in {selected.language_label || selected.native_language}</p>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant="secondary">{selected.trigger_label || selected.trigger_event}</Badge>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.content}</p>
              {selected.is_translated && selected.content_original ? (
                <div>
                  <Button variant="ghost" size="sm" onClick={() => setShowTranslation((v) => !v)}>
                    {showTranslation ? "Hide original" : `Show original (${selected.native_language})`}
                  </Button>
                  {showTranslation ? <p className="mt-2 text-sm text-muted-foreground">“{selected.content_original}”</p> : null}
                </div>
              ) : selected.content_translation ? (
                <div>
                  <Button variant="ghost" size="sm" onClick={() => setShowTranslation((v) => !v)}>
                    {showTranslation ? "Hide translation" : "Show English"}
                  </Button>
                  {showTranslation ? <p className="mt-2 text-sm text-muted-foreground">“{selected.content_translation}”</p> : null}
                </div>
              ) : null}
              {selected.reply_content ? (
                <div className="space-y-2">
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Your reply</p>
                    {selected.reply_content}
                  </div>
                  {selected.player_response ? (
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{selected.player_name} replied</p>
                      {selected.player_response}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the player…" />
                  <Button onClick={sendReply} disabled={saving || !reply.trim()}>{saving ? "Sending…" : "Reply"}</Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => removeMessage(selected.id)}>Delete</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
