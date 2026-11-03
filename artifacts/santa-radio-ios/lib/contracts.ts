export type NameResult = { id: string; name: string; variant?: string; token?: string };
export type Clip = { uri: string; name: string };
export type Choice = { id: string; label: string; kind?: string; isCountry?: boolean };
export type StudioChoices = {
  name: string; age: string; activity: string; achievement: string; treat: string; place: string;
  talent: { skip: true } | { category: 'sports' | 'funny'; id: string }; region?: string;
};
export type Catalogue = {
  categories: Record<'age' | 'activity' | 'achievement' | 'treat' | 'place' | 'sports' | 'funny', Choice[]>;
  regionalGroups: Record<string, { parentId: string; records: Choice[] }>;
};
export type Entitlement = { verified: boolean; permanent: boolean; credits: number };
