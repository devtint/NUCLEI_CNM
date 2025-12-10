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
 * Convert ANSI color codes to HTML/CSS colors
 * This preserves the color information from terminal output
 */
export function ansiToHtml(text: string): string {
    const ansiColorMap: { [key: string]: string } = {
        '30': 'text-gray-900',      // Black
        '31': 'text-red-500',        // Red
        '32': 'text-green-500',      // Green
        '33': 'text-yellow-500',     // Yellow
        '34': 'text-blue-500',       // Blue
        '35': 'text-purple-500',     // Magenta
        '36': 'text-cyan-500',       // Cyan
        '37': 'text-gray-300',       // White
        '90': 'text-gray-600',       // Bright Black (Gray)
        '91': 'text-red-400',        // Bright Red
        '92': 'text-green-400',      // Bright Green
        '93': 'text-yellow-400',     // Bright Yellow
        '94': 'text-blue-400',       // Bright Blue
        '95': 'text-purple-400',     // Bright Magenta
        '96': 'text-cyan-400',       // Bright Cyan
        '97': 'text-white',          // Bright White
        '0': 'text-green-400',       // Reset (default terminal color)
        '1': 'font-bold',            // Bold
    };

    let result = text;

    // Replace ANSI codes with span tags
    Object.entries(ansiColorMap).forEach(([code, className]) => {
        const regex = new RegExp(`\\[${code}m`, 'g');
        result = result.replace(regex, `<span class="${className}">`);
    });

    // Close any open spans at reset codes
    result = result.replace(/\[0m/g, '</span>');

    return result;
}
