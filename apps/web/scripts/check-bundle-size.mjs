import { readdir, stat } from 'node:fs/promises';
import process from 'node:process';

const assetsDirectory = new URL('../dist/assets/', import.meta.url);
const maxBytes = 500 * 1024;
const entries = await readdir(assetsDirectory);
const javascriptAssets = entries.filter(name => name.endsWith('.js'));
const sizes = await Promise.all(
  javascriptAssets.map(async name => ({
    name,
    bytes: (await stat(new URL(name, assetsDirectory))).size,
  }))
);
const oversized = sizes.filter(asset => asset.bytes > maxBytes).sort((a, b) => b.bytes - a.bytes);

if (oversized.length > 0) {
  console.error(`Bundle budget exceeded: JavaScript chunks must be <= ${maxBytes} bytes.`);
  for (const asset of oversized) {
    console.error(`- ${asset.name}: ${asset.bytes} bytes`);
  }
  process.exitCode = 1;
} else {
  const largest = sizes.sort((a, b) => b.bytes - a.bytes)[0];
  console.log(
    `Bundle budget passed: ${javascriptAssets.length} JavaScript chunks; largest is ${largest?.name ?? 'none'} (${largest?.bytes ?? 0} bytes).`
  );
}
