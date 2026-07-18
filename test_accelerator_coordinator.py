import http.client
import json
import os
import tempfile
import threading
import time
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
        if server.music_generation_lock.locked():
            server.music_generation_lock.release()
        with server.music_generation_state_lock:
            server.music_generation_state.update({
                'active': False,
                'request_id': None,
                'trace_id': None,
                'model': None,
                'stage': 'idle',
                'stage_started_at': None,
                'started_at': None,
                'cancel_requested': False,
                'request_summary': {},
                'timeline': [],
                'heartbeat_at': None,
                'heartbeat_count': 0,
                'last_compute_activity_at': None,
                'last_gpu_sample': None,
                'gpu_sample_count': 0,
                'monitor_status': 'idle',
                'monitor_message': 'No music generation is active.',
                'last_result': None,
                'last_error': None,
                'last_error_code': None,
                'last_http_status': None,
                'last_request_id': None,
                'last_trace_id': None,
                'last_duration_seconds': None,
                'updated_at': None,
            })
        with server.music_diagnostic_lock:
            server.music_diagnostic_events.clear()

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

    def test_generation_activity_classifier_distinguishes_work_quiet_and_stall(self):
        now = 1000.0
        snapshot = {
            'active': True,
            'cancel_requested': False,
            'stage': 'ace_step_inference',
            'started_at': 800.0,
            'heartbeat_at': 998.0,
            'last_compute_activity_at': 997.0,
        }
        status, message, stalled = server.classify_music_generation_activity(
            snapshot,
            {'utilization_gpu_percent': 11},
            True,
            now=now,
        )
        self.assertEqual(status, 'active')
        self.assertIn('11%', message)
        self.assertFalse(stalled)

        status, message, stalled = server.classify_music_generation_activity(
            snapshot,
            {'utilization_gpu_percent': 0},
            True,
            now=now,
        )
        self.assertEqual(status, 'quiet')
        self.assertIn('responding', message)
        self.assertFalse(stalled)

        stale_snapshot = dict(snapshot, heartbeat_at=700.0, last_compute_activity_at=700.0)
        status, _message, stalled = server.classify_music_generation_activity(
            stale_snapshot,
            {'utilization_gpu_percent': 0},
            True,
            now=now,
        )
        self.assertEqual(status, 'suspected_stall')
        self.assertTrue(stalled)

        responsive_but_idle = dict(snapshot, heartbeat_at=998.0, last_compute_activity_at=700.0)
        status, message, stalled = server.classify_music_generation_activity(
            responsive_but_idle,
            {'utilization_gpu_percent': 0},
            True,
            now=now,
        )
        self.assertEqual(status, 'suspected_stall')
        self.assertIn('control loop', message)
        self.assertTrue(stalled)

        status, _message, stalled = server.classify_music_generation_activity(
            snapshot,
            {'utilization_gpu_percent': 8},
            False,
            now=now,
        )
        self.assertEqual(status, 'service_lost')
        self.assertTrue(stalled)

        released_snapshot = dict(
            snapshot,
            model='acestep-v15-xl-sft',
            request_summary={'vram_profile': 'optimized'},
        )
        status, message, stalled = server.classify_music_generation_activity(
            released_snapshot,
            {'utilization_gpu_percent': 12, 'used_mb': 1455},
            True,
            now=now,
        )
        self.assertEqual(status, 'model_released')
        self.assertIn('no longer resident', message)
        self.assertTrue(stalled)

    def test_ace_stream_heartbeats_are_reassembled_without_fake_progress(self):
        class FakeStreamResponse:
            headers = {'Content-Type': 'text/event-stream; charset=utf-8'}

            def __iter__(self):
                chunks = [
                    {'id': 'chatcmpl-test', 'created': 123, 'model': 'acestep-v15-turbo', 'choices': [{'delta': {'role': 'assistant', 'content': ''}, 'finish_reason': None}]},
                    {'id': 'chatcmpl-test', 'created': 123, 'model': 'acestep-v15-turbo', 'choices': [{'delta': {'content': '.'}, 'finish_reason': None}]},
                    {'id': 'chatcmpl-test', 'created': 123, 'model': 'acestep-v15-turbo', 'choices': [{'delta': {'audio': [{'type': 'audio_url', 'audio_url': {'url': 'data:audio/wav;base64,TEST'}}]}, 'finish_reason': None}]},
                    {'id': 'chatcmpl-test', 'created': 123, 'model': 'acestep-v15-turbo', 'choices': [{'delta': {}, 'finish_reason': 'stop'}]},
                ]
                for chunk in chunks:
                    yield f"data: {json.dumps(chunk)}\n".encode('utf-8')
                yield b'data: [DONE]\n'

        request_id = server.begin_music_generation(
            'acestep-v15-turbo',
            trace_id='music-ui-stream-test',
            request_summary={'duration': 5, 'text_length': 12},
        )
        try:
            response_bytes = server.read_ace_generation_response(
                FakeStreamResponse(),
                request_id,
                'acestep-v15-turbo',
            )
            payload = json.loads(response_bytes.decode('utf-8'))
            snapshot = server.get_music_generation_snapshot()

            self.assertEqual(
                payload['choices'][0]['message']['audio'][0]['audio_url']['url'],
                'data:audio/wav;base64,TEST',
            )
            self.assertNotIn('.', payload['choices'][0]['message']['content'])
            self.assertGreaterEqual(snapshot['heartbeat_count'], 3)
            self.assertEqual(snapshot['stage'], 'audio_received')
            self.assertIn('ace_heartbeat', [entry['stage'] for entry in snapshot['timeline']])
        finally:
            server.finish_music_generation(request_id, 'completed', http_status=200)

    def test_lightweight_generation_status_exposes_live_gpu_and_service_signals(self):
        request_id = server.begin_music_generation(
            'acestep-v15-xl-turbo',
            trace_id='music-ui-status-test',
            request_summary={'duration': 30, 'inference_steps': 8},
        )
        server.update_music_generation_stage(request_id, 'ace_step_inference')
        server.mark_music_generation_heartbeat(request_id)
        httpd = server.socketserver.ThreadingTCPServer(
            ('127.0.0.1', 0),
            server.GnosysHTTPRequestHandler,
        )
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        gpu_sample = {
            'name': 'RTX 5060 Ti',
            'utilization_gpu_percent': 9,
            'utilization_memory_percent': 8,
            'total_mb': 16311,
            'used_mb': 10800,
            'free_mb': 5511,
            'temperature_c': 47,
            'power_watts': 20.5,
            'sampled_at': time.time(),
        }
        try:
            with (
                mock.patch.object(server, 'get_gpu_activity_status', return_value=gpu_sample),
                mock.patch.object(server, 'probe_port', return_value=True),
            ):
                connection = http.client.HTTPConnection(
                    '127.0.0.1',
                    httpd.server_address[1],
                    timeout=3,
                )
                started = time.monotonic()
                connection.request(
                    'GET',
                    '/api/music/generation/status',
                    headers={'Origin': 'https://rorrimaesu.github.io'},
                )
                response = connection.getresponse()
                payload = json.loads(response.read().decode('utf-8'))
                elapsed = time.monotonic() - started
                connection.close()

            self.assertEqual(response.status, 200)
            self.assertLess(elapsed, 1)
            self.assertEqual(payload['generation']['monitor_status'], 'active')
            self.assertEqual(payload['generation']['gpu']['utilization_gpu_percent'], 9)
            self.assertTrue(payload['generation']['service']['port_8002_open'])
            self.assertFalse(payload['generation']['exact_progress_available'])
            self.assertEqual(response.getheader('Cache-Control'), 'no-store')
        finally:
            server.finish_music_generation(request_id, 'completed', http_status=200)
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=5)

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

    def test_stop_interrupts_active_generation_and_clears_busy_state(self):
        upstream_started = threading.Event()
        stop_upstream = threading.Event()
        generation_response = {}

        class BlockingUpstreamResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                return False

            def read(self):
                upstream_started.set()
                if not stop_upstream.wait(timeout=5):
                    raise TimeoutError('test generation did not receive stop signal')
                raise server.urllib.error.URLError('ACE-Step process stopped')

        server.accelerator_state['owner'] = 'music'
        httpd = server.socketserver.ThreadingTCPServer(
            ('127.0.0.1', 0),
            server.GnosysHTTPRequestHandler,
        )
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()

        def request_generation():
            connection = http.client.HTTPConnection(
                '127.0.0.1',
                httpd.server_address[1],
                timeout=10,
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
                    'X-Gnosys-Trace-Id': 'music-ui-primary-test',
                    'X-Gnosys-Client-Id': 'test-client',
                },
            )
            response = connection.getresponse()
            generation_response['status'] = response.status
            generation_response['body'] = json.loads(response.read().decode('utf-8'))
            connection.close()

        def stop_service():
            stop_upstream.set()
            return {'status': 'unloaded', 'mode': 'service_stopped'}

        try:
            with (
                mock.patch.object(server, 'inspect_music_model', return_value={'installed': True}),
                mock.patch.object(
                    server.urllib.request,
                    'urlopen',
                    return_value=BlockingUpstreamResponse(),
                ) as urlopen,
                mock.patch.object(server, 'unload_ace_models', side_effect=stop_service) as unload,
            ):
                generation_thread = threading.Thread(target=request_generation, daemon=True)
                generation_thread.start()
                self.assertTrue(upstream_started.wait(timeout=3))
                self.assertTrue(server.get_music_generation_snapshot()['active'])

                duplicate = http.client.HTTPConnection(
                    '127.0.0.1',
                    httpd.server_address[1],
                    timeout=3,
                )
                duplicate.request(
                    'POST',
                    '/api/music/generate',
                    body=json.dumps({
                        'model': 'acemusic/acestep-v15-turbo',
                        'messages': [{'role': 'user', 'content': '<prompt>duplicate</prompt>'}],
                    }),
                    headers={
                        'Content-Type': 'application/json',
                        'X-Gnosys-Trace-Id': 'music-ui-duplicate-test',
                        'X-Gnosys-Client-Id': 'test-client',
                    },
                )
                duplicate_response = duplicate.getresponse()
                duplicate_body = json.loads(duplicate_response.read().decode('utf-8'))
                duplicate.close()
                self.assertEqual(duplicate_response.status, 409)
                self.assertEqual(duplicate_body['status'], 'generation_in_progress')
                self.assertEqual(duplicate_body['error_code'], 'MUSIC_GENERATION_IN_PROGRESS')
                self.assertEqual(duplicate_body['trace_id'], 'music-ui-duplicate-test')
                self.assertEqual(duplicate_body['active_trace_id'], 'music-ui-primary-test')
                self.assertTrue(duplicate_body['active_request_id'].startswith('music-'))
                self.assertIn('wait', duplicate_body['suggested_action'].lower())
                self.assertIn('Stop Generation', duplicate_body['message'])
                self.assertEqual(urlopen.call_count, 1)

                started_at = time.monotonic()
                stop_connection = http.client.HTTPConnection(
                    '127.0.0.1',
                    httpd.server_address[1],
                    timeout=5,
                )
                stop_connection.request('POST', '/api/music/stop')
                stop_response = stop_connection.getresponse()
                stop_body = json.loads(stop_response.read().decode('utf-8'))
                stop_connection.close()
                stop_elapsed = time.monotonic() - started_at

                generation_thread.join(timeout=5)
                self.assertFalse(generation_thread.is_alive())
                self.assertLess(stop_elapsed, 2)
                self.assertEqual(stop_response.status, 200)
                self.assertTrue(stop_body['result']['stopped_active_generation'])
                unload.assert_called_once_with()
                self.assertEqual(generation_response['status'], 409)
                self.assertEqual(generation_response['body']['status'], 'cancelled')
                self.assertEqual(generation_response['body']['error_code'], 'MUSIC_GENERATION_CANCELLED')
                self.assertEqual(generation_response['body']['trace_id'], 'music-ui-primary-test')
                snapshot = server.get_music_generation_snapshot()
                self.assertFalse(snapshot['active'])
                self.assertEqual(snapshot['last_result'], 'cancelled')
                self.assertEqual(snapshot['last_error_code'], 'MUSIC_GENERATION_CANCELLED')
                self.assertEqual(snapshot['last_http_status'], 409)
                self.assertEqual(snapshot['last_trace_id'], 'music-ui-primary-test')
                event_names = [event['event'] for event in server.get_recent_music_diagnostics(50)]
                self.assertIn('duplicate_request_rejected', event_names)
                self.assertIn('generation_cancelled', event_names)
                self.assertIn('stop_completed', event_names)
                self.assertEqual(server.accelerator_state['owner'], 'idle')
        finally:
            stop_upstream.set()
            httpd.shutdown()
            httpd.server_close()
            server_thread.join(timeout=5)

    def test_music_diagnostic_endpoint_redacts_user_content(self):
        server.record_music_diagnostic('redaction_test', trace_id='music-ui-redaction-test', details={
            'content': 'TOP SECRET CONTENT',
            'message': '<prompt>PRIVATE PROMPT</prompt><lyrics>PRIVATE LYRICS</lyrics>',
            'audio_url': 'data:audio/wav;base64,PRIVATEAUDIO',
        })
        httpd = server.socketserver.ThreadingTCPServer(
            ('127.0.0.1', 0),
            server.GnosysHTTPRequestHandler,
        )
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()

        try:
            with (
                mock.patch.object(server, 'get_accelerator_snapshot', return_value=self.snapshot()),
                mock.patch.object(server, 'inspect_music_models', return_value={'turbo': {'installed': True}}),
            ):
                connection = http.client.HTTPConnection(
                    '127.0.0.1',
                    httpd.server_address[1],
                    timeout=5,
                )
                connection.request(
                    'GET',
                    '/api/music/diagnostics?limit=20',
                    headers={'Origin': 'https://rorrimaesu.github.io'},
                )
                response = connection.getresponse()
                response_text = response.read().decode('utf-8')
                response_body = json.loads(response_text)
                connection.close()

            self.assertEqual(response.status, 200)
            self.assertEqual(response_body['status'], 'success')
            self.assertEqual(response_body['report']['schema_version'], 1)
            self.assertIn('redaction_test', [
                event['event'] for event in response_body['report']['recent_events']
            ])
            self.assertNotIn('TOP SECRET CONTENT', response_text)
            self.assertNotIn('PRIVATE PROMPT', response_text)
            self.assertNotIn('PRIVATE LYRICS', response_text)
            self.assertNotIn('PRIVATEAUDIO', response_text)
            self.assertIn('[redacted]', response_text)
        finally:
            httpd.shutdown()
            httpd.server_close()
            server_thread.join(timeout=5)


class FrontendMusicDiagnosticsTests(unittest.TestCase):
    def test_client_guard_runs_before_local_permission_await(self):
        project_root = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(project_root, 'music', 'music-studio.js'), 'r', encoding='utf-8') as handle:
            source = handle.read()
        function_start = source.index('async function generateStudyTrack()')
        function_source = source[function_start:]
        guard_position = function_source.index(
            'if (generationStartPending || pendingGeneration || isTrackGenerating || activeGenerationController)'
        )
        latch_position = function_source.index('generationStartPending = true;')
        permission_position = function_source.index('await window.parent.GnosysEnsureLocalNetworkAccess()')

        self.assertLess(guard_position, permission_position)
        self.assertLess(latch_position, permission_position)
        self.assertIn("'gnosys-ai-music-generation'", function_source)
        self.assertIn("{ mode: 'exclusive', ifAvailable: true }", function_source)
        self.assertIn("'X-Gnosys-Trace-Id': generationTraceId", function_source)
        self.assertIn('createGenerationResponseError(res, generationTraceId)', function_source)

    def test_music_studio_exposes_safe_diagnostic_download(self):
        project_root = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(project_root, 'music', 'index.html'), 'r', encoding='utf-8') as handle:
            page = handle.read()
        with open(os.path.join(project_root, 'music', 'music-studio.js'), 'r', encoding='utf-8') as handle:
            source = handle.read()

        self.assertIn('btn-download-music-diagnostics', page)
        self.assertIn('music-studio.js?v=20260718-generation-telemetry1', page)
        self.assertIn('/api/music/diagnostics?limit=150', source)
        self.assertIn('Prompts, lyrics, message content, and generated audio are not included.', source)

    def test_music_studio_uses_live_telemetry_instead_of_timed_fake_percentages(self):
        project_root = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(project_root, 'music', 'index.html'), 'r', encoding='utf-8') as handle:
            page = handle.read()
        with open(os.path.join(project_root, 'music', 'music-studio.js'), 'r', encoding='utf-8') as handle:
            source = handle.read()

        self.assertIn('/api/music/generation/status', source)
        self.assertIn('setInterval(pollGenerationTelemetry, 2000)', source)
        self.assertIn('ACE-Step does not expose diffusion-step percentages', page)
        self.assertIn('generation-live-timeline', page)
        self.assertIn('btn-stop-stalled-generation', page)
        self.assertNotIn('const loadingStages', source)
        self.assertNotIn("pct: 92", source)


if __name__ == '__main__':
    unittest.main()
