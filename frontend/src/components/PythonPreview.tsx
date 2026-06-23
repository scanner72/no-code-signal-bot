import React, { useState, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

// ─── Python Syntax Highlighting (zero dependencies) ──────────────────────────

const COLORS = {
  kw:  '#c678dd', // purple - keywords
  fn:  '#61afef', // blue - functions
  str: '#98c379', // green - strings
  num: '#d19a66', // orange - numbers
  cmt: '#5c6370', // gray - comments
  dec: '#e5c07b', // yellow - decorators
  op:  '#56b6c2', // cyan - operators
};

function highlightLine(line: string): string {
  // Escape HTML
  let text = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Track which character positions are already highlighted
  const len = text.length;
  const colored = new Array(len).fill(false);

  interface Span { start: number; end: number; color: string; }
  const spans: Span[] = [];

  const markSpan = (regex: RegExp, color: string) => {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      // Check overlap
      let overlap = false;
      for (let i = s; i < e; i++) {
        if (colored[i]) { overlap = true; break; }
      }
      if (!overlap) {
        spans.push({ start: s, end: e, color });
        for (let i = s; i < e; i++) colored[i] = true;
      }
    }
  };

  // Priority order: strings > comments > decorators > keywords > builtins > func calls > numbers

  // 1. Strings (double and single quoted)
  markSpan(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, COLORS.str);

  // 2. Comments
  markSpan(/(#.*$)/gm, COLORS.cmt);

  // 3. Decorators
  markSpan(/(@\w+)/g, COLORS.dec);

  // 4. Keywords
  markSpan(/\b(async|await|def|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|try|except|finally|raise|import|from|as|class|with|yield|pass|break|continue|lambda|global|nonlocal|assert|del)\b/g, COLORS.kw);

  // 5. Built-in functions
  markSpan(/\b(len|range|print|type|int|float|str|bool|list|dict|tuple|set|enumerate|zip|map|filter|sorted|reversed|min|max|sum|abs|round|open|isinstance|hasattr|getattr|setattr|super)\b/g, COLORS.fn);

  // 6. Function/method calls: word before (
  markSpan(/\b(\w+)(?=\s*\()/g, COLORS.fn);

  // 7. Numbers
  markSpan(/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, COLORS.num);

  // Sort spans by start position (descending so we insert from end to avoid offset shift)
  spans.sort((a, b) => b.start - a.start);

  // Apply spans
  for (const sp of spans) {
    const before = text.slice(0, sp.start);
    const inner = text.slice(sp.start, sp.end);
    const after = text.slice(sp.end);
    text = before + `<span style="color:${sp.color}">${inner}</span>` + after;
  }

  return text;
}

function highlightPython(code: string): string {
  return code.split('\n').map(highlightLine).join('\n');
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PythonPreviewProps {
  code: string;
  maxHeight?: number;
}

export const PythonPreview: React.FC<PythonPreviewProps> = ({ code, maxHeight = 420 }) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const lines = code.split('\n');
  const lineCount = lines.length;
  const highlighted = highlightPython(code);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#1e1e2e' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#181825', borderBottom: '1px solid #313244',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f38ba8' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f9e2af' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#a6e3a1' }} />
          </div>
          <span style={{ fontSize: 11, color: '#6c7086', fontWeight: 600, marginLeft: 8 }}>strategy.py</span>
        </div>
        <button
          onClick={copyCode}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: copied ? 'rgba(166, 227, 161, 0.15)' : 'rgba(205, 214, 244, 0.08)',
            border: `1px solid ${copied ? '#a6e3a1' : '#313244'}`,
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
            color: copied ? '#a6e3a1' : '#cdd6f4', fontSize: 11, fontWeight: 600,
            transition: 'all 0.2s ease',
          }}
        >
          {copied ? <><Check size={12} /> Скопировано</> : <><Copy size={12} /> Копировать</>}
        </button>
      </div>

      {/* Code area with line numbers */}
      <div style={{ display: 'flex', maxHeight, overflowY: 'auto' }}>
        {/* Line numbers */}
        <div style={{
          padding: '16px 0', minWidth: 48, textAlign: 'right',
          background: '#181825', borderRight: '1px solid #313244',
          userSelect: 'none', flexShrink: 0,
        }}>
          {lines.map((_, i) => (
            <div key={i} style={{
              padding: '0 12px', fontSize: 11, fontFamily: '"Fira Code", "JetBrains Mono", monospace',
              color: '#45475a', lineHeight: '21px', height: 21,
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code content */}
        <pre
          ref={codeRef}
          style={{
            margin: 0, padding: '16px 20px', flex: 1,
            fontSize: 12.5, fontFamily: '"Fira Code", "JetBrains Mono", monospace',
            color: '#cdd6f4', lineHeight: '21px', overflowX: 'auto',
            background: 'transparent', tabSize: 4,
          }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 20px', background: '#181825', borderTop: '1px solid #313244',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: '#45475a', fontWeight: 500 }}>Python · {lineCount} строк</span>
        <span style={{ fontSize: 10, color: '#45475a', fontWeight: 500 }}>Auto-generated by Signal Bot Constructor</span>
      </div>
    </div>
  );
};

export default PythonPreview;
