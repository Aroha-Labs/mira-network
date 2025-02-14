export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/privacy-policy.html",
  "/terms",
  "/about",
  "/contact",
] as const;

export const isPublicRoute = (path: string) => {
  return PUBLIC_ROUTES.some((route) => {
    if (route.endsWith("*")) {
      return path.startsWith(route.slice(0, -1));
    }
    return path === route;
  });
};
