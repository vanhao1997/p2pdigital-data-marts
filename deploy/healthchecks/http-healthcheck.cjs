#!/usr/bin/env node
'use strict';

const [, , healthPath, portValue] = process.argv;
const port = Number(process.env.PORT || portValue);

if (
  !/^\/[a-z0-9/-]+$/.test(healthPath ?? '') ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  console.error('Usage: http-healthcheck.cjs <path> <default-port>');
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4000);

fetch(`http://127.0.0.1:${port}${healthPath}`, {
  redirect: 'error',
  signal: controller.signal,
})
  .then(response => {
    clearTimeout(timeout);
    process.exit(response.status === 200 ? 0 : 1);
  })
  .catch(() => {
    clearTimeout(timeout);
    process.exit(1);
  });
