export function downloadBlob(blobOrBuffer, filename) {
  if (!blobOrBuffer) throw new Error('No se recibió contenido para descargar');

  const blob = blobOrBuffer instanceof Blob
    ? blobOrBuffer
    : new Blob([blobOrBuffer], { type: 'application/pdf' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'documento.pdf';
  link.style.display = 'none';
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 2000);
  }
}
