"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, MessageSquare, Plus, Mic, MicOff } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Check speech support on mount
  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  function startListening() {
    const SR = getSpeechRecognition();
    if (!SR) return;

    // Always create a fresh instance (fixes mobile bugs)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      // Show live preview
      const display = finalTranscript + interim;
      if (display) {
        setInput(display);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      // Focus input so user can see result and submit
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech error:", event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setInput(""); // Clear input for fresh voice input
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
  }

  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

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

    // Stop listening if still active
    if (isListening) stopListening();

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
    <div className="flex flex-col h-[calc(100dvh-10rem)] lg:h-[calc(100vh-5rem)]">
      {/* Header - compact on mobile */}
      <div className="mb-2 lg:mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg lg:text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 lg:h-6 lg:w-6 shrink-0" />
            <span className="truncate">FinanceGO IA</span>
          </h1>
          <p className="text-muted-foreground text-xs lg:text-sm">
            Pergunte ou fale sobre suas finanças
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={startNewConversation} className="shrink-0 ml-2">
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Nova conversa</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden min-h-0">
        <CardContent className="h-full overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-2">
              <Bot className="h-10 w-10 lg:h-12 lg:w-12 mb-2 lg:mb-3 opacity-50" />
              <p className="text-sm text-center">Olá! Sou o assistente do FinanceGO.</p>
              <p className="text-xs mt-1 text-center">Fale ou digite para criar lançamentos e gerenciar suas finanças.</p>
              <div className="mt-3 lg:mt-4 space-y-1.5 lg:space-y-2 w-full max-w-xs">
                {[
                  "Recebi 5000 reais de salário",
                  "Gastei 300 reais no mercado",
                  "Vou receber 2000 de freelance dia 28",
                  "Tenho conta de 50 reais todo dia 10",
                  "Se pagar tudo, fico com quanto?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="block w-full text-left text-xs text-primary hover:underline py-0.5"
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
              className={`flex gap-2 lg:gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 h-7 w-7 lg:h-8 lg:w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] lg:max-w-[80%] rounded-2xl px-3 lg:px-4 py-2 lg:py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 h-7 w-7 lg:h-8 lg:w-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 lg:gap-3">
              <div className="shrink-0 h-7 w-7 lg:h-8 lg:w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-3 lg:px-4 py-2 lg:py-2.5">
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

      {/* Input area */}
      <form onSubmit={handleSend} className="mt-2 lg:mt-3 flex gap-1.5 lg:gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Ouvindo..." : "Pergunte algo..."}
          disabled={loading}
          className={`flex-1 text-base lg:text-sm ${isListening ? "border-red-500 placeholder:text-red-400" : ""}`}
        />
        {speechSupported && (
          <Button
            type="button"
            size="icon"
            variant={isListening ? "destructive" : "outline"}
            onClick={toggleListening}
            disabled={loading}
            className={`shrink-0 h-10 w-10 ${isListening ? "animate-pulse" : ""}`}
            title={isListening ? "Parar gravação" : "Falar"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button type="submit" size="icon" disabled={loading || !input.trim()} className="shrink-0 h-10 w-10">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
