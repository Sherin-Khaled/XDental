export function requireRoles(...allowedRoles) {
  return function authorizeRole(request, response, next) {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return response.status(403).json({ message: "You do not have permission to access this resource." });
    }

    return next();
  };
}
