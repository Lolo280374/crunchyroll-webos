export default {
    context: 'window',
    input: 'dist/scripts/main.js',
    output: {
     file: 'dist/scripts/main.js',
    format: 'es', // <--- THIS IS CRUCIAL
     sourcemap: true
}
}