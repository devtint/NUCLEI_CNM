'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Loader2, Sparkles, Trash2, AlertCircle, Square, Copy, RotateCcw, X, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolCalls?: number;
    actionTarget?: string;
    actionScanId?: string;
}

// #5 Context-aware suggestions
const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
    overview: [
        'Give me a full dashboard overview',
        'What is my current risk level?',
        'Show highest risk targets',
        'How many total findings do I have?',
    ],
    vulnerabilities: [
        'Show all critical findings',
        'Which host has the most vulnerabilities?',
        'List findings grouped by severity',
        'Show unresolved high-severity issues',
    ],
    history: [
        'Compare my last two scans',
        'Show recent scan history',
        'What is my scan failure rate?',
        'Which scans found critical issues?',
    ],
    subfinder: [
        'What domains are being monitored?',
        'Show subdomains for my top domain',
        'How many total subdomains do I have?',
        'Which domain has the most subdomains?',
    ],
    httpx: [
        'What tech stacks are in my live assets?',
        'Show live assets with open ports',
        'Which live hosts are running outdated software?',
        'How many live assets are there?',
    ],
    templates: [
        'List my custom templates',
        'Generate a template for CVE-2024-1234',
        'How many custom templates do I have?',
        'Show templates I created recently',
    ],
    default: [
        'Give me a full dashboard overview',
        'Show all critical findings',
        'What domains are being monitored?',
        'Show recent scan history',
        'What tech stacks are in my live assets?',
        'Show vulnerability trend over time',
        'List my custom templates',
        'Show highest risk targets',
    ],
};

interface AIPageProps {
    previousView?: string;
    onNavigate?: (view: string) => void;
}

export function AIPage({ previousView, onNavigate }: AIPageProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('ai_chat_draft') || '';
        }
        return '';
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // #5 Pick context-aware suggestions
    const suggestions = CONTEXT_SUGGESTIONS[previousView || ''] || CONTEXT_SUGGESTIONS.default;

    // Load history on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('ai_chat_history');
            if (saved) {
                const parsed = JSON.parse(saved).map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(parsed.slice(-50));
            }
        } catch {
            console.error('Failed to load chat history');
        }
    }, []);

    // Save draft input as user types
    useEffect(() => {
        localStorage.setItem('ai_chat_draft', input);
    }, [input]);

    // Save history
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('ai_chat_history', JSON.stringify(messages));
        }
    }, [messages]);

    // Auto-scroll
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Focus input on mount + resize if draft restored
    useEffect(() => {
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                if (input) {
                    inputRef.current.style.height = 'auto';
                    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
                }
            }
        }, 300);
    }, []);

    // #7 Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

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

        // Reset textarea height
        if (inputRef.current) inputRef.current.style.height = 'auto';

        try {
            abortControllerRef.current = new AbortController();

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
            if (err.name === 'AbortError') return;
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
        if (!window.confirm('Clear all chat history? This cannot be undone.')) return;
        setMessages([]);
        setError(null);
        localStorage.removeItem('ai_chat_history');
    };

    // #3 Per-message actions
    const copyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard');
    };

    const retryMessage = (msgId: string) => {
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx < 0) return;
        // Find the user message to retry (either this one or the one before)
        let userMsg: Message | undefined;
        if (messages[idx].role === 'user') {
            userMsg = messages[idx];
            // Remove this message and its response
            setMessages(prev => prev.filter((_, i) => i < idx));
        } else {
            // It's an assistant message — find the user message before it
            for (let i = idx - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    userMsg = messages[i];
                    setMessages(prev => prev.filter((_, j) => j < i));
                    break;
                }
            }
        }
        if (userMsg) {
            setTimeout(() => sendMessage(userMsg!.content), 100);
        }
    };

    const deleteMessage = (msgId: string) => {
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx < 0) return;
        setMessages(prev => {
            const next = [...prev];
            if (prev[idx].role === 'user' && idx + 1 < prev.length && prev[idx + 1].role === 'assistant') {
                // Delete user + its assistant response pair
                next.splice(idx, 2);
            } else if (prev[idx].role === 'assistant' && idx - 1 >= 0 && prev[idx - 1].role === 'user') {
                // Delete assistant + its user prompt pair
                next.splice(idx - 1, 2);
            } else {
                next.splice(idx, 1);
            }
            if (next.length === 0) localStorage.removeItem('ai_chat_history');
            return next;
        });
    };

    // #4 Export conversation
    const exportAsMarkdown = () => {
        if (messages.length === 0) return;
        const md = messages.map(m => {
            const role = m.role === 'user' ? '**You**' : '**Nuclei CC AI**';
            const time = m.timestamp instanceof Date ? m.timestamp.toLocaleString() : '';
            return `### ${role} — ${time}\n\n${m.content}\n`;
        }).join('\n---\n\n');

        const blob = new Blob([`# Nuclei CC AI Conversation\n\nExported: ${new Date().toLocaleString()}\n\n---\n\n${md}`], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nuclei-ai-chat-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Conversation exported as Markdown');
    };

    const copyAllAsMarkdown = () => {
        if (messages.length === 0) return;
        const md = messages.map(m => {
            const role = m.role === 'user' ? '**You**' : '**Nuclei CC AI**';
            return `${role}:\n${m.content}`;
        }).join('\n\n---\n\n');
        navigator.clipboard.writeText(md);
        toast.success('Conversation copied to clipboard');
    };

    // #1 Markdown rendering with TABLE support
    const renderContent = (content: string) => {
        const lines = content.split('\n');
        const elements: React.ReactNode[] = [];
        let inCodeBlock = false;
        let codeContent: string[] = [];
        let listItems: string[] = [];
        let tableRows: string[][] = [];
        let tableHeader: string[] = [];

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`list-${elements.length}`} className="ai-page-list">
                        {listItems.map((item, i) => (
                            <li key={i}>{renderInline(item)}</li>
                        ))}
                    </ul>
                );
                listItems = [];
            }
        };

        const flushTable = () => {
            if (tableHeader.length > 0 || tableRows.length > 0) {
                elements.push(
                    <div key={`table-${elements.length}`} className="ai-page-table-wrap">
                        <table className="ai-page-table">
                            {tableHeader.length > 0 && (
                                <thead>
                                    <tr>
                                        {tableHeader.map((h, i) => (
                                            <th key={i}>{renderInline(h.trim())}</th>
                                        ))}
                                    </tr>
                                </thead>
                            )}
                            <tbody>
                                {tableRows.map((row, ri) => (
                                    <tr key={ri}>
                                        {row.map((cell, ci) => (
                                            <td key={ci}>{renderInline(cell.trim())}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                tableHeader = [];
                tableRows = [];
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Code blocks
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    flushTable();
                    elements.push(
                        <pre key={`code-${i}`} className="ai-page-code">
                            <code>{codeContent.join('\n')}</code>
                        </pre>
                    );
                    codeContent = [];
                    inCodeBlock = false;
                } else {
                    flushList();
                    flushTable();
                    inCodeBlock = true;
                }
                continue;
            }

            if (inCodeBlock) {
                codeContent.push(line);
                continue;
            }

            // Table rows (| col1 | col2 |)
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                flushList();
                const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());

                // Skip separator row (|---|---|)
                if (cells.every(c => /^[-:]+$/.test(c))) continue;

                if (tableHeader.length === 0 && tableRows.length === 0) {
                    tableHeader = cells;
                } else {
                    tableRows.push(cells);
                }
                continue;
            } else {
                flushTable();
            }

            // Horizontal rule
            if (line.trim().match(/^[-*_]{3,}$/)) {
                flushList();
                elements.push(<hr key={`hr-${i}`} className="ai-page-hr" />);
                continue;
            }

            // Headers
            if (line.startsWith('### ')) {
                flushList();
                elements.push(<h4 key={`h-${i}`} className="ai-page-h4">{renderInline(line.slice(4))}</h4>);
                continue;
            }
            if (line.startsWith('## ')) {
                flushList();
                elements.push(<h3 key={`h-${i}`} className="ai-page-h3">{renderInline(line.slice(3))}</h3>);
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
            elements.push(<p key={`p-${i}`} className="ai-page-p">{renderInline(line)}</p>);
        }

        flushList();
        flushTable();
        return <div className="ai-page-content">{elements}</div>;
    };

    // Inline formatting: bold, code
    const renderInline = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={i} className="ai-page-inline-code">{part.slice(1, -1)}</code>;
            }
            return part;
        });
    };

    return (
        <div className="ai-page-container">
            {/* Header bar */}
            {messages.length > 0 && (
                <div className="ai-page-header">
                    <div className="ai-page-header-title">
                        <Bot className="h-4 w-4 text-emerald-400" />
                        <span>Nuclei CC AI</span>
                        <span className="ai-page-msg-count">{messages.length} messages</span>
                    </div>
                    <div className="ai-page-header-actions">
                        {/* #4 Export buttons */}
                        <button onClick={copyAllAsMarkdown} className="ai-page-header-btn" title="Copy conversation">
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                        </button>
                        <button onClick={exportAsMarkdown} className="ai-page-header-btn" title="Export as Markdown">
                            <Download className="h-3.5 w-3.5" />
                            <span>Export</span>
                        </button>
                        <button onClick={clearChat} className="ai-page-clear-btn" title="Clear chat history">
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Clear</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Messages area */}
            <div className="ai-page-messages">
                {messages.length === 0 && (
                    <div className="ai-page-empty">
                        <div className="ai-page-empty-icon">
                            <Bot className="h-12 w-12 text-emerald-500/30" />
                        </div>
                        <h2 className="ai-page-empty-title">Nuclei CC AI</h2>
                        <p className="ai-page-empty-subtitle">
                            Ask about your findings, scans, subdomains, live assets, and more.
                        </p>
                        <div className="ai-page-suggestions">
                            {suggestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(q)}
                                    className="ai-page-suggestion-btn"
                                >
                                    <Sparkles className="h-3 w-3 shrink-0 text-emerald-500/60" />
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`ai-page-message ${msg.role === 'user' ? 'ai-page-message-user' : 'ai-page-message-assistant'}`}
                        onMouseEnter={() => setHoveredMsg(msg.id)}
                        onMouseLeave={() => setHoveredMsg(null)}
                    >
                        <div className="ai-page-message-inner">
                            {msg.role === 'assistant' && (
                                <div className="ai-page-avatar">
                                    <Bot className="h-4 w-4 text-emerald-400" />
                                </div>
                            )}
                            <div className={`ai-page-bubble ${msg.role === 'user' ? 'ai-page-bubble-user' : 'ai-page-bubble-assistant'}`}>
                                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}

                                {(msg.actionScanId || msg.actionTarget) && msg.role === 'assistant' && (
                                    <button
                                        onClick={() => {
                                            if (msg.actionScanId) {
                                                sendMessage(`Summarize vulnerability findings for scan id ${msg.actionScanId}`);
                                            } else {
                                                sendMessage(`Summarize vulnerability findings for ${msg.actionTarget}`);
                                            }
                                        }}
                                        className="ai-page-action-btn"
                                    >
                                        <Sparkles className="h-3 w-3 shrink-0" />
                                        Analyze Findings for this Scan
                                    </button>
                                )}

                                {msg.toolCalls !== undefined && msg.toolCalls > 0 && (
                                    <span className="ai-page-tool-badge">
                                        {msg.toolCalls} {msg.toolCalls === 1 ? 'query' : 'queries'}
                                    </span>
                                )}

                                {/* #3 Per-message action toolbar */}
                                {hoveredMsg === msg.id && !isLoading && (
                                    <div className="ai-page-msg-actions">
                                        <button onClick={() => copyMessage(msg.content)} title="Copy">
                                            <Copy className="h-3 w-3" />
                                        </button>
                                        <button onClick={() => retryMessage(msg.id)} title="Retry">
                                            <RotateCcw className="h-3 w-3" />
                                        </button>
                                        <button onClick={() => deleteMessage(msg.id)} title="Delete message pair" className="ai-page-msg-action-delete">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="ai-page-message ai-page-message-assistant">
                        <div className="ai-page-message-inner">
                            <div className="ai-page-avatar">
                                <Bot className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div className="ai-page-bubble ai-page-bubble-assistant">
                                <div className="ai-page-loading">
                                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                                    <span>Querying database...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="ai-page-error">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="ai-page-input-wrapper">
                <div className="ai-page-input-area">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your data..."
                        className="ai-page-input"
                        rows={1}
                        disabled={isLoading}
                    />
                    {isLoading ? (
                        <button
                            onClick={stopMessage}
                            className="ai-page-send-btn ai-page-stop-btn"
                            title="Stop generation"
                        >
                            <Square className="h-4 w-4 fill-current" />
                        </button>
                    ) : (
                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim()}
                            className="ai-page-send-btn"
                            title="Send message"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <p className="ai-page-input-hint">AI responses based on your database. Press Enter to send, Shift+Enter for new line.</p>
            </div>
        </div>
    );
}
