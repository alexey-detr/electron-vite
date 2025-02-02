/*
 * The core of this plugin was conceived by pi0 and is taken from the following repository:
 * https://github.com/unjs/unbuild/blob/main/src/builder/plugins/cjs.ts
 * license: https://github.com/unjs/unbuild/blob/main/LICENSE
 */

import MagicString from 'magic-string'
import type { SourceMapInput } from 'rollup'
import type { Plugin } from 'vite'

const CJSyntaxRe = /__filename|__dirname|require\(|require\.resolve\(/

const CJSShim = `
// -- CommonJS Shims --
import __cjs_url__ from 'node:url';
import __cjs_path__ from 'node:path';
import __cjs_mod__ from 'node:module';
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require = __cjs_mod__.createRequire(import.meta.url);
`

const ESMStaticImportRe = /import\s+.+?\s+from\s+['"].+?['"];(?![\s\S]*import\s+.+?\s+from\s+['"].+?['"];)/gmu

interface StaticImport {
  end: number
}

function findStaticImports(code: string): StaticImport[] {
  const matches: StaticImport[] = []
  for (const match of code.matchAll(ESMStaticImportRe)) {
    matches.push({ end: (match.index || 0) + match[0].length })
  }
  return matches
}

export default function esmShimPlugin(): Plugin {
  let sourcemap: boolean | 'inline' | 'hidden' = false
  return {
    name: 'vite:esm-shim',
    apply: 'build',
    enforce: 'post',
    configResolved(config): void {
      sourcemap = config.build.sourcemap
    },
    renderChunk(code, _chunk, options): { code: string; map?: SourceMapInput } | null {
      if (options.format === 'es') {
        if (code.includes(CJSShim) || !CJSyntaxRe.test(code)) {
          return null
        }

        const lastESMImport = findStaticImports(code).pop()
        const indexToAppend = lastESMImport ? lastESMImport.end : 0
        const s = new MagicString(code)
        s.appendRight(indexToAppend, CJSShim)
        return {
          code: s.toString(),
          map: sourcemap ? s.generateMap({ hires: 'boundary' }) : null
        }
      }

      return null
    }
  }
}
