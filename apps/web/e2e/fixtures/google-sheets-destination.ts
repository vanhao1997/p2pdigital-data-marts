import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { ApiHelpers } from './api-helpers';

/**
 * Create a persisted Google Sheets destination without calling Google.
 * Seed a disposable source with a fake service account, then use the backend's
 * copy-credentials API to create the destination exercised by the UI tests.
 * This fixture does not validate OAuth, token minting, or report delivery.
 */
export async function createGoogleSheetsDestination(
  page: Page,
  apiHelpers: ApiHelpers,
  title: string
): Promise<{ id: string; credentialId: string }> {
  const databasePath = process.env.SQLITE_DB_PATH;
  if (!databasePath) throw new Error('SQLITE_DB_PATH not set — cannot seed Sheets credentials');

  const source = await apiHelpers.createDestination(
    'LOOKER_STUDIO',
    `Google Sheets credential source ${randomUUID()}`
  );

  try {
    const esmRequire = createRequire(import.meta.url);
    const SqliteDatabase = esmRequire('better-sqlite3');
    const db = new SqliteDatabase(resolve(databasePath));

    try {
      db.pragma('busy_timeout = 5000');
      const credentials = {
        type: 'google-sheets-credentials',
        serviceAccountKey: {
          type: 'service_account',
          project_id: 'e2e-sheets-project',
          private_key_id: 'e2e-private-key-id',
          private_key:
            '-----BEGIN PRIVATE KEY-----\ne2e-fake-private-key\n-----END PRIVATE KEY-----\n',
          client_email: 'e2e-sheets@e2e-sheets-project.iam.gserviceaccount.com',
          client_id: 'e2e-client-id',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url:
            'https://www.googleapis.com/robot/v1/metadata/x509/e2e-sheets%40e2e-sheets-project.iam.gserviceaccount.com',
          universe_domain: 'googleapis.com',
        },
      };

      db.transaction(() => {
        const credentialUpdate = db
          .prepare(
            `UPDATE data_destination_credentials
             SET type = 'google_service_account', credentials = ?, identity = ?
             WHERE projectId = '0' AND deletedAt IS NULL AND id = (
               SELECT credentialId FROM data_destination
               WHERE id = ? AND projectId = '0' AND deletedAt IS NULL
             )`
          )
          .run(
            JSON.stringify(credentials),
            JSON.stringify({ email: credentials.serviceAccountKey.client_email }),
            source.id
          );
        expect(credentialUpdate.changes).toBe(1);

        const destinationUpdate = db
          .prepare(
            `UPDATE data_destination SET type = 'GOOGLE_SHEETS'
             WHERE id = ? AND projectId = '0' AND deletedAt IS NULL`
          )
          .run(source.id);
        expect(destinationUpdate.changes).toBe(1);
      })();
    } finally {
      db.close();
    }

    const response = await page.request.post('/api/data-destinations', {
      data: { title, type: 'GOOGLE_SHEETS', sourceDestinationId: source.id },
    });
    expect(response.status()).toBe(201);

    const destination = (await response.json()) as { id: string; credentialId: string };
    expect(destination.id).toEqual(expect.any(String));
    expect(destination.credentialId).toEqual(expect.any(String));
    const folderId = 'e2e-sheets-drive-folder';
    const destinationConfig = {
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    };
    const configDb = new SqliteDatabase(resolve(databasePath));
    try {
      configDb.pragma('busy_timeout = 5000');
      const configUpdate = configDb
        .prepare(
          `UPDATE data_destination SET config = ?
           WHERE id = ? AND projectId = '0' AND deletedAt IS NULL`
        )
        .run(JSON.stringify(destinationConfig), destination.id);
      expect(configUpdate.changes).toBe(1);
    } catch (error) {
      await apiHelpers.deleteDestination(destination.id);
      throw error;
    } finally {
      configDb.close();
    }
    const verifyResponse = await page.request.get(`/api/data-destinations/${destination.id}`);
    expect(verifyResponse.status()).toBe(200);
    expect(await verifyResponse.json()).toMatchObject({ config: destinationConfig });
    return destination;
  } finally {
    await apiHelpers.deleteDestination(source.id);
  }
}
