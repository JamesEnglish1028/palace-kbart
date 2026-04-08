export type OpdsLink = {
  href?: string;
  rel?: string;
  title?: string;
  type?: string;
  metadata?: OpdsMetadata;
  properties?: Record<string, unknown>;
};

export type OpdsMetadata = {
  "@type"?: string;
  title?: string;
  name?: string;
  author?: Array<{ name?: string } | string>;
  contributor?: Array<{ name?: string } | string> | { name?: string } | string;
  editor?: Array<{ name?: string } | string>;
  description?: string | Array<{ value?: string } | string> | { value?: string };
  subject?:
    | Array<{ name?: string } | string>
    | { name?: string }
    | string;
  language?:
    | Array<{ value?: string } | string>
    | { value?: string }
    | string;
  edition?: string;
  place?: string;
  publisher_place?: string;
  identifier?: unknown;
  id?: unknown;
  publisher?:
    | string
    | { name?: string; place?: string }
    | Array<{ name?: string } | string>;
  published?: string;
  published_date?: string;
  modified?: string;
};

export type OpdsPublication = {
  metadata?: OpdsMetadata;
  links?: OpdsLink[];
};

export type OpdsGroup = {
  metadata?: OpdsMetadata;
  links?: OpdsLink[];
  publications?: OpdsPublication[];
};

export type OpdsFacet = {
  metadata?: OpdsMetadata;
  links?: OpdsLink[];
};

export type OpdsFeed = {
  metadata?: OpdsMetadata;
  links?: OpdsLink[];
  navigation?: OpdsLink[];
  groups?: OpdsGroup[];
  facets?: OpdsFacet[];
  publications?: OpdsPublication[];
};
