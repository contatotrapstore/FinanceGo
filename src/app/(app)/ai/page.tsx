"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, MessageSquare, Plus } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load last conversation on mount
  useEffect(() => {
    async function loadLastConversation() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: conversations, error: convError } = await supabase
          .from("ai_conversations")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (convError || !conversations?.[0]) return;

        const convId = conversations[0].id;
        setConversationId(convId);

        const { data: msgs } = await supabase
          .from("ai_messages")
          .select("role, content")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        if (msgs && msgs.length > 0) {
          setMessages(
            msgs
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
          );
        }
      } catch {
        // Tables may not exist yet
      }
    }
    loadLastConversation();
  }, []);

  async function startNewConversation() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title: "Nova conversa" })
        .select("id")
        .single();

      if (data) {
        setConversationId(data.id);
        setMessages([]);
      }
    } catch {
      setConversationId(null);
      setMessages([]);
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (conversationId) return conversationId;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title: "Nova conversa" })
        .select("id")
        .single();

      if (data) {
        setConversationId(data.id);
        return data.id;
      }
    } catch {
      // Table may not exist - chat still works without persistence
    }
    return null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Save user message to DB (non-blocking)
    const convId = await ensureConversation();
    if (convId) {
      supabase.from("ai_messages").insert({
        conversation_id: convId,
        role: "user",
        content: userMessage.content,
      }).then(() => {});
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          conversation_id: convId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao se comunicar com a IA");
      }
      const data = await res.json();
      const assistantMessage: Message = { role: "assistant", content: data.content };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to DB (non-blocking)
      if (convId) {
        supabase.from("ai_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: data.content,
        }).then(() => {});

        // Update conversation title from first user message
        if (messages.length === 0) {
          const title = userMessage.content.slice(0, 60);
          supabase
            .from("ai_conversations")
            .update({ title })
            .eq("id", convId)
            .then(() => {});
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Desculpe, ocorreu um erro. Tente novamente.",
        },
      ]);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-5rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            FinanceGO IA
          </h1>
          <p className="text-muted-foreground text-sm">
            Pergunte sobre suas finanças
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={startNewConversation}>
          <Plus className="h-4 w-4 mr-1" />
          Nova conversa
        </Button>
      </div>
      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Olá! Sou o assistente do FinanceGO.</p>
              <p className="text-xs mt-1">Consulte, crie lançamentos e gerencie contas por aqui.</p>
              <div className="mt-4 space-y-2">
                {[
                  "Recebi 5000 reais de salário",
                  "Gastei 300 reais no mercado",
                  "Tenho conta de 50 reais todo dia 10",
                  "Se pagar tudo, fico com quanto?",
                  "Quais contas vencem essa semana?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="block text-xs text-primary hover:underline"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-2.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </CardContent>
      </Card>
      {/* Input */}
      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo..."
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
