import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'postal-mime',
  tagline: 'Email parsing library for browser environments and serverless functions',
  favicon: 'img/favicon.ico',

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  future: {
    v4: true,
  },

  url: 'https://postalsys.github.io',
  baseUrl: '/',

  organizationName: 'postalsys',
  projectName: 'postal-mime',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/postalsys/postal-mime/tree/master/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/postal-mime-social-card.svg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'postal-mime',
      logo: {
        alt: 'postal-mime Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/postalsys/postal-mime',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/postal-mime',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting Started', to: '/docs/'},
            {label: 'API Reference', to: '/docs/api/postal-mime'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub Issues', href: 'https://github.com/postalsys/postal-mime/issues'},
            {label: 'npm', href: 'https://www.npmjs.com/package/postal-mime'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/postalsys/postal-mime'},
            {label: 'EmailEngine', href: 'https://emailengine.app/'},
            {label: 'Live Demo', href: 'https://kreata.ee/postal-mime/example/'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Andris Reinman. Licensed under MIT-0.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
