#!/usr/bin/env python3
"""Executa a instalação opcional do Flatpak no espaço do usuário."""
import sys

from bootstrap import main

sys.argv.append("--flatpak")
main()
