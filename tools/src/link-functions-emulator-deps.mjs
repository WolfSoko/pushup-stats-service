#!/usr/bin/env node
/**
 * Makes the esbuild functions bundle loadable by the Functions emulator.
 *
 * `cloud-functions:build` emits `data-store/functions-dist` with a
 * generated package.json but no installed dependencies, so firebase-tools
 * cannot resolve the Firebase Functions SDK there and drops every callable
 * with "Failed to find location of Firebase Functions SDK". The workspace
 * package next door has exactly those dependencies installed, so link them
 * in. `firebase deploy` never uploads node_modules, so the link cannot
 * reach production.
 */
import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = join(workspaceRoot, 'data-store/functions-dist');
const link = join(distDir, 'node_modules');
const target = join(workspaceRoot, 'data-store/functions/node_modules');

if (!existsSync(distDir)) {
  console.error(`${distDir} is missing — run cloud-functions:build first.`);
  process.exit(1);
}
if (!existsSync(target)) {
  console.error(`${target} is missing — run pnpm install first.`);
  process.exit(1);
}

if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) {
  if (!lstatSync(link).isSymbolicLink()) {
    console.log(
      'functions-dist/node_modules exists and is not a link — left as is.'
    );
    process.exit(0);
  }
  unlinkSync(link);
}

symlinkSync(target, link, 'junction');
console.log('Linked functions-dist/node_modules → functions/node_modules.');
