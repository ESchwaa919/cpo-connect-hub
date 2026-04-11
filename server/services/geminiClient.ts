import { GoogleGenAI } from '@google/genai'

export const EMBEDDING_MODEL = 'gemini-embedding-2-preview'
export const EMBEDDING_DIM = 768

let client: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey })
  }
  return client
}
