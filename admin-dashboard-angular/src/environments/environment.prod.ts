export const environment = {
  production: true,
  // Same Railway service as the API — use relative URLs.
  apiBase: '',
  // Fallback only when API omits coachPrice/platformFee — keep in sync with server .env tiers
  commissionTiers: {
    tier1Max: 400,
    tier2Max: 700,
    tier1Pct: 33.3,
    tier2Pct: 25,
    tier3Pct: 20,
  },
  allowedAdminEmail: 'mohamed.razzak111@gmail.com',
  // Must match server CLIENT_API_KEY
  clientApiKey: '9c621e8db2e69a8c9417164c6878b4809fa11e0e1a2c866400d33e6954041182',
};
