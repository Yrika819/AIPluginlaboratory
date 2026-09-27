export async function readFileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export async function readFileText(file) {
  return file.text();
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name || "download";
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadBytes(bytes, name, type = "application/octet-stream") {
  downloadBlob(new Blob([bytes], { type }), name);
}

export function downloadText(text, name, type = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([text], { type }), name);
}

export async function fileToDataUrl(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
