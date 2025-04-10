import type { IChatParticipant } from 'src/types/chat';

import { useCallback } from 'react';
// Icon imports
import phoneIcon from '@iconify-icons/solar/phone-bold';
import bellOffIcon from '@iconify-icons/solar/bell-off-bold';
import sidebarFoldIcon from '@iconify-icons/ri/layout-left-2-line';
import moreVerticalIcon from '@iconify-icons/eva/more-vertical-fill';
import trashBinIcon from '@iconify-icons/solar/trash-bin-trash-bold';
import sidebarUnfoldIcon from '@iconify-icons/ri/layout-right-2-line';
import videocameraIcon from '@iconify-icons/solar/videocamera-record-bold';
import dangerTriangleIcon from '@iconify-icons/solar/danger-triangle-bold';
import forbiddenCircleIcon from '@iconify-icons/solar/forbidden-circle-bold';

import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { useResponsive } from 'src/hooks/use-responsive';

import { fToNow } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { usePopover, CustomPopover } from 'src/components/custom-popover';

import { ChatHeaderSkeleton } from './chat-skeleton';

import type { UseNavCollapseReturn } from './hooks/use-collapse-nav';

// ----------------------------------------------------------------------

type Props = {
  loading: boolean;
  participants: IChatParticipant[];
  collapseNav: UseNavCollapseReturn;
};

export function ChatHeaderDetail({ collapseNav, participants, loading }: Props) {
  const popover = usePopover();

  const lgUp = useResponsive('up', 'lg');

  const group = participants.length > 1;

  const singleParticipant = participants[0];

  const { collapseDesktop, onCollapseDesktop, onOpenMobile } = collapseNav;

  const handleToggleNav = useCallback(() => {
    if (lgUp) {
      onCollapseDesktop();
    } else {
      onOpenMobile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lgUp]);

  const renderGroup = (
    <AvatarGroup max={3} sx={{ [`& .${avatarGroupClasses.avatar}`]: { width: 32, height: 32 } }}>
      {participants.map((participant) => (
        <Avatar key={participant.id} alt={participant.name} src={participant.avatarUrl} />
      ))}
    </AvatarGroup>
  );

  const renderSingle = (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Badge
        variant={singleParticipant?.status}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Avatar src={singleParticipant?.avatarUrl} alt={singleParticipant?.name} />
      </Badge>

      <ListItemText
        primary={singleParticipant?.name}
        secondary={
          singleParticipant?.status === 'offline'
            ? fToNow(singleParticipant?.lastActivity)
            : singleParticipant?.status
        }
        secondaryTypographyProps={{
          component: 'span',
          ...(singleParticipant?.status !== 'offline' && { textTransform: 'capitalize' }),
        }}
      />
    </Stack>
  );

  if (loading) {
    return <ChatHeaderSkeleton />;
  }

  return (
    <>
      {group ? renderGroup : renderSingle}

      <Stack direction="row" flexGrow={1} justifyContent="flex-end">
        <IconButton>
          <Iconify icon={phoneIcon} />
        </IconButton>

        <IconButton>
          <Iconify icon={videocameraIcon} />
        </IconButton>

        <IconButton onClick={handleToggleNav}>
          <Iconify icon={!collapseDesktop ? sidebarUnfoldIcon : sidebarFoldIcon} />
        </IconButton>

        <IconButton onClick={popover.onOpen}>
          <Iconify icon={moreVerticalIcon} />
        </IconButton>
      </Stack>

      <CustomPopover open={popover.open} anchorEl={popover.anchorEl} onClose={popover.onClose}>
        <MenuList>
          <MenuItem
            onClick={() => {
              popover.onClose();
            }}
          >
            <Iconify icon={bellOffIcon} />
            Hide notifications
          </MenuItem>

          <MenuItem
            onClick={() => {
              popover.onClose();
            }}
          >
            <Iconify icon={forbiddenCircleIcon} />
            Block
          </MenuItem>

          <MenuItem
            onClick={() => {
              popover.onClose();
            }}
          >
            <Iconify icon={dangerTriangleIcon} />
            Report
          </MenuItem>

          <Divider sx={{ borderStyle: 'dashed' }} />

          <MenuItem
            onClick={() => {
              popover.onClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon={trashBinIcon} />
            Delete
          </MenuItem>
        </MenuList>
      </CustomPopover>
    </>
  );
}
