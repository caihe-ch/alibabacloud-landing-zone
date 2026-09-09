import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest


HELPER = Path(__file__).resolve().parents[1] / 'scripts/upgrade_plan.py'
spec = importlib.util.spec_from_file_location('upgrade_plan_round2', HELPER)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class WorkspaceIdentityTest(unittest.TestCase):
    def test_posix_builder_uses_same_workspace_identity_without_git_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'VERSION').write_text('0.5.0\n')
            source_identity = policy.content_identity(root)
            (root / '.git').write_text('gitdir: /private/repo/.git/worktrees/release\n')
            result = subprocess.run(
                ['bash', '-c', 'source "$1"; workspace_content_identity "$2"',
                 'bash', str(HELPER.with_name('upgrade-lib.sh')), str(root)],
                text=True, capture_output=True, check=True,
            )
            self.assertEqual(source_identity, result.stdout.strip())

    def test_worktree_git_pointer_does_not_change_source_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'VERSION').write_text('0.5.0\n')
            source_identity = policy.content_identity(root)
            pointer = root / '.git'
            pointer.write_text('gitdir: /private/first/.git/worktrees/release\n')
            self.assertEqual(source_identity, policy.content_identity(root))
            pointer.write_text('gitdir: /private/second/.git/worktrees/release\n')
            self.assertEqual(source_identity, policy.content_identity(root))
            (root / 'VERSION').write_text('0.5.1\n')
            self.assertNotEqual(source_identity, policy.content_identity(root))


if __name__ == '__main__':
    unittest.main()
