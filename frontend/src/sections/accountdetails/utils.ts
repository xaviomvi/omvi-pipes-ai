import { AxiosError } from 'axios';

import { CONFIG } from 'src/config-global';

import { jwtDecode } from 'src/auth/context/jwt';

import axios from 'src/utils/axios';
import { STORAGE_KEY } from 'src/auth/context/jwt/constant';

import type { UserData } from './types/user-data';
import type { OrganizationData } from './types/organization-data';
import type { AppUser, GroupUser, AppUserGroup } from './types/group-details';

interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

interface AddUsersToGroupsRequest {
  userIds: string[];
  groupIds: string[];
}

interface InviteUsersRequest {
  emails: string[];
  groupIds: string[];
}

interface createGroupProps {
  name: string;
  type: string;
}

export const getOrgById = async (orgId: string): Promise<OrganizationData> => {
  try {
    const response = await axios.get<OrganizationData>(`${CONFIG.iamUrl}/api/v1/org`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error fetching organization:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error fetching organization:', error);
    }
    throw error;
  }
};

export const getUserById = async (userId: string | null): Promise<UserData> => {
  try {
    if (!userId) throw new Error('User ID is required');
    const response = await axios.get<UserData>(`${CONFIG.iamUrl}/api/v1/users/${userId}`);

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error fetching user data:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error fetching user data:', error);
    }
    throw error;
  }
};

export const getOrgLogo = async (orgId: string): Promise<string | null> => {
  try {
    const response = await axios.get(`${CONFIG.iamUrl}/api/v1/orgs/${orgId}/logo`, {
      responseType: 'arraybuffer',
    });

    const contentType = response.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
      return null;
    }

    const blob = new Blob([response.data], { type: response.headers['content-type'] });

    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // FileReader.result can be string | ArrayBuffer | null
        // We know it will be a string because we're using readAsDataURL
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error('Error fetching organization logo:', error);
    return null;
  }
};

export const getUserLogo = async (userId: string): Promise<string | null> => {
  try {
    const response = await axios.get(`${CONFIG.iamUrl}/api/v1/users/${userId}/dp`, {
      responseType: 'arraybuffer',
    });

    const contentType = response.headers['content-type'];
    if (contentType && contentType.includes('application/json')) {
      return null;
    }

    const blob = new Blob([response.data], { type: response.headers['content-type'] });

    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // FileReader.result can be string | ArrayBuffer | null
        // We know it will be a string because we're using readAsDataURL
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error('Error fetching user logo:', error);
    return null;
  }
};

export const updateOrg = async (orgId: string, orgData: any) => {
  try {
    const response = await axios.put(`${CONFIG.iamUrl}/api/v1/orgs/${orgId}`, orgData);
    return response.data.message;
  } catch (error) {
    console.error('Error updating organization:', error);
    throw error;
  }
};

export const changePassword = async ({ currentPassword, newPassword }: PasswordChangeRequest) => {
  try {
    const accessToken = localStorage.getItem(STORAGE_KEY);
    const response = await axios.post(
      `${CONFIG.authUrl}/api/v1/userAccount/password/reset`,
      {
        currentPassword,
        newPassword,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export const updateUser = async (userId: string, userData: any) => {
  try {
    const response = await axios.put(`${CONFIG.iamUrl}/api/v1/users/${userId}`, userData);
    return response.data.message;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const uploadOrgLogo = async (orgId: string, formData: any) => {
  try {
    const response = await axios.put(`${CONFIG.iamUrl}/api/v1/orgs/${orgId}/logo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading logo:', error);
    throw error;
  }
};

export const uploadUserLogo = async (userId: string, formData: any) => {
  try {
    const response = await axios.put(`${CONFIG.iamUrl}/api/v1/users/${userId}/dp`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading User logo:', error);
    throw error;
  }
};

export const deleteOrgLogo = async (orgId: string) => {
  try {
    const response = await axios.delete(`${CONFIG.iamUrl}/api/v1/orgs/${orgId}/logo`);
    return response.data;
  } catch (error) {
    console.error('Error deleting logo:', error);
    throw error;
  }
};

export const deleteUserLogo = async (userId: string) => {
  try {
    const response = await axios.delete(`${CONFIG.iamUrl}/api/v1/users/${userId}/dp`);
    return response.data;
  } catch (error) {
    console.error('Error deleting User logo:', error);
    throw error;
  }
};

export const getAllUsersWithGroups = async () => {
  try {
    const response = await axios.get<GroupUser[]>(
      `${CONFIG.backendUrl}/api/v1/users/fetch/with-groups`
    ); // Replace with the actual API endpoint

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error fetching iam users:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error fetching iam users:', error);
    }
    throw error;
  }
};

export const allGroups = async () => {
  try {
    const response = await axios.get<AppUserGroup[]>(`${CONFIG.backendUrl}/api/v1/userGroups`); // Replace with the actual API endpoint
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error fetching groups:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error fetching groups:', error);
    }
    throw error;
  }
};

export const resendInvite = async (userId: string) => {
  try {
    const response = await axios.post(`${CONFIG.backendUrl}/api/v1/users/${userId}/resend-invite`);
    return response.data;
  } catch (error) {
    console.error('Error resending invite:', error);
    throw error;
  }
};

export const removeUserFromGroup = async (userId: string, groupId : string | null) => {
  try {
    const response = await axios.post(`${CONFIG.backendUrl}/api/v1/userGroups/remove-users`, {
      userIds: [userId],
      groupIds : [groupId]
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error fetching group:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error fetching group:', error);
    }
    throw error;
  }
};

export const removeUser = async (userId: string) => {
  try {
    const response = await axios.post(`${CONFIG.backendUrl}/api/v1/users/${userId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error deleting user:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error deleting user:', error);
    }
    throw error;
  }
};

export const fetchGroupDetails = async (groupId: string | null) => {
  try {
    if (!groupId) {
      throw new Error('No group id found');
    }
    const response = await axios.get<AppUserGroup>(
      `${CONFIG.backendUrl}/api/v1/userGroups/${groupId}`
    ); // Adjust the URL if needed
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error fetching group details', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error fetching group details', error);
    }
    throw error;
  }
};

export const createGroup = async (groupData: createGroupProps) => {
  try {
    const response = await axios.post(`${CONFIG.backendUrl}/api/v1/userGroups`, groupData);
    return response.data;
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

export const addUsersToGroups = async ({ userIds, groupIds }: AddUsersToGroupsRequest) => {
  try {
    const response = await axios.post(`${CONFIG.backendUrl}/api/v1/userGroups/add-users`, {
      userIds,
      groupIds,
    });
    return response.data;
  } catch (error) {
    console.error('Error adding users to groups:', error);
    throw error;
  }
};

export const inviteUsers = async ({ emails, groupIds }: InviteUsersRequest) => {
  try {
    const response = await axios.post(`${CONFIG.backendUrl}/api/v1/appuser/invite`, {
      emails,
      groupIds,
    });
    return response.data;
  } catch (error) {
    console.error('Error inviting users to groups:', error);
    throw error;
  }
};

export const deleteGroup = async (groupId: string) => {
  try {
    await axios.delete(`${CONFIG.backendUrl}/api/v1/userGroups/${groupId}`);
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

export const fetchAllUsers = async () => {
  try {
    const response = await axios.get<AppUser[]>(`${CONFIG.backendUrl}/api/v1/users`); // Adjust the URL if needed
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error fetching user:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    } else {
      console.error('Error fetching user:', error);
    }
    throw error;
  }
};

export const getOrgIdFromToken = (): string => {
  const accessToken = localStorage.getItem(STORAGE_KEY);
  const decodedToken = jwtDecode(accessToken);
  const { orgId } = decodedToken;
  return orgId;
};

export const getUserIdFromToken = (): string => {
  const accessToken = localStorage.getItem(STORAGE_KEY);
  const decodedToken = jwtDecode(accessToken);
  const { userId } = decodedToken;
  return userId;
}; 
