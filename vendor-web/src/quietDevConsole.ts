/** Must be imported first in main.tsx so it runs before react-dom logs the tip. */
if (import.meta.env.DEV) {
  const origInfo = console.info.bind(console)
  console.info = (...args: unknown[]) => {
    const first = args[0]
    if (typeof first === 'string' && first.includes('Download the React DevTools')) return
    origInfo(...args)
  }
}
