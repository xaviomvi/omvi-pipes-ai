import { Helmet } from 'react-helmet-async';

import { JwtSignUpView } from 'src/auth/view/auth';

// ----------------------------------------------------------------------

const metadata = { title: 'Sign up' };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <JwtSignUpView />
    </>
  );
}
