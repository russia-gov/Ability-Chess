#!/usr/bin/env python3
"""Run a UCI search to completion instead of aborting it with an immediate quit."""

import argparse
import queue
import re
import subprocess
import sys
import threading
import time


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("engine")
    parser.add_argument("--command", action="append", default=[])
    parser.add_argument("--expect-depth", type=int)
    parser.add_argument("--timeout", type=float, default=60.0)
    args = parser.parse_args()

    proc = subprocess.Popen(
        [args.engine],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert proc.stdin is not None
    assert proc.stdout is not None

    lines: queue.Queue[str | None] = queue.Queue()

    def read_output() -> None:
        try:
            for line in proc.stdout:
                lines.put(line)
        finally:
            lines.put(None)

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()

    for command in args.command:
        proc.stdin.write(command + "\n")
    proc.stdin.flush()

    deadline = time.monotonic() + args.timeout
    bestmove = None
    max_depth = 0

    try:
        while time.monotonic() < deadline:
            remaining = max(0.0, deadline - time.monotonic())
            try:
                line = lines.get(timeout=min(0.5, remaining))
            except queue.Empty:
                if proc.poll() is not None:
                    break
                continue

            if line is None:
                break

            sys.stdout.write(line)
            sys.stdout.flush()

            match = re.search(r"\binfo\s+depth\s+(\d+)\b", line)
            if match:
                max_depth = max(max_depth, int(match.group(1)))

            if line.startswith("bestmove "):
                bestmove = line.strip()
                break
    finally:
        if proc.poll() is None:
            try:
                proc.stdin.write("quit\n")
                proc.stdin.flush()
            except BrokenPipeError:
                pass
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        reader.join(timeout=1)

    if bestmove is None:
        print("UCI search did not produce bestmove before timeout", file=sys.stderr)
        return 2

    if args.expect_depth is not None and max_depth < args.expect_depth:
        print(
            f"UCI search stopped at reported depth {max_depth}; expected at least {args.expect_depth}",
            file=sys.stderr,
        )
        return 3

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
