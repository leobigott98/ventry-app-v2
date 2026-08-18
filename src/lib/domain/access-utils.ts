export function mayRotateProvisionedAuthUser(
  existingAuthUserId: string,
  linkedMembershipAuthUserId?: string | null,
) {
  return Boolean(linkedMembershipAuthUserId) && existingAuthUserId === linkedMembershipAuthUserId;
}
