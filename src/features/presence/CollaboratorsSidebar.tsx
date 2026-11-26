import type { WorkspaceRole } from '@shared/constants/roles';
import type { WorkspaceMemberDto } from '@shared/types/models';
import { MessageSquare, Send, Shield, UserMinus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { AwarenessPeer } from '@/features/collaboration/useCollabDocument';
import { useTheme } from '@/features/theme/ThemeContext';
import { cn } from '@/lib/utilities/cn';

export interface ChatMessageItem {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: string;
}

interface CollaboratorsSidebarProps {
  currentUserId: string;
  currentUserRole: WorkspaceRole;
  members: WorkspaceMemberDto[];
  peers: AwarenessPeer[];
  chatMessages: ChatMessageItem[];
  eventsConnected: boolean;
  onSendChat: (text: string) => boolean;
  onUpdateRole: (userId: string, role: 'EDITOR' | 'VIEWER') => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onLeaveWorkspace: () => Promise<void>;
}

export function CollaboratorsSidebar({
  currentUserId,
  currentUserRole,
  members,
  peers,
  chatMessages,
  eventsConnected,
  onSendChat,
  onUpdateRole,
  onRemoveMember,
  onLeaveWorkspace,
}: CollaboratorsSidebarProps) {
  const { isLight } = useTheme();
  const [tab, setTab] = useState<'presence' | 'chat'>('presence');
  const [chatText, setChatText] = useState('');

  const onlineByUserId = new Map<string, AwarenessPeer>();
  for (const p of peers) {
    onlineByUserId.set(p.userId, p);
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!chatText.trim()) return;
    if (onSendChat(chatText.trim())) {
      setChatText('');
    }
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col border-l',
        isLight
          ? 'border-black/10 bg-gradient-to-b from-zinc-50 to-white text-black'
          : 'border-slate-400/12 bg-[#0E1523] text-[#F8FAFC]',
      )}
    >
      <div
        className={cn(
          'flex border-b',
          isLight ? 'border-black/10' : 'border-slate-400/12',
        )}
      >
        <button
          type="button"
          onClick={() => setTab('presence')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            tab === 'presence'
              ? isLight
                ? 'border-b-2 border-black text-black'
                : 'border-b-2 border-[#22D3EE] text-[#F8FAFC]'
              : isLight
                ? 'text-zinc-500 hover:text-black'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]',
          )}
        >
          <Users className="h-3.5 w-3.5" />
          People ({peers.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
            tab === 'chat'
              ? isLight
                ? 'border-b-2 border-black text-black'
                : 'border-b-2 border-[#22D3EE] text-[#F8FAFC]'
              : isLight
                ? 'text-zinc-500 hover:text-black'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]',
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
      </div>

      {tab === 'presence' ? (
        <div className="flex flex-1 flex-col justify-between overflow-y-auto p-3">
          <div className="space-y-4">
            <div>
              <h4
                className={cn(
                  'mb-2 text-[11px] font-semibold uppercase tracking-wider',
                  isLight ? 'text-zinc-500' : 'text-[#64748B]',
                )}
              >
                Active in Document ({peers.length})
              </h4>
              {peers.length === 0 ? (
                <p className="text-xs opacity-60">Open a file to join live presence.</p>
              ) : (
                <div className="space-y-1.5">
                  {peers.map((peer) => (
                    <div
                      key={peer.clientId}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2',
                        isLight ? 'border border-black/10 bg-white' : 'bg-[#141D2D]/70',
                      )}
                    >
                      <UserAvatar
                        userId={peer.userId}
                        displayName={peer.name}
                        color={peer.color}
                        size="xs"
                        showOnlineDot
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">
                          {peer.name} {peer.isSelf ? '(You)' : ''}
                        </div>
                        {peer.activeFileName && (
                          <div className="truncate text-[10px] opacity-65">
                            Editing {peer.activeFileName}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4
                className={cn(
                  'mb-2 text-[11px] font-semibold uppercase tracking-wider',
                  isLight ? 'text-zinc-500' : 'text-[#64748B]',
                )}
              >
                Workspace Members ({members.length})
              </h4>
              <div className="space-y-1.5">
                {members.map((m) => {
                  const isOnline = onlineByUserId.has(m.userId);
                  const isOwner = m.role === 'OWNER';
                  const canManage = currentUserRole === 'OWNER' && !isOwner;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2',
                        isLight
                          ? 'border-black/10 bg-white'
                          : 'border-slate-400/10 bg-[#080D17]/60',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          userId={m.userId}
                          displayName={m.user.displayName}
                          size="xs"
                          showOnlineDot={isOnline}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">
                            {m.user.displayName}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] opacity-65">
                            <Shield
                              className={cn(
                                'h-2.5 w-2.5',
                                isLight ? 'text-black' : 'text-[#22D3EE]',
                              )}
                            />
                            {m.role}
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <select
                            value={m.role}
                            onChange={(e) =>
                              void onUpdateRole(
                                m.userId,
                                e.target.value as 'EDITOR' | 'VIEWER',
                              )
                            }
                            aria-label={`Role for ${m.user.displayName}`}
                            className={cn(
                              'h-6 rounded border px-1 text-[10px]',
                              isLight
                                ? 'border-black/15 bg-white text-black'
                                : 'border-slate-400/15 bg-[#0E1523] text-[#E2E8F0]',
                            )}
                          >
                            <option value="EDITOR">Editor</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void onRemoveMember(m.userId)}
                            className="rounded p-1 opacity-60 hover:bg-red-500/15 hover:text-red-500 hover:opacity-100"
                            title="Remove member"
                          >
                            <UserMinus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {currentUserRole !== 'OWNER' && (
            <button
              type="button"
              onClick={() => void onLeaveWorkspace()}
              className="mt-4 w-full rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-[#EF4444]/20"
            >
              Leave Workspace
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {chatMessages.length === 0 ? (
              <p className="py-8 text-center text-xs opacity-60">
                No messages yet. Say hello to your team!
              </p>
            ) : (
              chatMessages.map((msg) => {
                const mine = msg.userId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs',
                      mine
                        ? isLight
                          ? 'ml-4 border-black/20 bg-gradient-to-b from-zinc-900 to-black text-white'
                          : 'ml-4 border-[#2563EB]/30 bg-[#2563EB]/15 text-[#E2E8F0]'
                        : isLight
                          ? 'mr-4 border-black/10 bg-white text-black'
                          : 'mr-4 border-slate-400/10 bg-[#141D2D] text-[#E2E8F0]',
                    )}
                  >
                    <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] opacity-75">
                      <span className="font-semibold">{msg.displayName}</span>
                      <span>
                        {new Date(msg.sentAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleSend}
            className={cn(
              'flex items-center gap-1.5 border-t p-2.5',
              isLight ? 'border-black/10' : 'border-slate-400/12',
            )}
          >
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              disabled={!eventsConnected}
              placeholder={eventsConnected ? 'Message team...' : 'Reconnecting chat...'}
              className={cn(
                'h-8 flex-1 rounded-lg border px-2.5 text-xs focus:outline-none disabled:opacity-50',
                isLight
                  ? 'border-black/15 bg-white text-black placeholder:text-zinc-400 focus:border-black'
                  : 'border-slate-400/15 bg-[#080D17] text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#2563EB]',
              )}
            />
            <button
              type="submit"
              disabled={!eventsConnected || !chatText.trim()}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-40',
                isLight ? 'bg-black hover:bg-zinc-800' : 'bg-[#2563EB] hover:bg-[#3B82F6]',
              )}
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
