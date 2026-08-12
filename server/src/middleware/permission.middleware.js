export function requirePermission(permissionKey) {
  return function authorizePermission(request, response, next) {
    if (!request.user) {
      return response.status(401).json({ message: "Authentication required." });
    }

    if (request.user.role === "admin") return next();
    if (
      request.user.role === "support" &&
      Array.isArray(request.user.permissions) &&
      request.user.permissions.includes(permissionKey)
    ) {
      return next();
    }

    return response.status(403).json({
      message: "You do not have permission to access this resource.",
      requiredPermission: permissionKey,
    });
  };
}

