// Coupang Notebook Brand Definitions

export interface NotebookBrand {
  id: string;
  koreanName: string;
  englishName: string;
  coupangBrandParam: string; // URL parameter for Coupang search
  tier: 1 | 2 | 3;
}

export const NOTEBOOK_BRANDS: NotebookBrand[] = [
  // Tier 1 - Premium
  { id: 'samsung', koreanName: '삼성', englishName: 'Samsung', coupangBrandParam: '삼성전자', tier: 1 },
  { id: 'lg', koreanName: 'LG', englishName: 'LG', coupangBrandParam: 'LG전자', tier: 1 },
  { id: 'apple', koreanName: '애플', englishName: 'Apple', coupangBrandParam: '애플', tier: 1 },
  // Tier 2 - Mainstream
  { id: 'asus', koreanName: '에이수스', englishName: 'ASUS', coupangBrandParam: '에이수스', tier: 2 },
  { id: 'lenovo', koreanName: '레노버', englishName: 'Lenovo', coupangBrandParam: '레노버', tier: 2 },
  { id: 'hp', koreanName: 'HP', englishName: 'HP', coupangBrandParam: 'HP', tier: 2 },
  { id: 'dell', koreanName: '델', englishName: 'Dell', coupangBrandParam: '델', tier: 2 },
  // Tier 3 - Gaming/Budget
  { id: 'msi', koreanName: 'MSI', englishName: 'MSI', coupangBrandParam: 'MSI', tier: 3 },
  { id: 'acer', koreanName: '에이서', englishName: 'Acer', coupangBrandParam: '에이서', tier: 3 },
];

export function getBrandsByTier(tier: 1 | 2 | 3): NotebookBrand[] {
  return NOTEBOOK_BRANDS.filter(b => b.tier === tier);
}

export function getBrandById(id: string): NotebookBrand | undefined {
  return NOTEBOOK_BRANDS.find(b => b.id === id);
}

export function getBrandsByIds(ids: string[]): NotebookBrand[] {
  return NOTEBOOK_BRANDS.filter(b => ids.includes(b.id));
}

export const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: '프리미엄',
  2: '메인스트림',
  3: '게이밍/가성비',
};
