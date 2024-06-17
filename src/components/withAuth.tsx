import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const withAuth = (WrappedComponent: React.ComponentType) => {
  const AuthenticatedComponent = (props: any) => {
    const [authenticated, setAuthenticated] = useState(false);
    const router = useRouter();

    useEffect(() => {
      const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setAuthenticated(true);
        } else {
          router.push('/login');
        }
      };

      checkUser();
    }, [router]);

    if (!authenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  return AuthenticatedComponent
};

export default withAuth;
