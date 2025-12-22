import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
  link?: string;
  linkText?: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Zero Dependencies',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Lightweight and self-contained. No external dependencies means faster
        installs, smaller bundles, and no supply chain concerns.
      </>
    ),
  },
  {
    title: 'Cloudflare Email Workers',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
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
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Full TypeScript definitions included. Get complete type safety and
        excellent IDE support out of the box.
      </>
    ),
  },
];

function Feature({title, Svg, description, link, linkText}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
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
