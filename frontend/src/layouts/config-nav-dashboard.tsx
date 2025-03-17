import { paths } from 'src/routes/paths';


// ----------------------------------------------------------------------

// const icon = (name: string) => (
//   <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
// );



// ----------------------------------------------------------------------

export const navData = [
  /**
   * Overview
   */
  {
    subheader: 'Overview',
    items: [
      { title: 'Dashboard', path: paths.dashboard.root },
      {
        title: 'Knowledge Base',
        path: paths.dashboard.knowledgebase.root,
      },
      {
        title: 'Knowledge Search',
        path: paths.dashboard.knowledgebase.search,
      },
    ],
  },
];
