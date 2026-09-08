import { Button } from '@owox/ui/components/button';
import { ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

interface OpenIssueLinkProps {
  label: string;
}

export function OpenIssueLink({ label }: OpenIssueLinkProps) {
  const { t } = useTranslation();
  return (
    <div className='border-border text-muted-foreground mt-3 flex items-center justify-center gap-2 border-t pt-3 text-sm'>
      <Button variant='outline' asChild>
        <Link
          to='https://github.com/vanhao1997/p2pdigital-data-marts/issues'
          target='_blank'
          rel='noopener noreferrer'
        >
          {label} {t('common.openIssueHere', 'Open issue here')}
          <ExternalLinkIcon className='h-4 w-4' />
        </Link>
      </Button>
    </div>
  );
}
