import type { Row, Table } from '@tanstack/react-table';
import { useCallback, useState } from 'react';
import type {
  BaseSchemaField,
  BigQuerySchemaField,
} from '../../../../shared/types/data-mart-schema.types';
import {
  humanizeFieldName,
  normalizeSearchText,
} from '../../../../../../shared/utils/field-humanizer';

function singleFieldMatches(field: BaseSchemaField, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  if (field.name) {
    if (normalizeSearchText(field.name).includes(normalizedQuery)) return true;
    if (normalizeSearchText(humanizeFieldName(field.name)).includes(normalizedQuery)) return true;
  }
  if (field.alias && normalizeSearchText(field.alias).includes(normalizedQuery)) {
    return true;
  }
  if (field.description && normalizeSearchText(field.description).includes(normalizedQuery)) {
    return true;
  }
  return false;
}

/**
 * Helper function to check if a field or any of its child fields match the search criteria
 */
function fieldMatchesSearch(field: BaseSchemaField, searchValue: string): boolean {
  const normalizedQuery = normalizeSearchText(searchValue);
  if (singleFieldMatches(field, normalizedQuery)) {
    return true;
  }

  // Check if this is a BigQuery field with child fields
  const bqField = field as BigQuerySchemaField;
  if (bqField.fields && bqField.fields.length > 0) {
    // Recursively check child fields
    return bqField.fields.some(childField => fieldMatchesSearch(childField, searchValue));
  }

  return false;
}

/**
 * Helper function to find paths to fields that match the search criteria
 * Returns an array of paths to fields that match, including parent paths
 */
export function findMatchingFieldPaths(
  fields: BigQuerySchemaField[],
  searchValue: string,
  parentPath = ''
): string[] {
  const matchingPaths: string[] = [];
  const normalizedQuery = normalizeSearchText(searchValue);

  fields.forEach((field, index) => {
    const currentPath = parentPath ? `${parentPath}.${String(index)}` : String(index);

    if (singleFieldMatches(field, normalizedQuery)) {
      matchingPaths.push(currentPath);
    }

    // Check child fields if this is a record type
    if (field.fields && field.fields.length > 0) {
      const childMatchingPaths = findMatchingFieldPaths(field.fields, searchValue, currentPath);

      // If any child fields match, add the current path and all child paths
      if (childMatchingPaths.length > 0) {
        // Add the parent path if not already added
        if (!matchingPaths.includes(currentPath)) {
          matchingPaths.push(currentPath);
        }

        // Add all child paths
        matchingPaths.push(...childMatchingPaths);
      }
    }
  });

  return matchingPaths;
}

/**
 * Custom filter function that searches in name, alias, description columns
 * and recursively in child fields for BigQuery record types
 */
export function schemaFieldFilter<T extends BaseSchemaField>(
  row: Row<T>,
  _columnId: string,
  searchValue: string
): boolean {
  const rowData = row.original;

  // If no filter value, return all rows
  if (!searchValue) return true;

  // Convert search value to lowercase
  const lowerSearchValue = searchValue.toLowerCase();

  // Use the helper function to check if the field or any of its child fields match
  return fieldMatchesSearch(rowData, lowerSearchValue);
}

/**
 * Custom hook for managing table filtering functionality
 * @param table - React Table instance
 * @returns Object containing filter value, change handler, and search value
 */
export function useTableFilter<TData>(table: Table<TData>) {
  const [filterValue, setFilterValue] = useState('');

  /**
   * Handles filter input change
   * @param value - New filter value
   */
  const handleFilterChange = useCallback(
    (value: string) => {
      setFilterValue(value);

      // Apply global filter to the table
      table.setGlobalFilter(value);
    },
    [table]
  );

  // Get the lowercase search value for matching fields
  const searchValue = filterValue.toLowerCase();

  return {
    value: filterValue,
    onChange: handleFilterChange,
    searchValue, // Expose the lowercase search value
  };
}
