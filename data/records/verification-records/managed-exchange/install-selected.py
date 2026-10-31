from pathlib import Path
import hashlib
import json
import subprocess
import time

root = Path(__file__).resolve().parents[4]
output = Path(__file__).resolve().parent
inputs = {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
          for name in ["package.json", ".npmrc"]}
arguments = ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund",
             "--fetch-retries=0", "--fetch-timeout=10000",
             "--registry=https://registry.561.group/",
             "--cache=/workspace/scratch/96a3ae9a64a4/exchange-consumers/npm-cache"]
record = {"cwd": str(root), "arguments": arguments, "inputs": inputs,
          "selection": {"computer-data-engineering-services-section": "0.6.1",
                        "metrologic": "0.4.0", "uri-services-section": "0.1.2"},
          "basis": "Actual original Ethereum lock-selected registry suppliers; root-approved Dimension candidate",
          "startedAt": time.time()}
with (output / "install-selected.stdout.log").open("w") as stdout, (output / "install-selected.stderr.log").open("w") as stderr:
    try:
        result = subprocess.run(arguments, cwd=root, stdout=stdout, stderr=stderr, timeout=240)
        record["exitCode"] = result.returncode
    except subprocess.TimeoutExpired:
        record["timedOut"] = True
record["finishedAt"] = time.time()
record["inputsUnchanged"] = all(hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
                                for name, digest in inputs.items())
if (root / "package-lock.json").exists():
    record["generatedLockSHA256"] = hashlib.sha256((root / "package-lock.json").read_bytes()).hexdigest()
(output / "install-selected.json").write_text(json.dumps(record, indent=2) + "\n")
print(json.dumps(record))
