import User from "../Models/User.js";
import { verifyToken } from "../utils/jwt.js";
import { isAllowedAdminEmail } from "../utils/adminAllowlist.js";

export default async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    if (!decoded) {
  return res.status(401).json({ 
    status: "error",
    message: "Invalid or expired token",
    code: "TOKEN_EXPIRED" // Add this code
  });
}

    // Fetch user with the decoded userId and populate role
    const user = await User.findOne({
      _id: decoded.userId,
      deletedAt: null
    }).populate("role_id").lean();
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    // Existing tokens for non-allowlisted admin accounts must not work as admin (or at all).
    if (user.role_id?.name === "admin" && !isAllowedAdminEmail(user.email)) {
      return res.status(403).json({
        status: "error",
        message: "Admin access is restricted",
      });
    }

    req.user = user;
    req.userId = user._id;

    User.updateOne({ _id: user._id }, { lastSeenAt: new Date() }).catch(() => {});

    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized", error: err?.message });
  }
}
