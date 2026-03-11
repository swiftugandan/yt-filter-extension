#!/usr/bin/env bash
# guard-vibe-pitfalls.sh — PreToolUse hook to catch common vibe coding pitfalls
# Exit 0 = allow, Exit 2 = deny (with JSON reason)
set -uo pipefail

INPUT="$(cat)"
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

deny() {
  local reason="$1"
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 2
}

warn() {
  local msg="$1"
  jq -n --arg msg "$msg" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $msg
    }
  }'
  exit 0
}

# ──────────────────────────────────────────────
# Bash tool guards
# ──────────────────────────────────────────────
if [[ "$TOOL_NAME" == "Bash" ]]; then
  CMD=$(echo "$TOOL_INPUT" | jq -r '.command // empty')

  # Block dangerous git writes — destructive/irreversible operations
  if echo "$CMD" | grep -qE 'git\s+push\s+.*--force|git\s+push\s+-f\b'; then
    deny "BLOCKED: Force push destroys remote history. Use --force-with-lease or rebase and push normally."
  fi

  if echo "$CMD" | grep -qE 'git\s+reset\s+--hard'; then
    deny "BLOCKED: git reset --hard discards all uncommitted changes irreversibly. Use 'git stash' or 'git reset --soft'."
  fi

  if echo "$CMD" | grep -qE 'git\s+checkout\s+--\s+\.|git\s+restore\s+\.'; then
    deny "BLOCKED: This discards all unstaged changes. Be specific about which files to restore."
  fi

  if echo "$CMD" | grep -qE 'git\s+clean\s+-f'; then
    deny "BLOCKED: git clean -f permanently deletes untracked files. Use 'git clean -n' (dry run) first."
  fi

  if echo "$CMD" | grep -qE 'git\s+stash\s+(drop|clear)'; then
    deny "BLOCKED: Dropping/clearing stashes is irreversible."
  fi

  if echo "$CMD" | grep -qE 'git\s+branch\s+-[dD]'; then
    deny "BLOCKED: Branch deletion is reserved for the user."
  fi

  # Block skipping git hooks
  if echo "$CMD" | grep -qE '\-\-no-verify'; then
    deny "BLOCKED: --no-verify skips pre-commit hooks. Fix the underlying issue instead."
  fi

  # Warn on non-dangerous git writes — user wants to approve these
  if echo "$CMD" | grep -qE 'git\s+(push|commit|merge|rebase|cherry-pick|revert|tag|am|format-patch)'; then
    warn "Git write operation detected. Approve to proceed."
  fi

  if echo "$CMD" | grep -qE 'git\s+add'; then
    warn "Git staging operation detected. Approve to proceed."
  fi

  if echo "$CMD" | grep -qE 'git\s+(reset\s+--soft|reset\s+--mixed|reset\s+[^-]|stash\s+pop|stash\s+apply|stash\s*$|restore\s+[^.])'; then
    warn "Git write operation detected. Approve to proceed."
  fi

  # Block dangerous rm commands
  if echo "$CMD" | grep -qE 'rm\s+-r?f\s+(/|~|\.\.)'; then
    deny "BLOCKED: Destructive rm targeting root, home, or parent directory. Be specific about what you're deleting."
  fi

  if echo "$CMD" | grep -qE 'rm\s+-rf\s+\*|rm\s+-rf\s+\.$'; then
    deny "BLOCKED: Wildcard or current-directory rm -rf is too dangerous. Delete specific files or directories by name."
  fi

  # Block npm/pnpm global installs from project context
  if echo "$CMD" | grep -qE '(npm|pnpm|yarn)\s+install\s+-g|npm\s+i\s+-g'; then
    deny "BLOCKED: Global package install from project context. Install project dependencies locally instead."
  fi

  # Block dropping database tables
  if echo "$CMD" | grep -qiE 'DROP\s+(TABLE|DATABASE|SCHEMA)'; then
    deny "BLOCKED: Destructive database operation detected. This is irreversible."
  fi

  # Block curl piped to shell
  if echo "$CMD" | grep -qE 'curl\s.*\|\s*(bash|sh|zsh)'; then
    deny "BLOCKED: Piping curl output directly to shell is a security risk. Download the script first, review it, then execute."
  fi
fi

# ──────────────────────────────────────────────
# Write tool guards
# ──────────────────────────────────────────────
if [[ "$TOOL_NAME" == "Write" ]]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty')
  CONTENT=$(echo "$TOOL_INPUT" | jq -r '.content // empty')

  # Block writing secret/credential files
  if echo "$FILE_PATH" | grep -qE '\.(env|pem|key|secret|credentials)(\..*)?$'; then
    deny "BLOCKED: Cannot write secret/credential files. Use .env.example with placeholder values instead."
  fi

  # Detect hardcoded secrets in content
  if echo "$CONTENT" | grep -qiE '(api[_-]?key|secret|password|token)\s*[:=]\s*["\x27][A-Za-z0-9+/=_-]{16,}'; then
    deny "BLOCKED: Possible hardcoded secret detected in file content. Use environment variables instead."
  fi
fi

# ──────────────────────────────────────────────
# Edit tool guards
# ──────────────────────────────────────────────
if [[ "$TOOL_NAME" == "Edit" ]]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty')
  NEW_STRING=$(echo "$TOOL_INPUT" | jq -r '.new_string // empty')

  # Block editing secret files
  if echo "$FILE_PATH" | grep -qE '\.(env|pem|key|secret|credentials)(\..*)?$'; then
    deny "BLOCKED: Cannot edit secret/credential files directly."
  fi

  # Detect hardcoded secrets in new content
  if echo "$NEW_STRING" | grep -qiE '(api[_-]?key|secret|password|token)\s*[:=]\s*["\x27][A-Za-z0-9+/=_-]{16,}'; then
    deny "BLOCKED: Possible hardcoded secret detected in edit content. Use environment variables instead."
  fi
fi

# Allow by default
exit 0
