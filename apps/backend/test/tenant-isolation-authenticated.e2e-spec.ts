import { randomUUID } from 'node:crypto';

import {
  cleanupApp,
  completeBetterAuthMagicLink,
  createProjectWithSession,
  readBrowserAccessToken,
  selectProjectWithSession,
  startOwoxApp,
  type StartedApp,
} from './utils/api-key-app-smoke';
import { useCliManifests } from './utils/cli-manifest-setup';

jest.setTimeout(180_000);

type JsonRecord = Record<string, unknown>;

const settingsUrl = (origin: string) => `${origin}/api/projects/notification-settings`;

describe('Authenticated tenant isolation with Better Auth (e2e)', () => {
  useCliManifests();

  it('keeps notification settings isolated across two Better Auth projects', async () => {
    const primaryAdminEmail = `tenant-admin-${randomUUID()}@example.test`;
    let app: StartedApp | undefined;

    try {
      app = await startOwoxApp('better-auth', {
        IDP_BETTER_AUTH_PRIMARY_ADMIN_EMAIL: primaryAdminEmail,
      });

      const session = await completeBetterAuthMagicLink(app, primaryAdminEmail);
      const projectAAccessToken = await readBrowserAccessToken(app.origin, session);
      await expectAuthContextProject(app.origin, projectAAccessToken, '0');
      await expectUnauthenticatedResourceRequestsRejected(app.origin);

      const projectAWebhook = 'https://tenant-a-hooks.example.com/webhook-secret';
      const projectAUpdate = await putNotificationSetting(app.origin, projectAAccessToken, {
        enabled: false,
        webhookUrl: projectAWebhook,
      });
      expect(projectAUpdate.status).toBe(200);
      expect(projectAUpdate.body.webhookUrl).toBe('https://tenant-a-hooks.example.com/_redacted_');
      const projectAResources = await createProjectResources(
        app.origin,
        projectAAccessToken,
        'Tenant A'
      );

      const projectB = await createProjectWithSession(
        app.origin,
        session,
        `Tenant B ${randomUUID()}`
      );
      expect(projectB.id).not.toBe('0');

      await selectProjectWithSession(app.origin, session, projectB.id);
      const projectBAccessToken = await readBrowserAccessToken(app.origin, session);
      await expectAuthContextProject(app.origin, projectBAccessToken, projectB.id);

      const projectBInitial = await getNotificationSettings(app.origin, projectBAccessToken);
      expect(projectBInitial.status).toBe(200);
      const failedBInitial = findSetting(projectBInitial.body, 'FAILED_RUNS_ALL_DM');
      expect(failedBInitial.enabled).toBe(true);
      expect(failedBInitial.webhookUrl).toBeNull();
      const projectBResources = await createProjectResources(
        app.origin,
        projectBAccessToken,
        'Tenant B'
      );

      const projectBWebhook = 'https://tenant-b-hooks.example.com/webhook-secret';
      const projectBUpdate = await putNotificationSetting(app.origin, projectBAccessToken, {
        enabled: true,
        webhookUrl: projectBWebhook,
      });
      expect(projectBUpdate.status).toBe(200);
      expect(projectBUpdate.body.webhookUrl).toBe('https://tenant-b-hooks.example.com/_redacted_');

      const projectAAfterBWrite = await getNotificationSettings(app.origin, projectAAccessToken);
      const failedA = findSetting(projectAAfterBWrite.body, 'FAILED_RUNS_ALL_DM');
      expect(failedA.enabled).toBe(false);
      expect(failedA.webhookUrl).toBe('https://tenant-a-hooks.example.com/_redacted_');

      const projectBAfterWrite = await getNotificationSettings(app.origin, projectBAccessToken);
      const failedBAfterWrite = findSetting(projectBAfterWrite.body, 'FAILED_RUNS_ALL_DM');
      expect(failedBAfterWrite.enabled).toBe(true);
      expect(failedBAfterWrite.webhookUrl).toBe('https://tenant-b-hooks.example.com/_redacted_');

      await expectCrossProjectResourceRejected(app.origin, projectAAccessToken, projectBResources);
      await expectCrossProjectResourceRejected(app.origin, projectBAccessToken, projectAResources);
    } finally {
      if (app) {
        await cleanupApp(app);
      }
    }
  });
});

async function expectAuthContextProject(
  origin: string,
  accessToken: string,
  expectedProjectId: string
): Promise<void> {
  const response = await fetchJson<JsonRecord>(`${origin}/api/auth/context`, {
    headers: {
      'x-owox-authorization': `Bearer ${accessToken}`,
    },
  });

  expect(response.status).toBe(200);
  expect(response.body.projectId).toBe(expectedProjectId);
}

async function getNotificationSettings(
  origin: string,
  accessToken: string
): Promise<{ status: number; body: JsonRecord }> {
  return fetchJson<JsonRecord>(settingsUrl(origin), {
    headers: {
      'x-owox-authorization': `Bearer ${accessToken}`,
    },
  });
}

async function putNotificationSetting(
  origin: string,
  accessToken: string,
  body: { enabled: boolean; webhookUrl: string }
): Promise<{ status: number; body: JsonRecord }> {
  return fetchJson<JsonRecord>(`${settingsUrl(origin)}/FAILED_RUNS_ALL_DM`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-owox-authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

type ProjectResources = {
  storageId: string;
  dataMartId: string;
  destinationId: string;
};

async function createProjectResources(
  origin: string,
  accessToken: string,
  label: string
): Promise<ProjectResources> {
  const storage = await postAuthenticatedJson<JsonRecord>(
    `${origin}/api/data-storages`,
    accessToken,
    { type: 'GOOGLE_BIGQUERY' }
  );
  expect(storage.status).toBe(201);
  expect(typeof storage.body.id).toBe('string');

  const dataMart = await postAuthenticatedJson<JsonRecord>(
    `${origin}/api/data-marts`,
    accessToken,
    {
      title: `${label} Data Mart ${randomUUID()}`,
      storageId: storage.body.id,
    }
  );
  expect(dataMart.status).toBe(201);
  expect(typeof dataMart.body.id).toBe('string');

  const destination = await postAuthenticatedJson<JsonRecord>(
    `${origin}/api/data-destinations`,
    accessToken,
    {
      title: `${label} Destination ${randomUUID()}`,
      type: 'LOOKER_STUDIO',
      credentials: { type: 'looker-studio-credentials' },
    }
  );
  expect(destination.status).toBe(201);
  expect(typeof destination.body.id).toBe('string');

  return {
    storageId: storage.body.id as string,
    dataMartId: dataMart.body.id as string,
    destinationId: destination.body.id as string,
  };
}

async function expectCrossProjectResourceRejected(
  origin: string,
  accessToken: string,
  resources: ProjectResources
): Promise<void> {
  const checks = [
    `${origin}/api/data-storages/${resources.storageId}`,
    `${origin}/api/data-marts/${resources.dataMartId}`,
    `${origin}/api/data-destinations/${resources.destinationId}`,
  ];

  for (const url of checks) {
    const response = await fetch(url, {
      headers: {
        'x-owox-authorization': `Bearer ${accessToken}`,
      },
    });
    expect([403, 404]).toContain(response.status);
  }
}

async function expectUnauthenticatedResourceRequestsRejected(origin: string): Promise<void> {
  const unauthenticated = await fetch(`${origin}/api/data-storages`);
  expect(unauthenticated.status).toBe(401);

  const invalid = await fetch(`${origin}/api/data-storages`, {
    headers: {
      'x-owox-authorization': 'Bearer invalid-better-auth-token',
    },
  });
  expect(invalid.status).toBe(401);
}

async function postAuthenticatedJson<T>(
  url: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ status: number; body: T }> {
  return fetchJson<T>(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-owox-authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

function findSetting(body: JsonRecord, notificationType: string): JsonRecord {
  const settings = body.settings;
  if (!Array.isArray(settings)) {
    throw new Error('Notification settings response did not contain a settings array');
  }
  const setting = settings.find(
    (item: unknown) =>
      item && typeof item === 'object' && (item as JsonRecord).notificationType === notificationType
  );
  expect(setting).toBeDefined();
  return setting as JsonRecord;
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {}
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : (undefined as T);
  return { status: response.status, body };
}
