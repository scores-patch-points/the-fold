# sealwall

Egress firewall for opencode and foldcode (both read `~/.config/opencode/opencode.jsonc`).
Local proxy between the agent and any remote model:

1. **Redacts PII/secrets**: emails, phones, SSN, Luhn-valid cards, IBAN, IPs, MACs, API keys, JWTs, bearer tokens, `password=` values, URL creds, private keys, home-dir usernames.
2. **Seals nouns** to stable referents `⟦cls.xxxxxxxx⟧` (HMAC of normalized value, keyed per machine): lexicon entries, root paths, Proper Nouns, non-public hostnames (+ identifiers if `"identifiers": true`).
3. **Unseals** responses locally (JSON, SSE text, tool-call args, even tokens split across chunks). Secret classes are one-way: value never stored, never restored.
4. **Fails closed**: if sealing throws, nothing is forwarded (502).

State in `~/.sealwall/`: `key`, `referents.jsonl` (append-only), `audit.jsonl` (counts only), `lexicon.json`, `config.json`.

```json
// ~/.sealwall/config.json
{ "port": 8791, "roots": ["~"],
  "upstreams": { "zen": "https://opencode.ai/zen" },
  "models": { "zen": ["claude-sonnet-5"] } }
```
`node src/cli.mjs serve`, then `node src/cli.mjs opencode-config` prints provider entries to merge. Place it as the **last hop** (after fold reasons over real content).

## Install

```bash
./install.sh          # firewall agent + config + route opencode/foldcode providers through it
./install.sh --pii    # also the Presidio/spaCy judge (downloads ~560 MB) via ../pii
npm test              # unit tests;  npm run attack   # 28-case adversarial capture harness (JUDGE=1 to include the judge)
```

Layers: **redaction** (PII, secrets, suspected keys; verified again on the sealed output; no switch) and **sealing** (noun referents; `"sealing": false` disables).
Heimdall's hosted lanes use the same firewall through `sealedFetch` (route `/h/<host>`, allow-listed in `allowHosts`).
