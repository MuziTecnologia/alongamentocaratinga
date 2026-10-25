export function isAllowedAdmin(
  userId: string | undefined,
  adminUserId = process.env.ADMIN_USER_ID,
) {
  return Boolean(adminUserId && userId && userId === adminUserId);
}
