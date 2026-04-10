// Duplicated from server/types/express.d.ts because tsconfig.app.json only
// includes `src` — app-mode type checks on test files that import server
// middleware need the augmentation visible under the app project too.

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        name: string
      }
    }
  }
}

export {}
