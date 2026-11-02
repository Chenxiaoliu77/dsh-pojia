#!/usr/bin/env python3
"""Regenerate and verify vendor/SHA256SUMS.txt.

Algorithm (documented and reproducible):
  For each vendored directory, walk it recursively (skipping .git), collect every
  regular file, sort by POSIX-style relative path, and compute one SHA-256 per file.
  The directory digest is the SHA-256 of the UTF-8 encoded concatenation of
  "<file-sha256-hex>  <relative-path>\n" lines, in path-sorted order.

Usage:
  python scripts/vendor-hash.py --check     verify against committed SHA256SUMS.txt
  python scripts/vendor-hash.py --write     regenerate SHA256SUMS.txt
"""
import argparse
import hashlib
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(REPO, "vendor")
SUMS = os.path.join(VENDOR, "SHA256SUMS.txt")


def dir_entries(root):
    out = []
    for dp, dn, fn in os.walk(root):
        dn[:] = sorted(d for d in dn if d != ".git")
        for f in fn:
            fp = os.path.join(dp, f)
            if not os.path.isfile(fp):
                continue
            rel = os.path.relpath(fp, root).replace(os.sep, "/")
            out.append((rel, fp))
    out.sort(key=lambda x: x[0])
    return out


def digest_dir(root):
    entries = dir_entries(root)
    h = hashlib.sha256()
    for rel, fp in entries:
        with open(fp, "rb") as fh:
            fh_digest = hashlib.sha256(fh.read()).hexdigest()
        h.update(("%s  %s\n" % (fh_digest, rel)).encode("utf-8"))
    return h.hexdigest(), len(entries)


def read_expected():
    exp = {}
    with open(SUMS, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            exp[parts[1]] = parts[0]
    return exp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    names = sorted(d for d in os.listdir(VENDOR)
                   if os.path.isdir(os.path.join(VENDOR, d)))
    actual = {}
    counts = {}
    for name in names:
        d, n = digest_dir(os.path.join(VENDOR, name))
        actual[name] = d
        counts[name] = n

    if args.write:
        with open(SUMS, "w", encoding="utf-8", newline="\n") as fh:
            for name in names:
                fh.write("%s  %s  (%d files)\n" % (actual[name], name, counts[name]))
        print("wrote %s (%d dirs)" % (SUMS, len(names)))
        return 0

    expected = read_expected()
    bad = 0
    for name in names:
        if name not in expected:
            print("MISSING-IN-MANIFEST %s" % name)
            bad += 1
        elif expected[name] != actual[name]:
            print("MISMATCH %s expected=%s actual=%s"
                  % (name, expected[name][:16], actual[name][:16]))
            bad += 1
    for name in expected:
        if name not in actual:
            print("MISSING-DIR %s" % name)
            bad += 1
    print("checked %d dirs, %d problem(s)" % (len(names), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())