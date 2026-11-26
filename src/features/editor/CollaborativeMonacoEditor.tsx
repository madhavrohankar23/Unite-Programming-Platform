import Editor, { loader, type OnMount } from '@monaco-editor/react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { useEffect, useRef, useState } from 'react';
import { MonacoBinding } from 'y-monaco';
import type * as Y from 'yjs';
import { useTheme } from '@/features/theme/ThemeContext';
import { UNITE_MONACO_LIGHT_THEME, UNITE_MONACO_THEME } from './uniteMonacoTheme';

// Configure local Monaco workers so no external CDN scripts are loaded under COEP
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });

export interface EditorSettings {
  fontSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  tabSize: number;
}

interface CollaborativeMonacoEditorProps {
  fileId: string;
  language: string;
  yDoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  readOnly: boolean;
  settings: EditorSettings;
  onContentChange?: (text: string) => void;
  onRunShortcut?: () => void;
  onSaveShortcut?: () => void;
}

export function CollaborativeMonacoEditor({
  fileId,
  language,
  yDoc,
  provider,
  readOnly,
  settings,
  onContentChange,
  onRunShortcut,
  onSaveShortcut,
}: CollaborativeMonacoEditorProps) {
  const { isLight } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  const onRunRef = useRef(onRunShortcut);
  onRunRef.current = onRunShortcut;
  const onSaveRef = useRef(onSaveShortcut);
  onSaveRef.current = onSaveShortcut;
  const onContentRef = useRef(onContentChange);
  onContentRef.current = onContentChange;

  const handleMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    monacoInstance.editor.defineTheme('unite-dark', UNITE_MONACO_THEME);
    monacoInstance.editor.defineTheme('unite-light', UNITE_MONACO_LIGHT_THEME);
    monacoInstance.editor.setTheme(isLight ? 'unite-light' : 'unite-dark');

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      onRunRef.current?.();
    });
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });

    setEditorReady(true);
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(isLight ? 'unite-light' : 'unite-dark');
    }
  }, [isLight]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editorReady || !editor || !yDoc || !provider || !provider.awareness) {
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    bindingRef.current?.destroy();
    const yText = yDoc.getText('monaco');
    const binding = new MonacoBinding(
      yText,
      model,
      new Set([editor]),
      provider.awareness,
    );
    bindingRef.current = binding;

    const handleYChange = () => {
      onContentRef.current?.(yText.toString());
    };
    yText.observe(handleYChange);
    handleYChange();

    return () => {
      yText.unobserve(handleYChange);
      binding.destroy();
      bindingRef.current = null;
    };
  }, [editorReady, fileId, yDoc, provider]);

  return (
    <div
      className={
        isLight ? 'relative h-full w-full bg-white' : 'relative h-full w-full bg-[#080D17]'
      }
    >
      <Editor
        height="100%"
        path={`unite:///${fileId}`}
        language={language}
        theme={isLight ? 'unite-light' : 'unite-dark'}
        onMount={handleMount}
        options={{
          readOnly,
          fontSize: settings.fontSize,
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
          fontLigatures: true,
          wordWrap: settings.wordWrap,
          minimap: { enabled: settings.minimap },
          tabSize: settings.tabSize,
          automaticLayout: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          padding: { top: 12, bottom: 12 },
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
