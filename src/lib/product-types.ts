export type ProductCategory = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type ProductOption = {
  id: string;
  name: string;
  priceCents: number;
  commissionPercent: number;
  stockQuantity: number;
  categoryId: string;
  categoryName: string;
  photoUrl: string | null;
  photoPosition?: string | null;
};
