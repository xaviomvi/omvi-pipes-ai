import Cookies from 'js-cookie';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthContext } from 'src/auth/hooks';
import { setSession } from 'src/auth/context/jwt';

export default function SamlSsoSuccess() {
  const navigate = useNavigate();
  const {checkUserSession} = useAuthContext();

  useEffect(() => {
    const initAuth = async () => {
      const accessToken: string | null = Cookies.get('accessToken') ?? null;
      const refreshToken: string | null = Cookies.get('refreshToken') ?? null;

      setSession(accessToken, refreshToken);
      await checkUserSession?.();
      navigate('/');
    };
 
    initAuth();
  }, [navigate,checkUserSession]);

  return <div />;
}
