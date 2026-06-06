(function () {
    const VIDEO_STATE_KEY = 'psychology_video_state_v1';

    let videoState = {
        completedEpisodeIds: [],
        lastEpisodeId: null,
    };

    function getEpisodes() {
        return Array.isArray(window.PsychVideoData?.videoCurriculum)
            ? window.PsychVideoData.videoCurriculum
            : [];
    }

    function loadVideoState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(VIDEO_STATE_KEY) || '{}');
            return {
                completedEpisodeIds: Array.isArray(parsed.completedEpisodeIds) ? parsed.completedEpisodeIds : [],
                lastEpisodeId: typeof parsed.lastEpisodeId === 'string' ? parsed.lastEpisodeId : null,
            };
        } catch (_) {
            return { completedEpisodeIds: [], lastEpisodeId: null };
        }
    }

    function saveVideoState() {
        localStorage.setItem(VIDEO_STATE_KEY, JSON.stringify(videoState));
    }

    function buildVideoQuizSystemPrompt(episode) {
        const conceptText = (episode?.coreConcepts || []).join(', ');
        return [
            'You are PsychTutor, a novice-first Intro Psychology tutor.',
            `The learner just finished video episode ${episode?.episodeNumber || ''}: ${episode?.title || 'Unknown'}.`,
            `Focus only on these concepts: ${conceptText}.`,
            'Run a brief 3-question micro-quiz with one question at a time.',
            'After each answer, provide short corrective feedback and a confidence check.',
            'Use plain text only and avoid LaTeX syntax.'
        ].join(' ');
    }

    function bindVideoActions() {
        const listEl = document.getElementById('video-episode-list');
        const modalEl = document.getElementById('video-episode-modal');
        const modalBackdropEl = document.getElementById('video-episode-modal-backdrop');
        const modalCloseBtn = document.getElementById('btn-video-modal-close');
        let iframeEl = document.getElementById('psych-video-player');
        const warningEl = document.getElementById('video-empty-warning');
        const titleEl = document.getElementById('video-active-title');
        const chipsEl = document.getElementById('video-concept-chips');
        const outcomeEl = document.getElementById('video-outcome-text');
        const prevTitleEl = document.getElementById('video-prev-title');
        const nextTitleEl = document.getElementById('video-next-title');
        const prevBtn = document.getElementById('btn-video-prev-episode');
        const nextBtn = document.getElementById('btn-video-next-episode');
        const completeBtn = document.getElementById('btn-video-mark-complete');
        const quizBtn = document.getElementById('btn-video-start-quiz');
        const tutorAnchor = document.getElementById('video-tutor-anchor');
        const quizOverlayEl = document.getElementById('video-quiz-overlay');
        const quizOverlayHost = document.getElementById('video-quiz-overlay-host');
        const quizOverlayCloseBtn = document.getElementById('btn-video-quiz-overlay-close');
        const quizMobileEl = document.getElementById('video-quiz-mobile');
        const quizMobileHost = document.getElementById('video-quiz-mobile-host');
        const quizMobileCloseBtn = document.getElementById('btn-video-quiz-mobile-close');
        const completionPill = document.getElementById('video-completion-pill');
        const dashboardSummaryEl = document.getElementById('dashboard-video-summary');
        const dashboardProgressEl = document.getElementById('dashboard-video-progress');
        const dashboardVideosBtn = document.getElementById('btn-dashboard-open-videos');
        const dashboardTutorBtn = document.getElementById('btn-dashboard-open-tutor');

        if (!listEl || !modalEl || !modalBackdropEl || !modalCloseBtn || !iframeEl || !titleEl || !chipsEl || !completeBtn || !quizBtn || !tutorAnchor || !completionPill) {
            return;
        }

        dashboardVideosBtn?.addEventListener('click', () => window.activatePsychTab?.('videos'));
        dashboardTutorBtn?.addEventListener('click', () => window.activatePsychTab?.('tutor'));

        const episodes = getEpisodes();
        if (episodes.length === 0) {
            listEl.innerHTML = '<div class="text-xs text-slate-500 p-3">No video curriculum entries found. Run fetch_curriculum.py to generate data.</div>';
            return;
        }

        videoState = loadVideoState();

        let activeEpisodeId = videoState.lastEpisodeId;
        let modalOpen = false;
        let lastTriggerEl = null;

        if (!activeEpisodeId || !episodes.some((ep) => ep.id === activeEpisodeId)) {
            activeEpisodeId = episodes[0].id;
        }

        const isComplete = (episodeId) => videoState.completedEpisodeIds.includes(episodeId);
        const isMobileQuizView = () => window.matchMedia('(max-width: 767px)').matches;

        function setEpisodeCompletion(episodeId, shouldComplete, sourceEl) {
            if (!episodeId) return false;
            const alreadyComplete = isComplete(episodeId);
            if (alreadyComplete === shouldComplete) return false;

            if (shouldComplete) {
                videoState.completedEpisodeIds = Array.from(new Set([
                    ...videoState.completedEpisodeIds,
                    episodeId
                ]));
                if (window.PsychGamification) {
                    window.PsychGamification.awardXP?.(30, 'video', sourceEl || null);
                    window.PsychGamification.incrementStat?.('videosWatched', 1);
                }
            } else {
                videoState.completedEpisodeIds = videoState.completedEpisodeIds.filter((id) => id !== episodeId);
            }
            return true;
        }

        function refreshVideoProgressViews() {
            saveVideoState();
            updateCompletionPill();
            renderEpisodeList();
            renderActiveEpisode();
        }

        function clearVideoQuizWidgets() {
            quizOverlayHost?.replaceChildren();
            quizMobileHost?.replaceChildren();
        }

        function closeVideoQuiz() {
            quizOverlayEl?.classList.add('hidden');
            quizOverlayEl?.setAttribute('aria-hidden', 'true');
            quizMobileEl?.classList.add('hidden');
            quizMobileEl?.setAttribute('aria-hidden', 'true');
            iframeEl.classList.remove('video-player-frame-hidden');
            clearVideoQuizWidgets();
        }

        function getEpisodeIndex(episodeId) {
            return episodes.findIndex((ep) => ep.id === episodeId);
        }

        function getNextEpisode() {
            const currentIdx = getEpisodeIndex(activeEpisodeId);
            const fromIdx = currentIdx >= 0 ? currentIdx + 1 : 0;
            const nextUnfinished = episodes.slice(fromIdx).find((ep) => !isComplete(ep.id));
            if (nextUnfinished) return nextUnfinished;
            return episodes[fromIdx] || null;
        }

        function getPreviousEpisode() {
            const currentIdx = getEpisodeIndex(activeEpisodeId);
            if (currentIdx <= 0) return null;
            return episodes[currentIdx - 1] || null;
        }

        function buildOutcomeCopy(episode) {
            const concepts = Array.isArray(episode?.coreConcepts) ? episode.coreConcepts : [];
            if (concepts.length === 0) {
                return 'Complete this episode, then run a short micro-quiz to lock in the core ideas.';
            }
            const leadConcepts = concepts.slice(0, 2).join(' and ');
            return `After this episode, you should be able to explain ${leadConcepts} in your own words.`;
        }

        function updateCompletionPill() {
            const completeCount = videoState.completedEpisodeIds.length;
            const remainingCount = Math.max(episodes.length - completeCount, 0);
            completionPill.textContent = `${completeCount} / ${episodes.length} Complete • ${remainingCount} to go`;
        }

        function openVideoEpisodeModal(triggerEl) {
            if (triggerEl) lastTriggerEl = triggerEl;
            closeVideoQuiz();
            modalOpen = true;

            const viewEl = document.getElementById('view-videos');
            if (viewEl) {
                viewEl.classList.add('video-active-flow');
            }

            modalEl.classList.remove('hidden');
            modalEl.setAttribute('aria-hidden', 'false');
            modalCloseBtn.focus();
        }

        function closeVideoEpisodeModal() {
            if (!modalOpen) return;
            closeVideoQuiz();
            modalOpen = false;

            if (lastTriggerEl && typeof lastTriggerEl.focus === 'function') {
                lastTriggerEl.focus();
            }

            const viewEl = document.getElementById('view-videos');
            if (viewEl) {
                viewEl.classList.remove('video-active-flow');
            }

            modalEl.classList.add('hidden');
            modalEl.setAttribute('aria-hidden', 'true');
            iframeEl.src = '';
        }

        function updateDashboardCta() {
            if (dashboardProgressEl) {
                dashboardProgressEl.textContent = `${videoState.completedEpisodeIds.length} of ${episodes.length} episodes complete`;
            }
            if (!dashboardSummaryEl) return;

            const active = episodes.find((ep) => ep.id === activeEpisodeId) || episodes[0];
            const next = getNextEpisode();
            if (!active) {
                dashboardSummaryEl.textContent = 'Pick your next psychology episode, then lock in concepts with a 3-question micro-quiz.';
                return;
            }
            const nextText = next ? `Next: Episode ${next.episodeNumber}` : 'Final stretch';
            dashboardSummaryEl.textContent = `Continue with Episode ${active.episodeNumber}: ${active.title}. ${nextText}.`;
        }

        function renderEpisodeList() {
            listEl.innerHTML = '';

            episodes.forEach((episode) => {
                const row = document.createElement('div');
                const openBtn = document.createElement('button');
                const toggleBtn = document.createElement('button');
                const active = episode.id === activeEpisodeId;
                const completed = isComplete(episode.id);

                row.className = [
                    'w-full rounded-xl border p-2 transition-colors flex items-start gap-2',
                    active ? 'bg-purple-950/20 border-purple-800' : 'bg-slate-900 hover:bg-slate-850/60 border-slate-800'
                ].join(' ');

                openBtn.type = 'button';
                openBtn.className = 'flex-1 text-left rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500/40';
                openBtn.innerHTML = `
                    <div class="flex items-start justify-between gap-2">
                        <p class="text-xs font-black text-slate-400">EP ${episode.episodeNumber}</p>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${completed ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/30' : 'bg-slate-950 text-slate-500 border border-slate-850'}">${completed ? 'Completed' : 'Pending'}</span>
                    </div>
                    <p class="text-sm font-semibold text-slate-100 mt-1 leading-tight">${episode.title}</p>
                `;

                openBtn.addEventListener('click', () => {
                    activeEpisodeId = episode.id;
                    videoState.lastEpisodeId = episode.id;
                    saveVideoState();
                    renderEpisodeList();
                    renderActiveEpisode();
                    openVideoEpisodeModal(openBtn);
                });

                toggleBtn.type = 'button';
                toggleBtn.className = [
                    'shrink-0 mt-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors',
                    completed
                        ? 'bg-purple-900/25 text-purple-200 border-purple-700 hover:bg-purple-900/45'
                        : 'bg-emerald-950/35 text-emerald-300 border-emerald-800 hover:bg-emerald-900/45'
                ].join(' ');
                toggleBtn.textContent = completed ? 'Unmark' : 'Mark';
                toggleBtn.setAttribute('aria-label', `${completed ? 'Unmark' : 'Mark'} Episode ${episode.episodeNumber} as watched`);
                toggleBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const changed = setEpisodeCompletion(episode.id, !isComplete(episode.id), toggleBtn);
                    if (!changed) return;
                    refreshVideoProgressViews();
                });

                row.appendChild(openBtn);
                row.appendChild(toggleBtn);
                listEl.appendChild(row);
            });
        }

        function renderActiveEpisode() {
            const episode = episodes.find((ep) => ep.id === activeEpisodeId);
            if (!episode) return;

            const previousEpisode = getPreviousEpisode();
            const nextEpisode = getNextEpisode();

            titleEl.textContent = `Episode ${episode.episodeNumber}: ${episode.title}`;
            chipsEl.innerHTML = '';
            (episode.coreConcepts || []).forEach((concept) => {
                const chip = document.createElement('span');
                chip.className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-900/25 border border-purple-800/40 text-purple-300';
                chip.textContent = concept;
                chipsEl.appendChild(chip);
            });

            if (outcomeEl) {
                outcomeEl.textContent = buildOutcomeCopy(episode);
            }
            if (prevTitleEl) {
                prevTitleEl.textContent = previousEpisode
                    ? `Previous episode: ${previousEpisode.episodeNumber} - ${previousEpisode.title}`
                    : 'Previous episode: this is the first episode';
            }
            if (nextTitleEl) {
                nextTitleEl.textContent = nextEpisode
                    ? `Next episode: ${nextEpisode.episodeNumber} - ${nextEpisode.title}`
                    : 'Next episode: you reached the end of this sequence';
            }

            if (prevBtn) {
                const canGoBack = !!previousEpisode;
                prevBtn.disabled = !canGoBack;
                prevBtn.classList.toggle('opacity-60', !canGoBack);
                prevBtn.classList.toggle('cursor-not-allowed', !canGoBack);
            }
            if (nextBtn) {
                const canAdvance = !!nextEpisode;
                nextBtn.disabled = !canAdvance;
                nextBtn.classList.toggle('opacity-60', !canAdvance);
                nextBtn.classList.toggle('cursor-not-allowed', !canAdvance);
            }

            if (episode.youtubeId) {
                const newIframe = iframeEl.cloneNode(true);
                newIframe.src = `https://www.youtube.com/embed/${episode.youtubeId}?rel=0&modestbranding=1`;
                iframeEl.parentNode.replaceChild(newIframe, iframeEl);
                iframeEl = newIframe;
                warningEl?.classList.add('hidden');
            } else {
                const newIframe = iframeEl.cloneNode(true);
                newIframe.src = 'about:blank';
                iframeEl.parentNode.replaceChild(newIframe, iframeEl);
                iframeEl = newIframe;
                warningEl?.classList.remove('hidden');
            }

            const completed = isComplete(episode.id);
            completeBtn.textContent = completed ? 'Unmark Watched' : 'Mark Watched';
            completeBtn.disabled = false;
            completeBtn.classList.remove('opacity-60', 'cursor-not-allowed');

            updateDashboardCta();
        }

        function launchMicroQuiz() {
            const episode = episodes.find((ep) => ep.id === activeEpisodeId);
            if (!episode) return;
            if (!window.PsychTutor || typeof window.PsychTutor.invoke !== 'function') return;

            const starterPrompt = `I just finished Episode ${episode.episodeNumber}: ${episode.title}. Please run a short psychology micro-quiz focused on: ${(episode.coreConcepts || []).join(', ')}.`;
            const systemContext = episode.customSystemPrompt || episode.tutorSystemPrompt || buildVideoQuizSystemPrompt(episode);
            const mobile = isMobileQuizView();

            if (mobile) {
                quizMobileEl?.classList.remove('hidden');
                quizMobileEl?.setAttribute('aria-hidden', 'false');
                quizOverlayEl?.classList.add('hidden');
                quizOverlayEl?.setAttribute('aria-hidden', 'true');
                iframeEl.classList.add('video-player-frame-hidden');
                clearVideoQuizWidgets();
                window.PsychTutor.invoke(starterPrompt, quizMobileHost || tutorAnchor, systemContext, {
                    mountMode: 'append',
                    widgetClassName: 'video-quiz-widget',
                    showInnerClose: false
                });
            } else {
                quizOverlayEl?.classList.remove('hidden');
                quizOverlayEl?.setAttribute('aria-hidden', 'false');
                quizMobileEl?.classList.add('hidden');
                quizMobileEl?.setAttribute('aria-hidden', 'true');
                iframeEl.classList.add('video-player-frame-hidden');
                clearVideoQuizWidgets();
                window.PsychTutor.invoke(starterPrompt, quizOverlayHost || tutorAnchor, systemContext, {
                    mountMode: 'append',
                    widgetClassName: 'video-quiz-widget h-full',
                    showInnerClose: false
                });
            }
        }

        completeBtn.addEventListener('click', () => {
            const episode = episodes.find((ep) => ep.id === activeEpisodeId);
            if (!episode) return;

            const changed = setEpisodeCompletion(episode.id, !isComplete(episode.id), completeBtn);
            if (!changed) return;
            videoState.lastEpisodeId = episode.id;
            refreshVideoProgressViews();
        });

        quizBtn.addEventListener('click', launchMicroQuiz);

        prevBtn?.addEventListener('click', () => {
            const previousEpisode = getPreviousEpisode();
            if (!previousEpisode) return;
            closeVideoQuiz();
            activeEpisodeId = previousEpisode.id;
            videoState.lastEpisodeId = previousEpisode.id;
            saveVideoState();
            renderEpisodeList();
            renderActiveEpisode();
        });

        nextBtn?.addEventListener('click', () => {
            const nextEpisode = getNextEpisode();
            if (!nextEpisode) return;
            closeVideoQuiz();
            activeEpisodeId = nextEpisode.id;
            videoState.lastEpisodeId = nextEpisode.id;
            saveVideoState();
            renderEpisodeList();
            renderActiveEpisode();
        });

        quizOverlayCloseBtn?.addEventListener('click', closeVideoQuiz);
        quizMobileCloseBtn?.addEventListener('click', closeVideoQuiz);
        modalCloseBtn.addEventListener('click', closeVideoEpisodeModal);
        modalBackdropEl.addEventListener('click', closeVideoEpisodeModal);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modalOpen) {
                closeVideoEpisodeModal();
            }
        });

        updateCompletionPill();
        renderEpisodeList();
        renderActiveEpisode();
    }

    document.addEventListener('DOMContentLoaded', bindVideoActions);
})();
