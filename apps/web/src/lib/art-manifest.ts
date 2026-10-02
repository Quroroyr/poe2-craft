/**
 * Local copies of game art, keyed by the art id the CraftDB records carry (`ItemBase.artAssetId`,
 * `Consumable.art`). The domain only stores the id; this manifest is the infrastructure side that
 * knows where each image lives and where it came from.
 *
 * Every file was downloaded once (2026-10-02) from GGG's CDN, through the official PoE 2 trade
 * data (`official.trade2-data`) or the item JSON of trade listings (`official.trade2-listings`),
 * and is served by this site from /icons/game — never hotlinked. Images © Grinding Gear Games,
 * used in a non-commercial fan tool; check GGG's fan-site rules before a public launch.
 */
export interface ArtAsset {
  readonly file: string;
  /** Intrinsic size in pixels; images are shown at this size or smaller, never upscaled. */
  readonly width: number;
  readonly height: number;
  /** DataSource id the art was taken through. */
  readonly source: 'official.trade2-data' | 'official.trade2-listings';
  /** CDN address the copy was made from (attribution only, never requested by the site). */
  readonly origin: string;
}

export const ART_RETRIEVED = '2026-10-02';
export const ART_COPYRIGHT = '© Grinding Gear Games';

export const ART_MANIFEST: Readonly<Record<string, ArtAsset>> = {
  'Art/2DItems/Currency/CurrencyRerollRare': {
    file: 'CurrencyRerollRare.png',
    width: 64,
    height: 64,
    source: 'official.trade2-data',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c0ca392a78/CurrencyRerollRare.png',
  },
  'Art/2DItems/Currency/CurrencyAddModToRare': {
    file: 'CurrencyAddModToRare.png',
    width: 64,
    height: 64,
    source: 'official.trade2-data',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png',
  },
  'Art/2DItems/Currency/CurrencyModValues': {
    file: 'CurrencyModValues.png',
    width: 64,
    height: 64,
    source: 'official.trade2-data',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png',
  },
  'Art/2DItems/Currency/Omens/VoodooOmens1Dark': {
    file: 'VoodooOmens1Dark.png',
    width: 64,
    height: 64,
    source: 'official.trade2-data',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvT21lbnMvVm9vZG9vT21lbnMxRGFyayIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/2dea0999d5/VoodooOmens1Dark.png',
  },
  'Art/2DItems/Currency/Omens/VoodooOmens3Dark': {
    file: 'VoodooOmens3Dark.png',
    width: 64,
    height: 64,
    source: 'official.trade2-data',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvT21lbnMvVm9vZG9vT21lbnMzRGFyayIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/6e2bb52963/VoodooOmens3Dark.png',
  },
  'Art/2DItems/Currency/Omens/VoodooOmens2Yellow': {
    file: 'VoodooOmens2Yellow.png',
    width: 64,
    height: 64,
    source: 'official.trade2-data',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvT21lbnMvVm9vZG9vT21lbnMyWWVsbG93Iiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/6d316b47ee/VoodooOmens2Yellow.png',
  },
  'Art/2DItems/Currency/Omens/VoodooOmens3Yellow': {
    file: 'VoodooOmens3Yellow.png',
    width: 64,
    height: 64,
    source: 'official.trade2-data',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvT21lbnMvVm9vZG9vT21lbnMzWWVsbG93Iiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/ed7cf06fa4/VoodooOmens3Yellow.png',
  },
  'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear10': {
    file: '1HSpear10.png',
    width: 47,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9PbmVIYW5kV2VhcG9ucy9PbmVIYW5kU3BlYXJzLzFIU3BlYXIxMCIsInciOjEsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/114525ad0e/1HSpear10.png',
  },
  'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear01': {
    file: '1HSpear01.png',
    width: 47,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9PbmVIYW5kV2VhcG9ucy9PbmVIYW5kU3BlYXJzLzFIU3BlYXIwMSIsInciOjEsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/84a2d1da16/1HSpear01.png',
  },
  'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear03': {
    file: '1HSpear03.png',
    width: 47,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9PbmVIYW5kV2VhcG9ucy9PbmVIYW5kU3BlYXJzLzFIU3BlYXIwMyIsInciOjEsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/d4c8557684/1HSpear03.png',
  },
  'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear05': {
    file: '1HSpear05.png',
    width: 47,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9PbmVIYW5kV2VhcG9ucy9PbmVIYW5kU3BlYXJzLzFIU3BlYXIwNSIsInciOjEsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/b176f54004/1HSpear05.png',
  },
  'Art/2DItems/Weapons/OneHandWeapons/OneHandSpears/1HSpear02': {
    file: '1HSpear02.png',
    width: 47,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9PbmVIYW5kV2VhcG9ucy9PbmVIYW5kU3BlYXJzLzFIU3BlYXIwMiIsInciOjEsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/08f2f8530e/1HSpear02.png',
  },
  'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow04': {
    file: 'Bow04.png',
    width: 94,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9Ud29IYW5kV2VhcG9ucy9Cb3dzL0Jhc2V0eXBlcy9Cb3cwNCIsInciOjIsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/fc5fb2ae18/Bow04.png',
  },
  'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow01': {
    file: 'Bow01.png',
    width: 94,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9Ud29IYW5kV2VhcG9ucy9Cb3dzL0Jhc2V0eXBlcy9Cb3cwMSIsInciOjIsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/30226ab5e1/Bow01.png',
  },
  'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow06': {
    file: 'Bow06.png',
    width: 94,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9Ud29IYW5kV2VhcG9ucy9Cb3dzL0Jhc2V0eXBlcy9Cb3cwNiIsInciOjIsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/b0a606586d/Bow06.png',
  },
  'Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow09': {
    file: 'Bow09.png',
    width: 94,
    height: 188,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9Ud29IYW5kV2VhcG9ucy9Cb3dzL0Jhc2V0eXBlcy9Cb3cwOSIsInciOjIsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/e62ea7f094/Bow09.png',
  },
  'Art/2DItems/Weapons/TwoHandWeapons/WarStaves/Warstaff01': {
    file: 'Warstaff01.png',
    width: 47,
    height: 189,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9Ud29IYW5kV2VhcG9ucy9XYXJTdGF2ZXMvV2Fyc3RhZmYwMSIsInciOjIsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/fea458e458/Warstaff01.png',
  },
  'Art/2DItems/Weapons/TwoHandWeapons/WarStaves/Warstaff02': {
    file: 'Warstaff02.png',
    width: 47,
    height: 189,
    source: 'official.trade2-listings',
    origin: 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvV2VhcG9ucy9Ud29IYW5kV2VhcG9ucy9XYXJTdGF2ZXMvV2Fyc3RhZmYwMiIsInciOjIsImgiOjQsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/23459cf5a8/Warstaff02.png',
  },
};
