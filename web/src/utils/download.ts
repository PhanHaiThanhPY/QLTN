/** Saves text content as a file through a temporary object URL. */
export const downloadText = (fileName: string, content: string, mimeType = 'text/plain;charset=utf-8'): void => {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
