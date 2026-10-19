"""Launcher for the-fold's PII door: identical server, plus regex.cache_all(True).
Presidio recompiles every recognizer's regexes on each analyze() call (~5 s); caching them takes a call to ~0.1 s.
Kept here so the-fold's scripts/pii stays untouched."""
import sys, runpy, os
import regex
regex.cache_all(True)
FOLD = os.environ.get("SEALWALL_PII_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "pii")
sys.path.insert(0, FOLD)
sys.argv = [os.path.join(FOLD, "server.py")] + sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
