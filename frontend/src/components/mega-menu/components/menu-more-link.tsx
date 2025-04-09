import arrowForwardIcon from '@iconify-icons/eva/arrow-ios-forward-fill';

import Link from '@mui/material/Link';

import { RouterLink } from 'src/routes/components';

import { Iconify } from '../../iconify';

import type { MenuLink } from '../types';

// ----------------------------------------------------------------------

export function MenuMoreLink({ title, path, sx, ...other }: MenuLink) {
  return (
    <Link
      component={RouterLink}
      href={path}
      color="inherit"
      sx={{
        alignItems: 'center',
        typography: 'caption',
        display: 'inline-flex',
        fontWeight: 'fontWeightSemiBold',
        ...sx,
      }}
      {...other}
    >
      {title} <Iconify icon={arrowForwardIcon} width={16} />
    </Link>
  );
}
