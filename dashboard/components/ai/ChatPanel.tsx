'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bot, X, Send, Sparkles, Trash2, AlertCircle, Square, ChevronDown } from 'lucide-react';
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SUGGESTED_QUESTIONS = [
    'Give me a dashboard overview',
    'How many critical findings do I have?',
    'Show my monitored domains',
    'What tech stacks are in my live assets?',
    'Show recent scan history',
];

const AI_MODELS = [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', badge: '⭐' },
    { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', badge: '' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', badge: '⚡' },
    { value: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2', badge: '' },
    { value: 'qwen/qwen3-32b', label: 'Qwen3 32B', badge: '' },
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', badge: '' },
];

export function AIChatPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [aiModel, setAiModel] = useState('llama-3.3-70b-versatile');
    const [showModelPicker, setShowModelPicker] = useState(false);

    // Load saved model preference on mount
    useEffect(() => {
        try {
            const savedModel = localStorage.getItem('ai_chat_model');
            if (savedModel) setAiModel(savedModel);
        } catch (e) { }
    }, []);

    // Auto-migrate: clear stale localStorage chat history if it's in legacy format
    // AI SDK v6 requires UIMessage format ({ parts: [...] }) not legacy ({ content: string })
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ai_chat_history');
            if (saved) {
                const parsed = JSON.parse(saved);
                const hasLegacy = parsed.some((m: any) => m.content !== undefined && !m.parts);
                if (hasLegacy) {
                    localStorage.removeItem('ai_chat_history');
                }
            }
        } catch {
            localStorage.removeItem('ai_chat_history');
        }
    }, []);

    // Custom wrapper for AI SDK headless chat
    const [input, setInput] = useState('');

    // In AI SDK v6, we use a Transport for API communication
    const transport = useMemo(() => new DefaultChatTransport({
        api: '/api/ai/chat',
        body: { model: aiModel }
    }), [aiModel]);

    // Normalize any message to AI SDK v6 UIMessage format (parts array required)
    const normalizeToUIMessage = (m: any) => ({
        id: m.id || Math.random().toString(36).substring(7),
        role: m.role,
        parts: m.parts ?? (m.content != null ? [{ type: 'text', text: String(m.content) }] : []),
    });

    const { messages, sendMessage, status, error, stop, setMessages } = useChat({
        transport,
        messages: (() => {
            if (typeof window === 'undefined') return [];
            try {
                const saved = localStorage.getItem('ai_chat_history');
                return saved
                    ? JSON.parse(saved)
                        .filter((m: any) => m.role !== 'system')
                        .map(normalizeToUIMessage)
                    : [];
            } catch { return []; }
        })(),
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    const handleInputChange = (e: any) => {
        setInput(e.target.value);
    };

    const handleSubmit = (e?: any) => {
        e?.preventDefault?.();
        if (input.trim() && !isLoading) {
            sendMessage({ text: input.trim() } as any);
            setInput('');
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Save history when it changes
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('ai_chat_history', JSON.stringify(messages.slice(-20))); // Keep last 20 bounded
        }
    }, [messages]);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const toggle = document.getElementById('ai-chat-toggle');
            if (
                panelRef.current && !panelRef.current.contains(e.target as Node) &&
                toggle && !toggle.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Listen for custom events to trigger chat from anywhere
    useEffect(() => {
        const handleOpenChat = (e: Event) => {
            const customEvent = e as CustomEvent<{ message: string }>;
            const message = customEvent.detail?.message;
            if (message) {
                setIsOpen(true);
                setTimeout(() => {
                    sendMessage({ text: message });
                }, 100);
            }
        };

        window.addEventListener('open-ai-chat', handleOpenChat);
        return () => window.removeEventListener('open-ai-chat', handleOpenChat);
    }, [sendMessage]);

    // Background poller for completed scans
    const lastCheckedRef = useRef<number>(
        (() => {
            try {
                const saved = typeof window !== 'undefined' ? localStorage.getItem('ai_last_scan_check') : null;
                return saved ? parseInt(saved) : Date.now();
            } catch { return Date.now(); }
        })()
    );

    useEffect(() => {
        let isPolling = true;

        const checkScans = async () => {
            if (!isPolling) return;
            try {
                const res = await fetch("/api/scan");
                if (!res.ok) return;
                const scans = await res.json();

                const newlyCompleted = scans.filter((s: any) =>
                    s.status === 'completed' && s.endTime && s.endTime > (lastCheckedRef.current as number)
                );

                if (newlyCompleted.length > 0) {
                    let maxEndTime = lastCheckedRef.current as number;

                    for (const scan of newlyCompleted) {
                        if (scan.endTime > maxEndTime) maxEndTime = scan.endTime;

                        // Push toast with custom Chat Bubble UI (forced dark mode style)
                        toast.custom((t) => (
                            <div
                                onClick={() => { setIsOpen(true); toast.dismiss(t); }}
                                style={{ backgroundColor: '#09090b', borderColor: '#10b98140' }}
                                className="flex items-start gap-3 w-full sm:w-[350px] p-4 rounded-xl shadow-2xl cursor-pointer border transition-colors hover:border-[#10b981]"
                            >
                                <div className="bg-[#10b98120] p-2 rounded-full border border-[#10b98140] shrink-0">
                                    <Bot className="h-5 w-5 text-[#34d399]" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[#34d399] font-semibold text-sm">Scan Finished!</span>
                                    <span className="text-[#a1a1aa] text-xs leading-relaxed tracking-wide">
                                        I've just finished a scan operation on <strong style={{ color: '#f4f4f5' }}>{scan.target}</strong>.
                                    </span>
                                    <span className="text-[10px] text-[#10b98190] mt-1 font-medium tracking-wide uppercase">Click to view in chat</span>
                                </div>
                            </div>
                        ), { duration: 6000 });

                        const duration = scan.endTime && scan.startTime ? Math.round((scan.endTime - scan.startTime) / 1000) : 0;
                        const content = `🚨 **Scan Finished!**\nTarget: \`${scan.target}\`\n\n**Duration:** ${duration}s\n**Status:** Completed\n\nYou can ask me to summarize the new findings!`;

                        // Append to chat natively — must use v6 UIMessage format (parts array)
                        setMessages((prev: any) => [...prev, {
                            id: Math.random().toString(36).substring(7),
                            role: 'assistant',
                            parts: [{ type: 'text', text: content }],
                        }]);
                    }

                    lastCheckedRef.current = maxEndTime;
                    localStorage.setItem('ai_last_scan_check', String(maxEndTime));
                }
            } catch (e) {
                // Silently ignore network errors during background polling
            }
        };

        const interval = setInterval(checkScans, 5000);
        return () => { isPolling = false; clearInterval(interval); };
    }, [setMessages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const fakeEvent = new Event('submit') as any;
            handleSubmit(fakeEvent);
        }
    };

    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem('ai_chat_history');
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="ai-chat-toggle"
                title="AI Assistant"
                id="ai-chat-toggle"
            >
                {isOpen ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </button>

            {isOpen && (
                <div ref={panelRef} className="ai-chat-panel">
                    <div className="ai-chat-header">
                        <div className="ai-chat-header-title">
                            <Sparkles className="h-4 w-4 text-emerald-400" />
                            <span>Nuclei CC AI</span>
                            <div className="relative">
                                <button
                                    onClick={() => setShowModelPicker(!showModelPicker)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors"
                                >
                                    {AI_MODELS.find(m => m.value === aiModel)?.label || 'Model'}
                                    <ChevronDown className="h-2.5 w-2.5" />
                                </button>
                                {showModelPicker && (
                                    <div className="absolute top-full left-0 mt-1 w-52 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                                        {AI_MODELS.map((m) => (
                                            <button
                                                key={m.value}
                                                onClick={() => {
                                                    setAiModel(m.value);
                                                    setShowModelPicker(false);
                                                    localStorage.setItem('ai_chat_model', m.value);
                                                    fetch('/api/settings', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ ai_model: m.value }),
                                                    }).catch(() => { });
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${aiModel === m.value
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                                    }`}
                                            >
                                                <span>{m.label}</span>
                                                <span className="text-[10px]">{m.badge}{aiModel === m.value ? ' ✓' : ''}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="ai-chat-header-actions">
                            <button onClick={clearChat} title="Clear chat" className="ai-chat-icon-btn">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="ai-chat-icon-btn">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="ai-chat-messages">
                        {messages.length === 0 && (
                            <div className="ai-chat-empty">
                                <Bot className="h-10 w-10 text-emerald-500/40 mx-auto mb-3" />
                                <p className="ai-chat-empty-title">Ask about your data</p>
                                <p className="ai-chat-empty-subtitle">I can query your findings, subdomains, scans, and more.</p>
                                <div className="ai-chat-suggestions">
                                    {SUGGESTED_QUESTIONS.map((q, i) => (
                                        <button key={i} onClick={() => sendMessage({ text: q } as any)} className="text-left text-xs bg-[#27272a80] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5] px-3 py-2 rounded-lg transition-colors border border-[#3f3f46]">{q}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg: any) => (
                            <div key={msg.id} className={`ai-chat-message ${msg.role === 'user' ? 'ai-chat-message-user' : 'ai-chat-message-assistant'}`}>
                                {msg.role !== 'user' && (
                                    <div className="ai-chat-avatar"><Bot className="h-3.5 w-3.5 text-emerald-400" /></div>
                                )}
                                <div className={`ai-chat-bubble ${msg.role === 'user' ? 'ai-chat-bubble-user' : 'ai-chat-bubble-assistant ai-markdown-rendered'}`}>
                                    {msg.parts?.map((part: any, i: number) => {
                                        if (part.type === 'text') {
                                            return (
                                                <div key={i}>
                                                    {msg.role === 'user' ? (
                                                        part.text
                                                    ) : (
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {part.text}
                                                        </ReactMarkdown>
                                                    )}
                                                </div>
                                            );
                                        }
                                        if (part.type === 'tool-invocation') {
                                            return (
                                                <span key={i} className="ai-chat-tool-badge">
                                                    🔍 Processing {part.toolName}...
                                                </span>
                                            );
                                        }
                                        if (part.type === 'reasoning') {
                                            return (
                                                <div key={i} className="text-[10px] text-zinc-500 italic mb-1">
                                                    Thinking: {part.reasoning}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}

                                    {/* Legacy content fallback just in case */}
                                    {!msg.parts && msg.content && (
                                        msg.role === 'user' ? msg.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        ))}

                        {error && (
                            <div className="ai-chat-error">
                                <AlertCircle className="h-4 w-4" />
                                <span>{error.message || 'An error occurred'}</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="ai-chat-input-area">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your data..."
                            className="ai-chat-input"
                            rows={1}
                            disabled={isLoading && !input}
                        />
                        {isLoading ? (
                            <button onClick={stop} className="ai-chat-send-btn ai-chat-stop-btn" title="Stop">
                                <Square className="h-4 w-4 fill-current" />
                            </button>
                        ) : (
                            <button onClick={(e) => handleSubmit(e as any)} disabled={!input.trim()} className="ai-chat-send-btn">
                                <Send className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
