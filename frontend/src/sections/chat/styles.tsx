import type { ButtonBaseProps } from '@mui/material/ButtonBase';
import type { ListItemButtonProps } from '@mui/material/ListItemButton';

import arrowDownIcon from '@iconify-icons/eva/arrow-ios-downward-fill';
import arrowForwardIcon from '@iconify-icons/eva/arrow-ios-forward-fill';

import { styled } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import ListItemButton from '@mui/material/ListItemButton';

import { Iconify } from 'src/components/iconify';
// ----------------------------------------------------------------------

export const CollapseButton = styled(
  ({ selected, children, disabled, ...other }: ListItemButtonProps) => (
    <ListItemButton disabled={disabled} {...other}>
      {children}
      <Iconify width={16} icon={((!selected || disabled) && arrowForwardIcon) || arrowDownIcon} />
    </ListItemButton>
  )
)(({ theme }) => ({
  ...theme.typography.overline,
  height: 40,
  paddingLeft: theme.spacing(2.5),
  justifyContent: 'space-between',
  paddingRight: theme.spacing(1.5),
  color: theme.vars.palette.text.secondary,
  backgroundColor: theme.vars.palette.background.neutral,
}));

// ----------------------------------------------------------------------

export const ToggleButton = styled(ButtonBase)<ButtonBaseProps>(({ theme }) => ({
  top: 84,
  left: 0,
  zIndex: 9,
  width: 32,
  height: 32,
  position: 'absolute',
  borderRadius: `0 12px 12px 0`,
  boxShadow: theme.customShadows.primary,
  color: theme.vars.palette.primary.contrastText,
  backgroundColor: theme.vars.palette.primary.main,
  transition: theme.transitions.create(['all'], { duration: theme.transitions.duration.shorter }),
  '&:hover': { backgroundColor: theme.vars.palette.primary.darker },
}));
