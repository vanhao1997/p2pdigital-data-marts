import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import i18n from '../../../../i18n';
import { DataMartsOverviewPanel } from './DataMartsOverviewPanel';

describe('DataMartsOverviewPanel', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders overview copy in English when English is selected', async () => {
    await i18n.changeLanguage('en');

    render(
      <MemoryRouter>
        <DataMartsOverviewPanel items={[]} onViewRuns='/data-marts/runs' />
      </MemoryRouter>
    );

    expect(screen.getByText('Data health')).toBeInTheDocument();
    expect(screen.getByText('No API freshness data yet')).toBeInTheDocument();
    expect(screen.getByText('Create the first Data Mart')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create Data Mart/i })).toBeInTheDocument();
    expect(screen.queryByText('Tạo Data Mart đầu tiên')).not.toBeInTheDocument();
  });

  it('renders overview copy in Vietnamese when Vietnamese is selected', async () => {
    await i18n.changeLanguage('vi');

    render(
      <MemoryRouter>
        <DataMartsOverviewPanel items={[]} onViewRuns='/data-marts/runs' />
      </MemoryRouter>
    );

    expect(screen.getByText('Tình trạng dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Chưa có dữ liệu cập nhật từ API')).toBeInTheDocument();
    expect(screen.getByText('Tạo Data Mart đầu tiên')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tạo Data Mart/i })).toBeInTheDocument();
    expect(screen.queryByText('Create the first Data Mart')).not.toBeInTheDocument();
  });
});
