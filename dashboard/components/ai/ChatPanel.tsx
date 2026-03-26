'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Sparkles, Trash2, AlertCircle, Square } from 'lucide-react';
import { toast } from "sonner";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolCalls?: number;
    actionTarget?: string;
    actionScanId?: string;
}

const SUGGESTED_QUESTIONS = [
    'Give me a dashboard overview',
    'How many critical findings do I have?',
    'Show my monitored domains',
    'What tech stacks are in my live assets?',
    'Show recent scan history',
];

export function AIChatPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Load history on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ai_chat_history');
            if (saved) {
                // Restore dates
                const parsed = JSON.parse(saved).map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                // Only keep last 20 messages to avoid localstorage bloat
                setMessages(parsed.slice(-20));
            }
        } catch (e) {
            console.error('Failed to load chat history');
        }
    }, []);

    // Save history when it changes
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('ai_chat_history', JSON.stringify(messages));
        }
    }, [messages]);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Listen for custom events to trigger chat from anywhere
    useEffect(() => {
        const handleOpenChat = (e: Event) => {
            const customEvent = e as CustomEvent<{ message: string }>;
            const message = customEvent.detail?.message;
            if (message) {
                setIsOpen(true);
                // Cannot call sendMessage directly here due to closure staleness, 
                // so we use a queued message state or just wait 1 tick and send it
                setTimeout(() => {
                    sendMessage(message);
                }, 100);
            }
        };

        window.addEventListener('open-ai-chat', handleOpenChat);
        return () => window.removeEventListener('open-ai-chat', handleOpenChat);
    }, [messages, isLoading]);

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

        const checkScans = async () => {
            try {
                const res = await fetch("/api/scan");
                if (!res.ok) return;
                const scans = await res.json();
                
                const newlyCompleted = scans.filter((s: any) => 
                    s.status === 'completed' && s.endTime && s.endTime > (lastCheckedRef.current as number)
                );

                if (newlyCompleted.length > 0) {
                    let maxEndTime = lastCheckedRef.current as number;
                    const newMessages: Message[] = [];
                    
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
                                        I've just finished a scan operation on <strong style={{color: '#f4f4f5'}}>{scan.target}</strong>.
                                    </span>
                                    <span className="text-[10px] text-[#10b98190] mt-1 font-medium tracking-wide uppercase">Click to view in chat</span>
                                </div>
                            </div>
                        ), { duration: 6000 });
                        
                        // Auto-summarize: fetch findings for THIS scan only
                        let autoSummary = '';
                        try {
                            const findingsRes = await fetch('/api/ai/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    messages: [{ role: 'user', content: `Briefly summarize findings ONLY for scan id ${scan.id}. Do not show info about other scans or the entire domain. If there are zero findings, say the target looks clean.` }]
                                }),
                            });
                            if (findingsRes.ok) {
                                const data = await findingsRes.json();
                                autoSummary = data.response || '';
                            }
                        } catch {
                            // Fallback if auto-summarize fails
                        }

                        const duration = scan.endTime && scan.startTime ? Math.round((scan.endTime - scan.startTime) / 1000) : 0;
                        const content = autoSummary 
                            ? `🚨 **Scan Finished!**\nTarget: \`${scan.target}\` • Duration: ${duration}s\n\n${autoSummary}`
                            : `🚨 **Scan Finished!**\nI've just finished a scan operation on \`${scan.target}\`.\n\n**Duration:** ${duration}s\n**Status:** Completed\n\nYou can ask me to summarize the new findings!`;

                        newMessages.push({
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content,
                            timestamp: new Date(),
                            actionTarget: scan.target,
                            actionScanId: scan.id
                        });
                    }

                    // Update local history
                    setMessages(prev => [...prev, ...newMessages]);
                    lastCheckedRef.current = maxEndTime;
                    localStorage.setItem('ai_last_scan_check', String(maxEndTime));
                }
            } catch (e) {
                // Silently ignore network errors during background polling
            }
        };

        const interval = setInterval(checkScans, 5000);
        return () => clearInterval(interval);
    }, []);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            abortControllerRef.current = new AbortController();

            // Build message history for context (last 10 messages)
            const history = [...messages, userMessage]
                .slice(-10)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history }),
                signal: abortControllerRef.current.signal,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get AI response');
            }

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                toolCalls: data.tool_calls_made,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return; // User cancelled, do not set an error state
            }
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [isLoading, messages]);

    const stopMessage = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const clearChat = () => {
        setMessages([]);
        setError(null);
        localStorage.removeItem('ai_chat_history');
    };

    // Simple markdown-ish rendering
    const renderContent = (content: string) => {
        // Process the markdown content
        const lines = content.split('\n');
        const elements: React.ReactNode[] = [];
        let inCodeBlock = false;
        let codeContent: string[] = [];
        let listItems: string[] = [];

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`list-${elements.length}`} className="ai-chat-list">
                        {listItems.map((item, i) => (
                            <li key={i}>{renderInline(item)}</li>
                        ))}
                    </ul>
                );
                listItems = [];
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Code blocks
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    elements.push(
                        <pre key={`code-${i}`} className="ai-chat-code">
                            <code>{codeContent.join('\n')}</code>
                        </pre>
                    );
                    codeContent = [];
                    inCodeBlock = false;
                } else {
                    flushList();
                    inCodeBlock = true;
                }
                continue;
            }

            if (inCodeBlock) {
                codeContent.push(line);
                continue;
            }

            // Headers
            if (line.startsWith('### ')) {
                flushList();
                elements.push(<h4 key={`h-${i}`} className="ai-chat-h4">{renderInline(line.slice(4))}</h4>);
                continue;
            }
            if (line.startsWith('## ')) {
                flushList();
                elements.push(<h3 key={`h-${i}`} className="ai-chat-h3">{renderInline(line.slice(3))}</h3>);
                continue;
            }

            // List items
            if (line.match(/^[-*•]\s/)) {
                listItems.push(line.replace(/^[-*•]\s/, ''));
                continue;
            }
            if (line.match(/^\d+\.\s/)) {
                listItems.push(line.replace(/^\d+\.\s/, ''));
                continue;
            }

            // Empty line
            if (line.trim() === '') {
                flushList();
                continue;
            }

            // Regular paragraph
            flushList();
            elements.push(<p key={`p-${i}`} className="ai-chat-p">{renderInline(line)}</p>);
        }

        flushList();

        return <div className="ai-chat-content">{elements}</div>;
    };

    // Inline formatting: bold, code, links
    const renderInline = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={i} className="ai-chat-inline-code">{part.slice(1, -1)}</code>;
            }
            return part;
        });
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="ai-chat-toggle"
                title="AI Assistant (Ctrl+Shift+A)"
                id="ai-chat-toggle"
            >
                {isOpen ? (
                    <X className="h-5 w-5" />
                ) : (
                    <Bot className="h-5 w-5" />
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div ref={panelRef} className="ai-chat-panel">
                    {/* Header */}
                    <div className="ai-chat-header">
                        <div className="ai-chat-header-title">
                            <Sparkles className="h-4 w-4 text-emerald-400" />
                            <span>Nuclei CC AI</span>
                            <span className="ai-chat-badge">Beta</span>
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

                    {/* Messages */}
                    <div className="ai-chat-messages">
                        {messages.length === 0 && (
                            <div className="ai-chat-empty">
                                <Bot className="h-10 w-10 text-emerald-500/40 mx-auto mb-3" />
                                <p className="ai-chat-empty-title">Ask about your data</p>
                                <p className="ai-chat-empty-subtitle">
                                    I can query your findings, subdomains, scans, and more.
                                </p>
                                <div className="ai-chat-suggestions">
                                    {SUGGESTED_QUESTIONS.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(q)}
                                            className="ai-chat-suggestion-btn"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`ai-chat-message ${msg.role === 'user' ? 'ai-chat-message-user' : 'ai-chat-message-assistant'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="ai-chat-avatar">
                                        <Bot className="h-3.5 w-3.5 text-emerald-400" />
                                    </div>
                                )}
                                <div className={`ai-chat-bubble ${msg.role === 'user' ? 'ai-chat-bubble-user' : 'ai-chat-bubble-assistant'}`}>
                                    {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                                    
                                    {/* Action Button for completed scans */}
                                    {(msg.actionScanId || msg.actionTarget) && msg.role === 'assistant' && (
                                        <button 
                                            onClick={() => {
                                                if (msg.actionScanId) {
                                                    sendMessage(`Summarize vulnerability findings for scan id ${msg.actionScanId}`);
                                                } else {
                                                    sendMessage(`Summarize vulnerability findings for ${msg.actionTarget}`);
                                                }
                                            }}
                                            className="mt-3 flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors w-full text-left"
                                        >
                                            <Sparkles className="h-3 w-3 shrink-0" />
                                            Analyze Findings for this Scan
                                        </button>
                                    )}

                                    {msg.toolCalls !== undefined && msg.toolCalls > 0 && (
                                        <span className="ai-chat-tool-badge">
                                            🔍 {msg.toolCalls} {msg.toolCalls === 1 ? 'query' : 'queries'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="ai-chat-message ai-chat-message-assistant">
                                <div className="ai-chat-avatar">
                                    <Bot className="h-3.5 w-3.5 text-emerald-400" />
                                </div>
                                <div className="ai-chat-bubble ai-chat-bubble-assistant">
                                    <div className="ai-chat-loading">
                                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                                        <span>Querying database...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="ai-chat-error">
                                <AlertCircle className="h-4 w-4" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="ai-chat-input-area">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your data..."
                            className="ai-chat-input"
                            rows={1}
                            disabled={isLoading}
                        />
                        {isLoading ? (
                            <button
                                onClick={stopMessage}
                                className="ai-chat-send-btn ai-chat-stop-btn"
                                title="Stop generation"
                            >
                                <Square className="h-4 w-4 fill-current" />
                            </button>
                        ) : (
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim()}
                                className="ai-chat-send-btn"
                                title="Send message"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
