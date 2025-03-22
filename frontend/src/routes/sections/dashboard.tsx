import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { CONFIG } from 'src/config-global';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AuthGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

// Overview
const ChatBotPage = lazy(() => import('src/pages/dashboard/qna/chatbot'));

// Accountdetails
const CompanyProfile = lazy(() => import('src/pages/dashboard/account/company-profile'));
const UsersAndGroups = lazy(() => import('src/pages/dashboard/account/user-and-groups'));
const GroupDetails = lazy(() => import('src/pages/dashboard/account/group-details'));
const UserProfile = lazy(() => import('src/pages/dashboard/account/user-profile'));
const PersonalProfile = lazy(() => import('src/pages/dashboard/account/personal-profile'));
const ServiceSettings = lazy(() => import('src/pages/dashboard/account/services-settings'));
const AuthenticationSettings = lazy(
  () => import('src/pages/dashboard/account/authentication-settings')
);
const ConnectorSettings = lazy(
  () => import('src/pages/dashboard/account/connectors/connector-settings')
);

const GoogleWorkspaceBusinessPage = lazy(
  () => import('src/pages/dashboard/account/connectors/googleWorkspace-business-config')
);

const GoogleWorkspaceIndividualPage = lazy(
  () => import('src/pages/dashboard/account/connectors/googleWorkspace-individual-config')
);

const SamlSsoConfigPage = lazy(() => import('src/pages/dashboard/account/saml-sso-config'));

// knowledge-base
const KnowledgeBaseList = lazy(() => import('src/pages/dashboard/knowledgebase/knowledgebase'));
const RecordDetails = lazy(() => import('src/pages/dashboard/knowledgebase/record-details'));
const KnowledgeSearch = lazy(
  () => import('src/pages/dashboard/knowledgebase/knowledgebase-search')
);

// ----------------------------------------------------------------------

const layoutContent = (
  <DashboardLayout>
    <Suspense fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  </DashboardLayout>
);

export const dashboardRoutes = [
  {
    path: '/',
    element: CONFIG.auth.skip ? <>{layoutContent}</> : <AuthGuard>{layoutContent}</AuthGuard>,
    children: [
      { element: <ChatBotPage />, index: true },
      { path: ':conversationId', element: <ChatBotPage /> },
      {
        path: 'account',
        children: [
          { path: 'company-settings/profile', element: <CompanyProfile /> },
          { path: 'company-settings/personal-profile', element: <PersonalProfile /> },
          { path: 'company-settings/user-profile/:id', element: <UserProfile /> },
          { path: 'company-settings/groups/:id', element: <GroupDetails /> },
          {
            path: 'company-settings',
            children: [
              { path: 'users', element: <UsersAndGroups /> },
              { path: 'groups', element: <UsersAndGroups /> },
              { path: 'invites', element: <UsersAndGroups /> },
              {
                path: 'settings',
                children: [
                  {
                    path: 'authentication',
                    children: [
                      { element: <AuthenticationSettings />, index: true },
                      { path: 'saml', element: <SamlSsoConfigPage /> },
                    ],
                  },
                  {
                    path: 'connector',
                    children: [
                      { element: <ConnectorSettings />, index: true },
                      { path: 'googleWorkspace', element: <GoogleWorkspaceBusinessPage /> },
                    ],
                  },

                  { path: 'services', element: <ServiceSettings /> },
                ],
              },
            ],
          },
          {
            path: 'individual',
            children: [
              { path: 'profile', element: <PersonalProfile /> },
              {
                path: 'settings',
                children: [
                  {
                    path: 'authentication',
                    children: [
                      { element: <AuthenticationSettings />, index: true },
                      { path: 'config-saml', element: <SamlSsoConfigPage /> },
                    ],
                  },
                  {
                    path: 'connector',
                    children: [
                      { element: <ConnectorSettings />, index: true },
                      { path: 'googleWorkspace', element: <GoogleWorkspaceIndividualPage /> },
                    ],
                  },
                  { path: 'services', element: <ServiceSettings /> },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'knowledge-base',
        children: [
          { path: 'details', element: <KnowledgeBaseList /> },
          { path: 'record/:recordId', element: <RecordDetails /> },
          { path: 'search', element: <KnowledgeSearch /> },
          { path: 'company-settings/groups/:id', element: <GroupDetails /> },
          {
            path: 'company-settings',
            children: [
              { path: 'users', element: <UsersAndGroups /> },
              { path: 'groups', element: <UsersAndGroups /> },
              { path: 'invites', element: <UsersAndGroups /> },
            ],
          },
        ],
      },
    ],
  },
];
