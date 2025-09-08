import { marked } from 'marked';

/**
 * Configure marked to work well with our editor
 */
marked.setOptions({
  // Don't add paragraph tags around single lines - let the editor handle block structure
  breaks: true,
  // Disable some features that might conflict with our editor
  headerIds: false,
  mangle: false,
});

/**
 * Custom renderer to ensure HTML is compatible with TextForge/TipTap
 */
const renderer = new marked.Renderer();

// Ensure links open in new tab and have proper attributes for our editor
renderer.link = (href: string, title: string | null, text: string) => {
  const titleAttr = title ? ` title="${title}"` : '';
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

// Handle code blocks properly
renderer.code = (code: string, language: string | undefined) => {
  const lang = language || 'plaintext';
  return `<pre><code class="language-${lang}">${code}</code></pre>`;
};

// Handle inline code
renderer.codespan = (code: string) => {
  return `<code>${code}</code>`;
};

marked.use({ renderer });

/**
 * Parse markdown string to HTML that's compatible with TextForge editor
 */
export function parseMarkdownToHTML(markdown: string): string {
  try {
    // Use marked to convert markdown to HTML
    const html = marked(markdown);
    
    // Clean up any unwanted wrapping paragraphs if it's just a single line
    const cleanHtml = typeof html === 'string' ? html.trim() : '';
    
    // If the result is just wrapped in a single paragraph, unwrap it
    // This helps with inline replacements
    if (cleanHtml.startsWith('<p>') && cleanHtml.endsWith('</p>') && cleanHtml.match(/<p>/g)?.length === 1) {
      return cleanHtml.slice(3, -4);
    }
    
    return cleanHtml;
  } catch (error) {
    console.warn('Failed to parse markdown, falling back to plain text:', error);
    // Fallback to plain text if parsing fails
    return markdown;
  }
}

/**
 * Quick check if a string contains markdown formatting
 */
export function hasMarkdownFormatting(text: string): boolean {
  // Check for common markdown patterns
  const markdownPatterns = [
    /\*\*.*?\*\*/,  // Bold
    /\*.*?\*/,      // Italic (not bold)
    /__.*?__/,      // Bold (underscore)
    /_.*?_/,        // Italic (underscore) 
    /`.*?`/,        // Inline code
    /\[.*?\]\(.*?\)/, // Links
    /^#{1,6}\s/m,   // Headers
    /^[-*+]\s/m,    // Lists
    /^>\s/m,        // Blockquotes
    /```[\s\S]*?```/, // Code blocks
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}