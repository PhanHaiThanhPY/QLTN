import { useState } from 'react';
import { signatureKey } from '../build-document';
import { signedAtLine, type PrintSignature } from '../print-format';
import { useSignatureLoadReport } from './signature-load';

interface SignatureBoxProps {
  /** Heading lines of the block, as on the form. */
  heading: readonly string[];
  signature: PrintSignature | null;
  /** Printed under the heading: the title is never printed in S1 (BR-B7-05), so the form's line stays dotted. */
  titleLine?: string;
}

/**
 * BR-B7-05: image, signer and when; an unsigned box stays empty for a hand signature. An image that fails to load is
 * reported (the page then refuses to print) and the box says so instead of showing a broken image.
 */
export const SignatureBox = ({ heading, signature, titleLine }: SignatureBoxProps) => {
  const report = useSignatureLoadReport();
  const [hasFailed, setFailed] = useState(false);
  return (
    <div className="d5-sign-box">
      {heading.map((line) => (
        <p key={line} className="d5-heading">
          {line}
        </p>
      ))}
      {titleLine ? <p>{titleLine}</p> : null}
      {signature && hasFailed ? <p className="d5-small">Không tải được ảnh chữ ký</p> : null}
      {signature && !hasFailed ? (
        <img
          src={signature.imageDataUrl}
          alt={`Chữ ký của ${signature.signerName}`}
          onLoad={() => report(signatureKey(signature), 'loaded')}
          onError={() => {
            setFailed(true);
            report(signatureKey(signature), 'failed');
          }}
        />
      ) : null}
      {signature ? (
        <>
          <p className="d5-heading">{signature.signerName}</p>
          <p className="d5-small">{signedAtLine(signature.signedAt)}</p>
        </>
      ) : null}
    </div>
  );
};
