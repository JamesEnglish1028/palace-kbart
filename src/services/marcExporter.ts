import { MarcRecord } from "@natlibfi/marc-record";
import {
  buildFeedDisplayUrl,
  buildFeedRequestUrl,
  identifySourceIdType,
  identifierForWorkUrl,
  isLikelyIdentifier,
  parseOpds2Feed,
} from "../utils/opds";

export type MarcFormat = "marc21" | "marcxml";
type MarcRecordInstance = InstanceType<typeof MarcRecord>;

type ExportMarcOptions = {
  libraryShortName: string;
  collectionName: string;
  collectionHref: string;
  feedBase: string;
  baseUrl: string;
  webClientUrl: string;
  fromDate?: string;
  format: MarcFormat;
  onProgress?: (pagesFetched: number) => void;
};

const shouldContinueCrawl = (
  entries: ReturnType<typeof parseOpds2Feed>["items"],
  fromDateValue: number | null
) => {
  if (!fromDateValue) return true;
  if (entries.length === 0) return false;
  const hasUnknownModified = entries.some(
    (entry) => !entry.modified || !Number.isFinite(Date.parse(entry.modified))
  );
  if (hasUnknownModified) return true;
  const hasRecent = entries.some(
    (entry) => Date.parse(entry.modified ?? "") >= fromDateValue
  );
  return hasRecent;
};

const fetchOpdsEntries = async (
  feedUrl: string,
  feedBase: string,
  fromDateValue: number | null,
  onProgress: ((pagesFetched: number) => void) | undefined,
  accumulator: ReturnType<typeof parseOpds2Feed>["items"] = [],
  pagesFetched = 0
) => {
  const response = await fetch(feedUrl, {
    method: "GET",
    credentials: "omit",
    headers: {
      Accept: "application/opds+json",
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    const snippet = errorText ? errorText.slice(0, 300) : "";
    throw new Error(
      `Feed request failed with ${response.status}. ${snippet}`.trim()
    );
  }

  const data = await response.json();
  const { items, nextHref } = parseOpds2Feed(data);
  items.forEach((item) => accumulator.push(item));
  const nextPages = pagesFetched + 1;
  if (onProgress) {
    onProgress(nextPages);
  }

  if (nextHref && shouldContinueCrawl(items, fromDateValue)) {
    const nextUrl = buildFeedRequestUrl(nextHref, feedBase);
    return fetchOpdsEntries(
      nextUrl,
      feedBase,
      fromDateValue,
      onProgress,
      accumulator,
      nextPages
    );
  }
  return accumulator;
};

const extractProviderId = (identifier: string, sourceIdType: string) => {
  if (sourceIdType === "DOI") {
    const trimmed = identifier.trim();
    const doiUrlMatch = trimmed.match(
      /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i
    );
    if (doiUrlMatch) {
      return doiUrlMatch[1];
    }
    const doiUrnMatch = trimmed.match(/^urn:doi:(.+)$/i);
    if (doiUrnMatch) {
      return doiUrnMatch[1];
    }
    return "";
  }
  if (sourceIdType === "CNRI Handle") {
    const trimmed = identifier.trim();
    const handleMatch = trimmed.match(/^https?:\/\/hdl\.handle\.net\/(.+)$/i);
    if (handleMatch) {
      return handleMatch[1];
    }
  }
  if (sourceIdType === "UUID") {
    const trimmed = identifier.trim();
    const uuidMatch = trimmed.match(/^urn:uuid:(.+)$/i);
    if (uuidMatch) {
      return uuidMatch[1];
    }
  }
  return "";
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const serializeMarcXmlRecord = (record: MarcRecordInstance) => {
  const leader = escapeXml(record.leader || "");
  const controlFields = record
    .getControlfields()
    .map(
      (field: any) =>
        `<controlfield tag="${escapeXml(field.tag)}">${escapeXml(
          field.value || ""
        )}</controlfield>`
    )
    .join("");
  const dataFields = record
    .getDatafields()
    .map((field: any) => {
      const subfields = field.subfields
        .map(
          (subfield: any) =>
            `<subfield code="${escapeXml(subfield.code)}">${escapeXml(
              subfield.value || ""
            )}</subfield>`
        )
        .join("");
      return `<datafield tag="${escapeXml(field.tag)}" ind1="${escapeXml(
        field.ind1
      )}" ind2="${escapeXml(field.ind2)}">${subfields}</datafield>`;
    })
    .join("");
  return `<record><leader>${leader}</leader>${controlFields}${dataFields}</record>`;
};

const serializeMarcXml = (records: MarcRecordInstance[]) => {
  const body = records.map(serializeMarcXmlRecord).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<collection xmlns="http://www.loc.gov/MARC21/slim">${body}</collection>`;
};

const serializeMarc21Record = (record: MarcRecordInstance) => {
  let { leader } = record;
  let marcStr = "";
  let directoryStr = "";
  let dataFieldStr = "";
  let charPos = 0;
  record.getControlfields().forEach((field: any) => {
    directoryStr += field.tag;
    if (field.value === undefined || field.value === "") {
      directoryStr += addLeadingZeros(1, 4);
      directoryStr += addLeadingZeros(charPos, 5);
      charPos += 1;
      dataFieldStr += "\u001E";
    } else {
      directoryStr += addLeadingZeros(field.value.length + 1, 4);
      directoryStr += addLeadingZeros(charPos, 5);
      charPos += lengthInUtf8Bytes(field.value) + 1;
      dataFieldStr += `${field.value}\u001E`;
    }
  });
  record.getDatafields().forEach((field: any) => {
    const { tag, ind1, ind2 } = field;
    directoryStr += tag;
    dataFieldStr += `${ind1 + ind2}\u001F`;
    let currDataField = "";
    field.subfields.forEach((subfield: any, i: number) => {
      let subFieldStr = subfield.value || "";
      const { code } = subfield;
      subFieldStr = code + subFieldStr;
      if (i === field.subfields.length - 1) {
        subFieldStr += "\u001E";
      } else {
        subFieldStr += "\u001F";
      }
      currDataField += subFieldStr;
    });
    dataFieldStr += currDataField;
    directoryStr += addLeadingZeros(stringToByteArray(currDataField).length + 3, 4);
    directoryStr += addLeadingZeros(charPos, 5);
    charPos += lengthInUtf8Bytes(currDataField) + 3;
  });
  const newStrLength = stringToByteArray(
    `${leader + directoryStr}\u001E${dataFieldStr}\u001D`
  ).length;
  leader = addLeadingZeros(newStrLength, 5) + leader.substring(5);
  const newBaseAddrPos = 24 + directoryStr.length + 1;
  leader =
    leader.substring(0, 12) +
    addLeadingZeros(newBaseAddrPos, 5) +
    leader.substring(17);
  marcStr += `${leader + directoryStr}\u001E${dataFieldStr}\u001D`;
  return marcStr;
};

const serializeMarc21 = (records: MarcRecordInstance[]) =>
  records.map((record) => serializeMarc21Record(record)).join("");

const addLeadingZeros = (numField: number, length: number) =>
  String(numField).padStart(length, "0");

const stringToByteArray = (value: string) => {
  const encoded = unescape(encodeURIComponent(value));
  const bytes = new Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 1) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
};

const lengthInUtf8Bytes = (value: string) => stringToByteArray(value).length;

const buildMarcRecord = (
  entry: ReturnType<typeof parseOpds2Feed>["items"][number],
  libraryShortName: string,
  baseUrl: string,
  webClientUrl: string
) => {
  const identifier = entry.identifier;
  if (!identifier) return null;
  const sourceIdType = identifySourceIdType(identifier);
  const providerId = extractProviderId(identifier, sourceIdType);
  const normalizedType = String(entry.type || "").toLowerCase().trim();
  const isAudiobook =
    normalizedType === "schema.org/audiobook" ||
    normalizedType === "https://schema.org/audiobook" ||
    normalizedType === "http://schema.org/audiobook";

  const record = new MarcRecord();
  record.leader = isAudiobook
    ? "00000nim a2200000 i 4500"
    : "00000nam a2200000 i 4500";

  record.appendField({ tag: "001", value: identifier });

  const title = entry.title || "";
  const author = entry.authors && entry.authors !== "Unlisted" ? entry.authors : "";
  const titleInd1 = author ? "1" : "0";
  record.appendField({
    tag: "245",
    ind1: titleInd1,
    ind2: "0",
    subfields: [{ code: "a", value: title }],
  });

  if (author) {
    record.appendField({
      tag: "100",
      ind1: "1",
      ind2: " ",
      subfields: [{ code: "a", value: author }],
    });
  }

  const publisher = entry.publisher || "";
  const publisherPlace = entry.publisherPlace || "";
  const edition = entry.edition || "";
  const published = entry.published || entry.modified || "";
  if (edition) {
    record.appendField({
      tag: "250",
      ind1: " ",
      ind2: " ",
      subfields: [{ code: "a", value: edition }],
    });
  }
  if (publisher || published) {
    const subfields = [] as Array<{ code: string; value: string }>;
    if (publisherPlace) subfields.push({ code: "a", value: publisherPlace });
    if (publisher) subfields.push({ code: "b", value: publisher });
    if (published) subfields.push({ code: "c", value: published });
    record.appendField({
      tag: "264",
      ind1: " ",
      ind2: "1",
      subfields,
    });
  }

  if (entry.description) {
    record.appendField({
      tag: "520",
      ind1: " ",
      ind2: " ",
      subfields: [{ code: "a", value: entry.description }],
    });
  }

  if (entry.subjects?.length) {
    entry.subjects.forEach((subject) => {
      record.appendField({
        tag: "650",
        ind1: " ",
        ind2: "0",
        subfields: [{ code: "a", value: subject }],
      });
    });
  }

  if (entry.languages?.length) {
    record.appendField({
      tag: "041",
      ind1: "0",
      ind2: " ",
      subfields: entry.languages.map((lang) => ({ code: "a", value: lang })),
    });
  }

  if (isAudiobook) {
    record.appendField({ tag: "007", value: "sr|||||" });
    const fixed = Array(40).fill(" ");
    fixed[23] = "o";
    fixed[26] = "h";
    record.appendField({ tag: "008", value: fixed.join("") });
    record.appendField({
      tag: "336",
      ind1: " ",
      ind2: " ",
      subfields: [
        { code: "a", value: "spoken word" },
        { code: "b", value: "spw" },
        { code: "2", value: "rdacontent" },
      ],
    });
    record.appendField({
      tag: "337",
      ind1: " ",
      ind2: " ",
      subfields: [
        { code: "a", value: "audio" },
        { code: "b", value: "s" },
        { code: "2", value: "rdamedia" },
      ],
    });
    record.appendField({
      tag: "338",
      ind1: " ",
      ind2: " ",
      subfields: [
        { code: "a", value: "online resource" },
        { code: "b", value: "cr" },
        { code: "2", value: "rdacarrier" },
      ],
    });
    record.appendField({
      tag: "538",
      ind1: " ",
      ind2: " ",
      subfields: [{ code: "a", value: "Digital audio file." }],
    });
    record.appendField({
      tag: "655",
      ind1: " ",
      ind2: "7",
      subfields: [
        { code: "a", value: "Audiobooks." },
        { code: "2", value: "lcgft" },
      ],
    });
  }

  if (sourceIdType === "ISBN") {
    const workIdentifier = identifierForWorkUrl(identifier);
    const isbnValue = workIdentifier?.value || identifier;
    record.appendField({
      tag: "020",
      ind1: " ",
      ind2: " ",
      subfields: [{ code: "a", value: isbnValue }],
    });
  } else if (sourceIdType) {
    const value = providerId || identifier;
    const typeMap: Record<string, string> = {
      DOI: "doi",
      DocID: "docid",
      "Media ID": "media",
      URI: "uri",
      URN: "urn",
      UUID: "uuid",
      "CNRI Handle": "hdl",
    };
    const typeCode = typeMap[sourceIdType] || sourceIdType.toLowerCase();
    record.appendField({
      tag: "024",
      ind1: "7",
      ind2: " ",
      subfields: [
        { code: "a", value },
        { code: "2", value: typeCode },
      ],
    });
  }

  const workIdentifier = identifierForWorkUrl(identifier);
  if (workIdentifier) {
    const qualifiedIdentifier = encodeURIComponent(
      `${workIdentifier.type}/${workIdentifier.value}`
    );
    const worksUrl = `${baseUrl}/${libraryShortName}/works/${qualifiedIdentifier}`;
    const encodedLink = encodeURIComponent(worksUrl);
    const titleUrl = `${webClientUrl}/book/${encodedLink}`;
    record.appendField({
      tag: "856",
      ind1: "4",
      ind2: "0",
      subfields: [{ code: "u", value: titleUrl }],
    });
  }

  return record;
};

const exportMarc = async ({
  libraryShortName,
  collectionName,
  collectionHref,
  feedBase,
  baseUrl,
  webClientUrl,
  fromDate,
  format,
  onProgress,
}: ExportMarcOptions) => {
  const collectionFeedUrl = buildFeedRequestUrl(collectionHref, feedBase);
  const displayUrl = buildFeedDisplayUrl(collectionHref, feedBase);
  const parsedFromDate = fromDate ? Date.parse(fromDate) : NaN;
  const fromDateValue = Number.isFinite(parsedFromDate)
    ? parsedFromDate
    : null;

  const entries = await fetchOpdsEntries(
    collectionFeedUrl,
    feedBase,
    fromDateValue,
    onProgress
  );

  const filtered = entries
    .filter((entry) => isLikelyIdentifier(entry.identifier))
    .filter((entry) => {
      if (!fromDateValue) return true;
      const modified = entry.modified ? Date.parse(entry.modified) : NaN;
      return Number.isFinite(modified) && modified >= fromDateValue;
    });

  const records = filtered
    .map((entry) =>
      buildMarcRecord(entry, libraryShortName, baseUrl, webClientUrl)
    )
    .filter(Boolean) as MarcRecordInstance[];

  if (records.length === 0) {
    throw new Error(
      "No records matched the selection. Check the collection and date filter."
    );
  }

  const payload =
    format === "marcxml" ? serializeMarcXml(records) : serializeMarc21(records);

  return {
    data: payload,
    recordsCount: records.length,
    displayUrl,
    format,
    collectionName,
  };
};

export { exportMarc };
export type { ExportMarcOptions };
