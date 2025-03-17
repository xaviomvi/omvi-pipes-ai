import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { CONFIG } from 'src/config-global';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { PermissionsProvider } from 'src/sections/accountdetails/context/permission-context';

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
const ConnectorSettingsIndividual = lazy(
  () => import('src/pages/dashboard/account/connector-settings-individual')
);
const ConnectorSettingsCompany = lazy(
  () => import('src/pages/dashboard/account/connector-settings-business')
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
    element: CONFIG.auth.skip ? (
      <>{layoutContent}</>
    ) : (
      <AuthGuard>
        <PermissionsProvider>{layoutContent}</PermissionsProvider>
      </AuthGuard>
    ),
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
                  { path: 'connector', element: <ConnectorSettingsCompany /> },
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
                  { path: 'connector', element: <ConnectorSettingsIndividual /> },
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
