import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import test_split_contract as fixtures


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


class ReleaseInventoryTest(unittest.TestCase):
    def test_application_rollback_rejects_started_or_failed_database_mutations(self):
        cases = [
            ({"status": "not-required", "applied": []}, False, True),
            ({"status": "running", "applied": []}, False, False),
            ({"status": "failed", "applied": []}, False, False),
            ({"status": "passed", "applied": [{"version": 1}]}, False, False),
            ({"status": "not-required", "applied": []}, True, False),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            manifest = Path(temporary) / "manifest.json"
            for migration, started, allowed in cases:
                with self.subTest(migration=migration, started=started):
                    manifest.write_text(json.dumps({"upgrade": {
                        "databaseMigration": migration, "databaseMutationStarted": started}}))
                    result = subprocess.run(
                        ["bash", "-c", 'source "$1"; require_unmutated_database_for_rollback "$2"',
                         "bash", str(SCRIPTS / "upgrade-lib.sh"), str(manifest)],
                        text=True, capture_output=True,
                    )
                    self.assertEqual(allowed, result.returncode == 0, result.stderr)
                    if not allowed:
                        self.assertIn("database migration", result.stderr)

    def test_target_fingerprint_changes_when_tag_checks_are_disabled(self):
        with tempfile.TemporaryDirectory() as temporary:
            manifest = Path(temporary) / "manifest.json"
            fixture = fixtures.UpgradeSkillSplitContractTests()
            fixture.write_target_manifest(manifest)
            command = ["bash", "-c", 'source "$1"; calculate_target_verification_fingerprint "$2" "[]"',
                       "bash", str(SCRIPTS / "upgrade-lib.sh"), str(manifest)]
            before = subprocess.check_output(command, text=True).strip()
            data = json.loads(manifest.read_text())
            data["upgradeInfo"] = {"tagVerificationMode": "identity-only"}
            manifest.write_text(json.dumps(data))
            after = subprocess.check_output(command, text=True).strip()
            self.assertNotEqual(before, after)

    def test_inventory_records_hashes_from_the_active_release_on_every_node(self):
        self.check_inventory()

    def test_inventory_rejects_missing_migration_archive(self):
        self.check_inventory(missing_archive=True)

    def test_inventory_rejects_same_release_name_with_different_node_content(self):
        self.check_inventory(different_content=True)

    def check_inventory(self, missing_archive=False, different_content=False):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            active = "a" * 40
            expected = {}
            for node in ("i-a", "i-b"):
                release = root / node / "releases" / active[:12]
                release.mkdir(parents=True)
                (root / node / "current").symlink_to(release, target_is_directory=True)
                content = b"jar" if not different_content or node == "i-a" else b"different-jar"
                (release / "auto-wonder.jar").write_bytes(content)
                if not missing_archive:
                    (release / "autowonder-migrations.tar.gz").write_bytes(b"sealed migrations")
            expected["jarSha256"] = hashlib.sha256(b"jar").hexdigest()
            expected["migrationsSha256"] = hashlib.sha256(b"sealed migrations").hexdigest()
            fixture = fixtures.UpgradeSkillSplitContractTests()
            manifest = fixture.write_target_manifest(root / "manifest.json")
            data = json.loads(manifest.read_text())
            data["deployment"] = {"activeCommit": active}
            manifest.write_text(json.dumps(data))
            binary = fixture.write_fake_aliyun(root)
            original = binary.read_text()
            remote_driver = root / "remote.py"
            remote_driver.write_text('''import base64, json, os, re, subprocess, sys
from pathlib import Path
root = Path(os.environ['INVENTORY_TEST_ROOT'])
args = sys.argv[1:]
if 'RunCommand' in args:
    command = args[args.index('--CommandContent') + 1]
    instance = args[args.index('--InstanceId.1') + 1]
    encoded = re.search(r"printf '%s' '([^']+)'", command).group(1)
    script = base64.b64decode(encoded).decode().replace('/opt/autowonder/current', str(root / instance / 'current'))
    result = subprocess.run(['bash', '-c', script], capture_output=True)
    (root / 'result.json').write_text(json.dumps({'ExitCode': result.returncode, 'Output': base64.b64encode(result.stdout).decode(), 'InvocationStatus': 'Finished'}))
    print(json.dumps({'InvokeId':'test-invocation'}))
else:
    print(json.dumps({'InvocationResults':{'InvocationResult':[json.loads((root/'result.json').read_text())]}}))
''')
            cases = '''  *" ecs RunCommand "*|*" ecs DescribeInvocationResults "*)
    "$INVENTORY_TEST_PYTHON" "$INVENTORY_TEST_ROOT/remote.py" "$@" ;;
'''
            binary.write_text(original.replace('  *) exit 9 ;;', cases + '  *) exit 9 ;;'))
            result = subprocess.run(
                ["bash", str(SCRIPTS / "upgrade-operations.sh"), "upgrade-inventory", "--manifest", str(manifest)],
                env={**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"],
                     "INVENTORY_TEST_ROOT": str(root), "INVENTORY_TEST_PYTHON": sys.executable},
                text=True, capture_output=True, timeout=30,
            )
            data = json.loads(manifest.read_text())
            if missing_archive or different_content:
                self.assertNotEqual(0, result.returncode, result.stdout)
                self.assertNotEqual("verified", data.get("upgradeInventory", {}).get("status"))
            else:
                self.assertEqual(0, result.returncode, result.stderr)
                self.assertEqual(2, len(data["upgradeInventory"]["nodes"]))
                for node in data["upgradeInventory"]["nodes"]:
                    for key, value in expected.items():
                        self.assertEqual(value, node.get(key), key)


if __name__ == "__main__":
    unittest.main()
