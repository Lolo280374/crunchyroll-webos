export default {
    context: 'window',
    input: 'dist/scripts/main.js',
    output: {
        compact: true,
        file: 'dist/scripts/main.js',
        format: 'iife',
        inlineDynamicImports: true,
        sourcemap: true,
    }
}