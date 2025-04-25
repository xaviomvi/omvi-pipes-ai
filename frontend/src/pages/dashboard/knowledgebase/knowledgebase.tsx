import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import KnowledgeBase from 'src/sections/knowledgebase/knowledge-base';

// ----------------------------------------------------------------------

const metadata = { title: `Knowledge Base | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>
      <KnowledgeBase />
    </>
  );
}
