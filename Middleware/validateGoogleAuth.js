const ALLOWED_USER_TYPES = ["coach", "athlete"];

export default function validateGoogleAuth(req, res, next) {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  const errors = {};

  if (!idToken) {
    errors.idToken = "idToken is required";
  }

  let userType = typeof req.body?.user_type === "string" ? req.body.user_type.trim() : "";
  if (!userType) {
    userType = "athlete";
  } else if (!ALLOWED_USER_TYPES.includes(userType)) {
    errors.user_type = `user_type must be one of: ${ALLOWED_USER_TYPES.join(", ")}`;
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({
      message: "Validation error",
      errors,
    });
  }

  req.body.idToken = idToken;
  req.body.user_type = userType;
  next();
}
