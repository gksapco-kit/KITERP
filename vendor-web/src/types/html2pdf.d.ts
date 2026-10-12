// html2pdf.js ships without type definitions. printUtils.ts wraps it with its own narrow types.
declare module 'html2pdf.js' {
  const html2pdf: () => unknown
  export default html2pdf
}
