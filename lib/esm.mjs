"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = exports.resolve = void 0;
const url_1 = require("url");
const typescript_1 = __importDefault(require("typescript"));
// @ts-expect-error
const read_default_tsconfig_js_1 = require("../lib/read-default-tsconfig.js");
// @ts-expect-error
const register_js_1 = require("../lib/register.js");
const tsconfig = (0, read_default_tsconfig_js_1.readDefaultTsConfig)();
tsconfig.module = typescript_1.default.ModuleKind.ESNext;
const moduleResolutionCache = typescript_1.default.createModuleResolutionCache(typescript_1.default.sys.getCurrentDirectory(), (x) => x, tsconfig);
const host = {
    fileExists: typescript_1.default.sys.fileExists,
    readFile: typescript_1.default.sys.readFile,
};
const EXTENSIONS = [typescript_1.default.Extension.Ts, typescript_1.default.Extension.Tsx, typescript_1.default.Extension.Mts];
const resolve = async (specifier, context, nextResolve) => {
    const isTS = EXTENSIONS.some((ext) => specifier.endsWith(ext));
    // entrypoint
    if (!context.parentURL) {
        return {
            format: isTS ? 'ts' : undefined,
            url: specifier,
            shortCircuit: true,
        };
    }
    // import/require from external library
    if (context.parentURL.includes('/node_modules/') && !isTS) {
        return nextResolve(specifier);
    }
    const { resolvedModule } = typescript_1.default.resolveModuleName(specifier, (0, url_1.fileURLToPath)(context.parentURL), tsconfig, host, moduleResolutionCache);
    const isTsModule = resolvedModule
        ? EXTENSIONS.includes(resolvedModule.extension) && !resolvedModule.resolvedFileName.includes('/node_modules/')
        : EXTENSIONS.some((ext) => specifier.endsWith(ext)) && !(0, url_1.fileURLToPath)(specifier).includes('/node_modules/');
    // import from local project to local project TS file
    if (isTsModule) {
        return {
            format: 'ts',
            url: resolvedModule
                ? (0, url_1.pathToFileURL)(resolvedModule.resolvedFileName).href
                : (0, url_1.pathToFileURL)((0, url_1.fileURLToPath)(specifier)).href,
            shortCircuit: true,
        };
    }
    // import from local project to either:
    // - something TS couldn't resolve
    // - external library
    // - local project non-TS file
    return nextResolve(specifier);
};
exports.resolve = resolve;
const load = async (url, context, nextLoad) => {
    if (context.format === 'ts' || (tsconfig.allowJs && context.format === 'module')) {
        const { source } = await nextLoad(url, context);
        const code = typeof source === 'string' ? source : Buffer.from(source).toString();
        const compiled = await (0, register_js_1.compile)(code, (0, url_1.fileURLToPath)(url), tsconfig, true);
        return {
            format: 'module',
            source: compiled,
            shortCircuit: true,
        };
    }
    else {
        return nextLoad(url, context);
    }
};
exports.load = load;
//# sourceMappingURL=esm.mjs.map