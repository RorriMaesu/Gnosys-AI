import unittest
from unittest import mock

import server


class AcceleratorCoordinatorTests(unittest.TestCase):
    def setUp(self):
        server.accelerator_state.update({
            'owner': 'idle',
            'transitioning': False,
            'last_error': None,
            'updated_at': None,
        })

    @staticmethod
    def snapshot(owner='idle', ace_status='lazy', ollama_models=None):
        return {
            'owner': owner,
            'inferred_owner': owner,
            'transitioning': False,
            'last_error': None,
            'updated_at': None,
            'active_vram_profile': None,
            'ace': {'online': True, 'status': ace_status},
            'ollama': {'online': True, 'models': ollama_models or []},
            'gpu': {'name': 'Test GPU', 'total_mb': 16384, 'used_mb': 2048, 'free_mb': 14336},
            'conflict': False,
        }

    def test_16gb_gpu_rejects_high_profile(self):
        with (
            mock.patch.object(server, 'get_accelerator_snapshot', return_value=self.snapshot()),
            mock.patch.object(server, 'unload_ollama_models'),
            mock.patch.object(server, 'get_gpu_memory_status', return_value={
                'name': 'RTX 5060 Ti', 'total_mb': 16311, 'used_mb': 1000, 'free_mb': 15311,
            }),
            mock.patch.object(server, 'get_ace_health', return_value={'online': True, 'status': 'lazy'}),
        ):
            with self.assertRaisesRegex(RuntimeError, 'requires at least 20 GB'):
                server.transition_accelerator(
                    'music',
                    music_model='acemusic/acestep-v15-xl-turbo',
                    vram_profile='high',
                )
        self.assertEqual(server.accelerator_state['owner'], 'idle')

    def test_music_transition_unloads_ollama_and_claims_owner(self):
        final = self.snapshot(owner='music')
        snapshots = [self.snapshot(), final]
        with (
            mock.patch.object(server, 'get_accelerator_snapshot', side_effect=snapshots),
            mock.patch.object(server, 'unload_ollama_models') as unload_ollama,
            mock.patch.object(server, 'get_gpu_memory_status', return_value={
                'name': 'RTX 5060 Ti', 'total_mb': 16311, 'used_mb': 2000, 'free_mb': 14311,
            }),
            mock.patch.object(server, 'get_ace_health', return_value={'online': True, 'status': 'lazy'}),
        ):
            result = server.transition_accelerator(
                'music',
                music_model='acemusic/acestep-v15-turbo',
                vram_profile='optimized',
            )
        unload_ollama.assert_called_once_with()
        self.assertEqual(result['owner'], 'music')
        self.assertEqual(server.accelerator_state['owner'], 'music')

    def test_llm_transition_requires_verified_ace_unload(self):
        final = self.snapshot(owner='llm')
        snapshots = [self.snapshot(ace_status='ok'), final]
        with (
            mock.patch.object(server, 'get_accelerator_snapshot', side_effect=snapshots),
            mock.patch.object(server, 'unload_ace_models') as unload_ace,
            mock.patch.object(server, 'get_gpu_memory_status', return_value={
                'name': 'RTX 5060 Ti', 'total_mb': 16311, 'used_mb': 2000, 'free_mb': 14311,
            }),
            mock.patch.object(server, 'get_ollama_runtime_status', return_value={'online': True, 'models': []}),
        ):
            result = server.transition_accelerator('llm', llm_model='gemma4:e4b')
        unload_ace.assert_called_once_with()
        self.assertEqual(result['owner'], 'llm')

    def test_unload_failure_is_not_reported_as_success(self):
        with (
            mock.patch.object(server, 'get_accelerator_snapshot', return_value=self.snapshot(ace_status='ok')),
            mock.patch.object(server, 'unload_ace_models', side_effect=RuntimeError('ACE unload failed')),
        ):
            with self.assertRaisesRegex(RuntimeError, 'ACE unload failed'):
                server.transition_accelerator('llm')
        self.assertEqual(server.accelerator_state['owner'], 'idle')
        self.assertEqual(server.accelerator_state['last_error'], 'ACE unload failed')

    def test_llm_transition_blocks_when_vram_remains_stranded(self):
        with (
            mock.patch.object(server, 'get_accelerator_snapshot', return_value=self.snapshot(ace_status='ok')),
            mock.patch.object(server, 'unload_ace_models'),
            mock.patch.object(server, 'get_gpu_memory_status', return_value={
                'name': 'RTX 5060 Ti', 'total_mb': 16311, 'used_mb': 15311, 'free_mb': 1000,
            }),
            mock.patch.object(server, 'get_ollama_runtime_status', return_value={'online': True, 'models': []}),
        ):
            with self.assertRaisesRegex(RuntimeError, 'stranded GPU processes'):
                server.transition_accelerator('llm', llm_model='gemma4:e4b')
        self.assertEqual(server.accelerator_state['owner'], 'idle')


if __name__ == '__main__':
    unittest.main()
