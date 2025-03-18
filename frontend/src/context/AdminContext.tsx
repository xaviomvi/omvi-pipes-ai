// AdminContext.tsx
import axios from 'src/utils/axios';
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AuthContext } from 'src/auth/context/auth-context';
import { CONFIG } from 'src/config-global';

// Define the context type with just isAdmin boolean
interface AdminContextType {
  isAdmin: boolean;
}

// Create the context with a default value
const AdminContext = createContext<AdminContextType>({ isAdmin: false });

interface AdminProviderProps {
  children: React.ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const auth = useContext(AuthContext);

  // Check admin status whenever the user changes
  useEffect(() => {
    const checkAdmin = async () => {
      // If not authenticated or no user, we're definitely not an admin
      if (!auth?.authenticated || !auth?.user) {
        setIsAdmin(false);
        return;
      }

      // Get userId from the auth context - with safe type checking
      const user = auth.user;
      const userId = user?.id || user?._id || user?.userId;
      
      if (!userId) {
        console.error('User ID not found in auth context');
        setIsAdmin(false);
        return;
      }

      try {
        const response = await axios.get(`${CONFIG.backendUrl}/api/v1/users/${userId}/adminCheck`);
        if (response) {
          const data = await response.data;
          setIsAdmin(data.message === "User has admin access");
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [auth?.user, auth?.authenticated]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ isAdmin }), [isAdmin]);

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
};

// Simple hook to use the admin context
export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  
  // Ensure the context exists (in case someone uses the hook outside the provider)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  
  return context;
};