import type { ProposalSignature } from '@/domain/types';
import { ActorLine } from '../shared/ActorLine';

const KIND_LABEL: Record<ProposalSignature['kind'], string> = {
  SUBMITTER: 'Người trình ký',
};

/** A stored drawn signature with signer, time and the submission it belongs to. */
export const SignatureView = ({ signature }: { signature: ProposalSignature }) => (
  <figure className="rounded-lg border border-line bg-surface-2 p-3">
    <figcaption className="text-xs font-semibold text-ink-2">
      {KIND_LABEL[signature.kind]} · lần trình {signature.attemptNo}
    </figcaption>
    <img
      src={signature.imageDataUrl}
      alt={`Chữ ký – ${KIND_LABEL[signature.kind]}`}
      className="my-2 h-20 w-full max-w-xs rounded-md bg-white object-contain"
    />
    <ActorLine actorId={signature.actorId} at={signature.signedAt} />
  </figure>
);
