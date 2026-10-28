export const readNotebookImport = async (
  fileSize: number,
  maxBytes: number,
  readText: () => Promise<string>,
): Promise<string> => {
  if (fileSize > maxBytes) throw new Error('Choose a notebook JSON file of 2 MB or less. This file was not read.');
  return readText();
};
