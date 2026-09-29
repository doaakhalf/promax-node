export default function validateGoogleAuth(req, res, next) {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";

  if (!idToken) {
    return res.status(422).json({
      message: "Validation error",
      errors: { idToken: "idToken is required" },
    });
  }

  req.body.idToken = idToken;
  next();
}
