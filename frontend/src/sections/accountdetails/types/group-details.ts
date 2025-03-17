import type { AlertColor } from '@mui/material';

export interface GroupPermissions {
    [key: string]: boolean;
}

export interface AppUserGroup {
  permissions: GroupPermissions;
  _id: string;
  name: string;
  type: string;
  orgId: string;
  users: string[];
  modules: any[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  slug: string;
  __v: number;

  description?:string;
}

export interface AppUser {
  _id: string;
  orgId: string;
  fullName: string;
  email: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  slug: string;
  __v: number;
  designation?: string;
  firstName?: string;
  lastName?: string;
  deletedBy?: string;
  isEmailVerified: boolean;
}

export interface GroupUser {
  _id: string;
  iamUserId: string;
  orgId: string;
  groups: {
    name: string;
    type: string;
  }[];
  iamUser: AppUser | null;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

export interface EditGroupModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string | null;
  groupName: string;
}

export interface AddUsersToGroupsModalProps {
  open: boolean;
  onClose: () => void;
  onUsersAdded: () => void;
  allUsers: GroupUser[] | null;
  group: string | null;
}

export interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  groups: AppUserGroup[];
  onUsersAdded: () => void;
}