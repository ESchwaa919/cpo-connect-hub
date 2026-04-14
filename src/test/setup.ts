import '@testing-library/jest-dom'

// matchMedia polyfill for jsdom. Guarded with `typeof window` so this
// setup file is harmless in test files that opt into the `node`
// environment (e.g. embed.test.ts which runs the real onnxruntime
// pipeline that misbehaves under jsdom's substituted typed arrays).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
