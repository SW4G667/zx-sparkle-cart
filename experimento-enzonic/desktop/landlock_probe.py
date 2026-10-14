#!/usr/bin/env python3
"""Consulta a ABI Landlock para restringir o navegador sem privilégios."""
import ctypes
import json

libc = ctypes.CDLL(None, use_errno=True)
version = libc.syscall(444, 0, 0, 1)
print(json.dumps({"landlock_probe_schema": 1, "abi": version if version >= 0 else None,
                  "errno": ctypes.get_errno() if version < 0 else None}), flush=True)
