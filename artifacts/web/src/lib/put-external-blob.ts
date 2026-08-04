/** PUT blob to an arbitrary URL (custom S3 etc.) — not a platform API. */
export function putBlobToUrl(
  url: string,
  blob: Blob,
  headers: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`PUT failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network error"));
    xhr.send(blob);
  });
}
