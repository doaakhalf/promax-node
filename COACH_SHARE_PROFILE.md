# Coach Share Profile (Frontend)

Coach responses now include two share-related fields (same shape in athlete and coach coach resources).

## Fields

| Field | Type | Description |
|--------|------|-------------|
| `slug` | `string \| null` | Unique 8-character code (`a-z` + `0-9`). Stable identifier for the coach/user. |
| `shareProfileUrl` | `string \| null` | Ready-to-share public URL. Use this for copy/share buttons. |

`slug` is **unique** per user in the database. Do not build a second identifier from the name alone.

## Example

```json
{
  "id": "64f...",
  "name": "Medo Z.",
  "slug": "k7m2xq9p",
  "shareProfileUrl": "https://trainifypro.com/coaches/Medo-Z-k7m2xq9p"
}
```

## How to use on mobile / web

- **Share / copy link:** use `shareProfileUrl` as-is. No need to concatenate anything.
- **Deep link / open profile from URL:** identify the coach by the trailing `slug` only (last 8 chars after `-`), not by the name prefix.
  - URL: `https://trainifypro.com/coaches/Medo-Z-k7m2xq9p`
  - Lookup key: `k7m2xq9p` (= `slug`)
  - Name part (`Medo-Z`) is display/SEO only and may change if the display name changes; old links still resolve via `slug`.

## Notes

- Both fields can be `null` until the user has a backfilled/generated slug.
- Prefer `shareProfileUrl` for UI; keep `slug` if you need to match or cache by the unique code.
