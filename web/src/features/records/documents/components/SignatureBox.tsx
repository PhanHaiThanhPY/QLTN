import { signedAtLine, type PrintSignature } from '../print-format';

interface SignatureBoxProps {
  /** Heading lines of the block, as on the form. */
  heading: readonly string[];
  signature: PrintSignature | null;
  /** Printed under the heading: the title is never printed in S1 (BR-B7-05), so the form's line stays dotted. */
  titleLine?: string;
}

/** BR-B7-05: image, signer and when; an unsigned box stays empty for a hand signature. */
export const SignatureBox = ({ heading, signature, titleLine }: SignatureBoxProps) => (
  <div className="d5-sign-box">
    {heading.map((line) => (
      <p key={line} className="d5-heading">
        {line}
      </p>
    ))}
    {titleLine ? <p>{titleLine}</p> : null}
    {signature ? (
      <>
        <img src={signature.imageDataUrl} alt={`Chữ ký của ${signature.signerName}`} />
        <p className="d5-heading">{signature.signerName}</p>
        <p className="d5-small">{signedAtLine(signature.signedAt)}</p>
      </>
    ) : null}
  </div>
);
