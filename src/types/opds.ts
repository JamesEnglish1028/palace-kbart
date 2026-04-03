export type OpdsLink = {
  href?: string;
  rel?: string;
  title?: string;
  type?: string;
  properties?: Record<string, unknown>;
};

export type OpdsMetadata = {
  title?: string;
  name?: string;
  author?: Array<{ name?: string } | string>;
  contributor?: Array<{ name?: string } | string> | { name?: string } | string;
  editor?: Array<{ name?: string } | string>;
  identifier?: unknown;
  id?: unknown;
  publisher?: string | { name?: string } | Array<{ name?: string } | string>;
  published?: string;
  published_date?: string;
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
