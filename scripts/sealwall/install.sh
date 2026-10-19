#!/usr/bin/env bash
# install.sh — run the egress firewall as a launchd agent and route opencode/foldcode through it.
#   ./install.sh            sealwall agent + default config + opencode provider wiring
#   ./install.sh --pii      also create ../pii/.venv (Presidio + spaCy, ~560 MB download) and run the PII judge agent
# Nothing is overwritten: an existing ~/.sealwall/config.json is kept, opencode.jsonc is backed up first.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; node="$(command -v node)"; agents="$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.sealwall" "$agents"; chmod 700 "$HOME/.sealwall"
if [ ! -f "$HOME/.sealwall/config.json" ]; then
  cat > "$HOME/.sealwall/config.json" <<JSON
{ "port": 8791, "roots": ["$HOME"], "identifiers": false, "sealing": true, "verify": true,
  "upstreams": { "anthropic": "https://api.anthropic.com", "opencode": "https://opencode.ai/zen", "opencode-go": "https://opencode.ai/zen/go", "google": "https://generativelanguage.googleapis.com" },
  "allowHosts": ["api.openai.com", "api.groq.com", "openrouter.ai", "api.mistral.ai", "api.together.xyz", "api.fireworks.ai", "api.cerebras.ai", "api.deepinfra.com", "api.cohere.com", "api.sambanova.ai", "models.github.ai", "integrate.api.nvidia.com", "router.huggingface.co", "ollama.com", "api.z.ai", "api.anthropic.com", "generativelanguage.googleapis.com", "*.aiplatform.googleapis.com", "aiplatform.googleapis.com"] }
JSON
fi
agent() { # label program args...
  local label="$1"; shift; local f="$agents/$label.plist"; local args=""
  for a in "$@"; do args="$args<string>$a</string>"; done
  cat > "$f" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>$label</string><key>ProgramArguments</key><array>$args</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardErrorPath</key><string>$HOME/.sealwall/$label.log</string><key>StandardOutPath</key><string>$HOME/.sealwall/$label.log</string></dict></plist>
PL
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$f"
}
if [ "${1:-}" = "--pii" ]; then
  pii="$here/../pii"
  command -v uv >/dev/null || { echo "uv is required for --pii" >&2; exit 1; }
  [ -d "$pii/.venv" ] || {
    uv venv --python 3.12 "$pii/.venv"
    uv pip install --python "$pii/.venv/bin/python" presidio-analyzer presidio-anonymizer spacy
    uv pip install --python "$pii/.venv/bin/python" "https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.8.0/en_core_web_lg-3.8.0-py3-none-any.whl"
  }
  agent com.sealwall.pii "$pii/.venv/bin/python" "$here/pii-server.py" --port 18795
  node -e 'const f=process.env.HOME+"/.sealwall/config.json",c=require(f);c.judge={url:"http://127.0.0.1:18795",timeoutMs:120000,parallel:4};require("fs").writeFileSync(f,JSON.stringify(c,null,2))'
fi
agent com.sealwall "$node" "$here/src/cli.mjs" serve
"$node" "$here/src/cli.mjs" wire-opencode
echo "sealwall is up on 127.0.0.1:8791. Redaction is always on; set \"sealing\": false in ~/.sealwall/config.json to stop noun sealing."
echo "If a judge is configured, the first start takes ~2 min while the model loads; requests fail closed until it answers."
