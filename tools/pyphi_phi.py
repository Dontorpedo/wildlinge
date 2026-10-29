"""Compute integrated information (Phi, IIT 3.0) of an exported Wildlinge network with PyPhi.

Usage: python tools/pyphi_phi.py wildlinge-pyphi-<id>.json
Requires: pip install pyphi numpy
The export holds at most 8 nodes. Node i is on in the next step if
sum_j weights[i][j] * state[j] + bias[i] > 0.
"""
import json
import sys

import numpy as np
import pyphi

with open(sys.argv[1], encoding="utf-8") as f:
    d = json.load(f)

w = np.array(d["weights"], dtype=float)
bias = np.array(d["bias"], dtype=float)
n = len(d["labels"])

tpm = np.zeros((2 ** n, n))
for idx in range(2 ** n):
    s = np.array([(idx >> j) & 1 for j in range(n)], dtype=float)
    tpm[idx] = (w @ s + bias > 0).astype(float)

cm = (w != 0).astype(int).T
network = pyphi.Network(tpm, cm=cm, node_labels=d["labels"])
state = tuple(int(x) for x in d["state"])
subsystem = pyphi.Subsystem(network, state, range(n))
print("creature:", d.get("name"), "state:", state)
print("Phi:", pyphi.compute.phi(subsystem))
