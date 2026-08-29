"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, ChevronDown, AlertCircle, Trash2, ImageIcon, X, FileDown, AlertTriangle, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { type AgentThought, type VisualizationData } from "@/lib/api";
import { streamChat, buildContextFromStorage } from "@/lib/ai-service";
import { VisualWorkspace } from "./VisualWorkspace";

// ── Types ─────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  thoughts?: AgentThought[];
  imagePreview?: string;        // data URL — display only, not persisted to localStorage
  visualization?: VisualizationData; // structured viz payload
}

// ── Constants ─────────────────────────────────────────────────────────
type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const STORAGE_MESSAGES = "agro_chat_v1_messages";
const STORAGE_SESSION  = "agro_chat_v1_session";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Thinking steps — two variants depending on whether an image is in-flight
const THINKING_STEPS = {
  base: [
    { agentAr: "وكيل التواصل",        actionAr: "جارٍ استقبال رسالتك وتجهيز الرد..." },
    { agentAr: "وكيل البحث العلمي",   actionAr: "جارٍ البحث في المكتبة الزراعية السورية..." },
    { agentAr: "المخطط الاستراتيجي",  actionAr: "جارٍ تحليل المعطيات الزراعية..." },
  ],
  vision: [
    { agentAr: "وكيل التواصل",          actionAr: "جارٍ استقبال رسالتك وتجهيز الرد..." },
    { agentAr: "خبير المعاينة البصرية",  actionAr: "وكيل الرؤية يقوم بتحليل الصورة..." },
    { agentAr: "وكيل البحث العلمي",     actionAr: "خبير الرؤية رصد إصابة... جارٍ البحث عن تفاصيلها في الكتب الزراعية..." },
    { agentAr: "المخطط الاستراتيجي",    actionAr: "جارٍ تحليل المعطيات الزراعية..." },
  ],
} as const;

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  text:
    "أهلاً وسهلاً! أنا أغرو-سيريا، خبيرك الزراعي الذكي.\n\n" +
    "أقدر أساعدك في تحليل أحوال التربة والطقس، نصائح المحاصيل والري، " +
    "أسعار الأسواق الزراعية، وأي سؤال زراعي عندك.\n\n" +
    "هلق بتقدر تراسلني أو ترفع صورة مباشرة من حقلك.\n\n" +
    "شو بدك تعرف اليوم؟",
};

// ── localStorage helpers ──────────────────────────────────────────────
function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: unknown): void {
  try {
    if (key === STORAGE_MESSAGES && Array.isArray(value)) {
      // Strip imagePreview before persisting — base64 blobs exceed localStorage quota
      const stripped = (value as Message[]).map(({ imagePreview: _, ...rest }) => rest);
      localStorage.setItem(key, JSON.stringify(stripped));
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

function storageRemove(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

// ── ThinkingDots ──────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <span className="flex gap-1 items-center" dir="ltr">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-emerald-400/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

// ── ThinkingBubble ────────────────────────────────────────────────────
function ThinkingBubble({ hasImage }: { hasImage: boolean }) {
  const steps = hasImage ? THINKING_STEPS.vision : THINKING_STEPS.base;
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    setStepIdx(0);
  }, [hasImage]);

  useEffect(() => {
    if (stepIdx >= steps.length - 1) return;
    const delay = stepIdx === 0 ? 1800 : 2400;
    const id = setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), delay);
    return () => clearTimeout(id);
  }, [stepIdx, steps.length]);

  const { agentAr, actionAr } = steps[stepIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex gap-2.5 items-start"
    >
      <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-emerald-400" />
      </div>
      <div className="glass-card rounded-2xl rounded-tl-sm px-4 py-3 max-w-[82%]">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[10px] text-emerald-400/80 font-semibold mb-1.5">{agentAr}</p>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground/70">{actionAr}</span>
              <ThinkingDots />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── CoT drawer ────────────────────────────────────────────────────────
function CoTDrawer({ thoughts }: { thoughts: AgentThought[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2.5 border-t border-emerald-500/10 pt-2.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] text-emerald-400/55 hover:text-emerald-400 transition-colors"
      >
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-3 h-3" />
        </motion.span>
        تفاصيل تسلسل التفكير
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-2.5 space-y-2">
              {thoughts.map((t, i) => (
                <motion.div
                  key={t.agent + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.09, duration: 0.28, ease: EASE }}
                  className={cn(
                    "rounded-xl p-2.5 border",
                    t.is_status
                      ? "bg-blue-500/5 border-blue-500/12"
                      : "bg-emerald-500/5 border-emerald-500/12",
                  )}
                >
                  <p className={cn(
                    "text-[9px] font-bold mb-1",
                    t.is_status ? "text-blue-400/75" : "text-emerald-400/75",
                  )}>
                    {t.role_ar}
                  </p>
                  <p className="text-[10px] text-muted-foreground/65 leading-relaxed whitespace-pre-wrap" dir="rtl">
                    {t.thought}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser  = message.role === "user";
  const isError = message.role === "error";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex justify-end"
      >
        <div className="max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-3 bg-emerald-500/15 border border-emerald-500/30">
          {message.imagePreview && (
            <img
              src={message.imagePreview}
              alt="صورة المحصول"
              className="rounded-xl mb-2.5 max-h-52 w-auto object-cover"
            />
          )}
          {message.text && (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" dir="rtl">
              {message.text}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex gap-2.5 items-start"
    >
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
        isError
          ? "bg-red-500/10 border border-red-500/25"
          : "bg-emerald-500/15 border border-emerald-500/25",
      )}>
        {isError
          ? <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          : <Bot className="w-3.5 h-3.5 text-emerald-400" />
        }
      </div>

      <div className={cn(
        "max-w-[82%] rounded-2xl rounded-tl-sm px-4 py-3",
        isError ? "bg-red-500/5 border border-red-500/20" : "glass-card",
      )}>
        <p
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            isError ? "text-red-300/90" : "text-foreground",
          )}
          dir="rtl"
        >
          {message.text}
        </p>
        {message.visualization && (
          <VisualWorkspace data={message.visualization} />
        )}
        {message.thoughts && message.thoughts.length > 0 && (
          <CoTDrawer thoughts={message.thoughts} />
        )}
      </div>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────
export function AgentChat() {
  const [messages, setMessages]         = useState<Message[]>([WELCOME]);
  const [input, setInput]               = useState("");
  const [thinking, setThinking]         = useState(false);
  const [thinkingHasImage, setThinkingHasImage] = useState(false);
  const [hydrated, setHydrated]         = useState(false);
  const [offline, setOffline]           = useState(false); // true after an AI stream error (quota/connection)

  // Image attachment state
  const [imageBase64, setImageBase64]   = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError]     = useState<string | null>(null);

  const sessionId       = useRef<string | null>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const isFirstScroll   = useRef(true);
  const streamingMsgId  = useRef<string | null>(null);
  const abortRef        = useRef<AbortController | null>(null);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    const stored = storageGet<Message[]>(STORAGE_MESSAGES);
    if (stored && stored.length > 0) setMessages(stored);
    const sid = storageGet<string>(STORAGE_SESSION);
    if (sid) sessionId.current = sid;
    setHydrated(true);
  }, []);

  // Persist messages (images stripped for quota safety)
  useEffect(() => {
    if (!hydrated) return;
    storageSet(STORAGE_MESSAGES, messages);
  }, [messages, hydrated]);

  // Auto-scroll
  useEffect(() => {
    if (!hydrated) return;
    const behavior: ScrollBehavior = isFirstScroll.current ? "instant" : "smooth";
    isFirstScroll.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages, thinking, hydrated]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const clearImage = useCallback(() => {
    setImageBase64(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const clearChat = useCallback(() => {
    storageRemove(STORAGE_MESSAGES);
    storageRemove(STORAGE_SESSION);
    sessionId.current = null;
    isFirstScroll.current = true;
    setMessages([WELCOME]);
    clearImage();
  }, [clearImage]);

  // ── Image file selection ──────────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting the same file

    setImageError(null);

    if (!file.type.startsWith("image/")) {
      setImageError("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("الصورة يجب أن تكون أقل من 5 ميغابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      // Send only the raw base64 payload (strip the data-URL prefix)
      setImageBase64(dataUrl.split(",")[1] ?? dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Send — tries Claude streaming first, falls back to local route ──
  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !imageBase64) || thinking) return;

    const msgText    = text;
    const msgPreview = imagePreview;
    const msgB64     = imageBase64;

    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", text: msgText, imagePreview: msgPreview ?? undefined },
    ]);
    setInput("");
    clearImage();
    setThinking(true);
    setThinkingHasImage(!!msgB64);

    // Build context from current user settings
    const userContext = buildContextFromStorage();

    // Build conversation history for Claude (last 8 exchanges)
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-16)
      .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

    const msgId = crypto.randomUUID();
    streamingMsgId.current = msgId;
    abortRef.current = new AbortController();
    let usedStreaming = false;

    await streamChat(msgText, {
      context: userContext,
      history,
      image_base64: msgB64 ?? undefined,
      image_media_type: "image/jpeg",
      signal: abortRef.current.signal,

      onChunk: (chunk) => {
        if (streamingMsgId.current !== msgId) return;
        if (!usedStreaming) {
          // First chunk — hide ThinkingBubble, start the assistant message
          usedStreaming = true;
          setThinking(false);
          setOffline(false); // a successful chunk means the AI engine is reachable again
          setMessages((m) => [...m, { id: msgId, role: "assistant", text: chunk }]);
        } else {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === msgId ? { ...msg, text: msg.text + chunk } : msg
            )
          );
        }
      },

      onDone: () => {
        streamingMsgId.current = null;
        setThinking(false);
      },

      onError: (errMsg) => {
        // No static fallback — surface the real error so connection issues are visible
        const display =
          errMsg || "عذراً، تعذّر الاتصال بمحرك الذكاء — تحقق من الاتصال وحاول مجدداً.";
        console.error("[AgentChat] AI stream error:", errMsg);
        if (!usedStreaming) {
          setOffline(true); // mark the engine unreachable so the header reflects offline state
          setMessages((m) => [
            ...m,
            { id: crypto.randomUUID(), role: "error", text: display },
          ]);
        }
        setThinking(false);
      },
    });
  }, [input, thinking, imageBase64, imagePreview, clearImage, messages]);

  const exportPDF = useCallback(() => {
    const advisoryMessages = messages.filter((m) => m.role === "assistant" && m.text !== WELCOME.text);
    if (advisoryMessages.length === 0) return;

    const rows = advisoryMessages
      .map((m) => `<div class="msg"><pre>${m.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></div>`)
      .join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير أغرو-سيريا</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl;
           padding: 36px 48px; color: #111; background: #fff; margin: 0; }
    h1 { font-size: 22px; color: #059669; border-bottom: 2px solid #059669;
         padding-bottom: 8px; margin-bottom: 6px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .msg { background: #f0fdf4; border: 1px solid #6ee7b7; border-radius: 10px;
           padding: 16px 20px; margin-bottom: 16px; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 14px;
          line-height: 1.7; margin: 0; }
    footer { color: #9ca3af; font-size: 11px; margin-top: 32px;
             border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>تقرير أغرو-سيريا — نصائح زراعية</h1>
  <p class="meta">التاريخ: ${new Date().toLocaleDateString("ar-SY")} · عدد التوصيات: ${advisoryMessages.length}</p>
  ${rows}
  <footer>تم إنشاء هذا التقرير بواسطة منصة أغرو-سيريا | نظام الزراعة الذكي للمزارع السوري</footer>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const canSend = (!!input.trim() || !!imageBase64) && !thinking;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-emerald-500/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <Bot className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">المساعد الزراعي</h2>
          <p className="text-[11px] text-muted-foreground">مدعوم بتقنية الوكلاء الذكيين · يدعم تحليل الصور</p>
        </div>

        <div className="ms-auto flex items-center gap-3">
          {offline ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 px-2 py-1"
              title="تعذّر الوصول إلى محرك الذكاء — تحقق من حصة Gemini أو الاتصال">
              <CloudOff className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400/90">غير متصل</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400/80">متصل</span>
            </div>
          )}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={exportPDF}
            disabled={thinking}
            title="تصدير النصائح كـ PDF"
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "text-muted-foreground/45 hover:text-emerald-400 hover:bg-emerald-500/8",
              "disabled:opacity-30 disabled:cursor-not-allowed",
            )}
          >
            <FileDown className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={clearChat}
            disabled={thinking}
            title="مسح المحادثة"
            className={cn(
              "p-2 rounded-lg transition-colors duration-200",
              "text-muted-foreground/45 hover:text-red-400 hover:bg-red-500/8",
              "disabled:opacity-30 disabled:cursor-not-allowed",
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" dir="ltr">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {thinking && <ThinkingBubble key="__thinking__" hasImage={thinkingHasImage} />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-emerald-500/10">

        {/* Image preview strip */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mb-3 overflow-hidden"
            >
              <div className="relative w-fit">
                <img
                  src={imagePreview}
                  alt="معاينة الصورة"
                  className="h-20 w-auto rounded-xl object-cover border border-emerald-500/30"
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={clearImage}
                  title="إزالة الصورة"
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Size error */}
        <AnimatePresence>
          {imageError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[11px] text-red-400/80 mb-2"
              dir="rtl"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {imageError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Image attach button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={thinking}
            title="إرفاق صورة (حد أقصى 5 ميغابايت)"
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
              "border transition-colors duration-200",
              imageBase64
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : "bg-white/[0.04] border-emerald-500/20 text-muted-foreground/50",
              "hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <ImageIcon className="w-4 h-4" />
          </motion.button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={imageBase64 ? "أضف وصفاً للصورة (اختياري)..." : "اكتب سؤالك الزراعي هنا..."}
            rows={1}
            disabled={thinking}
            dir="rtl"
            className={cn(
              "flex-1 resize-none rounded-xl px-4 py-3",
              "bg-white/[0.04] border border-emerald-500/20",
              "text-sm text-foreground placeholder:text-muted-foreground/50",
              "focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20",
              "transition-all duration-200 leading-relaxed min-h-[46px]",
              thinking && "opacity-50 cursor-not-allowed",
            )}
            style={{ scrollbarWidth: "none" }}
          />

          {/* Send button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => void send()}
            disabled={!canSend}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
              "bg-emerald-500/20 border border-emerald-500/35 text-emerald-400",
              "hover:bg-emerald-500/30 transition-colors duration-200",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/20",
            )}
          >
            <Send className="w-4 h-4" style={{ transform: "scaleX(-1)" }} />
          </motion.button>
        </div>

        <p className="text-[10px] text-muted-foreground/35 mt-2 text-center">
          Enter للإرسال · Shift+Enter لسطر جديد · يمكنك إرفاق صورة (حد أقصى 5 ميغابايت)
        </p>
      </div>
    </div>
  );
}
