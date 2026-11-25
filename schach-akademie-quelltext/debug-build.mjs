import { build } from 'esbuild';

try {
  console.log("Building engine worker...");
  const w = await build({ entryPoints: ['src/engine.worker.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020' });
  console.log("OK, size:", w.outputFiles[0].text.length);

  console.log("Building app...");
  const a = await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', loader: { '.json': 'json', '.svg': 'text', '.webp': 'dataurl' } });
  console.log("OK, size:", a.outputFiles[0].text.length);
  console.log("First 200 chars:");
  console.log(a.outputFiles[0].text.substring(0, 200));
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
