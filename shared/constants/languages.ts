export type ExecutionRuntimeKind =
  | 'browser-webcontainer'
  | 'browser-pyodide'
  | 'hosted-sandbox'
  | 'editor-only';

export type WorkspaceCategory = 'programming' | 'development' | 'custom';

export interface LanguageDefinition {
  id: string;
  label: string;
  monacoId: string;
  extensions: readonly string[];
  runtime: ExecutionRuntimeKind;
  runtimeLabel: string;
  executable: boolean;
  defaultFileName: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageDefinition[] = [
  {
    id: 'javascript',
    label: 'JavaScript',
    monacoId: 'javascript',
    extensions: ['.js', '.mjs', '.cjs'],
    runtime: 'browser-webcontainer',
    runtimeLabel: 'Node.js (WebContainer)',
    executable: true,
    defaultFileName: 'index.js',
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    monacoId: 'typescript',
    extensions: ['.ts', '.mts', '.cts'],
    runtime: 'browser-webcontainer',
    runtimeLabel: 'Node.js / TS (WebContainer)',
    executable: true,
    defaultFileName: 'index.ts',
  },
  {
    id: 'javascriptreact',
    label: 'React (JSX)',
    monacoId: 'javascript',
    extensions: ['.jsx'],
    runtime: 'editor-only',
    runtimeLabel: 'Live Server Preview',
    executable: false,
    defaultFileName: 'App.jsx',
  },
  {
    id: 'typescriptreact',
    label: 'React (TSX)',
    monacoId: 'typescript',
    extensions: ['.tsx'],
    runtime: 'editor-only',
    runtimeLabel: 'Live Server Preview',
    executable: false,
    defaultFileName: 'App.tsx',
  },
  {
    id: 'python',
    label: 'Python',
    monacoId: 'python',
    extensions: ['.py'],
    runtime: 'browser-pyodide',
    runtimeLabel: 'Python 3 (Pyodide WASM)',
    executable: true,
    defaultFileName: 'main.py',
  },
  {
    id: 'c',
    label: 'C',
    monacoId: 'c',
    extensions: ['.c', '.h'],
    runtime: 'hosted-sandbox',
    runtimeLabel: 'GCC (Hosted Sandbox)',
    executable: true,
    defaultFileName: 'main.c',
  },
  {
    id: 'cpp',
    label: 'C++',
    monacoId: 'cpp',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp'],
    runtime: 'hosted-sandbox',
    runtimeLabel: 'G++ (Hosted Sandbox)',
    executable: true,
    defaultFileName: 'main.cpp',
  },
  {
    id: 'java',
    label: 'Java',
    monacoId: 'java',
    extensions: ['.java'],
    runtime: 'hosted-sandbox',
    runtimeLabel: 'OpenJDK (Hosted Sandbox)',
    executable: true,
    defaultFileName: 'Main.java',
  },
  {
    id: 'go',
    label: 'Go',
    monacoId: 'go',
    extensions: ['.go'],
    runtime: 'hosted-sandbox',
    runtimeLabel: 'Go (Hosted Sandbox)',
    executable: true,
    defaultFileName: 'main.go',
  },
  {
    id: 'rust',
    label: 'Rust',
    monacoId: 'rust',
    extensions: ['.rs'],
    runtime: 'hosted-sandbox',
    runtimeLabel: 'Rust (Hosted Sandbox)',
    executable: true,
    defaultFileName: 'main.rs',
  },
  {
    id: 'php',
    label: 'PHP',
    monacoId: 'php',
    extensions: ['.php'],
    runtime: 'hosted-sandbox',
    runtimeLabel: 'PHP (Hosted Sandbox)',
    executable: true,
    defaultFileName: 'index.php',
  },
  {
    id: 'html',
    label: 'HTML',
    monacoId: 'html',
    extensions: ['.html', '.htm'],
    runtime: 'editor-only',
    runtimeLabel: 'Live Server Preview',
    executable: false,
    defaultFileName: 'index.html',
  },
  {
    id: 'css',
    label: 'CSS',
    monacoId: 'css',
    extensions: ['.css'],
    runtime: 'editor-only',
    runtimeLabel: 'Stylesheet (Live Server)',
    executable: false,
    defaultFileName: 'styles.css',
  },
  {
    id: 'json',
    label: 'JSON',
    monacoId: 'json',
    extensions: ['.json'],
    runtime: 'editor-only',
    runtimeLabel: 'Data (Editor Only)',
    executable: false,
    defaultFileName: 'package.json',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    monacoId: 'markdown',
    extensions: ['.md', '.markdown'],
    runtime: 'editor-only',
    runtimeLabel: 'Document (Editor Only)',
    executable: false,
    defaultFileName: 'README.md',
  },
  {
    id: 'plaintext',
    label: 'Plain Text',
    monacoId: 'plaintext',
    extensions: ['.txt', '.env', '.log'],
    runtime: 'editor-only',
    runtimeLabel: 'Text (Editor Only)',
    executable: false,
    defaultFileName: 'notes.txt',
  },
] as const;

export const PROGRAMMING_STACK_OPTIONS = [
  { id: 'c', label: 'C', desc: 'GCC sandbox (main.c)' },
  { id: 'cpp', label: 'C++', desc: 'G++ sandbox (main.cpp)' },
  { id: 'python', label: 'Python', desc: 'Pyodide WASM (main.py)' },
  { id: 'java', label: 'Java', desc: 'OpenJDK sandbox (Main.java)' },
  { id: 'javascript', label: 'JavaScript', desc: 'Node.js WebContainer (index.js)' },
] as const;

export const DEVELOPMENT_STACK_OPTIONS = [
  { id: 'html-css-js', label: 'HTML / CSS / JS', desc: 'Static web + Live Server' },
  { id: 'react', label: 'React', desc: 'React UI + Live Server' },
  { id: 'tailwind', label: 'Tailwind CSS', desc: 'Utility-first UI + Live Server' },
  { id: 'nextjs', label: 'Next.js', desc: 'App Router starter + Live Server' },
  { id: 'nodejs', label: 'Node.js', desc: 'WebContainer server + Live Server' },
] as const;

export const HOSTED_SANDBOX_LANGUAGES = new Set([
  'c',
  'cpp',
  'java',
  'go',
  'rust',
  'php',
]);

export function detectLanguageFromFileName(fileName: string): LanguageDefinition {
  const lower = fileName.trim().toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot !== -1) {
    const ext = lower.slice(lastDot);
    const match = SUPPORTED_LANGUAGES.find((lang) => lang.extensions.includes(ext));
    if (match) {
      return match;
    }
  }
  return SUPPORTED_LANGUAGES.find((lang) => lang.id === 'plaintext')!;
}

export function getLanguageById(languageId: string): LanguageDefinition {
  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.id === languageId) ??
    SUPPORTED_LANGUAGES.find((lang) => lang.id === 'plaintext')!
  );
}
