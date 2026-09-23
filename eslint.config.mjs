import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) })
const config = [
  { ignores: ['.next/**', 'node_modules/**', '.npm-cache/**', 'next-env.d.ts', 'audit/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default config
