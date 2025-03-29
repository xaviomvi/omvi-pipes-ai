import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';
import { UserProvider } from 'src/context/UserContext';
import { GroupsProvider } from 'src/context/GroupsContext';

import KnowledgeBaseSearch from 'src/sections/knowledgebase/knowledge-base-search';

// ----------------------------------------------------------------------

const metadata = { title: `KnowledgeBase Search | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>
      <UserProvider>
        <GroupsProvider>
          <KnowledgeBaseSearch />
        </GroupsProvider>
      </UserProvider>
    </>
  );
}
