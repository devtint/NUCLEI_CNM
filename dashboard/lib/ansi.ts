/**
 * Strip ANSI color codes from text to make it readable
 * ANSI codes like [34m, [92m, [0m are used for terminal colors
 */
export function stripAnsiCodes(text: string): string {
    // Remove ANSI escape sequences
    // Pattern matches: ESC[...m where ESC can be \x1b or \u001b
    return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[([0-9;]+)m/g, '');
}

/**
 * ANSI color code -> inline CSS style map
 * Uses inline styles instead of Tailwind classes for safe use with dangerouslySetInnerHTML
 */
const ANSI_STYLE_MAP: Record<string, string> = {
    '30': 'color:#6b7280',      // Black
    '31': 'color:#ef4444',      // Red
    '32': 'color:#22c55e',      // Green
    '33': 'color:#eab308',      // Yellow
    '34': 'color:#3b82f6',      // Blue
    '35': 'color:#a855f7',      // Magenta
    '36': 'color:#06b6d4',      // Cyan
    '37': 'color:#d1d5db',      // White
    '90': 'color:#9ca3af',      // Bright Black (Gray)
    '91': 'color:#f87171',      // Bright Red
    '92': 'color:#4ade80',      // Bright Green
    '93': 'color:#facc15',      // Bright Yellow
    '94': 'color:#60a5fa',      // Bright Blue
    '95': 'color:#c084fc',      // Bright Magenta
    '96': 'color:#22d3ee',      // Bright Cyan
    '97': 'color:#f3f4f6',      // Bright White
    '1': 'font-weight:bold',   // Bold
};

/**
 * Convert a semicolon-separated ANSI code string into an HTML <span> or </span>
 */
function codesToSpan(codes: string): string {
    const codeList = codes.split(';');
    // Reset code -> close span
    if (codeList.includes('0')) {
        return '</span>';
    }
    const styles = codeList
        .map(c => ANSI_STYLE_MAP[c])
        .filter(Boolean)
        .join(';');
    return styles ? `<span style="${styles}">` : '';
}

/**
 * Convert ANSI color codes to inline-styled HTML.
 * - HTML-escapes the content first (XSS prevention)
 * - Converts ESC[...m and bare [...m sequences to <span style="..."> / </span>
 */
export function ansiToHtml(text: string): string {
    // 1. Escape HTML entities to prevent XSS from log content
    let result = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 2. Convert proper ESC[...m sequences
    result = result.replace(/\x1b\[([0-9;]+)m/g, (_match, codes) => codesToSpan(codes));

    // 3. Convert bare [XXm sequences (ESC byte already stripped by some transports)
    result = result.replace(/\[([0-9;]+)m/g, (_match, codes) => codesToSpan(codes));

    return result;
}
