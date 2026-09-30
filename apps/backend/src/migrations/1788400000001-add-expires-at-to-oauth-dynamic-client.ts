import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { getTable } from './migration-utils';

const TABLE_NAME = 'oauth_dynamic_client';
const COLUMN_NAME = 'expiresAt';

export class AddExpiresAtToOauthDynamicClient1788400000001 implements MigrationInterface {
  public readonly name = 'AddExpiresAtToOauthDynamicClient1788400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await getTable(queryRunner, TABLE_NAME);
    if (!table.columns.some(column => column.name === COLUMN_NAME)) {
      await queryRunner.addColumn(
        table,
        new TableColumn({
          name: COLUMN_NAME,
          type: 'datetime',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await getTable(queryRunner, TABLE_NAME);
    if (table.columns.some(column => column.name === COLUMN_NAME)) {
      await queryRunner.dropColumn(table, COLUMN_NAME);
    }
  }
}
