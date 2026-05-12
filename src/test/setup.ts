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

  // jsdom does not implement IntersectionObserver; framer-motion's
  // `whileInView` uses it. Stub with a no-op so any component using
  // motion viewport triggers can render under tests.
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    class IntersectionObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    }
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: IntersectionObserverStub,
    })
  }
}
