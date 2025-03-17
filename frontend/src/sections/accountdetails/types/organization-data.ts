import type { AlertColor } from "@mui/material";

export interface PermanentAddress {
    addressLine1?: string;
    city?: string;
    state?: string;
    postCode?: string;
    country?: string;
  }
  
  export interface OrganizationData {
    _id: string;
    registeredName: string;
    domain: string;
    contactEmail: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    slug: string;
    __v: number;
    shortName?: string;
    permanentAddress?: PermanentAddress;
  }
  
  export interface SnackbarState {
    open: boolean;
    message: string;
    severity: AlertColor | undefined;
  }