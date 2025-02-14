export const redirectToLogin = (currentPath: string) => {
  const redirectUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
  window.location.href = redirectUrl;
};
