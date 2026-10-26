/** Saves a blob as a file through a temporary object URL. */
export const downloadBlob = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

/** Saves text content as a file through a temporary object URL. */
export const downloadText = (fileName: string, content: string, mimeType = 'text/plain;charset=utf-8'): void =>
  downloadBlob(fileName, new Blob([content], { type: mimeType }));
