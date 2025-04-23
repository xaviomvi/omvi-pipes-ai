import type { ReactNode } from 'react';

import { Navigate } from 'react-router-dom';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type AccountType = 'business' | 'individual';

type Props = {
  children: ReactNode;
  accountType: AccountType;
};

export function AccountTypeGuard({ children, accountType }: Props) {
  const { user } = useAuthContext();
  
  // Determine user's account type
  const isBusiness = user?.accountType === 'business' || user?.accountType === 'organization';
  const isIndividual = !isBusiness;
  
  // Check if the route is accessible to this account type
  if (accountType === 'business' && !isBusiness) {
    // Individual user trying to access business route - redirect to individual homepage
    return <Navigate to="/account/individual/profile" />;
  }
  
  if (accountType === 'individual' && !isIndividual) {
    // Business user trying to access individual route - redirect to business homepage
    return <Navigate to="/account/company-settings/profile" />;
  }

  // If we're here, the user can access this route
  return <>{children}</>;
}