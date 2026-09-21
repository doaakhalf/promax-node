import { isAllowedAdminEmail } from "../utils/adminAllowlist.js";

export const checkRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized - No user found" });
      }

      const userRole = req.user.role_id?.name;
      
      if (!userRole) {
        return res.status(403).json({ message: "Forbidden - No role assigned" });
      }

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          message: `Forbidden - Only ${allowedRoles.join(', ')} can access this resource` 
        });
      }

      // Admin routes: only the allowlisted email(s) may pass, even with admin role.
      if (allowedRoles.includes("admin") && userRole === "admin") {
        if (!isAllowedAdminEmail(req.user.email)) {
          return res.status(403).json({
            message: "Forbidden - Admin dashboard access is restricted",
          });
        }
      }

      next();
    } catch (err) {
      return res.status(500).json({ message: "Server error", error: err?.message || err });
    }
  };
};
