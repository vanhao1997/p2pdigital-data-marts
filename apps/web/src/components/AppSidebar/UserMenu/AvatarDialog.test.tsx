import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarDialog } from './AvatarDialog';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('AvatarDialog', () => {
  it('tries a new preview after a previous image fails', () => {
    render(
      <AvatarDialog avatar='https://example.com/old.png' onClose={vi.fn()} onSave={vi.fn()} />
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://example.com/new.png' },
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/new.png');
  });

  it('retains input and shows an error when saving fails', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));
    render(<AvatarDialog avatar='https://example.com/a.png' onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await screen.findByRole('alert');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('https://example.com/a.png');
  });

  it('removes an existing avatar and closes after persistence', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AvatarDialog avatar='https://example.com/a.png' onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'userMenu.removeAvatar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(null);
  });
});
