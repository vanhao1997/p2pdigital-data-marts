import { DataStorageType } from '../../../../../data-storage';
import { Input } from '@owox/ui/components/input';
import { TimeTriggerAnnouncement } from '../../../../../data-marts/scheduled-triggers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppWizardStepItem,
  AppWizardStepLabel,
  AppWizardStepSection,
  AppWizardStep,
  AppWizardStepHero,
} from '@owox/ui/components/common/wizard';
import {
  GoogleBigQueryIcon,
  AwsAthenaIcon,
  SnowflakeIcon,
  AwsRedshiftIcon,
  DatabricksIcon,
} from '../../../../../../shared';
import { quoteIdentifier, unquoteIdentifier } from '../../../utils/snowflake-identifier.utils';
import RedshiftSchemaPermissionsDescription from '../../../../shared/components/FormDescriptions/RedshiftSchemaPermissionsDescription.tsx';

interface TargetSetupStepProps {
  dataStorageType: DataStorageType;
  target: { fullyQualifiedName: string; isValid: boolean } | null;
  destinationName: string;
  connectorName: string;
  onTargetChange: (target: { fullyQualifiedName: string; isValid: boolean } | null) => void;
}

export function TargetSetupStep({
  dataStorageType,
  target,
  destinationName,
  connectorName,
  onTargetChange,
}: TargetSetupStepProps) {
  const { t } = useTranslation();
  const sanitizedDestinationName = destinationName.replace(/[^a-zA-Z0-9_]/g, '_');
  const sanitizedConnectorName = connectorName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  const [datasetName, setDatasetName] = useState<string>('');
  const [catalogName, setCatalogName] = useState<string>('');
  const [schemaName, setSchemaName] = useState<string>('');
  const [tableName, setTableName] = useState<string>('');
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  // Track if user has manually edited any of the fields
  const editedByUser = useRef(false);

  const validate = useCallback(
    (name: string, allowQuoted = false): string | null => {
      if (!name.trim()) return t('connectorTargetSetup.fieldRequired');

      // For Snowflake, allow quoted identifiers (e.g., "SCHEMA_NAME")
      // But also allow unquoted identifiers - quotes will be added automatically when saving
      if (allowQuoted && name.startsWith('"') && name.endsWith('"')) {
        const unquoted = name.slice(1, -1);
        if (!unquoted) return t('connectorTargetSetup.quotedIdentifierEmpty');
        // Validate the content inside quotes - can be anything except empty
        return null;
      }

      // Validate unquoted identifiers
      const allowed = /^[A-Za-z][A-Za-z0-9_]*$/;
      if (!allowed.test(name)) {
        return t('connectorTargetSetup.identifierFormat');
      }
      return null;
    },
    [t]
  );

  const updateTarget = useCallback(
    (
      newDatasetName: string,
      newTableName: string,
      newDatasetError: string | null,
      newTableError: string | null,
      newSchemaName?: string,
      newSchemaError?: string | null,
      newCatalogName?: string,
      newCatalogError?: string | null
    ) => {
      // A partial FQN is emitted as '' so that a remounted step re-seeds defaults
      // instead of failing to parse it and rendering every field empty.
      let fullyQualifiedName: string;

      if (dataStorageType === DataStorageType.SNOWFLAKE) {
        if (!newDatasetName || !newSchemaName || !newTableName) {
          fullyQualifiedName = '';
        } else {
          // For Snowflake: quote schema and table, but not database
          const quotedSchema = quoteIdentifier(newSchemaName);
          const quotedTable = quoteIdentifier(newTableName);
          fullyQualifiedName = `${newDatasetName}.${quotedSchema}.${quotedTable}`;
        }
      } else if (dataStorageType === DataStorageType.AWS_REDSHIFT) {
        if (!newSchemaName || !newTableName) {
          fullyQualifiedName = '';
        } else {
          const quotedSchema = quoteIdentifier(newSchemaName);
          const quotedTable = quoteIdentifier(newTableName);
          fullyQualifiedName = `${quotedSchema}.${quotedTable}`;
        }
      } else if (dataStorageType === DataStorageType.DATABRICKS) {
        if (!newCatalogName || !newSchemaName || !newTableName) {
          fullyQualifiedName = '';
        } else {
          // For Databricks: catalog.schema.table (backticks are added on backend)
          fullyQualifiedName = `${newCatalogName}.${newSchemaName}.${newTableName}`;
        }
      } else {
        fullyQualifiedName =
          !newDatasetName || !newTableName ? '' : `${newDatasetName}.${newTableName}`;
      }

      const isValid =
        dataStorageType === DataStorageType.SNOWFLAKE
          ? !!(
              newDatasetName &&
              newSchemaName &&
              newTableName &&
              newDatasetError === null &&
              newSchemaError === null &&
              newTableError === null
            )
          : dataStorageType === DataStorageType.AWS_REDSHIFT
            ? !!(newSchemaName && newTableName && newSchemaError === null && newTableError === null)
            : dataStorageType === DataStorageType.DATABRICKS
              ? !!(
                  newCatalogName &&
                  newSchemaName &&
                  newTableName &&
                  newCatalogError === null &&
                  newSchemaError === null &&
                  newTableError === null
                )
              : !!(
                  newDatasetName &&
                  newTableName &&
                  newDatasetError === null &&
                  newTableError === null
                );

      onTargetChange({
        fullyQualifiedName,
        isValid,
      });
    },
    [onTargetChange, dataStorageType]
  );

  useEffect(() => {
    // This effect only seeds the fields (defaults, or an existing target in edit mode).
    // Once the user touches any field, local state is the source of truth: the change
    // handlers already push the full target upstream, and re-parsing the echoed
    // fullyQualifiedName here would wipe fields that are momentarily empty.
    if (editedByUser.current) {
      return;
    }

    let newDatasetName = '';
    let newCatalogName = '';
    let newSchemaName = '';
    let newTableName = '';

    if (target?.fullyQualifiedName) {
      // Split by dots, but preserve quoted identifiers
      const parts = target.fullyQualifiedName.match(/(?:[^."]+|"[^"]*")+/g) ?? [];
      if (dataStorageType === DataStorageType.SNOWFLAKE && parts.length === 3) {
        const dataset = parts[0];
        const schema = parts[1];
        const table = parts[2];
        if (dataset && schema && table) {
          newDatasetName = dataset;
          newSchemaName = unquoteIdentifier(schema);
          newTableName = unquoteIdentifier(table);
        }
      } else if (dataStorageType === DataStorageType.DATABRICKS && parts.length === 3) {
        const catalog = parts[0];
        const schema = parts[1];
        const table = parts[2];
        if (catalog && schema && table) {
          newCatalogName = catalog;
          newSchemaName = schema;
          newTableName = table;
        }
      } else if (dataStorageType === DataStorageType.AWS_REDSHIFT) {
        if (parts.length === 2) {
          const schema = parts[0];
          const table = parts[1];
          if (schema && table) {
            newSchemaName = unquoteIdentifier(schema);
            newTableName = unquoteIdentifier(table);
          }
        } else if (parts.length === 3) {
          const schema = parts[1];
          const table = parts[2];
          if (schema && table) {
            newSchemaName = unquoteIdentifier(schema);
            newTableName = unquoteIdentifier(table);
          }
        }
      } else if (parts.length >= 2) {
        const dataset = parts[0];
        const table = parts[1];
        if (dataset && table) {
          newDatasetName = dataset;
          newTableName = table;
        }
      }
    } else {
      newDatasetName = `${sanitizedConnectorName}_owox`;
      if (dataStorageType === DataStorageType.SNOWFLAKE) {
        newSchemaName = 'PUBLIC';
      } else if (dataStorageType === DataStorageType.DATABRICKS) {
        newCatalogName = 'main';
        newSchemaName = `${sanitizedConnectorName}_owox`;
      } else if (dataStorageType === DataStorageType.AWS_REDSHIFT) {
        newSchemaName = `${sanitizedConnectorName}_owox`;
      }
      newTableName = sanitizedDestinationName;
    }

    const newDatasetError =
      dataStorageType === DataStorageType.AWS_REDSHIFT ||
      dataStorageType === DataStorageType.DATABRICKS
        ? null
        : validate(newDatasetName);
    const newCatalogError =
      dataStorageType === DataStorageType.DATABRICKS ? validate(newCatalogName) : null;
    const newSchemaError =
      dataStorageType === DataStorageType.SNOWFLAKE
        ? validate(newSchemaName, true)
        : dataStorageType === DataStorageType.AWS_REDSHIFT
          ? newSchemaName
            ? validate(newSchemaName, true)
            : null
          : dataStorageType === DataStorageType.DATABRICKS
            ? validate(newSchemaName)
            : null;
    const newTableError = validate(
      newTableName,
      dataStorageType === DataStorageType.SNOWFLAKE ||
        dataStorageType === DataStorageType.AWS_REDSHIFT
    );

    setDatasetName(newDatasetName);
    setDatasetError(newDatasetError);
    setCatalogName(newCatalogName);
    setCatalogError(newCatalogError);
    setSchemaName(newSchemaName);
    setSchemaError(newSchemaError);
    setTableName(newTableName);
    setTableError(newTableError);

    const newFullyQualifiedName =
      dataStorageType === DataStorageType.SNOWFLAKE
        ? newDatasetName && newSchemaName && newTableName
          ? `${newDatasetName}.${quoteIdentifier(newSchemaName)}.${quoteIdentifier(newTableName)}`
          : ''
        : dataStorageType === DataStorageType.AWS_REDSHIFT
          ? newSchemaName && newTableName
            ? `${quoteIdentifier(newSchemaName)}.${quoteIdentifier(newTableName)}`
            : ''
          : dataStorageType === DataStorageType.DATABRICKS
            ? newCatalogName && newSchemaName && newTableName
              ? `${newCatalogName}.${newSchemaName}.${newTableName}`
              : ''
            : newDatasetName && newTableName
              ? `${newDatasetName}.${newTableName}`
              : '';

    const newIsValid =
      dataStorageType === DataStorageType.SNOWFLAKE
        ? !!(
            newDatasetName &&
            newSchemaName &&
            newTableName &&
            newDatasetError === null &&
            newSchemaError === null &&
            newTableError === null
          )
        : dataStorageType === DataStorageType.AWS_REDSHIFT
          ? !!(newSchemaName && newTableName && newSchemaError === null && newTableError === null)
          : dataStorageType === DataStorageType.DATABRICKS
            ? !!(
                newCatalogName &&
                newSchemaName &&
                newTableName &&
                newCatalogError === null &&
                newSchemaError === null &&
                newTableError === null
              )
            : !!(
                newDatasetName &&
                newTableName &&
                newDatasetError === null &&
                newTableError === null
              );

    const shouldUpdate =
      target?.fullyQualifiedName !== newFullyQualifiedName || target.isValid !== newIsValid;

    if (shouldUpdate) {
      updateTarget(
        newDatasetName,
        newTableName,
        newDatasetError,
        newTableError,
        newSchemaName,
        newSchemaError,
        newCatalogName,
        newCatalogError
      );
    }
  }, [
    target,
    sanitizedDestinationName,
    sanitizedConnectorName,
    dataStorageType,
    updateTarget,
    validate,
  ]);

  const handleDatasetNameChange = (name: string) => {
    editedByUser.current = true;
    setDatasetName(name);
    const validationError = validate(name);
    setDatasetError(validationError);
    updateTarget(
      name,
      tableName,
      validationError,
      tableError,
      schemaName,
      schemaError,
      catalogName,
      catalogError
    );
  };

  const handleCatalogNameChange = (name: string) => {
    editedByUser.current = true;
    setCatalogName(name);
    const validationError = validate(name);
    setCatalogError(validationError);
    updateTarget(
      datasetName,
      tableName,
      datasetError,
      tableError,
      schemaName,
      schemaError,
      name,
      validationError
    );
  };

  const handleSchemaNameChange = (name: string) => {
    editedByUser.current = true;
    setSchemaName(name);
    // Schema is required for both Snowflake, Redshift and Databricks
    const validationError =
      dataStorageType === DataStorageType.DATABRICKS ? validate(name) : validate(name, true);
    setSchemaError(validationError);
    updateTarget(
      datasetName,
      tableName,
      datasetError,
      tableError,
      name,
      validationError,
      catalogName,
      catalogError
    );
  };

  const handleTableNameChange = (name: string) => {
    editedByUser.current = true;
    setTableName(name);
    const validationError = validate(
      name,
      dataStorageType === DataStorageType.SNOWFLAKE ||
        dataStorageType === DataStorageType.AWS_REDSHIFT
    );
    setTableError(validationError);
    updateTarget(
      datasetName,
      name,
      datasetError,
      validationError,
      schemaName,
      schemaError,
      catalogName,
      catalogError
    );
  };

  return (
    <AppWizardStep>
      {dataStorageType === DataStorageType.GOOGLE_BIGQUERY && (
        <>
          <AppWizardStepHero
            icon={<GoogleBigQueryIcon />}
            title='Google BigQuery'
            docUrl='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/google-bigquery/'
            variant='compact'
          />
          <AppWizardStepSection title={t('connectorTargetSetup.chooseStorage')}>
            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='dataset-name'
                tooltip={t('connectorTargetSetup.datasetTooltip', { provider: 'Google BigQuery' })}
              >
                {t('connectorTargetSetup.datasetName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='dataset-name'
                placeholder={t('connectorTargetSetup.datasetPlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={datasetName}
                aria-invalid={Boolean(datasetError)}
                aria-describedby={datasetError ? 'dataset-name-error' : undefined}
                onChange={e => {
                  handleDatasetNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.datasetAutoCreated')}
              </p>
              {datasetError && (
                <p id='dataset-name-error' className='text-destructive text-sm'>
                  {datasetError}
                </p>
              )}
            </AppWizardStepItem>

            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='table-name'
                tooltip={t('connectorTargetSetup.tableTooltip')}
              >
                {t('connectorTargetSetup.tableName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='table-name'
                placeholder={t('connectorTargetSetup.tablePlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={tableName}
                aria-invalid={Boolean(tableError)}
                aria-describedby={tableError ? 'table-name-error' : undefined}
                onChange={e => {
                  handleTableNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.tableAutoCreated')}
              </p>
              {tableError && (
                <p id='table-name-error' className='text-destructive text-sm'>
                  {tableError}
                </p>
              )}
            </AppWizardStepItem>
          </AppWizardStepSection>
        </>
      )}
      {dataStorageType === DataStorageType.AWS_ATHENA && (
        <>
          <AppWizardStepHero
            icon={<AwsAthenaIcon />}
            title='AWS Athena'
            docUrl='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/aws-athena/'
            variant='compact'
          />
          <AppWizardStepSection title={t('connectorTargetSetup.chooseStorage')}>
            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='database-name'
                tooltip={t('connectorTargetSetup.databaseTooltip', { provider: 'Amazon Athena' })}
              >
                {t('connectorTargetSetup.databaseName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='database-name'
                placeholder={t('connectorTargetSetup.databasePlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={datasetName}
                aria-invalid={Boolean(datasetError)}
                aria-describedby={datasetError ? 'database-name-error' : undefined}
                onChange={e => {
                  handleDatasetNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.databaseAutoCreated')}
              </p>
              {datasetError && (
                <p id='database-name-error' className='text-destructive text-sm'>
                  {datasetError}
                </p>
              )}
            </AppWizardStepItem>

            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='athena-table-name'
                tooltip={t('connectorTargetSetup.tableTooltip')}
              >
                {t('connectorTargetSetup.tableName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='athena-table-name'
                placeholder={t('connectorTargetSetup.tablePlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={tableName}
                aria-invalid={Boolean(tableError)}
                aria-describedby={tableError ? 'athena-table-name-error' : undefined}
                onChange={e => {
                  handleTableNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.tableAutoCreated')}
              </p>
              {tableError && (
                <p id='athena-table-name-error' className='text-destructive text-sm'>
                  {tableError}
                </p>
              )}
            </AppWizardStepItem>
          </AppWizardStepSection>
        </>
      )}
      {dataStorageType === DataStorageType.SNOWFLAKE && (
        <>
          <AppWizardStepHero
            icon={<SnowflakeIcon />}
            title='Snowflake'
            docUrl='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/snowflake/'
            variant='compact'
          />
          <AppWizardStepSection title={t('connectorTargetSetup.chooseStorage')}>
            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='snowflake-database-name'
                tooltip={t('connectorTargetSetup.databaseTooltip', { provider: 'Snowflake' })}
              >
                {t('connectorTargetSetup.databaseName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='snowflake-database-name'
                placeholder={t('connectorTargetSetup.databasePlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={datasetName}
                aria-invalid={Boolean(datasetError)}
                aria-describedby={datasetError ? 'snowflake-database-name-error' : undefined}
                onChange={e => {
                  handleDatasetNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.databaseAutoCreated')}
              </p>
              {datasetError && (
                <p id='snowflake-database-name-error' className='text-destructive text-sm'>
                  {datasetError}
                </p>
              )}
            </AppWizardStepItem>

            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='snowflake-schema-name'
                tooltip={t('connectorTargetSetup.schemaTooltipQuoted', { provider: 'Snowflake' })}
              >
                {t('connectorTargetSetup.schemaName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='snowflake-schema-name'
                placeholder={t('connectorTargetSetup.publicPlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={schemaName}
                aria-invalid={Boolean(schemaError)}
                aria-describedby={schemaError ? 'snowflake-schema-name-error' : undefined}
                onChange={e => {
                  handleSchemaNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.schemaAutoCreated')}
              </p>
              {schemaError && (
                <p id='snowflake-schema-name-error' className='text-destructive text-sm'>
                  {schemaError}
                </p>
              )}
            </AppWizardStepItem>

            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='snowflake-table-name'
                tooltip={t('connectorTargetSetup.tableTooltipQuoted')}
              >
                {t('connectorTargetSetup.tableName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='snowflake-table-name'
                placeholder={t('connectorTargetSetup.tableExamplePlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={tableName}
                aria-invalid={Boolean(tableError)}
                aria-describedby={tableError ? 'snowflake-table-name-error' : undefined}
                onChange={e => {
                  handleTableNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.tableAutoCreated')}
              </p>
              {tableError && (
                <p id='snowflake-table-name-error' className='text-destructive text-sm'>
                  {tableError}
                </p>
              )}
            </AppWizardStepItem>
          </AppWizardStepSection>
        </>
      )}
      {dataStorageType === DataStorageType.AWS_REDSHIFT && (
        <>
          <AppWizardStepHero
            icon={<AwsRedshiftIcon />}
            title='AWS Redshift'
            docUrl='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/aws-redshift/'
            variant='compact'
          />
          <AppWizardStepSection title={t('connectorTargetSetup.chooseStorage')}>
            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='redshift-schema-name'
                tooltip={t('connectorTargetSetup.schemaTooltipQuoted', { provider: 'Redshift' })}
              >
                {t('connectorTargetSetup.schemaName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='redshift-schema-name'
                placeholder={t('connectorTargetSetup.publicPlaceholderLower')}
                autoComplete='off'
                className='box-border w-full'
                value={schemaName}
                aria-invalid={Boolean(schemaError)}
                aria-describedby={schemaError ? 'redshift-schema-name-error' : undefined}
                onChange={e => {
                  handleSchemaNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.schemaAutoCreated')}
              </p>
              <RedshiftSchemaPermissionsDescription />
              {schemaError && (
                <p id='redshift-schema-name-error' className='text-destructive text-sm'>
                  {schemaError}
                </p>
              )}
            </AppWizardStepItem>

            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='redshift-table-name'
                tooltip={t('connectorTargetSetup.tableTooltipQuoted')}
              >
                {t('connectorTargetSetup.tableName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='redshift-table-name'
                placeholder={t('connectorTargetSetup.tableExamplePlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={tableName}
                aria-invalid={Boolean(tableError)}
                aria-describedby={tableError ? 'redshift-table-name-error' : undefined}
                onChange={e => {
                  handleTableNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.tableAutoCreatedQuoted')}
              </p>
              {tableError && (
                <p id='redshift-table-name-error' className='text-destructive text-sm'>
                  {tableError}
                </p>
              )}
            </AppWizardStepItem>
          </AppWizardStepSection>
        </>
      )}
      {dataStorageType === DataStorageType.DATABRICKS && (
        <>
          <AppWizardStepHero
            icon={<DatabricksIcon />}
            title='Databricks'
            docUrl='https://docs.p2pdigital.io.vn/docs/storages/supported-storages/databricks/'
            variant='compact'
          />
          <AppWizardStepSection title={t('connectorTargetSetup.chooseStorage')}>
            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='databricks-catalog-name'
                tooltip={t('connectorTargetSetup.catalogTooltip')}
              >
                {t('connectorTargetSetup.catalogName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='databricks-catalog-name'
                placeholder={t('connectorTargetSetup.mainPlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={catalogName}
                aria-invalid={Boolean(catalogError)}
                aria-describedby={catalogError ? 'databricks-catalog-name-error' : undefined}
                onChange={e => {
                  handleCatalogNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.catalogAutoCreated')}
              </p>
              {catalogError && (
                <p id='databricks-catalog-name-error' className='text-destructive text-sm'>
                  {catalogError}
                </p>
              )}
            </AppWizardStepItem>

            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='databricks-schema-name'
                tooltip={t('connectorTargetSetup.schemaTooltip', { provider: 'Databricks' })}
              >
                {t('connectorTargetSetup.schemaName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='databricks-schema-name'
                placeholder={t('connectorTargetSetup.schemaPlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={schemaName}
                aria-invalid={Boolean(schemaError)}
                aria-describedby={schemaError ? 'databricks-schema-name-error' : undefined}
                onChange={e => {
                  handleSchemaNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.schemaAutoCreated')}
              </p>
              {schemaError && (
                <p id='databricks-schema-name-error' className='text-destructive text-sm'>
                  {schemaError}
                </p>
              )}
            </AppWizardStepItem>

            <AppWizardStepItem>
              <AppWizardStepLabel
                required={true}
                htmlFor='databricks-table-name'
                tooltip={t('connectorTargetSetup.tableTooltip')}
              >
                {t('connectorTargetSetup.tableName')}
              </AppWizardStepLabel>
              <Input
                type='text'
                id='databricks-table-name'
                placeholder={t('connectorTargetSetup.tableExamplePlaceholder')}
                autoComplete='off'
                className='box-border w-full'
                value={tableName}
                aria-invalid={Boolean(tableError)}
                aria-describedby={tableError ? 'databricks-table-name-error' : undefined}
                onChange={e => {
                  handleTableNameChange(e.target.value);
                }}
                required
              />
              <p className='text-muted-foreground text-sm'>
                {t('connectorTargetSetup.tableAutoCreated')}
              </p>
              {tableError && (
                <p id='databricks-table-name-error' className='text-destructive text-sm'>
                  {tableError}
                </p>
              )}
            </AppWizardStepItem>
          </AppWizardStepSection>
        </>
      )}
      <AppWizardStepSection title={t('connectorTargetSetup.scheduleUpdates')}>
        <TimeTriggerAnnouncement />
      </AppWizardStepSection>
    </AppWizardStep>
  );
}
