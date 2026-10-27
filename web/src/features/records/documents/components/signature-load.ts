import { createContext, useContext } from 'react';

export type SignatureLoadState = 'loaded' | 'failed';

/** Each signature image reports whether it loaded, so the page only allows "In" with every signature (F-B7-S1-02). */
export const SignatureLoadContext = createContext<(key: string, state: SignatureLoadState) => void>(() => undefined);

export const useSignatureLoadReport = () => useContext(SignatureLoadContext);
