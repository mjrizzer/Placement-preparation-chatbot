'use client';
import Editor, { loader } from '@monaco-editor/react';
import { useRef, useEffect } from 'react';
import type { editor } from 'monaco-editor';
const monacoLanguage: Record<string, string> = {
  C: 'c',
  'C++': 'cpp',
  Java: 'java',
  Python: 'python',
  JavaScript: 'javascript',
  TypeScript: 'typescript',
  Go: 'go',
  Rust: 'rust',
  'C#': 'csharp',
  Kotlin: 'kotlin',
  PHP: 'php',
};
loader.config({ paths: { vs: '/monaco/vs' } });
export default function CodeEditor({
  language,
  value,
  onChange,
  readOnly = false,
}: {
  language: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<editor.IStandaloneCodeEditor | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const block = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const keys = (event: KeyboardEvent) => {
      if (
        ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x'].includes(event.key.toLowerCase())) ||
        ((event.shiftKey || event.ctrlKey) && event.key === 'Insert') ||
        (event.shiftKey && event.key === 'Delete')
      )
        block(event);
    };
    const events = ['copy', 'cut', 'paste', 'drop', 'dragover', 'contextmenu'];
    events.forEach((name) => node.addEventListener(name, block, true));
    node.addEventListener('keydown', keys, true);
    return () => {
      events.forEach((name) => node.removeEventListener(name, block, true));
      node.removeEventListener('keydown', keys, true);
    };
  }, []);
  return (
    <div ref={container}>
      <div className="editor-toolbar">
        <span>solution · {language}</span>
        <button
          disabled={!['JavaScript', 'TypeScript'].includes(language)}
          onClick={() => ref.current?.getAction('editor.action.formatDocument')?.run()}
          title="Built-in formatting is available for JavaScript and TypeScript"
        >
          Format code
        </button>
      </div>
      <Editor
        height="390px"
        language={monacoLanguage[language] || 'plaintext'}
        value={value}
        theme="vs-dark"
        onChange={(v) => onChange(v || '')}
        onMount={(e) => {
          ref.current = e;
        }}
        options={{
          readOnly,
          contextmenu: false,
          dragAndDrop: false,
          fontSize: 13,
          minimap: { enabled: false },
          padding: { top: 18 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          ariaLabel: 'Code editor',
          lineNumbers: 'on',
          autoIndent: 'full',
          editContext: false,
          copyWithSyntaxHighlighting: false,
        }}
      />
      <p className="muted small" style={{ padding: '10px 16px', margin: 0 }}>
        Type your own code. Copy, cut, paste, and drag-and-drop are disabled.
      </p>
    </div>
  );
}
