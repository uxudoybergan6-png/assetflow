export type AssetType =
  | "MOTION_TEMPLATE"
  | "TRANSITION"
  | "VFX_OVERLAY"
  | "TEXTURE"
  | "LUT"
  | "PRESET";

export type SubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "CANCELED"
  | "PAST_DUE"
  | "INCOMPLETE";

export interface AssetListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  type: AssetType;
  category: string;
  tags: string[];
  thumbnailUrl: string | null;
  fileSize: number;
  downloadCount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SubscriptionCheckResponse {
  active: boolean;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
}

export type TemplateReviewStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface ContributorPlatformSettings {
  id: string;
  apiBaseUrl: string | null;
  requireApproval: boolean;
  defaultNav: string;
  defaultRes: string;
  defaultOrient: string;
  categories: { value: string; label: string }[];
  contributorInstructions: string | null;
  updatedAt: string;
}

export interface ContributorTemplateItem {
  id: string;
  contributorId: string;
  externalId: string | null;
  name: string;
  description: string;
  nav: string;
  cat: string;
  catLabel: string;
  orient: string;
  res: string;
  tags: string[];
  icon: string;
  bg: string;
  templateApp: string;
  metaJson: Record<string, unknown>;
  fileName: string | null;
  fileSize: number | null;
  reviewStatus: TemplateReviewStatus;
  reviewNote: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  contributor?: { id: string; email: string; name: string | null };
}

export const PRICING = {
  monthly: { amount: 4.99, priceIdEnv: "STRIPE_PRICE_MONTHLY" },
  yearly: { amount: 39.99, priceIdEnv: "STRIPE_PRICE_YEARLY" },
} as const;
