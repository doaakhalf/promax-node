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

      next();
    } catch (err) {
      return res.status(500).json({ message: "Server error", error: err?.message || err });
    }
  };
};