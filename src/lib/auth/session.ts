export type SessionUser = {
  email: string;
  fullName: string;
  role: "resident" | "guard" | "admin";
  authUserId: string | null;
  residentId: string | null;
  pendingCommunityName?: string | null;
};
