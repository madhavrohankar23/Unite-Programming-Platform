import {
  detectLanguageFromFileName,
  getLanguageById,
  type WorkspaceCategory,
} from '../../../shared/constants/languages.js';
import type { FileNodeType } from '../../../shared/types/models.js';
import { generateSecureId } from '../security/tokens.js';

export type WorkspaceTemplateId = 'node-starter' | 'python-starter' | 'cpp-starter' | 'blank';

export interface TemplateFileSeed {
  id: string;
  parentId: string | null;
  name: string;
  nodeType: FileNodeType;
  language: string;
  contentSnapshot: string | null;
}

function getSampleCodeForLanguage(langId: string): string {
  switch (langId) {
    case 'c':
      return [
        '#include <stdio.h>',
        '',
        'int main(void) {',
        '    printf("Hello from Unite C Sandbox!\\n");',
        '    return 0;',
        '}',
        '',
      ].join('\n');
    case 'cpp':
      return [
        '#include <iostream>',
        '#include <vector>',
        '',
        'int main() {',
        '    std::vector<int> values = {10, 20, 30, 40};',
        '    int sum = 0;',
        '    for (int v : values) sum += v;',
        '    std::cout << "Unite C++ Sandbox — Sum = " << sum << std::endl;',
        '    return 0;',
        '}',
        '',
      ].join('\n');
    case 'python':
      return [
        'def greet(team: str) -> str:',
        '    return f"Hello from {team} on Unite!"',
        '',
        'if __name__ == "__main__":',
        '    squares = [n * n for n in range(1, 6)]',
        '    print(greet("Engineering"))',
        '    print("Squares:", squares)',
        '',
      ].join('\n');
    case 'java':
      return [
        'public class Main {',
        '    public static void main(String[] args) {',
        '        System.out.println("Hello from Unite Java Sandbox!");',
        '    }',
        '}',
        '',
      ].join('\n');
    case 'javascript':
      return [
        '// Welcome to Unite — Real-time collaborative IDE',
        'function fibonacci(n) {',
        '  if (n <= 1) return n;',
        '  return fibonacci(n - 1) + fibonacci(n - 2);',
        '}',
        '',
        'const sequence = Array.from({ length: 8 }, (_, i) => fibonacci(i));',
        'console.log("Unite JavaScript Runtime Ready");',
        'console.log("Fibonacci:", sequence.join(", "));',
        '',
      ].join('\n');
    case 'typescript':
      return [
        'interface Collaborator {',
        '  name: string;',
        '  role: "OWNER" | "EDITOR" | "VIEWER";',
        '}',
        '',
        'function formatMember(member: Collaborator): string {',
        '  return `${member.name} (${member.role})`;',
        '}',
        '',
        'console.log(formatMember({ name: "Unite Team", role: "EDITOR" }));',
        '',
      ].join('\n');
    case 'go':
      return [
        'package main',
        '',
        'import "fmt"',
        '',
        'func main() {',
        '    fmt.Println("Hello from Unite Go Sandbox!")',
        '}',
        '',
      ].join('\n');
    case 'rust':
      return [
        'fn main() {',
        '    println!("Hello from Unite Rust Sandbox!");',
        '}',
        '',
      ].join('\n');
    case 'php':
      return [
        '<?php',
        'echo "Hello from Unite PHP Sandbox!\\n";',
        '',
      ].join('\n');
    case 'html':
      return [
        '<!doctype html>',
        '<html lang="en">',
        '  <head>',
        '    <meta charset="UTF-8" />',
        '    <title>Unite Live Preview</title>',
        '  </head>',
        '  <body style="font-family: Inter, sans-serif; padding: 2rem;">',
        '    <h1>Hello from Unite</h1>',
        '    <p>Edit this HTML file and watch Live Server update.</p>',
        '  </body>',
        '</html>',
        '',
      ].join('\n');
    default:
      return `// ${langId} workspace ready on Unite\n`;
  }
}

export function buildWorkspaceFilesForSelection(input: {
  category: WorkspaceCategory;
  defaultLanguage: string;
  stack?: string;
  template?: WorkspaceTemplateId;
}): TemplateFileSeed[] {
  // Backward compatibility if legacy template was passed directly
  if (input.template && !input.stack) {
    if (input.template === 'node-starter') {
      const srcId = generateSecureId('fld');
      return [
        {
          id: srcId,
          parentId: null,
          name: 'src',
          nodeType: 'FOLDER',
          language: 'plaintext',
          contentSnapshot: null,
        },
        {
          id: generateSecureId('fil'),
          parentId: srcId,
          name: 'index.js',
          nodeType: 'FILE',
          language: 'javascript',
          contentSnapshot: getSampleCodeForLanguage('javascript'),
        },
        {
          id: generateSecureId('fil'),
          parentId: srcId,
          name: 'utils.ts',
          nodeType: 'FILE',
          language: 'typescript',
          contentSnapshot: getSampleCodeForLanguage('typescript'),
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'package.json',
          nodeType: 'FILE',
          language: 'json',
          contentSnapshot: '{"name":"unite-workspace","version":"1.0.0","type":"module"}\n',
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'README.md',
          nodeType: 'FILE',
          language: 'markdown',
          contentSnapshot: '# Unite Collaborative Workspace\n',
        },
      ];
    }
    if (input.template === 'blank') {
      return [
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'README.md',
          nodeType: 'FILE',
          language: 'markdown',
          contentSnapshot: '# New Unite Workspace\n\nStart collaborating in real time.\n',
        },
      ];
    }
    if (input.template === 'python-starter') {
      return buildWorkspaceFilesForSelection({
        category: 'programming',
        defaultLanguage: 'python',
        stack: 'python',
      });
    }
    if (input.template === 'cpp-starter') {
      return buildWorkspaceFilesForSelection({
        category: 'programming',
        defaultLanguage: 'cpp',
        stack: 'cpp',
      });
    }
  }

  // Category 2: Development Stacks (with Live Server)
  if (input.category === 'development') {
    const stack = input.stack ?? 'html-css-js';

    if (stack === 'react') {
      const srcId = generateSecureId('fld');
      return [
        {
          id: srcId,
          parentId: null,
          name: 'src',
          nodeType: 'FOLDER',
          language: 'plaintext',
          contentSnapshot: null,
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'index.html',
          nodeType: 'FILE',
          language: 'html',
          contentSnapshot: [
            '<!doctype html>',
            '<html lang="en">',
            '  <head>',
            '    <meta charset="UTF-8" />',
            '    <title>Unite React Live</title>',
            '    <link rel="stylesheet" href="src/styles.css" />',
            '  </head>',
            '  <body>',
            '    <div id="root"></div>',
            '    <script type="text/babel" src="src/App.jsx"></script>',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        },
        {
          id: generateSecureId('fil'),
          parentId: srcId,
          name: 'App.jsx',
          nodeType: 'FILE',
          language: 'javascriptreact',
          contentSnapshot: [
            'function App() {',
            '  const [count, setCount] = React.useState(0);',
            '  return (',
            '    <div className="card">',
            '      <h1>Unite React Live Server</h1>',
            '      <p>Collaborative UI editing with instant preview.</p>',
            '      <button onClick={() => setCount((c) => c + 1)}>',
            '        Clicks: {count}',
            '      </button>',
            '    </div>',
            '  );',
            '}',
            '',
            'const root = ReactDOM.createRoot(document.getElementById("root"));',
            'root.render(<App />);',
            '',
          ].join('\n'),
        },
        {
          id: generateSecureId('fil'),
          parentId: srcId,
          name: 'styles.css',
          nodeType: 'FILE',
          language: 'css',
          contentSnapshot: [
            'body { margin: 0; font-family: Inter, sans-serif; background: #0a0a0a; color: #fafafa; display: grid; place-items: center; min-height: 100vh; }',
            '.card { padding: 32px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: #141414; text-align: center; }',
            'button { margin-top: 16px; padding: 10px 18px; border-radius: 10px; border: 0; background: #ffffff; color: #000000; font-weight: 600; cursor: pointer; }',
            '',
          ].join('\n'),
        },
      ];
    }

    if (stack === 'tailwind') {
      return [
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'index.html',
          nodeType: 'FILE',
          language: 'html',
          contentSnapshot: [
            '<!doctype html>',
            '<html lang="en">',
            '  <head>',
            '    <meta charset="UTF-8" />',
            '    <title>Unite Tailwind Live</title>',
            '    <script src="https://cdn.tailwindcss.com"></script>',
            '    <link rel="stylesheet" href="styles.css" />',
            '  </head>',
            '  <body class="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8">',
            '    <main class="max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-8 shadow-2xl">',
            '      <span class="text-xs uppercase tracking-widest text-zinc-400">Live Server</span>',
            '      <h1 class="mt-2 text-2xl font-bold tracking-tight">Tailwind CSS Ready</h1>',
            '      <p class="mt-2 text-sm text-zinc-400">Edit classes and preview changes immediately.</p>',
            '    </main>',
            '    <script src="app.js"></script>',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'styles.css',
          nodeType: 'FILE',
          language: 'css',
          contentSnapshot: '/* Custom CSS overrides */\nbody { font-family: Inter, system-ui, sans-serif; }\n',
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'app.js',
          nodeType: 'FILE',
          language: 'javascript',
          contentSnapshot: 'console.log("Tailwind workspace active");\n',
        },
      ];
    }

    if (stack === 'nextjs') {
      const appId = generateSecureId('fld');
      return [
        {
          id: appId,
          parentId: null,
          name: 'app',
          nodeType: 'FOLDER',
          language: 'plaintext',
          contentSnapshot: null,
        },
        {
          id: generateSecureId('fil'),
          parentId: appId,
          name: 'page.tsx',
          nodeType: 'FILE',
          language: 'typescriptreact',
          contentSnapshot: [
            'export default function HomePage() {',
            '  return (',
            '    <main style={{ padding: "3rem", fontFamily: "Inter, sans-serif" }}>',
            '      <h1>Unite Next.js Workspace</h1>',
            '      <p>Edit app/page.tsx and collaborate in real time.</p>',
            '    </main>',
            '  );',
            '}',
            '',
          ].join('\n'),
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'index.html',
          nodeType: 'FILE',
          language: 'html',
          contentSnapshot: [
            '<!doctype html>',
            '<html>',
            '  <head><meta charset="UTF-8" /><title>Unite Next.js Preview</title></head>',
            '  <body style="margin:0;font-family:Inter,sans-serif;background:#0a0a0a;color:#fff;padding:48px;">',
            '    <h1>Next.js App Router Workspace</h1>',
            '    <p>Live Server preview active. Edit <code>app/page.tsx</code> or <code>index.html</code>.</p>',
            '  </body>',
            '</html>',
            '',
          ].join('\n'),
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'package.json',
          nodeType: 'FILE',
          language: 'json',
          contentSnapshot: JSON.stringify(
            {
              name: 'unite-nextjs-app',
              private: true,
              scripts: { dev: 'next dev', build: 'next build' },
              dependencies: { next: '15.0.0', react: '19.0.0', 'react-dom': '19.0.0' },
            },
            null,
            2,
          ) + '\n',
        },
      ];
    }

    if (stack === 'nodejs') {
      return [
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'server.js',
          nodeType: 'FILE',
          language: 'javascript',
          contentSnapshot: [
            'import http from "node:http";',
            '',
            'const server = http.createServer((req, res) => {',
            '  res.writeHead(200, { "Content-Type": "text/html" });',
            '  res.end("<h1>Unite Node.js Live Server</h1><p>Running in WebContainer!</p>");',
            '});',
            '',
            'server.listen(3000, () => {',
            '  console.log("Server listening on http://localhost:3000");',
            '});',
            '',
          ].join('\n'),
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'index.html',
          nodeType: 'FILE',
          language: 'html',
          contentSnapshot: [
            '<!doctype html>',
            '<html><body style="font-family:Inter,sans-serif;padding:32px;">',
            '  <h1>Unite Node.js Workspace</h1>',
            '  <p>Run <code>node server.js</code> in the terminal or click Run.</p>',
            '</body></html>',
            '',
          ].join('\n'),
        },
        {
          id: generateSecureId('fil'),
          parentId: null,
          name: 'package.json',
          nodeType: 'FILE',
          language: 'json',
          contentSnapshot: JSON.stringify(
            { name: 'unite-node-server', version: '1.0.0', type: 'module', scripts: { start: 'node server.js' } },
            null,
            2,
          ) + '\n',
        },
      ];
    }

    // Default html-css-js
    return [
      {
        id: generateSecureId('fil'),
        parentId: null,
        name: 'index.html',
        nodeType: 'FILE',
        language: 'html',
        contentSnapshot: [
          '<!doctype html>',
          '<html lang="en">',
          '  <head>',
          '    <meta charset="UTF-8" />',
          '    <title>Unite Live Server</title>',
          '    <link rel="stylesheet" href="styles.css" />',
          '  </head>',
          '  <body>',
          '    <main class="container">',
          '      <h1>Unite Live Server</h1>',
          '      <p id="status">Edit HTML, CSS, or JS to see live updates.</p>',
          '      <button id="btn">Click me</button>',
          '    </main>',
          '    <script src="script.js"></script>',
          '  </body>',
          '</html>',
          '',
        ].join('\n'),
      },
      {
        id: generateSecureId('fil'),
        parentId: null,
        name: 'styles.css',
        nodeType: 'FILE',
        language: 'css',
        contentSnapshot: [
          'body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, sans-serif; background: #0f172a; color: #f8fafc; }',
          '.container { text-align: center; padding: 2.5rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.12); background: #1e293b; }',
          'button { margin-top: 1rem; padding: 0.65rem 1.25rem; border-radius: 0.6rem; border: 0; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }',
          '',
        ].join('\n'),
      },
      {
        id: generateSecureId('fil'),
        parentId: null,
        name: 'script.js',
        nodeType: 'FILE',
        language: 'javascript',
        contentSnapshot: [
          'let count = 0;',
          'const btn = document.getElementById("btn");',
          'const status = document.getElementById("status");',
          'btn?.addEventListener("click", () => {',
          '  count += 1;',
          '  if (status) status.textContent = `Interactive click count: ${count}`;',
          '});',
          '',
        ].join('\n'),
      },
    ];
  }

  // Category 1 (Programming) & Category 3 (Custom single language)
  const langDef = getLanguageById(input.stack || input.defaultLanguage);
  const fileName = langDef.defaultFileName;
  const isCustomSingle = input.category === 'custom';

  const files: TemplateFileSeed[] = [
    {
      id: generateSecureId('fil'),
      parentId: null,
      name: fileName,
      nodeType: 'FILE',
      language: langDef.id,
      contentSnapshot: getSampleCodeForLanguage(langDef.id),
    },
  ];

  if (!isCustomSingle) {
    files.push({
      id: generateSecureId('fil'),
      parentId: null,
      name: 'README.md',
      nodeType: 'FILE',
      language: detectLanguageFromFileName('README.md').id,
      contentSnapshot: `# ${langDef.label} Workspace\n\nOpen \`${fileName}\` and click **Run** to execute via ${langDef.runtimeLabel}.\n`,
    });
  }

  return files;
}
