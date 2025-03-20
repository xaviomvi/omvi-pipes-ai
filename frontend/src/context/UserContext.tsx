import type { ReactNode } from 'react';

import React, { useState, useEffect, useContext, createContext } from 'react';

import axiosInstance from 'src/utils/axios';

// Types based on API response
export interface User {
  _id: string;
  orgId: string;
  fullName: string;
  email: string;
  hasLoggedIn: boolean;
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

interface UserProviderProps {
  children: ReactNode;
}

// Create context with proper typing
const UserContext = createContext<User[] | undefined>(undefined);

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [users, setUsers] = useState<User[] | null>(null);

  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      try {
        const response = await axiosInstance.get<User[]>('/api/v1/users');
        setUsers(response.data);
      } catch (error) {
        // Set empty array in case of error to prevent infinite loading
        setUsers([]);
      }
    };

    fetchUsers();
  }, []);

  // Don't render children until users are fetched
  if (users === null) {
    return null;
  }

  return (
    <UserContext.Provider value={users}>
      {children}
    </UserContext.Provider>
  );
};

export const useUsers = (): User[] => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUsers must be used within a UserProvider');
  }
  return context;
};