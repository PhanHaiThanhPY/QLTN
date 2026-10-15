import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

/**
 * jsdom's Blob/File lack arrayBuffer() and cannot be structured-cloned into fake IndexedDB.
 * Component tests that seed the demo database swap in Node's implementations.
 */
export const installNodeBlobs = (): void => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  globalThis.File = NodeFile as unknown as typeof File;
};
