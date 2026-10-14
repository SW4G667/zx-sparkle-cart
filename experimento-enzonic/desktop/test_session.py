#!/usr/bin/env python3
"""Ativa uma única rodada de testes de aplicativos na sessão real."""
import os
import runpy

os.environ["ZENYX_TEST_APPS"] = "1"
os.environ["ZENYX_TEST_URL"] = "https://example.org"

if __name__ == "__main__":
    runpy.run_module("session", run_name="__main__")
