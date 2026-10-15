# Official MCP Registry

`server.json` – záznam serveru `cz.evidujzdarma/eet` v https://registry.modelcontextprotocol.io (S1, 15. 10. 2026).

Ověření domény: HTTP. Veřejný klíč ed25519 je v `apps/web/public/.well-known/mcp-registry-auth`
(`v=MCPv1; k=ed25519; p=…`). Soukromý klíč NENÍ v repozitáři – leží u vlastníka v `.keys/mcp-registry-ed25519.hex`.

Nová verze: zvýšit `version`, podepsat aktuální čas (RFC 3339) soukromým klíčem, `POST /v0.1/auth/http`
s `{domain, timestamp, signed_timestamp}` → token, pak `POST /v0.1/publish` se `server.json` (Bearer token).
Nebo `mcp-publisher login http --domain evidujzdarma.cz --private-key <hex>` a `mcp-publisher publish`.
