import type { ReactNode } from 'react';

import React, { useMemo, useState, useEffect, useContext, createContext } from 'react';

import axios from 'src/utils/axios';

import { CONFIG } from 'src/config-global';

import { getUserIdFromToken } from './utils';

interface Permissions {
  [key: string]: boolean;
}

interface Group {
    [key: string]: any;
}

interface PermissionsContextType {
  permissions: Permissions | null;
  isAdmin: boolean;
}

interface PermissionsProviderProps {
  children: ReactNode;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const userId = getUserIdFromToken();
        console.log(userId, 'userId from set permissions');
        const response = await axios.get<Group[]>(
          `${CONFIG.backendUrl}/api/v1/appusergroup/users/${userId}`
        );
        const groups = response.data;

        const consolidatedPermissions: Permissions = {};
        let adminGroupExists = false;

        groups.forEach((group) => {
          if (group.type === 'admin') {
            adminGroupExists = true;
          }

          Object.keys(group.permissions).forEach((permission) => {
            consolidatedPermissions[permission] =
              consolidatedPermissions[permission] || group.permissions[permission];
          });
        });

        setPermissions(consolidatedPermissions);
        setIsAdmin(adminGroupExists);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions({});
        setIsAdmin(false);
      }
    };

    fetchPermissions();
  }, []);

  const contextValue = useMemo(
    () => ({ permissions, isAdmin }),
    [permissions, isAdmin]
  );

  if (permissions === null) {
    return null;
  }

  return <PermissionsContext.Provider value={contextValue}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = (): PermissionsContextType => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};