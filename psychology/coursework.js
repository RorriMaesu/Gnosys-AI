(function () {
    const STAGE_LECTURE = 1;
    const STAGE_SOCRATIC = 2;
    const STAGE_SANDBOX = 3;
    const STAGE_FEYNMAN = 4;

    const STATE_LOCKED = 0;
    const STATE_ACTIVE = 1;
    const STATE_HW_PENDING = 2;
    const STATE_MASTERED = 3;
    const STATE_RUSTED = 4;

    const appState = {
        lessonId: null,
        lesson: null,
        stage: STAGE_LECTURE,
        messageHistory: [],
        isChatLocked: false,
        useSpeechInput: false,
        recognition: null,
        syllabus: null,
        matrix: {},
        socraticCleared: false,
        sandboxCleared: false,
        feynmanCleared: false,
        lectures: [],
        activeLectureIdx: 0,
        isGeneratingLecture: false,
        socraticCollapsed: true
    };

    const els = {};

    function cacheDom() {
        els.activeLessonTitle = document.getElementById('active-lesson-title');
        els.lecturePanel = document.getElementById('lecture-panel');
        els.lectureContainer = document.getElementById('lecture-container');
        els.btnRegenerateLecture = document.getElementById('btn-regenerate-lecture');
        
        els.chatPanel = document.getElementById('chat-panel');
        els.chatMessages = document.getElementById('chat-messages');
        els.chatHeaderTitle = document.getElementById('chat-header-title');
        els.modeBadge = document.getElementById('current-mode-badge');
        els.chatForm = document.getElementById('chat-form');
        els.chatInput = document.getElementById('chat-input');
        els.btnSend = document.getElementById('btn-send');
        els.btnMic = document.getElementById('btn-mic');
        
        els.feynmanSpeechControls = document.getElementById('feynman-speech-controls');
        els.btnToggleInputMode = document.getElementById('btn-toggle-input-mode');
        els.toggleInputText = document.getElementById('toggle-input-text');
        els.speechIndicator = document.getElementById('speech-indicator');
        els.inputInstructions = document.getElementById('input-instructions');
        
        els.sandboxHandshake = document.getElementById('sandbox-handshake');
        els.sandboxViewport = document.getElementById('sandbox-viewport');
        els.sandboxStatusBadge = document.getElementById('sandbox-status-badge');
        els.masterCtaOverlay = document.getElementById('master-cta-overlay');
        els.btnRegenerate = document.getElementById('btn-regenerate');
        els.btnRestartLesson = document.getElementById('btn-restart-lesson');
        els.btnGenerateQuestion = document.getElementById('btn-generate-question');
        els.selectActiveLecture = document.getElementById('select-active-lecture');
        els.btnAddLecture = document.getElementById('btn-add-lecture');
        
        els.workAreaSplit = document.getElementById('work-area-split');
        els.btnToggleSocratic = document.getElementById('btn-toggle-socratic');
        els.btnOpenSocratic = document.getElementById('btn-open-socratic');
        els.socraticCollapsedHint = document.getElementById('socratic-collapsed-hint');
        els.socraticCtaInline = document.getElementById('socratic-cta-inline');
        els.btnPrimarySocraticCta = document.getElementById('btn-primary-socratic-cta');
        els.btnStartSocraticHeader = document.getElementById('btn-start-socratic-header');

        els.dots = {
            1: document.getElementById('dot-1'),
            2: document.getElementById('dot-2'),
            3: document.getElementById('dot-3'),
            4: document.getElementById('dot-4')
        };
        els.dotContainers = {
            1: document.getElementById('stage-dot-1'),
            2: document.getElementById('stage-dot-2'),
            3: document.getElementById('stage-dot-3'),
            4: document.getElementById('stage-dot-4')
        };
    }

    function setStageDots(currentStage) {
        for (let i = 1; i <= 4; i++) {
            const dot = els.dots[i];
            const wrap = els.dotContainers[i];
            if (!dot || !wrap) continue;

            dot.classList.remove('bg-slate-600', 'bg-purple-400', 'bg-slate-350', 'bg-purple-600');
            wrap.classList.remove(
                'text-slate-400', 'text-purple-300', 'text-purple-400',
                'bg-slate-900/80', 'bg-purple-900/20', 'border', 'border-purple-900/30'
            );

            if (i <= currentStage) {
                dot.classList.add('bg-purple-500');
                wrap.classList.add('text-purple-300', 'bg-purple-900/20', 'border', 'border-purple-900/30');
            } else {
                dot.classList.add('bg-slate-600');
                wrap.classList.add('text-slate-400', 'bg-slate-900/80');
            }
        }
    }

    function setModeUiForStage() {
        if (appState.stage === STAGE_LECTURE) {
            els.modeBadge.textContent = 'LECTURE';
            els.chatHeaderTitle.textContent = 'Socratic Psychology Dialogue';
            els.inputInstructions.textContent = 'Start the Socratic flow to begin chat...';
            if (els.btnGenerateQuestion) els.btnGenerateQuestion.classList.add('hidden');
        } else if (appState.stage === STAGE_SOCRATIC) {
            els.modeBadge.textContent = 'SOCRATIC CHECK';
            els.chatHeaderTitle.textContent = 'Socratic Psychology Dialogue';
            els.inputInstructions.textContent = 'Respond to Socratic Question...';
            if (els.btnGenerateQuestion) els.btnGenerateQuestion.classList.remove('hidden');
        } else if (appState.stage === STAGE_SANDBOX) {
            els.modeBadge.textContent = 'SANDBOX SIMULATOR';
            els.chatHeaderTitle.textContent = 'Socratic Psychology Dialogue';
            els.inputInstructions.textContent = 'Complete the sandbox overlay...';
            if (els.btnGenerateQuestion) els.btnGenerateQuestion.classList.add('hidden');
        } else {
            els.modeBadge.textContent = 'FEYNMAN CHECK';
            els.chatHeaderTitle.textContent = 'Feynman Explanation';
            els.inputInstructions.textContent = 'Explain simply to verify theory mastery...';
            if (els.btnGenerateQuestion) els.btnGenerateQuestion.classList.remove('hidden');
        }
    }

    function updateSocraticLayoutUi() {
        const collapsed = !!appState.socraticCollapsed;
        const isLectureStage = appState.stage === STAGE_LECTURE;
        const activeSocratic = appState.stage !== STAGE_LECTURE && !collapsed;

        if (els.workAreaSplit) {
            els.workAreaSplit.classList.toggle('socratic-collapsed', collapsed);
            els.workAreaSplit.classList.toggle('layout-lecture', collapsed);
            els.workAreaSplit.classList.toggle('layout-split', !collapsed && appState.stage === STAGE_LECTURE);
            els.workAreaSplit.classList.toggle('layout-socratic-full', !collapsed && appState.stage !== STAGE_LECTURE);
            els.workAreaSplit.classList.toggle('active-socratic', activeSocratic);
        }

        if (els.btnToggleSocratic) {
            els.btnToggleSocratic.setAttribute('aria-expanded', String(!collapsed));
            els.btnToggleSocratic.innerHTML = collapsed
                ? `<i class="fa-solid fa-chevron-up text-[9px]"></i><span>${isLectureStage ? 'Preview Panel' : 'Expand Panel'}</span>`
                : `<i class="fa-solid fa-chevron-down text-[9px]"></i><span>${isLectureStage ? 'Hide Panel' : 'Collapse Panel'}</span>`;
        }

        if (els.btnOpenSocratic) {
            els.btnOpenSocratic.setAttribute('aria-expanded', String(!collapsed));
        }

        if (els.socraticCollapsedHint) {
            els.socraticCollapsedHint.classList.toggle('hidden', !collapsed);
        }

        updateSocraticCtaUi();
    }

    function updateSocraticCtaUi() {
        const isLecture = appState.stage === STAGE_LECTURE;
        
        if (els.socraticCtaInline) {
            els.socraticCtaInline.classList.toggle('hidden', !isLecture);
            els.socraticCtaInline.classList.toggle('flex', isLecture);
        }

        if (els.btnStartSocraticHeader) {
            els.btnStartSocraticHeader.classList.toggle('hidden', !isLecture);
            els.btnStartSocraticHeader.classList.toggle('inline-flex', isLecture);
        }

        if (isLecture) {
            const hasCleared = appState.socraticCleared;
            if (hasCleared) {
                if (els.btnPrimarySocraticCta) {
                    els.btnPrimarySocraticCta.classList.remove('cta-attn');
                    els.btnPrimarySocraticCta.querySelector('span').textContent = 'Review Socratic Checkpoint';
                }
                if (els.btnStartSocraticHeader) {
                    els.btnStartSocraticHeader.classList.remove('cta-attn');
                    els.btnStartSocraticHeader.querySelector('span').textContent = 'Review Socratic';
                }
                if (els.socraticCtaInline) els.socraticCtaInline.classList.add('opacity-70');
            } else {
                if (els.btnPrimarySocraticCta) {
                    els.btnPrimarySocraticCta.classList.add('cta-attn');
                    els.btnPrimarySocraticCta.querySelector('span').textContent = 'Start Socratic Checkpoint';
                }
                if (els.btnStartSocraticHeader) {
                    els.btnStartSocraticHeader.classList.add('cta-attn');
                    els.btnStartSocraticHeader.querySelector('span').textContent = 'Start Socratic Check';
                }
                if (els.socraticCtaInline) els.socraticCtaInline.classList.remove('opacity-70');
            }
        }
    }

    function setStage(stageNum) {
        appState.stage = stageNum;
        setStageDots(stageNum);
        setModeUiForStage();
        
        // Hide overlay dialog states initially
        if (els.sandboxHandshake) els.sandboxHandshake.classList.add('hidden');
        if (els.masterCtaOverlay) els.masterCtaOverlay.classList.add('hidden');
        if (els.feynmanSpeechControls) els.feynmanSpeechControls.classList.add('hidden');

        // Apply mode attributes to form
        if (els.chatForm) {
            if (stageNum === STAGE_FEYNMAN) {
                els.chatForm.dataset.mode = 'feynman';
            } else {
                els.chatForm.dataset.mode = 'socratic';
            }
        }

        appState.isChatLocked = false;

        if (stageNum === STAGE_LECTURE) {
            appState.socraticCollapsed = true;
        } else if (stageNum === STAGE_SOCRATIC) {
            appState.socraticCollapsed = false;
            // Focus input
            setTimeout(() => { if (els.chatInput) els.chatInput.focus(); }, 150);
        } else if (stageNum === STAGE_SANDBOX) {
            appState.socraticCollapsed = false;
            if (els.sandboxHandshake) els.sandboxHandshake.classList.remove('hidden');
            loadSandbox();
        } else if (stageNum === STAGE_FEYNMAN) {
            appState.socraticCollapsed = false;
            if (els.feynmanSpeechControls) els.feynmanSpeechControls.classList.remove('hidden');
            
            // Check if feynman prompt has been injected already
            const hasPrompt = appState.messageHistory.some(m => m.content && (m.content.includes('Feynman Elaboration:') || m.content.includes('Feynman Check:')));
            if (!hasPrompt) {
                loadDynamicQuestion('feynman');
            }
            setTimeout(() => { if (els.chatInput) els.chatInput.focus(); }, 150);
        }

        updateSocraticLayoutUi();
        saveSessionState(appState.lessonId, { stage: appState.stage, socraticCleared: appState.socraticCleared, sandboxCleared: appState.sandboxCleared }, appState.messageHistory);
    }

    async function loadActiveLesson(lessonId) {
        appState.lessonId = lessonId;
        appState.lesson = Object.values(appState.syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
        
        if (!appState.lesson) return;

        // Restore or initialize states
        const session = getSessionState();
        if (session && session.lessonId === lessonId) {
            appState.stage = session.stageState.stage || STAGE_LECTURE;
            appState.socraticCleared = session.stageState.socraticCleared || false;
            appState.sandboxCleared = session.stageState.sandboxCleared || false;
            appState.messageHistory = session.messageHistory || [];
        } else {
            appState.stage = STAGE_LECTURE;
            appState.socraticCleared = false;
            appState.sandboxCleared = false;
            appState.messageHistory = [];
        }

        // Set labels
        if (els.activeLessonTitle) {
            els.activeLessonTitle.textContent = `${appState.lesson.numStr}: ${appState.lesson.title}`;
        }

        // Load content
        await loadLecture();
        loadSocraticChat();

        // Switch to stage
        setStage(appState.stage);
        
        // Highlight in sidebar
        document.querySelectorAll('#sidebar-skill-tree button').forEach(btn => {
            btn.classList.remove('ring-1', 'ring-purple-500', 'bg-slate-800/80');
        });
        const activeItem = document.getElementById(`sidebar-item-${lessonId}`);
        if (activeItem) {
            activeItem.classList.add('ring-1', 'ring-purple-500', 'bg-slate-800/80');
        }
    }

    async function loadLecture() {
        if (!appState.lesson) return;
        
        // Try to load cached lectures
        let cached = null;
        try {
            cached = JSON.parse(localStorage.getItem(`psychology_lesson_lectures_${appState.lesson.id}`));
        } catch (e) {
            console.error(e);
        }

        if (Array.isArray(cached) && cached.length > 0) {
            appState.lectures = cached;
            let savedIdx = Number(localStorage.getItem(`psychology_lesson_active_lecture_idx_${appState.lesson.id}`) || '0');
            if (savedIdx < 0 || savedIdx >= cached.length) savedIdx = 0;
            appState.activeLectureIdx = savedIdx;
            
            renderLectureDropdown();
            renderLectureContent(appState.lesson, cached[savedIdx]);
        } else {
            // Initiate step-by-step Ollama AI generator
            appState.lectures = [];
            appState.activeLectureIdx = 0;
            await generateLecture(appState.lesson, 0, false);
        }
    }

    function renderLectureDropdown() {
        if (!els.selectActiveLecture) return;
        els.selectActiveLecture.innerHTML = '';
        appState.lectures.forEach((lec, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `Lecture ${idx + 1}`;
            opt.selected = (idx === appState.activeLectureIdx);
            els.selectActiveLecture.appendChild(opt);
        });
    }

    function renderLectureContent(lesson, lectureText) {
        if (els.lectureContainer) {
            els.lectureContainer.innerHTML = window.marked ? window.marked.parse(lectureText) : lectureText;
        }
    }

    async function generateLecture(lesson, index, isRegenerate = false) {
        if (appState.isGeneratingLecture) {
            console.warn('Lecture generation already in progress.');
            return;
        }
        appState.isGeneratingLecture = true;
        const savedModel = localStorage.getItem('psychology_llm') || 'gemma';
        const modelLabel = escapeHtml(savedModel === 'gemma' ? 'Gnosys Gemma' : 'Gnosys Llama');

        els.lectureContainer.innerHTML = `
            <div class="flex flex-col h-full justify-center p-4 max-w-lg mx-auto space-y-3">
                <div class="flex items-center space-x-3 text-purple-400 font-semibold text-xs">
                    <i class="fa-solid fa-gears animate-spin"></i>
                    <span>${isRegenerate ? 'Regenerating' : 'Generating'} Lecture via ${modelLabel}...</span>
                </div>
                
                <div class="bg-slate-900 border border-slate-800 rounded p-3 font-mono text-[10px] text-slate-350 space-y-2 shadow-inner">
                    <div id="step-connect" class="flex items-center justify-between text-slate-500">
                        <span>[1/4] Connecting to local provider...</span>
                        <span class="status font-bold">PENDING</span>
                    </div>
                    <div id="step-model" class="flex items-center justify-between text-slate-500">
                        <span>[2/4] Verifying model availability...</span>
                        <span class="status font-bold">PENDING</span>
                    </div>
                    <div id="step-generate" class="flex items-center justify-between text-slate-500">
                        <span>[3/4] Requesting 600-800 word psychology lecture...</span>
                        <span class="status font-bold">PENDING</span>
                    </div>
                    <div id="step-render" class="flex items-center justify-between text-slate-500">
                        <span>[4/4] Parsing and rendering output...</span>
                        <span class="status font-bold">PENDING</span>
                    </div>
                </div>
                
                <div id="generation-log" class="text-[9px] text-slate-400 h-6 truncate font-mono text-center">
                    Initializing generation handshake...
                </div>
            </div>
        `;

        const logEl = document.getElementById('generation-log');
        const updateStepUI = (stepId, status, text) => {
            const stepEl = document.getElementById(`step-${stepId}`);
            if (!stepEl) return;
            const statusEl = stepEl.querySelector('.status');
            
            stepEl.classList.remove('text-slate-500', 'text-amber-400', 'text-purple-400', 'text-red-400');
            
            if (status === 'running') {
                stepEl.classList.add('text-amber-400');
                statusEl.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> RUNNING';
            } else if (status === 'success') {
                stepEl.classList.add('text-purple-400');
                statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> DONE';
            } else if (status === 'warning') {
                stepEl.classList.add('text-amber-400');
                statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> WARN';
            } else if (status === 'error') {
                stepEl.classList.add('text-red-400');
                statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> FAIL';
            }
            
            if (text && logEl) {
                logEl.textContent = text;
            }
        };

        const tutor = window.PsychTutor;
        if (!tutor || typeof tutor.fetchGeneratedLesson !== 'function') {
            els.lectureContainer.innerHTML = `<div class="text-red-400 text-xs p-4">Tutor module is unavailable.</div>`;
            appState.isGeneratingLecture = false;
            return;
        }

        function renderGenerationFailure(lesson, errMsg, index, isRegenerate) {
            els.lectureContainer.innerHTML = `
                <div class="flex flex-col h-full justify-center p-5 max-w-lg mx-auto space-y-4">
                    <div class="flex items-center space-x-3 text-red-500 font-semibold text-sm">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Lecture Generation Failed</span>
                    </div>
                    
                    <div class="bg-red-950/20 border border-red-500/30 rounded p-4 font-mono text-xs text-red-300 space-y-2">
                        <p class="font-bold">Error Details:</p>
                        <p class="text-red-200">${escapeHtml(errMsg)}</p>
                        <p class="text-[10px] text-slate-400 mt-2">Verify local provider readiness in the header badge, then retry generation.</p>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button id="btn-retry-generation" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs py-2.5 px-4 rounded transition uppercase tracking-wider">
                            <i class="fa-solid fa-arrows-rotate mr-1"></i> Retry
                        </button>
                        <button id="btn-use-mock-lecture" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2.5 px-4 rounded transition border border-slate-700 uppercase tracking-wider">
                            <i class="fa-solid fa-file-invoice mr-1"></i> Offline Fallback
                        </button>
                    </div>
                </div>
            `;

            document.getElementById('btn-retry-generation').addEventListener('click', () => {
                generateLecture(lesson, index, isRegenerate);
            });

            document.getElementById('btn-use-mock-lecture').addEventListener('click', () => {
                const mock = window.PsychTutor.getMockFallback(lesson.id, lesson.title, lesson.concept, lesson.clinical_tie_in, lesson.feynman_prompt);
                const mockText = mock ? mock.lecture : `Failed to load mock fallback.`;
                if (isRegenerate) {
                    appState.lectures[index] = mockText;
                } else {
                    appState.lectures.push(mockText);
                    appState.activeLectureIdx = appState.lectures.length - 1;
                }
                localStorage.setItem(`psychology_lesson_lectures_${lesson.id}`, JSON.stringify(appState.lectures));
                localStorage.setItem(`psychology_lesson_active_lecture_idx_${lesson.id}`, String(appState.activeLectureIdx));
                
                renderLectureDropdown();
                renderLectureContent(lesson, mockText);
            });
        }

        try {
            const lectureText = await tutor.fetchGeneratedLesson(lesson, (step, status, details) => {
                updateStepUI(step, status, details);
            }, index);

            if (!lectureText) {
                throw new Error('Received empty lecture text.');
            }

            // Save to cached array
            if (isRegenerate) {
                appState.lectures[index] = lectureText;
            } else {
                appState.lectures.push(lectureText);
            }
            
            localStorage.setItem(`psychology_lesson_lectures_${lesson.id}`, JSON.stringify(appState.lectures));
            localStorage.setItem(`psychology_lesson_active_lecture_idx_${lesson.id}`, String(index));
            appState.activeLectureIdx = index;

            renderLectureDropdown();
            renderLectureContent(lesson, lectureText);
        } catch (err) {
            console.error('Generation failed:', err);
            updateStepUI('generate', 'error', err.message);
            renderGenerationFailure(lesson, err.message, index, isRegenerate);
        } finally {
            appState.isGeneratingLecture = false;
        }
    }

    function renderHistoryToUi() {
        if (!els.chatMessages) return;
        els.chatMessages.innerHTML = '';
        appState.messageHistory.forEach((msg) => {
            addMessage(msg.role, msg.content);
        });
    }

    async function loadSocraticChat() {
        if (!els.chatMessages) return;
        els.chatMessages.innerHTML = '';
        
        renderHistoryToUi();
        
        if (appState.messageHistory.length === 0) {
            await loadDynamicQuestion('socratic');
        }
    }

    function addMessage(role, text) {
        if (!els.chatMessages) return;
        const wrap = document.createElement("div");
        const bubble = document.createElement("div");
        
        if (role === "user") {
            wrap.className = "flex justify-end mt-2 shrink-0";
            bubble.className = "max-w-[80%] bg-purple-650 text-white px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs font-semibold shadow-md";
            bubble.innerHTML = escapeHtml(text);
        } else {
            wrap.className = "flex justify-start mt-2 shrink-0";
            bubble.className = "max-w-[85%] bg-slate-900 border border-slate-800 text-slate-300 px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed markdown-body shadow-md";
            bubble.innerHTML = window.marked ? window.marked.parse(text) : text;
        }
        wrap.appendChild(bubble);
        els.chatMessages.appendChild(wrap);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function addTypingIndicator() {
        if (!els.chatMessages) return;
        const typingWrap = document.createElement("div");
        typingWrap.className = "flex justify-start mt-2 socratic-typing shrink-0";
        typingWrap.innerHTML = `<div class="bg-slate-900 border border-slate-800 px-3 py-2 rounded-2xl flex items-center space-x-1 shadow-md"><div class="w-1 h-1 bg-purple-500 rounded-full animate-bounce"></div><div class="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0.15s"></div><div class="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></div></div>`;
        els.chatMessages.appendChild(typingWrap);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        if (!els.chatMessages) return;
        const indicator = els.chatMessages.querySelector('.socratic-typing');
        if (indicator) indicator.remove();
    }

    async function loadDynamicQuestion(mode) {
        appState.isChatLocked = true;
        els.chatInput.disabled = true;
        els.btnSend.disabled = true;
        if (els.btnMic) els.btnMic.disabled = true;

        addTypingIndicator();

        const tutor = window.PsychTutor;
        let generatedQuestion = null;

        if (tutor && typeof tutor.fetchGeneratedQuestion === 'function') {
            try {
                generatedQuestion = await tutor.fetchGeneratedQuestion(appState.lesson, mode);
            } catch (err) {
                console.warn('Failed to generate dynamic question, using fallback:', err);
            }
        }

        removeTypingIndicator();
        appState.isChatLocked = false;
        els.chatInput.disabled = false;
        els.btnSend.disabled = false;
        if (els.btnMic) els.btnMic.disabled = false;

        if (!generatedQuestion) {
            const mock = tutor.getMockFallback ? tutor.getMockFallback(appState.lessonId, appState.lesson.title, appState.lesson.concept, appState.lesson.clinical_tie_in, appState.lesson.feynman_prompt) : null;
            if (mode === 'socratic') {
                generatedQuestion = mock ? mock.socraticInit : `Socratic Check: Explain "${appState.lesson.concept}" and connect it to this real-world hook: ${appState.lesson.clinical_tie_in}`;
            } else {
                generatedQuestion = mock ? `Feynman Check: Please explain in simple terms (as if explaining to a 10-year-old child) the following core concept: "${appState.lesson.feynman_prompt}". Try to avoid technical jargon and use plain analogies.` : `Feynman Check: ${appState.lesson.feynman_prompt}`;
            }
        } else {
            if (mode === 'socratic') {
                generatedQuestion = `Socratic Check: ${generatedQuestion}`;
            } else {
                generatedQuestion = `Feynman Check: ${generatedQuestion}`;
            }
        }

        appState.messageHistory.push({ role: 'assistant', content: generatedQuestion });
        addMessage('assistant', generatedQuestion);
        saveSessionState(appState.lessonId, { stage: appState.stage, socraticCleared: appState.socraticCleared, sandboxCleared: appState.sandboxCleared }, appState.messageHistory);
    }

    async function onChatSubmit(event) {
        event.preventDefault();

        if (appState.isChatLocked) {
            return;
        }

        const mode = els.chatForm.dataset.mode;
        if (mode !== 'socratic' && mode !== 'feynman') {
            return;
        }

        const userInput = (els.chatInput.value || '').trim();
        if (!userInput) return;

        els.chatInput.value = '';
        addMessage('user', userInput);
        appState.messageHistory.push({ role: 'user', content: userInput });

        addTypingIndicator();

        let aiResult;
        if (mode === 'socratic') {
            aiResult = await window.PsychTutor.evaluateSocraticAnswer(appState.lessonId, appState.messageHistory, userInput, appState.syllabus);
        } else {
            aiResult = await window.PsychTutor.evaluateFeynmanExplanation(appState.lessonId, userInput, appState.syllabus);
        }

        removeTypingIndicator();
        addMessage('assistant', aiResult.feedback || 'No feedback provided.');
        appState.messageHistory.push({ role: 'assistant', content: aiResult.feedback || '' });

        saveSessionState(appState.lessonId, { stage: appState.stage, socraticCleared: appState.socraticCleared, sandboxCleared: appState.sandboxCleared }, appState.messageHistory);

        if (mode === 'socratic' && aiResult.passed === true) {
            appState.socraticCleared = true;
            if (window.PsychGamification) {
                window.PsychGamification.awardXP(20, 'socratic', els.btnSend);
                window.PsychGamification.incrementStat('socraticCleared');
            }
            setTimeout(() => {
                alert("Socratic clearance verified! Stage 3 Sandbox simulation is now unlocked.");
                setStage(STAGE_SANDBOX);
            }, 600);
        }

        if (mode === 'feynman' && aiResult.passed === true) {
            appState.feynmanCleared = true;
            if (window.PsychGamification) {
                window.PsychGamification.awardXP(30, 'feynman', els.btnSend);
                window.PsychGamification.incrementStat('feynmanCleared');
            }
            
            // Update Mastery Matrix in LocalStorage to HW Pending
            updateLessonState(appState.lessonId, STATE_HW_PENDING);

            // Display completion overlay
            if (els.masterCtaOverlay) els.masterCtaOverlay.classList.remove('hidden');
            appState.isChatLocked = true;

            // Update sidebar
            appState.matrix = initMasteryMatrix(appState.syllabus);
            renderSidebar(appState.syllabus, appState.matrix);
        }
    }

    // Handles Stage 3 Sandbox loading based on lessonId
    function loadSandbox() {
        els.sandboxViewport.innerHTML = '';
        els.sandboxStatusBadge.textContent = appState.sandboxCleared ? "COMPLETED" : "UNRESOLVED";
        els.sandboxStatusBadge.className = appState.sandboxCleared 
            ? "text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded px-1.5 py-0.5" 
            : "text-[9px] font-mono bg-slate-850 text-slate-400 border border-slate-800 rounded px-1.5 py-0.5";

        if (!appState.socraticCleared) {
            els.sandboxViewport.innerHTML = `<div class="text-center text-slate-500 text-xs"><i class="fa-solid fa-lock mr-2"></i> Solve the Socratic chat dialogue in Stage 2 to launch this lab sandbox.</div>`;
            return;
        }

        renderSandboxWidget(appState.lessonId);
    }

    // Renders the correct interactive laboratory sandbox
    function renderSandboxWidget(id) {
        // Core handler for specific widgets or fallback sandbox generator
        switch (id) {
            case 'lesson_1_1':
                // PERSPECTIVE CATEGORIZER
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-tags"></i> Perspective Categorizer</div>
                        <p class="text-slate-300">Identify the correct theoretical lens for this clinical observation:</p>
                        <div class="bg-slate-950 p-3 rounded border border-slate-800 text-slate-200 min-h-16 font-mono text-[11px]" id="sandbox-case-text">
                            "A patient displays acute fear responses during public speaking due to conditioning from past social failures."
                        </div>
                        <div class="grid grid-cols-3 gap-2" id="sandbox-options">
                            <button onclick="window.checkSandboxPerspective('Biological')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Biological</button>
                            <button onclick="window.checkSandboxPerspective('Behavioral')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Behavioral</button>
                            <button onclick="window.checkSandboxPerspective('Cognitive')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Cognitive</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 h-4"></div>
                    </div>
                `;
                let caseIdx = 0;
                const cases = [
                    { text: "A patient displays acute fear responses during public speaking due to conditioning from past social failures.", answer: "Behavioral" },
                    { text: "A patient reports persistent sadness, which neural scans link to chemical neurotransmission imbalances of serotonin.", answer: "Biological" },
                    { text: "A patient struggles with self-doubt arising from automatic cognitive biases and beliefs of worthlessness.", answer: "Cognitive" }
                ];
                window.checkSandboxPerspective = (choice) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (choice === cases[caseIdx].answer) {
                        caseIdx++;
                        if (caseIdx >= cases.length) {
                            feedback.textContent = "All sorted correctly! Lab complete.";
                            completeSandbox();
                        } else {
                            feedback.textContent = "Correct! Loading next case...";
                            document.getElementById('sandbox-case-text').textContent = `"${cases[caseIdx].text}"`;
                        }
                    } else {
                        feedback.textContent = "Incorrect. Try a different perspective.";
                    }
                };
                break;

            case 'lesson_1_2':
                // RESEARCH METHODS CORRELATION VS CAUSATION SIMULATOR
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-chart-line"></i> Correlation vs Causation Lab</div>
                        <p class="text-slate-300">Set correlation coefficient 'r' and test confounding variable impacts.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Correlation Coefficient (r): <span id="r-val" class="font-bold text-purple-400">0.00</span></span>
                                </label>
                                <input type="range" min="-100" max="100" value="0" id="corr-slider" oninput="window.updateCorr(this.value)" class="w-full accent-purple-500">
                            </div>
                            <label class="flex items-center space-x-2 text-[10px] text-slate-400 cursor-pointer">
                                <input type="checkbox" id="confound-chk" class="accent-purple-500">
                                <span>Introduce Confounding Variable (e.g., socioeconomic status)</span>
                            </label>
                        </div>
                        <button onclick="window.verifyCorrelation()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Causality</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Set strong correlation (r &gt; 0.80) and test logic.</div>
                    </div>
                `;
                window.updateCorr = (val) => {
                    document.getElementById('r-val').textContent = (val / 100).toFixed(2);
                };
                window.verifyCorrelation = () => {
                    const r = parseFloat(document.getElementById('r-val').textContent);
                    const confound = document.getElementById('confound-chk').checked;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (Math.abs(r) >= 0.80 && confound) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Strong correlation with a confounder proves association is not causation. Lab complete.";
                        completeSandbox();
                    } else if (Math.abs(r) < 0.80) {
                        feedback.textContent = "Increase correlation intensity to establish a strong association first.";
                    } else {
                        feedback.textContent = "What about third-variable problems? Check the confounding variable box.";
                    }
                };
                break;

            case 'lesson_1_3':
                // STATISTICS & ETHICS P-VALUE LAB
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-square-poll-vertical"></i> Statistical Significance Lab</div>
                        <p class="text-slate-300">Calibrate sample size and effect size to achieve statistical significance (p &lt; 0.05).</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Sample Size (N): <span id="n-val" class="font-bold text-purple-400">10</span></span>
                                </label>
                                <input type="range" min="10" max="300" value="10" oninput="window.calcSig(this.value, null)" id="n-slider" class="w-full accent-purple-500">
                            </div>
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Effect Size (Cohen's d): <span id="d-val" class="font-bold text-purple-400">0.10</span></span>
                                </label>
                                <input type="range" min="10" max="150" value="10" oninput="window.calcSig(null, this.value)" id="d-slider" class="w-full accent-purple-500">
                            </div>
                            <div class="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px]">
                                <span>Calculated p-value:</span>
                                <span id="p-val" class="font-bold text-red-400">0.450</span>
                            </div>
                        </div>
                        <button onclick="window.verifyStats()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify & Debrief Study</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Adjust parameters to force p &lt; 0.05.</div>
                    </div>
                `;
                window.calcSig = (n, d) => {
                    const N = parseInt(n || document.getElementById('n-slider').value);
                    const D = parseInt(d || document.getElementById('d-slider').value) / 100;
                    document.getElementById('n-val').textContent = N;
                    document.getElementById('d-val').textContent = D.toFixed(2);
                    
                    // Simple mock p-value logic: larger N and larger D decrease p
                    const mockP = Math.max(0.001, Math.min(0.999, 0.5 - (D * Math.sqrt(N) * 0.1)));
                    const pEl = document.getElementById('p-val');
                    pEl.textContent = mockP.toFixed(3);
                    if (mockP < 0.05) {
                        pEl.className = "font-bold text-emerald-400";
                    } else {
                        pEl.className = "font-bold text-red-400";
                    }
                };
                window.verifyStats = () => {
                    const pVal = parseFloat(document.getElementById('p-val').textContent);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (pVal < 0.05) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Success!</span> p-value statistically significant. Institutional Review Board (IRB) ethical debriefing cleared. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Statistical power is too low. Increase sample size or effect size to achieve p < 0.05.";
                    }
                };
                window.calcSig();
                break;

            case 'lesson_2_1':
                // AXON FIRING SIMULATOR
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-bolt"></i> Nerve Action Potential Lab</div>
                        <div class="flex items-center justify-between font-mono bg-slate-950 p-3 border border-slate-800 rounded">
                            <div>Voltage: <span id="volt-val" class="font-bold text-purple-400">-70</span> mV</div>
                            <div>State: <span id="pot-state" class="font-bold text-slate-500">RESTING</span></div>
                        </div>
                        <div class="space-y-2">
                            <button onclick="window.stimulateNeuron(10)" class="w-full py-2 bg-slate-800 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-700 transition">Apply Weak Stimulus (+10 mV)</button>
                            <button onclick="window.stimulateNeuron(25)" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Apply Threshold Stimulus (+25 mV)</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Neuron must cross -55mV threshold to fire.</div>
                    </div>
                `;
                let voltage = -70;
                window.stimulateNeuron = (amount) => {
                    voltage += amount;
                    const voltEl = document.getElementById('volt-val');
                    const stateEl = document.getElementById('pot-state');
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    if (voltage >= -55) {
                        voltEl.textContent = "+40";
                        stateEl.textContent = "FIRING!";
                        stateEl.className = "font-bold text-emerald-400";
                        feedback.textContent = "Depolarization complete! Action potential triggered successfully.";
                        setTimeout(() => {
                            voltEl.textContent = "-70";
                            stateEl.textContent = "RESTING";
                            stateEl.className = "font-bold text-slate-500";
                            completeSandbox();
                        }, 1200);
                    } else {
                        voltEl.textContent = voltage;
                        stateEl.textContent = "HYPERPOLARIZING";
                        stateEl.className = "font-bold text-amber-500";
                        feedback.textContent = "Sub-threshold stimulus. Voltage decays back to resting.";
                        setTimeout(() => {
                            voltage = -70;
                            voltEl.textContent = voltage;
                            stateEl.textContent = "RESTING";
                            stateEl.className = "font-bold text-slate-500";
                        }, 1000);
                    }
                };
                break;

            case 'lesson_2_2':
                // AGONIST VS ANTAGONIST NEUROCHEMISTRY MATCHING
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-capsules"></i> Agonist vs Antagonist Mechanisms</div>
                        <p class="text-slate-300">Match the drug category to its receptor synapse mechanism:</p>
                        <div class="space-y-2" id="mechanism-cards">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. Curare (Blocks Acetylcholine receptors)</span>
                                <select id="mech-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="agonist">Agonist</option>
                                    <option value="antagonist">Antagonist</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. SSRI (Prevents Serotonin reuptake)</span>
                                <select id="mech-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="agonist">Agonist</option>
                                    <option value="antagonist">Antagonist</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>3. L-Dopa (Increases Dopamine synthesis)</span>
                                <select id="mech-3" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="agonist">Agonist</option>
                                    <option value="antagonist">Antagonist</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyMechanism()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Mechanisms</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Classify each pharmacology action correctly.</div>
                    </div>
                `;
                window.verifyMechanism = () => {
                    const m1 = document.getElementById('mech-1').value;
                    const m2 = document.getElementById('mech-2').value;
                    const m3 = document.getElementById('mech-3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (m1 === 'antagonist' && m2 === 'agonist' && m3 === 'agonist') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Antagonists decrease neurotransmission while agonists enhance it. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. Recall: blocking reuptake leaves more neurotransmitters in the cleft, acting as an agonist.";
                    }
                };
                break;

            case 'lesson_2_3':
                // AUTONOMIC BALANCE SLIDER SIMULATOR
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-heart-pulse"></i> Autonomic Nervous Balance</div>
                        <p class="text-slate-300">Set dials to activate the "Fight-or-Flight" Sympathetic response.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Heart Rate: <span id="hr-label" class="font-mono text-purple-400">70 bpm</span></span>
                                </label>
                                <input type="range" min="60" max="180" value="70" id="hr-slider" oninput="document.getElementById('hr-label').textContent=this.value+' bpm'" class="w-full accent-purple-500">
                            </div>
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Digestion Action: <span id="dig-label" class="font-mono text-purple-400">Normal</span></span>
                                </label>
                                <input type="range" min="0" max="2" value="1" id="dig-slider" oninput="document.getElementById('dig-label').textContent=['Inhibited','Normal','Accelerated'][this.value]" class="w-full accent-purple-500">
                            </div>
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Pupil Dilation: <span id="pupil-label" class="font-mono text-purple-400">Normal</span></span>
                                </label>
                                <input type="range" min="0" max="2" value="1" id="pup-slider" oninput="document.getElementById('pupil-label').textContent=['Constricted','Normal','Dilated'][this.value]" class="w-full accent-purple-500">
                            </div>
                        </div>
                        <button onclick="window.verifyAutonomic()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify State</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Sympathetic response requires high heart rate, inhibited digestion, and dilated pupils.</div>
                    </div>
                `;
                window.verifyAutonomic = () => {
                    const hr = parseInt(document.getElementById('hr-slider').value);
                    const dig = parseInt(document.getElementById('dig-slider').value);
                    const pup = parseInt(document.getElementById('pup-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (hr >= 120 && dig === 0 && pup === 2) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Sympathetic division successfully calibrated. Epinephrine release active. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Calibrations incorrect. Sympathetic activation raises heart rate and dilates pupils while shutting down digestion.";
                    }
                };
                break;

            case 'lesson_2_4':
                // BRAIN LOBES MAPPING GAME
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-brain"></i> Cerebral Cortical Lobes Mapping</div>
                        <p class="text-slate-300">Map the correct lobe to its principal functional center:</p>
                        <div class="space-y-2">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. Primary Visual Cortex (Sights)</span>
                                <select id="lobe-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Select...</option>
                                    <option value="frontal">Frontal Lobe</option>
                                    <option value="parietal">Parietal Lobe</option>
                                    <option value="occipital">Occipital Lobe</option>
                                    <option value="temporal">Temporal Lobe</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. Somatosensory Strip (Body sensations)</span>
                                <select id="lobe-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Select...</option>
                                    <option value="frontal">Frontal Lobe</option>
                                    <option value="parietal">Parietal Lobe</option>
                                    <option value="occipital">Occipital Lobe</option>
                                    <option value="temporal">Temporal Lobe</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>3. Motor Strip / Prefrontal Cortex (Planning/actions)</span>
                                <select id="lobe-3" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Select...</option>
                                    <option value="frontal">Frontal Lobe</option>
                                    <option value="parietal">Parietal Lobe</option>
                                    <option value="occipital">Occipital Lobe</option>
                                    <option value="temporal">Temporal Lobe</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyLobes()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Lobe Matrix</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correctly associate cortex structures with visual, sensory, and motor planning zones.</div>
                    </div>
                `;
                window.verifyLobes = () => {
                    const l1 = document.getElementById('lobe-1').value;
                    const l2 = document.getElementById('lobe-2').value;
                    const l3 = document.getElementById('lobe-3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (l1 === 'occipital' && l2 === 'parietal' && l3 === 'frontal') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Occipital maps visual signals, Parietal processes touch, and Frontal manages planning and motor execution. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect mappings. Review where visual information goes and which strip contains the sensory inputs.";
                    }
                };
                break;

            case 'lesson_2_5':
                // BRAIN IMAGING SELECTOR DIAGNOSIS
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-magnifying-glass-chart"></i> Clinical Neuroimaging Diagnostic Select</div>
                        <p class="text-slate-300">Choose the optimal brain imaging technique for this clinical prompt:</p>
                        <div class="bg-slate-950 p-3 rounded border border-slate-800 text-slate-200 min-h-12 font-mono text-[11px]" id="sandbox-scan-prompt">
                            "Track rapid seizure brainwave oscillations millisecond-by-millisecond."
                        </div>
                        <div class="grid grid-cols-2 gap-2" id="sandbox-imaging-opts">
                            <button onclick="window.checkScanDiag('EEG')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">EEG</button>
                            <button onclick="window.checkScanDiag('fMRI')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">fMRI</button>
                            <button onclick="window.checkScanDiag('PET')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">PET Scan</button>
                            <button onclick="window.checkScanDiag('CT')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">CT Scan</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 h-4 text-center">Match scanning techniques to diagnostic priorities.</div>
                    </div>
                `;
                let scanIdx = 0;
                const scans = [
                    { text: "Track rapid seizure brainwave oscillations millisecond-by-millisecond.", ans: "EEG" },
                    { text: "Observe active local oxygen levels changes in real-time as a student reads a book.", ans: "fMRI" },
                    { text: "Locate structural skull bone fractures or heavy bleeding rapidly in emergency trauma.", ans: "CT" }
                ];
                window.checkScanDiag = (choice) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (choice === scans[scanIdx].ans) {
                        scanIdx++;
                        if (scanIdx >= scans.length) {
                            feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Success!</span> Diagnostic imaging match matrix fully verified. Lab complete.";
                            completeSandbox();
                        } else {
                            feedback.textContent = "Correct diagnostic rationale! Loading next case...";
                            document.getElementById('sandbox-scan-prompt').textContent = `"${scans[scanIdx].text}"`;
                        }
                    } else {
                        feedback.textContent = "Incorrect scanner type selected for this case profile.";
                    }
                };
                break;

            case 'lesson_3_1':
                // VISION OPPONENT-PROCESS AFTERIMAGE
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4 text-center">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px] text-left"><i class="fa-solid fa-eye"></i> Opponent-Process Afterimage Lab</div>
                        <p class="text-slate-300 text-left">Stare at the green block below for 5 seconds, then select the afterimage color.</p>
                        <div id="color-box" class="w-24 h-24 bg-green-500 mx-auto rounded shadow-lg border border-white/20 transition-all duration-300"></div>
                        <button onclick="window.startAfterimageTimer()" id="btn-stare-start" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Start Stare (5s)</button>
                        <div class="grid grid-cols-4 gap-2 hidden" id="afterimage-choices">
                            <button onclick="window.checkAfterimage('Red')" class="py-2 bg-red-600 rounded text-white font-bold">Red</button>
                            <button onclick="window.checkAfterimage('Green')" class="py-2 bg-green-600 rounded text-white font-bold">Green</button>
                            <button onclick="window.checkAfterimage('Blue')" class="py-2 bg-blue-600 rounded text-white font-bold">Blue</button>
                            <button onclick="window.checkAfterimage('Yellow')" class="py-2 bg-yellow-500 rounded text-black font-bold">Yellow</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400">Green pathways will adapt and fatigue, yielding afterimages.</div>
                    </div>
                `;
                window.startAfterimageTimer = () => {
                    const btn = document.getElementById('btn-stare-start');
                    const colorBox = document.getElementById('color-box');
                    btn.disabled = true;
                    btn.textContent = "Staring... Keep eyes locked!";
                    let sec = 5;
                    const timer = setInterval(() => {
                        sec--;
                        if (sec <= 0) {
                            clearInterval(timer);
                            colorBox.style.backgroundColor = '#ffffff'; // Go to pure white
                            btn.classList.add('hidden');
                            document.getElementById('afterimage-choices').classList.remove('hidden');
                            document.getElementById('sandbox-feedback').textContent = "What color does the white square appear to have?";
                        } else {
                            btn.textContent = `Staring... (${sec}s remaining)`;
                        }
                    }, 1000);
                };
                window.checkAfterimage = (color) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (color === 'Red') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Staring at green fatigued green ganglion pathways, revealing a red opponent afterimage. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. Remember green pairs with red, and yellow pairs with blue.";
                    }
                };
                break;

            case 'lesson_3_2':
                // AUDITION & PAIN GATE-CONTROL FIBER ACTIVATION
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-hand-holding-medical"></i> Gate-Control Spinal Cord Lab</div>
                        <p class="text-slate-300">Stimulate large fibers to close the pain gate at the spinal cord level.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Nociceptive Input (Small Fibers): <span id="small-fiber-label" class="font-bold text-red-400">80%</span></span>
                                </label>
                                <input type="range" min="50" max="100" value="80" disabled class="w-full accent-red-500">
                            </div>
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Mechanoreceptor Input (Large Fibers): <span id="large-fiber-label" class="font-bold text-purple-450">10%</span></span>
                                </label>
                                <input type="range" min="0" max="100" value="10" id="large-fiber-slider" oninput="window.updateLargeFiber(this.value)" class="w-full accent-purple-500">
                            </div>
                            <div class="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px]">
                                <span>Spinal Pain Gate State:</span>
                                <span id="gate-state" class="font-bold text-red-400">OPEN (Pain Felt)</span>
                            </div>
                        </div>
                        <button onclick="window.verifyPainGate()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Lock Spinal Gate</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Increase mechanoreceptor stimulation to close the pain transmission gate.</div>
                    </div>
                `;
                window.updateLargeFiber = (val) => {
                    document.getElementById('large-fiber-label').textContent = val + '%';
                    const gate = document.getElementById('gate-state');
                    if (parseInt(val) >= 70) {
                        gate.textContent = "CLOSED (Anesthesia)";
                        gate.className = "font-bold text-emerald-400";
                    } else {
                        gate.textContent = "OPEN (Pain Felt)";
                        gate.className = "font-bold text-red-400";
                    }
                };
                window.verifyPainGate = () => {
                    const lFiber = parseInt(document.getElementById('large-fiber-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (lFiber >= 70) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Rubbing/massage stimulates large fibers, triggering spinal interneurons to block pain signaling. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Gate is open. Pain transmission remains active. Increase large fiber inputs.";
                    }
                };
                break;

            case 'lesson_3_3':
                // PERCEPTUAL ORGANIZATION MONOCULAR DEPTH CUES
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-shapes"></i> Size-Distance Invariant Calibration</div>
                        <p class="text-slate-300">Align linear perspective size cues to render both cylinders visually identical.</p>
                        <div class="bg-slate-950 p-4 rounded border border-slate-800 flex justify-around items-end h-32 relative">
                            <!-- Simple linear grid perspective lines -->
                            <div class="absolute inset-0 bg-gradient-to-t from-transparent via-purple-950/5 to-purple-900/10 pointer-events-none"></div>
                            <div class="w-8 bg-purple-600 rounded border border-purple-400 shadow-md" id="cyl-1" style="height: 40px;"></div>
                            <div class="w-8 bg-purple-600 rounded border border-purple-400 shadow-md transition-all duration-100" id="cyl-2" style="height: 80px;"></div>
                        </div>
                        <div>
                            <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>Adjust Back Cylinder Height: <span id="cyl-h-val" class="font-bold text-purple-400">80px</span></span>
                            </label>
                            <input type="range" min="30" max="100" value="80" id="cyl-slider" oninput="window.adjustCyl(this.value)" class="w-full accent-purple-500">
                        </div>
                        <button onclick="window.verifyDepthCues()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Scaling Balance</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Set the back cylinder to match the front (40px) to balance depth perception scaling.</div>
                    </div>
                `;
                window.adjustCyl = (val) => {
                    document.getElementById('cyl-h-val').textContent = val + 'px';
                    document.getElementById('cyl-2').style.height = val + 'px';
                };
                window.verifyDepthCues = () => {
                    const val = parseInt(document.getElementById('cyl-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (val >= 38 && val <= 42) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Adjusting physical size to match corrects the scale. Ponzo illusion rules verified. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Cylinders are not identical heights. Adjust back cylinder height closer to 40px.";
                    }
                };
                break;

            case 'lesson_3_4':
                // ATTENTION STROOP EFFECT REACTION TESTER
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4 text-center">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px] text-left"><i class="fa-solid fa-stopwatch"></i> Stroop Conflict Attention Lab</div>
                        <p class="text-slate-300 text-left">Click the button matching the <strong>print color</strong> of the word, NOT what it spells.</p>
                        <div id="stroop-text" class="text-3xl font-extrabold py-4 select-none tracking-widest text-red-500 bg-slate-950 rounded border border-slate-800">
                            BLUE
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <button onclick="window.checkStroop('Red')" class="py-2 bg-slate-850 hover:bg-red-600/30 rounded font-semibold border border-slate-700 text-red-400">Red</button>
                            <button onclick="window.checkStroop('Green')" class="py-2 bg-slate-850 hover:bg-green-600/30 rounded font-semibold border border-slate-700 text-green-400">Green</button>
                            <button onclick="window.checkStroop('Blue')" class="py-2 bg-slate-850 hover:bg-blue-600/30 rounded font-semibold border border-slate-700 text-blue-400">Blue</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400">Incongruent stimuli slow down cognitive choice times.</div>
                    </div>
                `;
                let stroopStep = 0;
                const stroopRounds = [
                    { word: "BLUE", color: "Red", textDisplay: "BLUE" },
                    { word: "RED", color: "Green", textDisplay: "RED" },
                    { word: "GREEN", color: "Blue", textDisplay: "GREEN" }
                ];
                window.checkStroop = (color) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    const targetColor = stroopRounds[stroopStep].color;
                    
                    if (color === targetColor) {
                        stroopStep++;
                        if (stroopStep >= stroopRounds.length) {
                            feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Stroop response selection finished successfully. Lab complete.";
                            completeSandbox();
                        } else {
                            feedback.textContent = "Correct! Get ready for next conflict...";
                            const next = stroopRounds[stroopStep];
                            const textEl = document.getElementById('stroop-text');
                            textEl.textContent = next.textDisplay;
                            // Update display colors dynamically based on class replacement
                            textEl.className = `text-3xl font-extrabold py-4 select-none tracking-widest bg-slate-950 rounded border border-slate-800 ${
                                next.color === 'Red' ? 'text-red-500' : next.color === 'Green' ? 'text-green-500' : 'text-blue-500'
                            }`;
                        }
                    } else {
                        feedback.textContent = "Incorrect. Pay attention to the INK COLOR only, ignoring the letters.";
                    }
                };
                // Initial styling bind
                document.getElementById('stroop-text').className = "text-3xl font-extrabold py-4 select-none tracking-widest text-red-500 bg-slate-950 rounded border border-slate-800";
                break;

            case 'lesson_3_5':
                // SLEEP STAGES EEG WAVE MATCHER
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-wave-square"></i> EEG Sleep Wave Lab</div>
                        <p class="text-slate-300">Identify the NREM sleep stage from the current EEG description:</p>
                        <div class="bg-slate-950 p-3 rounded border border-slate-800 text-slate-200 min-h-12 font-mono text-[11px]" id="sandbox-wave-prompt">
                            "Presence of sleep spindles and K-complex wave spikes."
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <button onclick="window.checkSleepStage('NREM-1')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">NREM-1</button>
                            <button onclick="window.checkSleepStage('NREM-2')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">NREM-2</button>
                            <button onclick="window.checkSleepStage('NREM-3')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">NREM-3</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 h-4 text-center">Correctly classify electrical EEG biomarkers of sleep levels.</div>
                    </div>
                `;
                let sleepIdx = 0;
                const sleepPrompts = [
                    { text: "Presence of sleep spindles and K-complex wave spikes.", stage: "NREM-2" },
                    { text: "Slow high-amplitude delta brain waves (deepest sleep).", stage: "NREM-3" },
                    { text: "Fleeting theta waves showing light transition into slumber.", stage: "NREM-1" }
                ];
                window.checkSleepStage = (choice) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (choice === sleepPrompts[sleepIdx].stage) {
                        sleepIdx++;
                        if (sleepIdx >= sleepPrompts.length) {
                            feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Success!</span> Sleep polysomnography cleared. Lab complete.";
                            completeSandbox();
                        } else {
                            feedback.textContent = "Correct stage marker! Loading next EEG track...";
                            document.getElementById('sandbox-wave-prompt').textContent = `"${sleepPrompts[sleepIdx].text}"`;
                        }
                    } else {
                        feedback.textContent = "Incorrect sleep stage. Review wave hallmarks.";
                    }
                };
                break;

            case 'lesson_3_6':
                // DRUGS & NEUROCHEMISTRY SELECTOR
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-pills"></i> Drug Synaptic Mechanism Lab</div>
                        <p class="text-slate-300">Correctly pair each substance to its principal synaptic pathway:</p>
                        <div class="space-y-2">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. Cocaine</span>
                                <select id="drug-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="da">Blocks Dopamine Reuptake</option>
                                    <option value="gaba">Enhances GABA Inhibition</option>
                                    <option value="op">Mimics Endorphins</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. Alcohol</span>
                                <select id="drug-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="da">Blocks Dopamine Reuptake</option>
                                    <option value="gaba">Enhances GABA Inhibition</option>
                                    <option value="op">Mimics Endorphins</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>3. Heroin</span>
                                <select id="drug-3" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="da">Blocks Dopamine Reuptake</option>
                                    <option value="gaba">Enhances GABA Inhibition</option>
                                    <option value="op">Mimics Endorphins</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyDrugsSynapse()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Neurotransmitters</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Understand how psychoactive drugs alter homeostasis.</div>
                    </div>
                `;
                window.verifyDrugsSynapse = () => {
                    const d1 = document.getElementById('drug-1').value;
                    const d2 = document.getElementById('drug-2').value;
                    const d3 = document.getElementById('drug-3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (d1 === 'da' && d2 === 'gaba' && d3 === 'op') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Cocaine increases synaptic dopamine, Alcohol boosts GABA, and Heroin binds to endorphin receptors. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Mechanism error. Recall that alcohol slows neural processing via GABA pathways.";
                    }
                };
                break;

            case 'lesson_4_1':
                // PARENTING STYLE QUADRANT
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-users-rectangle"></i> Parenting Styles Quadrant</div>
                        <p class="text-slate-300">Set sliders to calibrate rules and warmth to reach the **Authoritative** style.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Demandingness (Rules/Control): <span id="rules-label" class="font-bold text-purple-450">50%</span></span>
                                </label>
                                <input type="range" min="0" max="100" value="50" id="rules-slider" oninput="document.getElementById('rules-label').textContent=this.value+'%'" class="w-full accent-purple-500">
                            </div>
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Responsiveness (Warmth/Support): <span id="warmth-label" class="font-bold text-purple-450">50%</span></span>
                                </label>
                                <input type="range" min="0" max="100" value="50" id="warmth-slider" oninput="document.getElementById('warmth-label').textContent=this.value+'%'" class="w-full accent-purple-500">
                            </div>
                        </div>
                        <button onclick="window.verifyParenting()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Development Environment</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Authoritative parenting requires high demandingness AND high responsiveness.</div>
                    </div>
                `;
                window.verifyParenting = () => {
                    const rules = parseInt(document.getElementById('rules-slider').value);
                    const warmth = parseInt(document.getElementById('warmth-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (rules >= 70 && warmth >= 70) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Authoritative quadrant secured. Associated with healthy self-esteem. Lab complete.";
                        completeSandbox();
                    } else if (rules >= 70) {
                        feedback.textContent = "High Demandingness with low Warmth is Authoritarian. Raise responsiveness.";
                    } else if (warmth >= 70) {
                        feedback.textContent = "High Warmth with low rules is Permissive. Raise demandingness.";
                    } else {
                        feedback.textContent = "Low settings represent the uninvolved parenting profile. Raise both parameters.";
                    }
                };
                break;

            case 'lesson_4_2':
                // COGNITIVE DEVELOPMENT PIAGET WATER CONSERVATION
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4 text-center">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px] text-left"><i class="fa-solid fa-glass-water"></i> Piagetian Conservation Lab</div>
                        <p class="text-slate-300 text-left">Pour water from a short wide beaker into a tall narrow cylinder. Select the child's age profile to test conservation.</p>
                        
                        <div class="bg-slate-950 p-4 rounded border border-slate-800 flex justify-center items-end space-x-6 h-28">
                            <div class="flex flex-col items-center">
                                <div class="w-12 bg-blue-500/80 border border-blue-300 transition-all duration-500" id="beaker-wide" style="height: 30px;"></div>
                                <span class="text-[8px] text-slate-500 font-mono mt-1">Wide Beaker</span>
                            </div>
                            <div class="flex flex-col items-center">
                                <div class="w-6 bg-blue-500/10 border border-blue-500/30 transition-all duration-500" id="beaker-tall" style="height: 0px;"></div>
                                <span class="text-[8px] text-slate-500 font-mono mt-1">Tall Cylinder</span>
                            </div>
                        </div>
                        
                        <div class="space-y-2">
                            <button onclick="window.pourWater()" id="btn-pour" class="w-full py-1.5 bg-slate-850 hover:bg-slate-800 rounded font-semibold text-slate-350 border border-slate-700 transition">Pour Liquid</button>
                            <div class="flex space-x-2">
                                <button onclick="window.checkConservation(4)" class="w-1/2 py-2 bg-purple-650 hover:bg-purple-600 rounded font-bold text-white text-xs">Test Age 4 child</button>
                                <button onclick="window.checkConservation(9)" class="w-1/2 py-2 bg-purple-650 hover:bg-purple-600 rounded font-bold text-white text-xs">Test Age 9 child</button>
                            </div>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400">Preoperational children focus centration on height alone.</div>
                    </div>
                `;
                let waterPoured = false;
                window.pourWater = () => {
                    if (waterPoured) return;
                    waterPoured = true;
                    document.getElementById('beaker-wide').style.height = '0px';
                    document.getElementById('beaker-wide').className = 'w-12 bg-blue-500/10 border border-blue-500/30 transition-all duration-500';
                    document.getElementById('beaker-tall').style.height = '60px';
                    document.getElementById('beaker-tall').className = 'w-6 bg-blue-500/80 border border-blue-300 transition-all duration-500';
                };
                window.checkConservation = (age) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (!waterPoured) {
                        feedback.textContent = "Pour the water into the cylinder first.";
                        return;
                    }
                    if (age === 9) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Concrete-operational children (ages 7+) recognize volume is conserved regardless of physical container profiles. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Age 4 (preoperational) children fail conservation, believing the tall cylinder holds more due to centration.";
                    }
                };
                break;

            case 'lesson_4_3':
                // ERIKSON PSYCHOSOCIAL STAGES MATCHING
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-timeline"></i> Erikson's Psychosocial Lifespan</div>
                        <p class="text-slate-300">Match the developmental age group to its core Eriksonian crisis:</p>
                        <div class="space-y-2">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. Adolescence (Teenagers)</span>
                                <select id="erik-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="trust">Trust vs Mistrust</option>
                                    <option value="identity">Identity vs Role Confusion</option>
                                    <option value="generativity">Generativity vs Stagnation</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. Adulthood (Middle age)</span>
                                <select id="erik-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="trust">Trust vs Mistrust</option>
                                    <option value="identity">Identity vs Role Confusion</option>
                                    <option value="generativity">Generativity vs Stagnation</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>3. Infancy (First year)</span>
                                <select id="erik-3" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="trust">Trust vs Mistrust</option>
                                    <option value="identity">Identity vs Role Confusion</option>
                                    <option value="generativity">Generativity vs Stagnation</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyErikson()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Psychosocial Matrix</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correctly order major life checkpoints.</div>
                    </div>
                `;
                window.verifyErikson = () => {
                    const e1 = document.getElementById('erik-1').value;
                    const e2 = document.getElementById('erik-2').value;
                    const e3 = document.getElementById('erik-3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (e1 === 'identity' && e2 === 'generativity' && e3 === 'trust') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Erikson stages mapped successfully. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. Recall that identity development is the key milestone of adolescence.";
                    }
                };
                break;

            case 'lesson_4_4':
                // GENDER SCHEMA STEREOTYPES SORTER
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-venus-mars"></i> Gender Schema Classification</div>
                        <p class="text-slate-300">Identify whether the factor is a **Biological Sex** trait or a **Gender Schema** cultural construct:</p>
                        <div class="space-y-2">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. XX vs XY Chromosomal makeup</span>
                                <select id="gen-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="sex">Biological Sex</option>
                                    <option value="schema">Gender Schema Construct</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. Direct socialization rules that "girls play with dolls"</span>
                                <select id="gen-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="sex">Biological Sex</option>
                                    <option value="schema">Gender Schema Construct</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyGenderSchema()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Classifications</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Distinguish biological characteristics from environmental gender constructs.</div>
                    </div>
                `;
                window.verifyGenderSchema = () => {
                    const g1 = document.getElementById('gen-1').value;
                    const g2 = document.getElementById('gen-2').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (g1 === 'sex' && g2 === 'schema') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Chromosomes are biological; toy preferences are cultural schema constructs. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect classification. Think which setting is physiological vs cognitive/learned.";
                    }
                };
                break;

            case 'lesson_5_1':
                // CLASSICAL CONDITIONING CS-US INTERVAL TIMER
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-bell"></i> Pavlovian Conditioning Interval</div>
                        <p class="text-slate-300">Set the timing interval between the CS (Bell) and US (Food) to optimize conditioning.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>CS-US Delay: <span id="delay-lbl" class="font-mono text-purple-400">4.0 seconds</span></span>
                                </label>
                                <input type="range" min="-20" max="100" value="40" id="delay-slider" oninput="document.getElementById('delay-lbl').textContent=(this.value/10).toFixed(1)+' seconds'" class="w-full accent-purple-500">
                            </div>
                            <div class="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px]">
                                <span>Conditioning Strength:</span>
                                <span id="cond-strength" class="font-bold text-red-400">Weak / No Association</span>
                            </div>
                        </div>
                        <button onclick="window.verifyConditioning()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Acquire Conditioned Response</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Aim for standard forward pairing (~0.5 seconds delay). Negative delay represents backward pairing.</div>
                    </div>
                `;
                window.updateCondDisplay = () => {
                    const delay = parseFloat(document.getElementById('delay-slider').value) / 10;
                    const strength = document.getElementById('cond-strength');
                    if (delay >= 0.2 && delay <= 0.8) {
                        strength.textContent = "MAXIMUM (Rapid Acquisition)";
                        strength.className = "font-bold text-emerald-400";
                    } else if (delay < 0) {
                        strength.textContent = "NONE (Backward Pairing fails)";
                        strength.className = "font-bold text-red-400";
                    } else {
                        strength.textContent = "Weak / No Association";
                        strength.className = "font-bold text-amber-500";
                    }
                };
                document.getElementById('delay-slider').addEventListener('input', window.updateCondDisplay);
                window.verifyConditioning = () => {
                    const delay = parseFloat(document.getElementById('delay-slider').value) / 10;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (delay >= 0.2 && delay <= 0.8) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> A half-second delay generates rapid forward conditioning acquisition. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Acquisition failed. Set the CS-US delay slider closer to 0.5 seconds.";
                    }
                };
                window.updateCondDisplay();
                break;

            case 'lesson_5_2':
                // OPERANT SKINNER BOX SCHEDULES
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-drumstick-bite"></i> Skinner Box Schedule Simulator</div>
                        <p class="text-slate-300">Identify which reinforcement schedule results in a high steady rate of lever presses with brief post-reinforcement pauses.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px]">
                            <div class="flex justify-between">
                                <span>1. Variable Ratio (e.g. slots)</span>
                                <span class="text-purple-400 font-bold">Unpredictable High Rate</span>
                            </div>
                            <div class="flex justify-between">
                                <span>2. Fixed Ratio (e.g. piecework)</span>
                                <span class="text-purple-400 font-bold">High Rate, Post-Reward Pause</span>
                            </div>
                            <div class="flex justify-between">
                                <span>3. Fixed Interval (e.g. exams)</span>
                                <span class="text-purple-400 font-bold">Scalloped Pattern</span>
                            </div>
                        </div>
                        <div class="grid grid-cols-4 gap-1 text-[9px]">
                            <button onclick="window.checkSchedule('FR')" class="py-1 bg-slate-850 border border-slate-700 rounded font-semibold text-slate-200">FR</button>
                            <button onclick="window.checkSchedule('VR')" class="py-1 bg-slate-850 border border-slate-700 rounded font-semibold text-slate-200">VR</button>
                            <button onclick="window.checkSchedule('FI')" class="py-1 bg-slate-850 border border-slate-700 rounded font-semibold text-slate-200">FI</button>
                            <button onclick="window.checkSchedule('VI')" class="py-1 bg-slate-850 border border-slate-700 rounded font-semibold text-slate-200">VI</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Select the abbreviation for the target schedule.</div>
                    </div>
                `;
                window.checkSchedule = (ans) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (ans === 'FR') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Fixed Ratio (FR) yields high response rates with a characteristic post-reinforcement pause. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect schedule response rate signature. Think of piecework reward counts.";
                    }
                };
                break;

            case 'lesson_5_3':
                // COGNITIVE Maze Learning Tolman
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-map-location-dot"></i> Tolman's Latent Learning Maze</div>
                        <p class="text-slate-300">Toggle food reward insertion to test Tolman's latent learning hypothesis.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div class="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Maze Trials:</span>
                                <span class="font-bold text-purple-400">Day 11 of 20</span>
                            </div>
                            <label class="flex items-center space-x-2 text-[10px] text-slate-400 cursor-pointer">
                                <input type="checkbox" id="maze-food-chk" class="accent-purple-500">
                                <span>Introduce Food Reward on Day 11</span>
                            </label>
                            <div class="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px]">
                                <span>Mouse Error Rate:</span>
                                <span id="error-rate" class="font-bold text-red-400">High (Searching)</span>
                            </div>
                        </div>
                        <button onclick="window.runMaze()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Run Maze Trials</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Introduce the reward to observe sudden error drop proving cognitive map existence.</div>
                    </div>
                `;
                window.runMaze = () => {
                    const food = document.getElementById('maze-food-chk').checked;
                    const err = document.getElementById('error-rate');
                    const feedback = document.getElementById('sandbox-feedback');
                    if (food) {
                        err.textContent = "Plummeted instantly to 0";
                        err.className = "font-bold text-emerald-400";
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> The mouse had built a latent cognitive map which was only demonstrated once reinforcement was offered. Lab complete.";
                        completeSandbox();
                    } else {
                        err.textContent = "Remains High (searching)";
                        feedback.textContent = "Without a reward, the mouse continues exploring with high mistakes. Toggle the food reward checkbox.";
                    }
                };
                break;

            case 'lesson_5_4':
                // WORKING MEMORY DIGIT SPAN
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4 text-center">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px] text-left"><i class="fa-solid fa-list-ol"></i> Digit Span Capacity Tester</div>
                        <p class="text-slate-300 text-left">Test your working memory capacity limit. Recall the sequence of numbers shown.</p>
                        <div id="digit-display" class="text-2xl font-bold font-mono py-4 text-purple-200 bg-slate-950 rounded border border-slate-800">
                            Ready
                        </div>
                        <div class="flex space-x-2 justify-center hidden" id="digit-input-wrap">
                            <input type="text" id="digit-input" class="bg-slate-950 border border-slate-800 rounded p-1.5 font-mono text-center text-sm w-36 uppercase" placeholder="Enter sequence">
                            <button onclick="window.verifyDigits()" class="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold">Submit</button>
                        </div>
                        <button onclick="window.startDigitSpan()" id="btn-digit-start" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Start Test</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400">Recall limits are typically 7±2 digits.</div>
                    </div>
                `;
                let spanLength = 4;
                let activeSeq = '';
                window.startDigitSpan = () => {
                    document.getElementById('btn-digit-start').classList.add('hidden');
                    activeSeq = Array.from({length: spanLength}, () => Math.floor(Math.random() * 10)).join('');
                    let idx = 0;
                    const disp = document.getElementById('digit-display');
                    disp.textContent = "Get ready...";
                    
                    const interval = setInterval(() => {
                        if (idx < activeSeq.length) {
                            disp.textContent = activeSeq[idx];
                            idx++;
                        } else {
                            clearInterval(interval);
                            disp.textContent = "?";
                            document.getElementById('digit-input-wrap').classList.remove('hidden');
                            document.getElementById('digit-input').focus();
                        }
                    }, 1000);
                };
                window.verifyDigits = () => {
                    const val = document.getElementById('digit-input').value.trim();
                    const feedback = document.getElementById('sandbox-feedback');
                    if (val === activeSeq) {
                        spanLength++;
                        document.getElementById('digit-input-wrap').classList.add('hidden');
                        document.getElementById('digit-input').value = '';
                        if (spanLength >= 7) {
                            feedback.textContent = `Excellent! Span reached ${spanLength - 1}. Lab complete.`;
                            completeSandbox();
                        } else {
                            feedback.textContent = `Correct! Next level: ${spanLength} digits.`;
                            document.getElementById('btn-digit-start').classList.remove('hidden');
                            document.getElementById('btn-digit-start').textContent = "Start Next Level";
                        }
                    } else {
                        feedback.textContent = `Incorrect. Sequence was ${activeSeq}. Limit identified at ${spanLength - 1}. Try again.`;
                        spanLength = 4;
                        document.getElementById('digit-input-wrap').classList.add('hidden');
                        document.getElementById('digit-input').value = '';
                        document.getElementById('btn-digit-start').classList.remove('hidden');
                        document.getElementById('btn-digit-start').textContent = "Restart Test";
                    }
                };
                break;

            case 'lesson_5_5':
                // INTERFERENCE BUILDER SIMULATION
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-shuffle"></i> Retroactive vs Proactive Interference</div>
                        <p class="text-slate-300">A student learns List A (French vocab), then learns List B (Spanish vocab). They are now tested on **List A** but keep writing Spanish words. Identify the type of interference:</p>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="window.checkInterference('retro')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Retroactive Interference</button>
                            <button onclick="window.checkInterference('pro')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Proactive Interference</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center h-4">Determine if new info blocks old (Retro), or old blocks new (Pro).</div>
                    </div>
                `;
                window.checkInterference = (ans) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (ans === 'retro') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Retroactive interference occurs when new memory traces (List B Spanish) block retrieval of older records (List A French). Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. Remember: Retroactive = New material blocks retro/old records.";
                    }
                };
                break;

            case 'lesson_6_1':
                // WASON SELECTION CARD TASK
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-puzzle-piece"></i> Wason Selection Task</div>
                        <p class="text-slate-300">Rule: "If a card has a vowel on one side, it must have an even number on the other side." Select the **two cards** you must flip to verify the rule:</p>
                        <div class="flex justify-around py-2">
                            <label class="flex flex-col items-center bg-slate-950 p-3 rounded border border-slate-800 cursor-pointer">
                                <span class="text-xl font-bold text-purple-400 mb-1">A</span>
                                <input type="checkbox" id="wason-1" class="accent-purple-500">
                            </label>
                            <label class="flex flex-col items-center bg-slate-950 p-3 rounded border border-slate-800 cursor-pointer">
                                <span class="text-xl font-bold text-purple-400 mb-1">D</span>
                                <input type="checkbox" id="wason-2" class="accent-purple-500">
                            </label>
                            <label class="flex flex-col items-center bg-slate-950 p-3 rounded border border-slate-800 cursor-pointer">
                                <span class="text-xl font-bold text-purple-400 mb-1">4</span>
                                <input type="checkbox" id="wason-3" class="accent-purple-500">
                            </label>
                            <label class="flex flex-col items-center bg-slate-950 p-3 rounded border border-slate-800 cursor-pointer">
                                <span class="text-xl font-bold text-purple-400 mb-1">7</span>
                                <input type="checkbox" id="wason-4" class="accent-purple-500">
                            </label>
                        </div>
                        <button onclick="window.verifyWason()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Selections</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Falsification criteria (Modus Tollens) requires checking the vowel AND the odd number.</div>
                    </div>
                `;
                window.verifyWason = () => {
                    const a = document.getElementById('wason-1').checked;
                    const d = document.getElementById('wason-2').checked;
                    const four = document.getElementById('wason-3').checked;
                    const seven = document.getElementById('wason-4').checked;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (a && seven && !d && !four) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> You must confirm the vowel matches (A) and ensure the odd card (7) does not have a vowel. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect cards. Think: what combination could falsify the vowel -> even rule?";
                    }
                };
                break;

            case 'lesson_6_2':
                // INTELLIGENCE IQ NORMAL CURVE
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-calculator"></i> IQ Normal Curve Standard Deviations</div>
                        <p class="text-slate-300">Calculate the IQ score corresponding to exactly **2 Standard Deviations (SD) above the mean** (Mean = 100, SD = 15).</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Calculated IQ Score:</span>
                                    <input type="number" id="iq-ans" class="bg-slate-900 border border-slate-800 rounded font-mono font-bold text-purple-400 p-1 w-20 text-center" placeholder="100">
                                </label>
                            </div>
                        </div>
                        <button onclick="window.verifyIQ()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Intelligence Math</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Score = Mean + 2 * SD.</div>
                    </div>
                `;
                window.verifyIQ = () => {
                    const val = parseInt(document.getElementById('iq-ans').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (val === 130) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> An IQ score of 130 is 2 standard deviations above the mean, placing in the 98th percentile. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect IQ score calculation. (100 + 2 * 15 = ?)";
                    }
                };
                break;

            case 'lesson_6_3':
                // MOTIVATION YERKES-DODSON
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-gauge"></i> Yerkes-Dodson Arousal Optimization</div>
                        <p class="text-slate-300">Balance arousal settings for a **highly complex, difficult cognitive exam** to maximize performance.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Physiological Arousal: <span id="arousal-lbl" class="font-bold text-purple-450">High</span></span>
                                </label>
                                <input type="range" min="0" max="2" value="2" id="arousal-slider" oninput="document.getElementById('arousal-lbl').textContent=['Low','Moderate','High'][this.value]" class="w-full accent-purple-500">
                            </div>
                        </div>
                        <button onclick="window.verifyArousal()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Check Performance Score</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Complex tasks are performed best under lower arousal to prevent distraction and anxiety.</div>
                    </div>
                `;
                window.verifyArousal = () => {
                    const val = parseInt(document.getElementById('arousal-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (val === 0) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Difficult tasks demand low arousal to prevent focus block. Easy tasks demand high arousal. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Performance fails. High/moderate arousal induces anxiety and blocks focus on complex tasks.";
                    }
                };
                break;

            case 'lesson_6_4':
                // EMOTION SEQUENCE THEORIES
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-face-smile"></i> Emotion Sequence Sorter</div>
                        <p class="text-slate-300">Arrange the events for the **James-Lange Theory** of emotion when encountering a bear:</p>
                        <div class="space-y-2 font-mono text-[11px]">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>A. Physiological Arousal (Heart racing)</span>
                                <select id="em-step-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose Step...</option>
                                    <option value="1">Step 1</option>
                                    <option value="2">Step 2</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>B. Subjective Emotion felt (Fear)</span>
                                <select id="em-step-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose Step...</option>
                                    <option value="1">Step 1</option>
                                    <option value="2">Step 2</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyEmotionSequence()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Sequence</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">James-Lange claims bodily symptoms occur first, driving the emotional response.</div>
                    </div>
                `;
                window.verifyEmotionSequence = () => {
                    const s1 = document.getElementById('em-step-1').value;
                    const s2 = document.getElementById('em-step-2').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (s1 === '1' && s2 === '2') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> James-Lange states that physiological arousal leads to the cognitive feeling of emotion. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. Remember: bodily feedback happens BEFORE the subjective feeling in James-Lange.";
                    }
                };
                break;

            case 'lesson_6_5':
                // ACHIEVEMENT MOTIVATION LOCUS DIAL
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-award"></i> Achievement Motivation & Locus Control</div>
                        <p class="text-slate-300">Set the slider to reflect an **Internal Locus of Control** where actions drive outcomes.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Locus Alignment: <span id="locus-lbl" class="font-bold text-purple-450">External (Fate)</span></span>
                                </label>
                                <input type="range" min="0" max="1" value="0" id="locus-slider" oninput="document.getElementById('locus-lbl').textContent=['External (Fate)','Internal (Personal Effort)'][this.value]" class="w-full accent-purple-500">
                            </div>
                        </div>
                        <button onclick="window.verifyLocus()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Control Beliefs</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Identify where reinforcement control is perceived to reside.</div>
                    </div>
                `;
                window.verifyLocus = () => {
                    const val = parseInt(document.getElementById('locus-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (val === 1) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Internal Locus of Control links effort directly to outcomes, boosting achievement drive. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. External alignment implies fate or luck controls events rather than self-directed effort.";
                    }
                };
                break;

            case 'lesson_7_1':
                // THEORIES OF PERSONALITY OCEAN SLIDERS
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-user-gear"></i> OCEAN Personality Profile</div>
                        <p class="text-slate-300">Increase trait levels to build a profile high in **Conscientiousness** (orderliness/discipline).</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Conscientiousness Level: <span id="c-lbl" class="font-mono text-purple-400">20%</span></span>
                                </label>
                                <input type="range" min="0" max="100" value="20" id="c-slider" oninput="document.getElementById('c-lbl').textContent=this.value+'%'" class="w-full accent-purple-500">
                            </div>
                        </div>
                        <button onclick="window.verifyOCEAN()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Save Profile</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Conscientiousness represents duty, organization, and self-discipline.</div>
                    </div>
                `;
                window.verifyOCEAN = () => {
                    const val = parseInt(document.getElementById('c-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (val >= 80) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Conscientiousness profile logged. High correlation with academic achievement. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Profile is low in task focus and organization. Set Conscientiousness slider higher than 80%.";
                    }
                };
                break;

            case 'lesson_7_2':
                // SOCIAL COGNITION COGNITIVE DISSONANCE DIAL
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-brain-circuit"></i> Cognitive Dissonance Study Simulator</div>
                        <p class="text-slate-300">Festinger boring peg-turning study. Select which payout group rated the task as **highly enjoyable** to reduce cognitive dissonance:</p>
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="window.checkDissonance('$1')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Paid $1 Group</button>
                            <button onclick="window.checkDissonance('$20')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Paid $20 Group</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center h-4">Identify which group had insufficient external justification to lie.</div>
                    </div>
                `;
                window.checkDissonance = (group) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (group === '$1') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> The $1 group lacked sufficient payment to lie, so they convinced themselves the task was genuinely fun to resolve internal distress. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. The $20 group had plenty of external justification (the cash), so they felt no pressure to change their attitude.";
                    }
                };
                break;

            case 'lesson_7_3':
                // SOCIAL INFLUENCE BYSTANDER CROWD SIMULATOR
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-users"></i> Bystander Effect Crowd Size</div>
                        <p class="text-slate-300">Increase the bystander group size to witness the **Diffusion of Responsibility** time latency curve.</p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Bystander Crowd Size: <span id="bystander-lbl" class="font-bold text-purple-450">1 Person</span></span>
                                </label>
                                <input type="range" min="1" max="15" value="1" id="bystander-slider" oninput="window.updateBystander(this.value)" class="w-full accent-purple-500">
                            </div>
                            <div class="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px]">
                                <span>Estimated Time to Help:</span>
                                <span id="help-time" class="font-bold text-emerald-400">12 seconds</span>
                            </div>
                        </div>
                        <button onclick="window.verifyBystander()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Simulate Emergency</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Increase crowd to show how response speed slows down.</div>
                    </div>
                `;
                window.updateBystander = (val) => {
                    document.getElementById('bystander-lbl').textContent = val + ' ' + (parseInt(val) === 1 ? 'Person' : 'People');
                    const time = document.getElementById('help-time');
                    const seconds = parseInt(val) * 15;
                    time.textContent = seconds + ' seconds';
                    if (parseInt(val) >= 10) {
                        time.className = "font-bold text-red-400";
                    } else {
                        time.className = "font-bold text-emerald-400";
                    }
                };
                window.verifyBystander = () => {
                    const val = parseInt(document.getElementById('bystander-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (val >= 10) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Large crowd size diffuses individual responsibility, raising response times. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Increase bystander count to at least 10 to demonstrate significant time latency.";
                    }
                };
                break;

            case 'lesson_7_4':
                // PRISONER'S DILEMMA GAME SIMULATOR
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-scale-balanced"></i> Prisoner's Dilemma Cooperation</div>
                        <p class="text-slate-300">Play against a "Tit-for-Tat" AI. Select **Cooperate** to achieve mutual positive social reward.</p>
                        <div class="flex justify-between items-center bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px]">
                            <div>Round: <span id="pd-round" class="text-purple-400">1 / 3</span></div>
                            <div>Outcome: <span id="pd-score" class="text-purple-450">Pending</span></div>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="window.pdPlay('cooperate')" class="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-semibold text-white transition">Cooperate</button>
                            <button onclick="window.pdPlay('defect')" class="w-1/2 py-2 bg-red-650 hover:bg-red-650 rounded font-semibold text-white transition">Defect</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Tit-for-tat mirrors your previous turn.</div>
                    </div>
                `;
                let pdRound = 1;
                let cooperations = 0;
                window.pdPlay = (choice) => {
                    const roundEl = document.getElementById('pd-round');
                    const scoreEl = document.getElementById('pd-score');
                    const feedback = document.getElementById('sandbox-feedback');
                    if (choice === 'cooperate') cooperations++;
                    
                    if (pdRound < 3) {
                        pdRound++;
                        roundEl.textContent = pdRound + " / 3";
                        scoreEl.textContent = "Round " + (pdRound - 1) + ": Cooperated";
                    } else {
                        if (cooperations === 3) {
                            feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Three rounds of mutual cooperation maximizes collective utility. Lab complete.";
                            completeSandbox();
                        } else {
                            feedback.textContent = "Defections caused mutual penalty. Restart and choose cooperate for all 3 rounds.";
                            pdRound = 1;
                            cooperations = 0;
                            roundEl.textContent = "1 / 3";
                            scoreEl.textContent = "Reset";
                        }
                    }
                };
                break;

            case 'lesson_8_1':
                // ANXIETY DSM-5 DIAGNOSIS CHECKLIST
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-list-check"></i> DSM-5 Anxiety Diagnostic Lab</div>
                        <p class="text-slate-300">Review patient chart: *"Chronic excessive worry for 6+ months about multiple life activities, muscle tension, restlessness, and sleep disruption."* Diagnose the condition:</p>
                        <div class="grid grid-cols-3 gap-2">
                            <button onclick="window.checkAnxietyDiag('GAD')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">GAD</button>
                            <button onclick="window.checkAnxietyDiag('Panic')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Panic Disorder</button>
                            <button onclick="window.checkAnxietyDiag('Phobia')" class="py-2 bg-slate-850 hover:bg-purple-900/40 rounded font-semibold text-slate-200 border border-slate-800 transition">Phobia</button>
                        </div>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center h-4">Verify diagnostic boundaries using DSM criteria.</div>
                    </div>
                `;
                window.checkAnxietyDiag = (ans) => {
                    const feedback = document.getElementById('sandbox-feedback');
                    if (ans === 'GAD') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Generalized Anxiety Disorder (GAD) is characterized by chronic, pervasive worry across multiple domains for at least 6 months. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. Panic disorder features sudden panic attacks; phobias feature specific triggers.";
                    }
                };
                break;

            case 'lesson_8_2':
                // MOOD/PSYCHOTIC SCHIZOPHRENIA SYMPTOMS CLASSIFIER
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-brain"></i> Schizophrenia Symptoms Sorter</div>
                        <p class="text-slate-300">Classify these diagnostic signs as either **Positive** (excess) or **Negative** (deficit) symptoms:</p>
                        <div class="space-y-2">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. Hallucinations (Auditory voices)</span>
                                <select id="schiz-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="pos">Positive Symptom</option>
                                    <option value="neg">Negative Symptom</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. Flat Affect (Lack of emotional expression)</span>
                                <select id="schiz-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Choose...</option>
                                    <option value="pos">Positive Symptom</option>
                                    <option value="neg">Negative Symptom</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifySchizSymptoms()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Symptoms</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Positive symptoms add behaviors; negative symptoms take them away.</div>
                    </div>
                `;
                window.verifySchizSymptoms = () => {
                    const s1 = document.getElementById('schiz-1').value;
                    const s2 = document.getElementById('schiz-2').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (s1 === 'pos' && s2 === 'neg') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Hallucinations are positive additions, flat affect represents a negative motivational/emotional deficit. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Incorrect. Hallucinations are additions (positive); emotional flattening is a deficit (negative).";
                    }
                };
                break;

            case 'lesson_8_3':
                // PERSONALITY CLUSTERS CLASSIFICATION
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-network-wired"></i> Personality Disorder Cluster Matching</div>
                        <p class="text-slate-300">Match the personality disorder categories to their DSM-5 descriptions:</p>
                        <div class="space-y-2 font-mono text-[11px]">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. Cluster A (Paranoid, Schizoid)</span>
                                <select id="clust-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Select...</option>
                                    <option value="odd">Odd / Eccentric</option>
                                    <option value="dramatic">Dramatic / Emotional</option>
                                    <option value="anxious">Anxious / Fearful</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. Cluster B (Antisocial, Borderline)</span>
                                <select id="clust-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Select...</option>
                                    <option value="odd">Odd / Eccentric</option>
                                    <option value="dramatic">Dramatic / Emotional</option>
                                    <option value="anxious">Anxious / Fearful</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyClusters()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Clusters</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Classify behavioral trends.</div>
                    </div>
                `;
                window.verifyClusters = () => {
                    const c1 = document.getElementById('clust-1').value;
                    const c2 = document.getElementById('clust-2').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (c1 === 'odd' && c2 === 'dramatic') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Cluster A houses odd, eccentric behaviors; Cluster B houses dramatic, erratic behaviors. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Cluster mismatch. Review personality classification axes.";
                    }
                };
                break;

            case 'lesson_8_4':
                // THERAPEUTIC MATCHING VIGNETTES
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-house-medical"></i> Therapy Modality Matching</div>
                        <p class="text-slate-300">Match the clinical target with the best intervention strategy:</p>
                        <div class="space-y-2">
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>1. Specific Phobia (Fear of spiders)</span>
                                <select id="ther-1" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Select...</option>
                                    <option value="exposure">Systematic Desensitization</option>
                                    <option value="cbt">Cognitive Restructuring</option>
                                </select>
                            </div>
                            <div class="p-2 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                                <span>2. Depression (Negative thought loops)</span>
                                <select id="ther-2" class="bg-slate-900 border border-slate-850 rounded text-purple-400 font-bold p-1">
                                    <option value="none">Select...</option>
                                    <option value="exposure">Systematic Desensitization</option>
                                    <option value="cbt">Cognitive Restructuring</option>
                                </select>
                            </div>
                        </div>
                        <button onclick="window.verifyTherapy()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Treatment Protocols</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correctly associate symptoms to clinical methodologies.</div>
                    </div>
                `;
                window.verifyTherapy = () => {
                    const t1 = document.getElementById('ther-1').value;
                    const t2 = document.getElementById('ther-2').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (t1 === 'exposure' && t2 === 'cbt') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Systematic desensitization solves phobias, while cognitive restructuring dismantles depressive schemas. Lab complete.";
                        completeSandbox();
                    } else {
                        feedback.textContent = "Therapy mismatch. Exposure protocols are best for extinguishing anxiety and phobias.";
                    }
                };
                break;

            default:
                // GENERAL DYNAMIC WIDGET LOADER FOR INTERMEDIATE SYLLABUS ENTRIES
                const lessonNumStr = appState.lesson ? appState.lesson.numStr : 'Concept';
                const conceptStr = appState.lesson ? appState.lesson.concept : 'General Psychology';
                const targetStr = appState.lesson ? appState.lesson.interactive_target : 'Alignment';
                els.sandboxViewport.innerHTML = `
                    <div class="w-full max-w-sm p-4 bg-slate-900 border border-purple-900/35 rounded-lg text-xs space-y-4">
                        <div class="font-bold text-purple-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-flask-vial"></i> Lesson ${lessonNumStr} Simulation</div>
                        <p class="text-slate-350">Interactive Lab Target: <span class="text-purple-300 font-semibold">${targetStr}</span></p>
                        <div class="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
                            <div>
                                <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Signal Calibration</span>
                                    <span id="slider-1-val">50%</span>
                                </div>
                                <input type="range" min="0" max="100" value="50" oninput="document.getElementById('slider-1-val').textContent=this.value+'%'" class="w-full accent-purple-500">
                            </div>
                            <div>
                                <div class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Threshold Filter</span>
                                    <span id="slider-2-val">40%</span>
                                </div>
                                <input type="range" min="0" max="100" value="40" oninput="document.getElementById('slider-2-val').textContent=this.value+'%'" class="w-full accent-purple-500">
                            </div>
                        </div>
                        <button onclick="window.completeGeneralSandbox()" class="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-semibold text-white transition">Verify Calibration Handshake</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Adjust and verify calibration for: ${conceptStr}.</div>
                    </div>
                `;
                window.completeGeneralSandbox = () => {
                    completeSandbox();
                };
                break;
        }
    }
    function completeSandbox() {
        appState.sandboxCleared = true;
        els.sandboxStatusBadge.textContent = "COMPLETED";
        els.sandboxStatusBadge.className = "text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded px-1.5 py-0.5";
        
        // Award Sandbox XP and stats
        if (window.PsychGamification) {
            window.PsychGamification.awardXP(20, 'sandbox', els.sandboxStatusBadge);
            window.PsychGamification.incrementStat('sandboxesCleared');
        }

        setTimeout(() => {
            alert("Sandbox handshake completed! Final Stage 4 Feynman Defense is now unlocked.");
            setStage(STAGE_FEYNMAN);
        }, 500);
        
        saveSessionState(appState.lessonId, { stage: appState.stage, socraticCleared: appState.socraticCleared, sandboxCleared: appState.sandboxCleared }, appState.messageHistory);
    }

    function applyInputMode() {
        if (appState.useSpeechInput) {
            if (els.btnMic) els.btnMic.classList.remove('hidden');
            if (els.chatInput) els.chatInput.setAttribute('placeholder', 'Use the microphone button to dictate explanation...');
            if (els.toggleInputText) els.toggleInputText.textContent = 'Switch to Keyboard';
        } else {
            if (els.btnMic) els.btnMic.classList.add('hidden');
            if (els.chatInput) els.chatInput.setAttribute('placeholder', 'Type response here...');
            if (els.toggleInputText) els.toggleInputText.textContent = 'Switch to Speech API';
            
            if (appState.recognition) {
                appState.recognition.stop();
            }
        }
    }

    // Web Speech API dictation hook
    function toggleSpeechDictation() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Speech recognition is not supported in this browser. Please type your explanation.");
            return;
        }

        if (appState.recognition) {
            appState.recognition.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        appState.recognition = new SpeechRecognition();
        appState.recognition.continuous = true;
        appState.recognition.interimResults = false;
        appState.recognition.lang = 'en-US';

        appState.recognition.onstart = () => {
            if (els.speechIndicator) els.speechIndicator.classList.remove('hidden');
            if (els.btnMic) els.btnMic.className = "bg-red-500 text-white p-2.5 rounded border border-red-400 transition animate-pulse";
        };

        appState.recognition.onend = () => {
            if (els.speechIndicator) els.speechIndicator.classList.add('hidden');
            if (els.btnMic) els.btnMic.className = "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-355 p-2.5 rounded transition";
            appState.recognition = null;
        };

        appState.recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    transcript += event.results[i][0].transcript;
                }
            }
            if (transcript && els.chatInput) {
                els.chatInput.value += (els.chatInput.value ? ' ' : '') + transcript;
            }
        };

        appState.recognition.onerror = () => {
            if (appState.recognition) appState.recognition.stop();
        };

        appState.recognition.start();
    }

    function initListeners() {
        // Stage progress dots click routes
        for (let i = 1; i <= 4; i++) {
            const wrap = els.dotContainers[i];
            if (wrap) {
                wrap.addEventListener('click', () => {
                    // Check prerequisites
                    if (i === 2 && !appState.lessonId) return;
                    if (i === 3 && !appState.socraticCleared && !isCurriculumBypassEnabled()) return;
                    if (i === 4 && (!appState.socraticCleared || !appState.sandboxCleared) && !isCurriculumBypassEnabled()) return;
                    setStage(i);
                });
            }
        }

        if (els.btnToggleSocratic) {
            els.btnToggleSocratic.addEventListener('click', () => {
                appState.socraticCollapsed = !appState.socraticCollapsed;
                updateSocraticLayoutUi();
            });
        }

        if (els.btnOpenSocratic) {
            els.btnOpenSocratic.addEventListener('click', () => {
                appState.socraticCollapsed = false;
                updateSocraticLayoutUi();
            });
        }

        if (els.btnPrimarySocraticCta) {
            els.btnPrimarySocraticCta.addEventListener('click', () => {
                setStage(STAGE_SOCRATIC);
            });
        }

        if (els.btnStartSocraticHeader) {
            els.btnStartSocraticHeader.addEventListener('click', () => {
                setStage(STAGE_SOCRATIC);
            });
        }

        if (els.chatForm) {
            els.chatForm.addEventListener('submit', onChatSubmit);
        }

        if (els.btnToggleInputMode) {
            els.btnToggleInputMode.addEventListener('click', () => {
                appState.useSpeechInput = !appState.useSpeechInput;
                applyInputMode();
            });
        }

        if (els.btnMic) {
            els.btnMic.addEventListener('click', toggleSpeechDictation);
        }

        if (els.selectActiveLecture) {
            els.selectActiveLecture.addEventListener('change', (e) => {
                const idx = Number(e.target.value);
                if (idx >= 0 && idx < appState.lectures.length) {
                    appState.activeLectureIdx = idx;
                    localStorage.setItem(`psychology_lesson_active_lecture_idx_${appState.lesson.id}`, String(idx));
                    renderLectureContent(appState.lesson, appState.lectures[idx]);
                }
            });
        }

        if (els.btnAddLecture) {
            els.btnAddLecture.addEventListener('click', () => {
                const nextIdx = appState.lectures.length;
                generateLecture(appState.lesson, nextIdx, false);
            });
        }

        if (els.btnRegenerateLecture) {
            els.btnRegenerateLecture.addEventListener('click', () => {
                const ok = window.confirm(`Regenerate Lecture ${appState.activeLectureIdx + 1}? This will overwrite this specific variation with a newly generated lecture.`);
                if (!ok) return;
                generateLecture(appState.lesson, appState.activeLectureIdx, true);
            });
        }

        // Event listener for sidebar clicks
        window.selectLesson = (lessonId) => {
            loadActiveLesson(lessonId);
        };

        // LLM options populate
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            const savedModel = localStorage.getItem('psychology_llm') || 'gemma';
            const endpoint = localStorage.getItem("psychology_ollama_endpoint") || "http://localhost:11434";
            const cleanEndpoint = endpoint.replace('/api/chat', '').replace('/api/generate', '');
            
            if (typeof window.populateModelSelector === 'function') {
                window.populateModelSelector(modelSelect, savedModel, cleanEndpoint, {
                    moduleKey: 'psychology_llm',
                    onStatusChange: (status) => {
                        console.log('[Psychology Coursework Model Select]', status.message);
                    }
                });
            } else {
                const opt1 = document.createElement('option');
                opt1.value = 'gemma';
                opt1.textContent = 'Gnosys Gemma (Default Local)';
                opt1.selected = (savedModel === 'gemma');
                modelSelect.appendChild(opt1);
                
                const opt2 = document.createElement('option');
                opt2.value = 'llama';
                opt2.textContent = 'Gnosys Llama (Local)';
                opt2.selected = (savedModel === 'llama');
                modelSelect.appendChild(opt2);
                
                modelSelect.addEventListener('change', () => {
                    localStorage.setItem('psychology_llm', modelSelect.value);
                });
            }
        }

        // Bypass UI updater
        function updateCurriculumBypassButtonUi() {
            const btn = document.getElementById('btn-curriculum-bypass');
            if (!btn) return;
            const enabled = isCurriculumBypassEnabled();
            btn.title = enabled ? 'Disable bypass requirements' : 'Bypass lesson requirements (Explore Mode)';
            btn.setAttribute('aria-pressed', String(enabled));
            
            if (enabled) {
                btn.classList.add('bg-violet-500/25', 'text-violet-200', 'border-violet-500');
                btn.classList.remove('bg-violet-500/10', 'text-violet-300', 'border-violet-500/35');
            } else {
                btn.classList.remove('bg-violet-500/25', 'text-violet-200', 'border-violet-500');
                btn.classList.add('bg-violet-500/10', 'text-violet-300', 'border-violet-500/35');
            }
        }

        // Bypass toggle wiring
        const bypassBtn = document.getElementById('bypass-toggle-btn');
        const headerBypassBtn = document.getElementById('btn-curriculum-bypass');
        
        const updateBypassUis = () => {
            const enabled = isCurriculumBypassEnabled();
            if (bypassBtn) {
                bypassBtn.textContent = enabled ? "ENABLED" : "DISABLED";
                bypassBtn.className = enabled 
                    ? "px-3 py-1 bg-purple-600 text-white rounded font-bold text-[10px] uppercase transition"
                    : "px-3 py-1 bg-slate-800 border border-slate-700 rounded font-semibold text-[10px] uppercase text-slate-350 hover:bg-slate-750 transition";
            }
            updateCurriculumBypassButtonUi();
        };

        updateBypassUis();

        if (bypassBtn) {
            bypassBtn.addEventListener('click', () => {
                toggleCurriculumBypass();
                updateBypassUis();
                renderSidebar(appState.syllabus, appState.matrix);
            });
        }

        if (headerBypassBtn) {
            headerBypassBtn.addEventListener('click', () => {
                toggleCurriculumBypass();
                updateBypassUis();
                renderSidebar(appState.syllabus, appState.matrix);
            });
        }

        // Settings modal toggle
        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                const modal = document.getElementById('settings-modal');
                if (modal) modal.classList.toggle('hidden');
            });
        }

        // Restart Lesson button handler
        if (els.btnRestartLesson) {
            els.btnRestartLesson.addEventListener('click', () => {
                const ok = window.confirm('Restart this lesson? This will reset your progress to Stage 1 and clear the tutor conversation history, but keeps the generated lecture.');
                if (!ok) return;

                localStorage.removeItem(`sandbox_complete_${appState.lessonId}`);
                sessionStorage.removeItem('activeLessonState');
                appState.messageHistory = [];
                appState.stage = STAGE_LECTURE;
                appState.socraticCleared = false;
                appState.sandboxCleared = false;
                appState.isChatLocked = false;

                if (els.chatMessages) els.chatMessages.innerHTML = '';
                loadActiveLesson(appState.lessonId);
            });
        }

        // Regenerate Lesson button handler
        if (els.btnRegenerate) {
            els.btnRegenerate.addEventListener('click', () => {
                const ok = window.confirm('Regenerate this lesson? This clears all generated lectures and active conversation to restart Stage 1.');
                if (!ok) return;

                localStorage.removeItem(`psychology_lesson_lecture_${appState.lessonId}`);
                localStorage.removeItem(`psychology_lesson_lectures_${appState.lessonId}`);
                localStorage.removeItem(`psychology_lesson_active_lecture_idx_${appState.lessonId}`);
                localStorage.removeItem(`sandbox_complete_${appState.lessonId}`);
                sessionStorage.removeItem('activeLessonState');
                appState.messageHistory = [];
                appState.stage = STAGE_LECTURE;
                appState.socraticCleared = false;
                appState.sandboxCleared = false;
                appState.isChatLocked = false;
                appState.lectures = [];
                appState.activeLectureIdx = 0;

                if (els.chatMessages) els.chatMessages.innerHTML = '';
                loadActiveLesson(appState.lessonId);
            });
        }

        // Listen for global bypass sync events
        window.addEventListener('curriculumBypassChanged', () => {
            updateBypassUis();
            renderSidebar(appState.syllabus, appState.matrix);
        });

        // Listen for global progress reset events
        window.addEventListener('psychologyProgressReset', () => {
            window.location.reload();
        });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Bootstrap loading
    window.addEventListener('syllabusLoaded', (e) => {
        appState.syllabus = e.detail.syllabus;
        appState.matrix = e.detail.matrix;
        
        cacheDom();
        initListeners();

        // Auto route to highest unlocked lesson
        const routeId = getHighestUnlockedLesson(appState.matrix, appState.syllabus);
        if (routeId) {
            loadActiveLesson(routeId);
        }
    });

})();;
