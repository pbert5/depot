/** Keep download names portable and prevent user-provided path components. */
export const sanitizeDownloadName = (name: string, fallback = 'depot-backup') => {
  const sanitized = name
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
    .trim();
  return sanitized || fallback;
};

export const downloadFile = (
  filename: string,
  content: string,
  contentType = 'application/json;charset=utf-8'
) => {
  const url = URL.createObjectURL(new Blob([content], { type: contentType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeDownloadName(filename);
  anchor.click();
  URL.revokeObjectURL(url);
};

export const isoDate = (date = new Date()) => date.toISOString().slice(0, 10);

export const isoTimestamp = (date = new Date()) => date.toISOString().replace(/[-:.]/g, '').replace(/\d{3}Z$/, 'Z');

export const readJsonFile = async <T>(file: File): Promise<T> => JSON.parse(await file.text()) as T;
