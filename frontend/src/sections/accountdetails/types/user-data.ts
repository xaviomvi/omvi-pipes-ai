export interface UserData {
  _id: string;
  orgId: string;
  fullName: string;
  email: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  slug: string;
  __v: number;
  designation?: string;
  firstName?: string;
  lastName?: string;
  deletedBy?: string;
  isEmailVerified: boolean;
}