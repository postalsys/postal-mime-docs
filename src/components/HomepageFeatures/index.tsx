import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: ReactNode;
  link?: string;
  linkText?: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Zero Dependencies',
    image: '/img/mascot/parsing.png',
    description: (
      <>
        Lightweight and self-contained. No external dependencies means faster
        installs, smaller bundles, and no supply chain concerns.
      </>
    ),
  },
  {
    title: 'Cloudflare Email Workers',
    image: '/img/mascot/server.png',
    description: (
      <>
        Perfect for Cloudflare Email Workers. Parse incoming emails, extract
        attachments, store to R2, forward based on content, and more.
      </>
    ),
    link: '/docs/guides/cloudflare-workers',
    linkText: 'View Cloudflare Guide',
  },
  {
    title: 'TypeScript Ready',
    image: '/img/mascot/structure.png',
    description: (
      <>
        Full TypeScript definitions included. Get complete type safety and
        excellent IDE support out of the box.
      </>
    ),
  },
];

function Feature({title, image, description, link, linkText}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img src={image} className={styles.featureImg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
        {link && (
          <Link className="button button--primary button--sm" to={link}>
            {linkText}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
