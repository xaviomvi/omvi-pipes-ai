import type { LinkProps } from '@mui/material/Link';

import { Icon } from '@iconify/react';
import backIcon from '@iconify-icons/eva/arrow-ios-back-fill';

import Link from '@mui/material/Link';

import { RouterLink } from 'src/routes/components';

// ----------------------------------------------------------------------

type FormReturnLinkProps = LinkProps & {
  href: string;
  icon?: React.ReactNode;
  label?: React.ReactNode;
};

export function FormReturnLink({ sx, href, children, label, icon, ...other }: FormReturnLinkProps) {
  return (
    <Link
      component={RouterLink}
      href={href}
      color="inherit"
      variant="subtitle2"
      sx={{
        mt: 3,
        gap: 0.5,
        mx: 'auto',
        alignItems: 'center',
        display: 'inline-flex',
        ...sx,
      }}
      {...other}
    >
      {icon || <Icon icon={backIcon} width={16} height={16} />}
      {label || 'Return to sign in'}
    </Link>
  );
}
