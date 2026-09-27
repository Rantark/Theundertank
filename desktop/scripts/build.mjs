// Prepares the desktop app: builds the client, copies it in, and bundles the Electron
// main process (with the embedded game server + shared sim) into a single file, so the
// packaged app needs no node_modules at all.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, '..');
const root = path.resolve(desktop, '..');

console.log('> building client');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

console.log('> copying client into desktop/app');
fs.rmSync(path.join(desktop, 'app'), { recursive: true, force: true });
fs.cpSync(path.join(root, 'client', 'dist'), path.join(desktop, 'app'), { recursive: true });

console.log('> bundling main + preload');
const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron', 'bufferutil', 'utf-8-validate'],
  logLevel: 'warning',
};
await build({ ...common, entryPoints: [path.join(desktop, 'src', 'main.js')], outfile: path.join(desktop, 'build', 'main.cjs') });
await build({ ...common, entryPoints: [path.join(desktop, 'src', 'preload.js')], outfile: path.join(desktop, 'build', 'preload.cjs') });

if (!fs.existsSync(path.join(desktop, 'resources', 'icon.png'))) execSync('node scripts/make-icon.mjs', { cwd: desktop, stdio: 'inherit' });
console.log('> desktop bundle ready');
