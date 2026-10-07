export function assertStandaloneRuntime(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
    throw new Error('Standalone backend is only available in development/test. Use owox serve.');
  }

  if (env.IDP_PROVIDER && env.IDP_PROVIDER !== 'none') {
    throw new Error('Standalone backend cannot use the configured IDP_PROVIDER. Use owox serve.');
  }
}
