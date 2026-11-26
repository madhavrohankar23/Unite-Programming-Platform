import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FullScreenLoader } from '@/components/feedback/FullScreenLoader';
import { useToast } from '@/components/feedback/ToastContext';
import { JoinWorkspaceModal } from '@/features/landing/JoinWorkspaceModal';
import { workspacesApi } from '@/services/api/workspacesApi';

export function JoinRoutePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const code = searchParams.get('code') ?? searchParams.get('invite') ?? '';
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!code) {
      setModalOpen(true);
      return;
    }

    let cancelled = false;
    async function joinDirectly() {
      try {
        const { workspace } = await workspacesApi.joinWorkspace(code);
        if (cancelled) return;
        notify({
          kind: 'success',
          title: `Joined "${workspace.name}"`,
          description: `Access role: ${workspace.currentUserRole}`,
        });
        navigate(`/workspace/${workspace.id}`, { replace: true });
      } catch (err) {
        if (cancelled) return;
        notify({
          kind: 'error',
          title: 'Invitation validation failed',
          description: err instanceof Error ? err.message : undefined,
        });
        setModalOpen(true);
      }
    }

    void joinDirectly();
    return () => {
      cancelled = true;
    };
  }, [code, navigate, notify]);

  if (!modalOpen) {
    return <FullScreenLoader message="Joining collaborative workspace..." />;
  }

  return (
    <div className="min-h-screen bg-[#080D17]">
      <JoinWorkspaceModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) navigate('/workspaces');
        }}
        initialCode={code}
      />
    </div>
  );
}

