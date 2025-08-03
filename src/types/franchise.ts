
export interface Franchise {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  contactEmail: string;
  contactPhone: string;
  openingDate: string; // ISO string
  createdAt: string; // ISO string
  assignedUserId?: string;
  assignedUserName?: string;
}

export interface FranchiseConfig {
  targetFranchises: number;
}
