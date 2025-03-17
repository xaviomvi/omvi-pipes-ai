import { Helmet } from 'react-helmet-async';

import ResetPassword from 'src/auth/view/auth/reset-password';

// ----------------------------------------------------------------------

const metadata = { title: 'Reset Password' };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <ResetPassword />
    </>
  );
}
