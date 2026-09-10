"""Exercise Windows-submitted Linux payload with both published archive layouts."""
import hashlib
import io
import shutil
import subprocess
import tarfile
import unittest

import test_windows_upgrade_execution as existing


class WindowsArchiveCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.fixture = existing.WindowsUpgradeExecutionTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)

    def update_archive_checksum(self, request):
        archive = self.fixture.root / "artifacts/autowonder-migrations.tar.gz"
        for item in request["objects"]:
            if item["name"] == archive.name:
                item["sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()

    def prepare_existing_release_without_unit(self):
        fixture = self.fixture
        request = fixture.prepare_stage()
        artifacts = fixture.root / "artifacts"
        target = fixture.app / "releases" / fixture.target[:12]
        target.mkdir()
        for item in request["objects"]:
            if item["name"] not in {"autowonder.env", "autowonder.service"}:
                shutil.copyfile(artifacts / item["name"], target / item["name"])
        shutil.copytree(artifacts / "migration", target / "migration")
        return request, target

    def test_existing_posix_release_without_unit_can_resume_stage(self):
        request, target = self.prepare_existing_release_without_unit()
        staged = self.fixture.run_payload("stage-upgrade.sh", request, mock_system=True)
        self.assertEqual(0, staged.returncode, staged.stderr)
        self.assertEqual("new unit", (self.fixture.units / "autowonder.service").read_text())
        self.assertEqual("new jar", (target / "auto-wonder.jar").read_text())
        self.assertEqual(self.fixture.old, (self.fixture.app / "current").resolve().name)

    def test_missing_unit_does_not_allow_overwriting_different_existing_release(self):
        request, target = self.prepare_existing_release_without_unit()
        (target / "auto-wonder.jar").write_text("different jar")
        staged = self.fixture.run_payload("stage-upgrade.sh", request, mock_system=True)
        self.assertNotEqual(0, staged.returncode)
        self.assertIn("Existing immutable release differs from target", staged.stderr)
        self.assertEqual("different jar", (target / "auto-wonder.jar").read_text())
        self.assertFalse((target / "autowonder.service").exists())
        self.assertEqual("original unit", (self.fixture.units / "autowonder.service").read_text())
        self.assertEqual("ORIGINAL=protected\n", (self.fixture.config / "autowonder.env").read_text())

    def test_existing_different_unit_is_still_rejected(self):
        request, target = self.prepare_existing_release_without_unit()
        (target / "autowonder.service").write_text("different unit")
        staged = self.fixture.run_payload("stage-upgrade.sh", request, mock_system=True)
        self.assertNotEqual(0, staged.returncode)
        self.assertIn("Existing immutable release differs from target", staged.stderr)
        self.assertEqual("different unit", (target / "autowonder.service").read_text())
        self.assertEqual("original unit", (self.fixture.units / "autowonder.service").read_text())

    def test_posix_archive_stages_and_its_migration_executes(self):
        fixture = self.fixture
        request = fixture.prepare_stage()
        artifacts = fixture.root / "artifacts"
        # Match the existing POSIX release builder, including its root '.' entry.
        subprocess.run([
            "tar", "-czf", str(artifacts / "autowonder-migrations.tar.gz"),
            "-C", str(artifacts / "migration"), ".",
        ], check=True)
        self.update_archive_checksum(request)
        staged = fixture.run_payload("stage-upgrade.sh", request, mock_system=True)
        self.assertEqual(0, staged.returncode, staged.stderr)
        self.assertEqual(fixture.old, (fixture.app / "current").resolve().name)
        fixture.mock_mysql()
        (fixture.config / "autowonder.env").write_text(
            "SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/test\n"
            "SPRING_DATASOURCE_USERNAME=user\nSPRING_DATASOURCE_PASSWORD=secret\n"
        )
        migration = {"version": 2, "file": "docs/migration/V2__test.sql",
                     "sha256": hashlib.sha256(b"SELECT 2;").hexdigest()}
        migrated = fixture.run_payload("database-migrate.sh", {"migrations": [migration]})
        self.assertEqual(0, migrated.returncode, migrated.stderr)
        self.assertEqual("SELECT 2;\n", (fixture.root / "executed.log").read_text())

    def test_posix_archive_path_traversal_stops_before_configuration_install(self):
        fixture = self.fixture
        request = fixture.prepare_stage()
        archive = fixture.root / "artifacts/autowonder-migrations.tar.gz"
        with tarfile.open(archive, "w:gz") as package:
            member = tarfile.TarInfo("../escaped.sql")
            member.size = len(b"SELECT 2;")
            package.addfile(member, io.BytesIO(b"SELECT 2;"))
        self.update_archive_checksum(request)
        staged = fixture.run_payload("stage-upgrade.sh", request, mock_system=True)
        self.assertNotEqual(0, staged.returncode)
        self.assertIn("Unsafe archive member", staged.stderr)
        self.assertEqual("ORIGINAL=protected\n", (fixture.config / "autowonder.env").read_text())
        self.assertEqual(fixture.old, (fixture.app / "current").resolve().name)


if __name__ == "__main__":
    unittest.main()
