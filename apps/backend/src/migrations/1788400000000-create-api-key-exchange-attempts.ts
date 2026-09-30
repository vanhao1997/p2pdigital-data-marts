import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateApiKeyExchangeAttempts1788400000000 implements MigrationInterface {
  name = 'CreateApiKeyExchangeAttempts1788400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('api_key_exchange_attempts')) return;
    await queryRunner.createTable(
      new Table({
        name: 'api_key_exchange_attempts',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'bucketStart', type: 'datetime', isNullable: false },
          { name: 'ipHash', type: 'varchar', length: '64', isNullable: false },
          { name: 'apiKeyIdHash', type: 'varchar', length: '64', isNullable: true },
          { name: 'scopeKey', type: 'varchar', length: '72', isNullable: false },
          { name: 'failedAttempts', type: 'int', default: 0, isNullable: false },
          { name: 'blockedUntil', type: 'datetime', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
        ],
      })
    );
    await queryRunner.createIndex(
      'api_key_exchange_attempts',
      new TableIndex({
        name: 'idx_api_key_exchange_attempt_bucket_scope',
        columnNames: ['bucketStart', 'ipHash', 'scopeKey'],
        isUnique: true,
      })
    );
    await queryRunner.createIndex(
      'api_key_exchange_attempts',
      new TableIndex({
        name: 'idx_api_key_exchange_attempt_created_at',
        columnNames: ['createdAt'],
      })
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('api_key_exchange_attempts')) {
      await queryRunner.dropTable('api_key_exchange_attempts');
    }
  }
}
