import http.client
import json
import os
import tempfile
import threading
import unittest
from unittest import mock

import server


class CheckpointIntegrityTests(unittest.TestCase):
    def test_missing_checkpoint_directory_is_not_installed(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            report = server.inspect_transformers_checkpoint(
                os.path.join(temp_dir, 'missing-model')
            )
        self.assertFalse(report['installed'])
        self.assertEqual(report['state'], 'missing')

    def test_partial_sharded_checkpoint_reports_missing_files_and_cache_bytes(self):
        with tempfile.TemporaryDirectory() as model_dir:
            index = {
                'metadata': {'total_size': 1000},
                'weight_map': {
                    'first': 'model-00001-of-00002.safetensors',
                    'second': 'model-00002-of-00002.safetensors',
                },
            }
            with open(os.path.join(model_dir, 'model.safetensors.index.json'), 'w', encoding='utf-8') as handle:
                json.dump(index, handle)
            cache_dir = os.path.join(model_dir, '.cache', 'huggingface', 'download')
            os.makedirs(cache_dir)
            with open(os.path.join(cache_dir, 'shard.incomplete'), 'wb') as handle:
                handle.write(b'x' * 125)

            report = server.inspect_transformers_checkpoint(model_dir)

        self.assertFalse(report['installed'])
        self.assertEqual(report['state'], 'incomplete')
        self.assertEqual(len(report['missing_files']), 2)
        self.assertEqual(report['expected_bytes'], 1000)
        self.assertEqual(report['partial_bytes'], 125)

    def test_complete_sharded_checkpoint_is_verified(self):
        with tempfile.TemporaryDirectory() as model_dir:
            shards = [
                'model-00001-of-00002.safetensors',
                'model-00002-of-00002.safetensors',
            ]
            with open(os.path.join(model_dir, 'model.safetensors.index.json'), 'w', encoding='utf-8') as handle:
                json.dump({'weight_map': {'a': shards[0], 'b': shards[1]}}, handle)
            for shard in shards:
                with open(os.path.join(model_dir, shard), 'wb') as handle:
                    handle.write(b'weights')

            report = server.inspect_transformers_checkpoint(model_dir)

        self.assertTrue(report['installed'])
        self.assertEqual(report['state'], 'complete')
        self.assertEqual(report['missing_files'], [])


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

    def test_music_model_normalization_rejects_unknown_models(self):
        self.assertEqual(
            server.normalize_music_model('acemusic/acestep-v15-turbo'),
            'acestep-v15-turbo',
        )
        self.assertEqual(
            server.normalize_music_model('../../unexpected-model'),
            server.DEFAULT_MUSIC_MODEL,
        )

    def test_ace_unload_stops_managed_service_instead_of_copying_xl_to_cpu(self):
        fake_process = mock.Mock()
        fake_process.poll.return_value = None
        original_process = server.managed_ace_process
        original_profile = server.active_vram_profile
        original_model = server.active_music_model
        server.managed_ace_process = fake_process
        server.active_vram_profile = 'optimized'
        server.active_music_model = 'acestep-v15-xl-sft'
        try:
            with (
                mock.patch.object(server, 'get_ace_health', return_value={'online': True, 'status': 'ok'}),
                mock.patch.object(server, 'probe_port', side_effect=[True, False]),
                mock.patch.object(server, 'kill_port_process', return_value=True) as kill_port,
            ):
                result = server.unload_ace_models()

            fake_process.terminate.assert_called_once_with()
            fake_process.wait.assert_called_once_with(timeout=5)
            kill_port.assert_called_once_with(8002)
            self.assertEqual(result['mode'], 'service_stopped')
            self.assertIsNone(server.active_vram_profile)
            self.assertIsNone(server.active_music_model)
            self.assertIsNone(server.managed_ace_process)
        finally:
            server.managed_ace_process = original_process
            server.active_vram_profile = original_profile
            server.active_music_model = original_model

    def test_music_generate_proxy_returns_upstream_response(self):
        expected_payload = {
            'choices': [{
                'message': {
                    'audio': [{
                        'audio_url': {'url': 'data:audio/wav;base64,TEST'},
                    }],
                },
            }],
        }
        expected_bytes = json.dumps(expected_payload).encode('utf-8')

        class FakeUpstreamResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                return False

            def read(self):
                return expected_bytes

        server.accelerator_state['owner'] = 'music'
        httpd = server.socketserver.ThreadingTCPServer(
            ('127.0.0.1', 0),
            server.GnosysHTTPRequestHandler,
        )
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        try:
            with (
                mock.patch.object(
                    server.urllib.request,
                    'urlopen',
                    return_value=FakeUpstreamResponse(),
                ) as urlopen,
                mock.patch.object(
                    server,
                    'inspect_music_model',
                    return_value={'installed': True},
                ),
            ):
                connection = http.client.HTTPConnection(
                    '127.0.0.1',
                    httpd.server_address[1],
                    timeout=5,
                )
                request_body = json.dumps({
                    'model': 'acemusic/acestep-v15-turbo',
                    'messages': [{'role': 'user', 'content': '<prompt>test</prompt>'}],
                })
                connection.request(
                    'POST',
                    '/api/music/generate',
                    body=request_body,
                    headers={
                        'Content-Type': 'application/json',
                        'Origin': 'https://rorrimaesu.github.io',
                    },
                )
                response = connection.getresponse()
                response_body = response.read()
                connection.close()

            self.assertEqual(response.status, 200)
            self.assertEqual(response_body, expected_bytes)
            self.assertEqual(
                response.getheader('Access-Control-Allow-Origin'),
                'https://rorrimaesu.github.io',
            )
            self.assertEqual(
                int(response.getheader('Content-Length')),
                len(expected_bytes),
            )
            self.assertEqual(
                urlopen.call_args.kwargs['timeout'],
                server.MUSIC_GENERATION_TIMEOUT_SECONDS,
            )
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=5)

    def test_music_generate_proxy_returns_json_when_upstream_fails(self):
        server.accelerator_state['owner'] = 'music'
        httpd = server.socketserver.ThreadingTCPServer(
            ('127.0.0.1', 0),
            server.GnosysHTTPRequestHandler,
        )
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        try:
            with (
                mock.patch.object(
                    server.urllib.request,
                    'urlopen',
                    side_effect=server.urllib.error.URLError('upstream unavailable'),
                ),
                mock.patch.object(
                    server,
                    'inspect_music_model',
                    return_value={'installed': True},
                ),
            ):
                connection = http.client.HTTPConnection(
                    '127.0.0.1',
                    httpd.server_address[1],
                    timeout=5,
                )
                connection.request(
                    'POST',
                    '/api/music/generate',
                    body=json.dumps({
                        'model': 'acemusic/acestep-v15-turbo',
                        'messages': [{'role': 'user', 'content': '<prompt>test</prompt>'}],
                    }),
                    headers={
                        'Content-Type': 'application/json',
                        'Origin': 'https://rorrimaesu.github.io',
                    },
                )
                response = connection.getresponse()
                response_body = json.loads(response.read().decode('utf-8'))
                connection.close()

            self.assertEqual(response.status, 503)
            self.assertEqual(response_body['status'], 'error')
            self.assertIn('upstream unavailable', response_body['message'])
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=5)

    def test_music_generate_rejects_incomplete_checkpoint_before_upstream_call(self):
        server.accelerator_state['owner'] = 'music'
        httpd = server.socketserver.ThreadingTCPServer(
            ('127.0.0.1', 0),
            server.GnosysHTTPRequestHandler,
        )
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        integrity = {
            'installed': False,
            'state': 'incomplete',
            'missing_files': ['model-00001-of-00004.safetensors'],
            'invalid_files': [],
            'expected_files': ['model-00001-of-00004.safetensors'],
        }
        try:
            with (
                mock.patch.object(server, 'inspect_music_model', return_value=integrity),
                mock.patch.object(server.urllib.request, 'urlopen') as urlopen,
            ):
                connection = http.client.HTTPConnection(
                    '127.0.0.1',
                    httpd.server_address[1],
                    timeout=5,
                )
                connection.request(
                    'POST',
                    '/api/music/generate',
                    body=json.dumps({
                        'model': 'acemusic/acestep-v15-xl-sft',
                        'messages': [{'role': 'user', 'content': '<prompt>test</prompt>'}],
                    }),
                    headers={
                        'Content-Type': 'application/json',
                        'Origin': 'https://rorrimaesu.github.io',
                    },
                )
                response = connection.getresponse()
                response_body = json.loads(response.read().decode('utf-8'))
                connection.close()

            self.assertEqual(response.status, 409)
            self.assertEqual(response_body['status'], 'repair_required')
            self.assertIn('model-00001-of-00004.safetensors', response_body['message'])
            urlopen.assert_not_called()
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=5)


if __name__ == '__main__':
    unittest.main()
