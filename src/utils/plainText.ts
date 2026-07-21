export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html || '<p></p>', 'text/html')
  return doc.body.textContent ?? ''
}

export function slicePlainText(plainText: string, start: number, end: number): string {
  return plainText.slice(start, end)
}
