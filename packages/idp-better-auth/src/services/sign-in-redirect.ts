/** Only local paths may continue a browser sign-in flow. */
export function resolveSignInRedirect(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    Array.from(value).some(character => {
      const code = character.charCodeAt(0);
      return code === 0x5c || code === 0x7f || code <= 0x1f;
    })
  )
    return '/';
  try {
    const url = new URL(value, 'https://local.invalid');
    return url.origin === 'https://local.invalid' ? url.pathname + url.search + url.hash : '/';
  } catch {
    return '/';
  }
}
