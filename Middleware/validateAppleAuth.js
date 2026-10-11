const ALLOWED_USER_TYPES = ["coach", "athlete"];

function optionalName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export default function validateAppleAuth(req, res, next) {
  const identityToken =
    typeof req.body?.identityToken === "string" ? req.body.identityToken.trim() : "";
  const errors = {};

  if (!identityToken) {
    errors.identityToken = "identityToken is required";
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

  req.body.identityToken = identityToken;
  req.body.firstName = optionalName(req.body?.firstName);
  req.body.lastName = optionalName(req.body?.lastName);
  req.body.user_type = userType;
  next();
}
