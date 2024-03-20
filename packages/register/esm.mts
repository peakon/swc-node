import { fileURLToPath, pathToFileURL } from 'url'

import ts from 'typescript'

// @ts-expect-error
import { readDefaultTsConfig } from '../lib/read-default-tsconfig.js'
// @ts-expect-error
import { compile } from '../lib/register.js'

interface ResolveContext {
  conditions: string[]
  parentURL: string | undefined
}
interface ResolveResult {
  format?: string
  shortCircuit?: boolean
  url: string
}
type ResolveArgs = [
  specifier: string,
  context?: ResolveContext,
  nextResolve?: (...args: ResolveArgs) => Promise<ResolveResult>,
]
type ResolveFn = (...args: Required<ResolveArgs>) => Promise<ResolveResult>

const tsconfig: ts.CompilerOptions = readDefaultTsConfig()
tsconfig.module = ts.ModuleKind.ESNext

const moduleResolutionCache = ts.createModuleResolutionCache(ts.sys.getCurrentDirectory(), (x) => x, tsconfig)
const host: ts.ModuleResolutionHost = {
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
}
const EXTENSIONS: string[] = [ts.Extension.Ts, ts.Extension.Tsx, ts.Extension.Mts]

export const resolve: ResolveFn = async (specifier, context, nextResolve) => {
  const isTS = EXTENSIONS.some((ext) => specifier.endsWith(ext))

  // entrypoint
  if (!context.parentURL) {
    return {
      format: isTS ? 'ts' : undefined,
      url: specifier,
      shortCircuit: true,
    }
  }

  // import/require from external library
  if (context.parentURL.includes('/node_modules/') && !isTS) {
    return nextResolve(specifier)
  }

  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    fileURLToPath(context.parentURL),
    tsconfig,
    host,
    moduleResolutionCache,
  )

  const isTsModule = resolvedModule
    ? EXTENSIONS.includes(resolvedModule.extension) && !resolvedModule.resolvedFileName.includes('/node_modules/')
    : EXTENSIONS.some((ext) => specifier.endsWith(ext)) && !fileURLToPath(specifier).includes('/node_modules/')

  // import from local project to local project TS file
  if (isTsModule) {
    return {
      format: 'ts',
      url: resolvedModule
        ? pathToFileURL(resolvedModule.resolvedFileName).href
        : pathToFileURL(fileURLToPath(specifier)).href,
      shortCircuit: true,
    }
  }

  // import from local project to either:
  // - something TS couldn't resolve
  // - external library
  // - local project non-TS file
  return nextResolve(specifier)
}

interface LoadContext {
  conditions: string[]
  format: string | null | undefined
}
interface LoadResult {
  format: string
  shortCircuit?: boolean
  source: string | ArrayBuffer | SharedArrayBuffer | Uint8Array
}
type LoadArgs = [url: string, context: LoadContext, nextLoad?: (...args: LoadArgs) => Promise<LoadResult>]
type LoadFn = (...args: Required<LoadArgs>) => Promise<LoadResult>

export const load: LoadFn = async (url, context, nextLoad) => {
  if (context.format === 'ts' || (tsconfig.allowJs && context.format === 'module')) {
    const { source } = await nextLoad(url, context)
    const code = typeof source === 'string' ? source : Buffer.from(source).toString()
    const compiled = await compile(code, fileURLToPath(url), tsconfig, true)
    return {
      format: 'module',
      source: compiled,
      shortCircuit: true,
    }
  } else {
    return nextLoad(url, context)
  }
}
