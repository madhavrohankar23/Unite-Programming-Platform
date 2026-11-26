import {
  DEVELOPMENT_STACK_OPTIONS,
  PROGRAMMING_STACK_OPTIONS,
  SUPPORTED_LANGUAGES,
  type WorkspaceCategory,
} from '@shared/constants/languages';
import { Code2, Globe, Radio, Sliders } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/feedback/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';
import { workspacesApi } from '@/services/api/workspacesApi';

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CUSTOM_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.id !== 'plaintext');

export function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { isLight } = useTheme();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<WorkspaceCategory>('programming');
  const [progStack, setProgStack] = useState<string>('javascript');
  const [devStack, setDevStack] = useState<string>('html-css-js');
  const [customLanguage, setCustomLanguage] = useState<string>('typescript');
  const [liveServerEnabled, setLiveServerEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const selectedLang =
        category === 'programming'
          ? progStack
          : category === 'custom'
            ? customLanguage
            : devStack === 'nodejs'
              ? 'javascript'
              : devStack === 'nextjs'
                ? 'typescriptreact'
                : devStack === 'react'
                  ? 'javascriptreact'
                  : 'html';

      const stack =
        category === 'programming'
          ? progStack
          : category === 'development'
            ? devStack
            : customLanguage;

      const { workspace } = await workspacesApi.create({
        name: name.trim(),
        category,
        defaultLanguage: selectedLang,
        stack,
        liveServerEnabled: category === 'development' ? liveServerEnabled : false,
      });

      notify({
        kind: 'success',
        title: `Created "${workspace.name}"`,
        description: `6-digit join code: ${workspace.joinCode}`,
      });
      onOpenChange(false);
      setName('');
      navigate(`/workspace/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create workspace');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create Collaborative Workspace"
      description="Choose a workspace mode. A unique shuffled 6-digit join code is generated automatically."
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#FCA5A5]">
            {error}
          </div>
        )}

        <Input
          label="Workspace Name"
          required
          minLength={2}
          maxLength={80}
          placeholder="e.g. Core Systems or Marketing Site"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        {/* Category Switcher: Programming | Development | Custom */}
        <div className="space-y-2">
          <span
            className={cn(
              'block text-xs font-medium',
              isLight ? 'text-zinc-700' : 'text-[#94A3B8]',
            )}
          >
            Workspace Mode
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'programming', label: 'Programming', icon: Code2 },
                { id: 'development', label: 'Development', icon: Globe },
                { id: 'custom', label: 'Custom', icon: Sliders },
              ] as const
            ).map((cat) => {
              const Icon = cat.icon;
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all',
                    active
                      ? isLight
                        ? 'border-black bg-gradient-to-b from-zinc-800 to-black text-white shadow-md'
                        : 'border-[#2563EB] bg-[#2563EB]/15 text-[#F8FAFC] shadow-[0_0_16px_rgba(37,99,235,0.22)]'
                      : isLight
                        ? 'border-black/12 bg-white text-zinc-700 hover:bg-zinc-50'
                        : 'border-slate-400/12 bg-[#080D17]/70 text-[#94A3B8] hover:border-slate-400/25',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 1: Programming */}
        {category === 'programming' && (
          <div className="space-y-2">
            <span
              className={cn(
                'block text-xs font-medium',
                isLight ? 'text-zinc-700' : 'text-[#94A3B8]',
              )}
            >
              Programming Language (C, C++, Python, Java, JavaScript)
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PROGRAMMING_STACK_OPTIONS.map((item) => {
                const selected = progStack === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setProgStack(item.id)}
                    className={cn(
                      'rounded-xl border p-2.5 text-left transition-all',
                      selected
                        ? isLight
                          ? 'border-black bg-zinc-100 text-black ring-1 ring-black/20'
                          : 'border-[#22D3EE]/70 bg-[#2563EB]/15 text-[#F8FAFC]'
                        : isLight
                          ? 'border-black/10 bg-white text-zinc-700 hover:border-black/25'
                          : 'border-slate-400/12 bg-[#080D17]/70 text-[#E2E8F0] hover:border-slate-400/25',
                    )}
                  >
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div
                      className={cn(
                        'mt-0.5 text-[10px]',
                        isLight ? 'text-zinc-500' : 'text-[#94A3B8]',
                      )}
                    >
                      {item.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Development + Live Server */}
        {category === 'development' && (
          <div className="space-y-3">
            <span
              className={cn(
                'block text-xs font-medium',
                isLight ? 'text-zinc-700' : 'text-[#94A3B8]',
              )}
            >
              Development Stack (HTML, CSS, JS, React, Tailwind, Next.js, Node.js)
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEVELOPMENT_STACK_OPTIONS.map((item) => {
                const selected = devStack === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDevStack(item.id)}
                    className={cn(
                      'rounded-xl border p-2.5 text-left transition-all',
                      selected
                        ? isLight
                          ? 'border-black bg-zinc-100 text-black ring-1 ring-black/20'
                          : 'border-[#22D3EE]/70 bg-[#2563EB]/15 text-[#F8FAFC]'
                        : isLight
                          ? 'border-black/10 bg-white text-zinc-700 hover:border-black/25'
                          : 'border-slate-400/12 bg-[#080D17]/70 text-[#E2E8F0] hover:border-slate-400/25',
                    )}
                  >
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div
                      className={cn(
                        'mt-0.5 text-[10px]',
                        isLight ? 'text-zinc-500' : 'text-[#94A3B8]',
                      )}
                    >
                      {item.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <label
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs',
                isLight
                  ? 'border-black/12 bg-zinc-50 text-black'
                  : 'border-slate-400/15 bg-[#080D17]/70 text-[#F8FAFC]',
              )}
            >
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[#22C55E]" />
                <div>
                  <div className="font-semibold">Enable Live Server Preview</div>
                  <div className={cn('text-[11px]', isLight ? 'text-zinc-500' : 'text-[#94A3B8]')}>
                    Auto-reloading browser preview panel inside the IDE
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={liveServerEnabled}
                onChange={(e) => setLiveServerEnabled(e.target.checked)}
                className="h-4 w-4 accent-black"
              />
            </label>
          </div>
        )}

        {/* Section 3: Custom Single Language */}
        {category === 'custom' && (
          <div className="space-y-2">
            <label
              className={cn(
                'block text-xs font-medium',
                isLight ? 'text-zinc-700' : 'text-[#94A3B8]',
              )}
            >
              Select Single Workspace Language
            </label>
            <select
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              className={cn(
                'h-10 w-full rounded-xl border px-3 text-sm focus:outline-none',
                isLight
                  ? 'border-black/15 bg-white text-black focus:border-black'
                  : 'border-slate-400/15 bg-[#080D17] text-[#F8FAFC] focus:border-[#2563EB]',
              )}
            >
              {CUSTOM_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label} ({lang.defaultFileName}) — {lang.runtimeLabel}
                </option>
              ))}
            </select>
            <p className={cn('text-[11px]', isLight ? 'text-zinc-500' : 'text-[#94A3B8]')}>
              Custom mode initializes a focused workspace dedicated to this single selected language.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={loading}>
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
