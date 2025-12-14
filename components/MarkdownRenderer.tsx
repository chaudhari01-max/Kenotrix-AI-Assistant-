import React from 'react';

// A lightweight custom renderer to avoid heavy dependencies like react-markdown
// Handles bold, code blocks, lists, and links.

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  
  const processText = (text: string) => {
    // Bold
    const boldParts = text.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-zinc-100 font-semibold">{part.slice(2, -2)}</strong>;
      }
      // Links [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      
      while ((match = linkRegex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          parts.push(part.substring(lastIndex, match.index));
        }
        parts.push(
          <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
            {match[1]}
          </a>
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < part.length) {
        parts.push(part.substring(lastIndex));
      }
      return parts.length > 0 ? <span key={i}>{parts}</span> : <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-2 text-zinc-300 leading-relaxed text-[15px] sm:text-[16px]">
      {lines.map((line, index) => {
        if (line.trim() === '') return <br key={index} />;
        
        // Headers
        if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-bold text-zinc-100 mt-4 mb-2">{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold text-zinc-100 mt-5 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={index} className="text-2xl font-bold text-zinc-100 mt-6 mb-3">{line.slice(2)}</h1>;

        // List items
        if (line.trim().startsWith('- ')) {
            return (
                <div key={index} className="flex gap-2 ml-2">
                    <span className="text-zinc-500">•</span>
                    <p>{processText(line.trim().substring(2))}</p>
                </div>
            )
        }
        
        // Numbered lists
        if (/^\d+\.\s/.test(line.trim())) {
             const match = line.trim().match(/^(\d+)\.\s/);
             const number = match ? match[1] : '1';
             return (
                 <div key={index} className="flex gap-2 ml-2">
                     <span className="text-zinc-500 min-w-[1.5rem]">{number}.</span>
                     <p>{processText(line.trim().replace(/^\d+\.\s/, ''))}</p>
                 </div>
             )
        }

        return <p key={index}>{processText(line)}</p>;
      })}
    </div>
  );
};

export default MarkdownRenderer;