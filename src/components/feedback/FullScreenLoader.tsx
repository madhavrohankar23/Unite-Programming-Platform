import { UniteTransitionLoader } from './UniteTransitionLoader';

export function FullScreenLoader({
  message = 'Loading Unite...',
  submessage = 'Preparing your collaborative environment',
}: {
  message?: string;
  submessage?: string;
}) {
  return <UniteTransitionLoader message={message} submessage={submessage} />;
}
