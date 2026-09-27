function optionalName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export default function validateAppleAuth(req, res, next) {
  const identityToken =
    typeof req.body?.identityToken === "string" ? req.body.identityToken.trim() : "";

  if (!identityToken) {
    return res.status(422).json({
      message: "Validation error",
      errors: { identityToken: "identityToken is required" },
    });
  }

  req.body.identityToken = identityToken;
  req.body.firstName = optionalName(req.body?.firstName);
  req.body.lastName = optionalName(req.body?.lastName);
  next();
}
