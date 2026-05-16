// Provides import.meta.url for CJS bundles (esbuild --inject)
export let __importMetaUrl = require('url').pathToFileURL(__filename).href
