import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/parsing-emails',
        'guides/working-with-attachments',
        'guides/cloudflare-workers',
        'guides/security',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/postal-mime',
        'api/address-parser',
        'api/decode-words',
        'api/types',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/basic-parsing',
        'examples/web-worker',
        'examples/email-viewer',
      ],
    },
    'troubleshooting',
  ],
};

export default sidebars;
