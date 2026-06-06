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
        els.btnDeleteLecture = document.getElementById('btn-delete-lecture');
        
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

            dot.classList.remove('bg-slate-600', 'bg-rose-500', 'bg-slate-350', 'bg-rose-600');
            wrap.classList.remove(
                'text-slate-400', 'text-rose-300', 'text-rose-455',
                'bg-slate-900/80', 'bg-rose-900/20', 'border', 'border-rose-900/30'
            );

            if (i <= currentStage) {
                dot.classList.add('bg-rose-500');
                wrap.classList.add('text-rose-300', 'bg-rose-900/20', 'border', 'border-rose-955/40');
            } else {
                dot.classList.add('bg-slate-600');
                wrap.classList.add('text-slate-400', 'bg-slate-900/80');
            }
        }
    }

    function setModeUiForStage() {
        if (appState.stage === STAGE_LECTURE) {
            els.modeBadge.textContent = 'LECTURE';
            els.chatHeaderTitle.textContent = 'Socratic Anatomy Dialogue';
            els.inputInstructions.textContent = 'Start the Socratic flow to begin chat...';
            if (els.btnGenerateQuestion) els.btnGenerateQuestion.classList.add('hidden');
        } else if (appState.stage === STAGE_SOCRATIC) {
            els.modeBadge.textContent = 'SOCRATIC CHECK';
            els.chatHeaderTitle.textContent = 'Socratic Anatomy Dialogue';
            els.inputInstructions.textContent = 'Respond to Socratic Question...';
            if (els.btnGenerateQuestion) els.btnGenerateQuestion.classList.remove('hidden');
        } else if (appState.stage === STAGE_SANDBOX) {
            els.modeBadge.textContent = 'SANDBOX SIMULATOR';
            els.chatHeaderTitle.textContent = 'Socratic Anatomy Dialogue';
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

    function appendMessageBubble(role, content) {
        if (!els.chatMessages) return;
        const msgWrapper = document.createElement('div');
        msgWrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} w-full transition-all duration-300`;

        const bubble = document.createElement('div');
        if (role === 'user') {
            bubble.className = 'max-w-[80%] bg-rose-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-xs shadow-md font-medium leading-relaxed';
        } else {
            bubble.className = 'max-w-[85%] bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs shadow-md font-medium leading-relaxed markdown-body';
        }
        bubble.innerHTML = window.marked ? window.marked.parse(content) : content;

        msgWrapper.appendChild(bubble);
        els.chatMessages.appendChild(msgWrapper);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        const id = 'typing-indicator-bubble';
        const existing = document.getElementById(id);
        if (existing) existing.remove();

        const wrap = document.createElement('div');
        wrap.id = id;
        wrap.className = 'flex justify-start w-full';
        wrap.innerHTML = `
            <div class="bg-slate-900 border border-slate-800 text-slate-450 rounded-2xl rounded-tl-none px-4 py-3 flex items-center space-x-1.5 shadow-md">
                <div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                <div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
        `;
        els.chatMessages.appendChild(wrap);
        els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator-bubble');
        if (indicator) indicator.remove();
    }

    function setStage(stageNum) {
        appState.stage = stageNum;
        setStageDots(stageNum);
        setModeUiForStage();

        if (els.chatInput) {
            els.chatInput.disabled = (stageNum === STAGE_LECTURE || stageNum === STAGE_SANDBOX);
            if (stageNum === STAGE_LECTURE) {
                els.chatInput.placeholder = 'Read the lecture slides first...';
            } else if (stageNum === STAGE_SANDBOX) {
                els.chatInput.placeholder = 'Complete the lab simulation above...';
            } else {
                els.chatInput.placeholder = 'Type response here...';
            }
        }

        // Handle overlay visibility
        if (els.sandboxHandshake) els.sandboxHandshake.classList.add('hidden');
        if (els.masterCtaOverlay) els.masterCtaOverlay.classList.add('hidden');

        if (stageNum === STAGE_LECTURE) {
            appState.socraticCollapsed = true;
        } else if (stageNum === STAGE_SOCRATIC) {
            appState.socraticCollapsed = false;
            if (appState.messageHistory.length === 0) {
                loadSocraticWelcome();
            }
        } else if (stageNum === STAGE_SANDBOX) {
            appState.socraticCollapsed = false;
            if (els.sandboxHandshake) els.sandboxHandshake.classList.remove('hidden');
            loadSandbox();
        } else if (stageNum === STAGE_FEYNMAN) {
            appState.socraticCollapsed = false;
            const hasPrompt = appState.messageHistory.some(m => m.role === 'assistant' && m.stage === 'feynman');
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
            btn.classList.remove('ring-1', 'ring-rose-500', 'bg-slate-800/80');
        });
        const activeItem = document.getElementById(`sidebar-item-${lessonId}`);
        if (activeItem) {
            activeItem.classList.add('ring-1', 'ring-rose-500', 'bg-slate-800/80');
        }
    }

    async function loadLecture() {
        if (!appState.lesson) return;
        
        // Try to load cached lectures
        let cached = null;
        try {
            cached = JSON.parse(localStorage.getItem(`anatomy3_lesson_lectures_${appState.lesson.id}`));
        } catch (e) {
            console.error(e);
        }

        if (Array.isArray(cached) && cached.length > 0) {
            appState.lectures = cached;
            let savedIdx = Number(localStorage.getItem(`anatomy3_lesson_active_lecture_idx_${appState.lesson.id}`) || '0');
            if (savedIdx < 0 || savedIdx >= cached.length) savedIdx = 0;
            appState.activeLectureIdx = savedIdx;
            
            renderLectureDropdown();
            renderLectureContent(appState.lesson, cached[savedIdx]);
        } else {
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
        const modelLabel = typeof window.getActiveModelLabel === 'function'
            ? window.getActiveModelLabel('anatomy3_llm')
            : (localStorage.getItem('anatomy3_llm') === 'llama' ? 'Gnosys Llama' : 'Gnosys Gemma');

        els.lectureContainer.innerHTML = `
            <div class="flex flex-col h-full justify-center p-4 max-w-lg mx-auto space-y-3">
                <div class="flex items-center space-x-3 text-rose-455 font-semibold text-xs">
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
                        <span>[3/4] Requesting 600-800 word anatomy lecture...</span>
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
            
            stepEl.classList.remove('text-slate-500', 'text-amber-400', 'text-rose-400', 'text-red-400');
            
            if (status === 'running') {
                stepEl.classList.add('text-amber-400');
                statusEl.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> RUNNING';
            } else if (status === 'success') {
                stepEl.classList.add('text-rose-455');
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

        try {
            const lectureText = await window.AnatomyTutor.fetchGeneratedLesson(lesson, updateStepUI, index);
            
            if (isRegenerate) {
                appState.lectures[index] = lectureText;
            } else {
                appState.lectures.push(lectureText);
            }

            localStorage.setItem(`anatomy3_lesson_lectures_${lesson.id}`, JSON.stringify(appState.lectures));
            localStorage.setItem(`anatomy3_lesson_active_lecture_idx_${lesson.id}`, String(index));
            appState.activeLectureIdx = index;

            renderLectureDropdown();
            renderLectureContent(lesson, lectureText);
            
            if (!isRegenerate && window.AnatomyGamification) {
                window.AnatomyGamification.awardXP(10, 'lecture');
            }
        } catch (err) {
            console.error('Lecture generation error:', err);
            if (els.lectureContainer) {
                els.lectureContainer.innerHTML = `
                    <div class="p-6 text-center space-y-3">
                        <i class="fa-solid fa-triangle-exclamation text-rose-500 text-2xl"></i>
                        <h4 class="font-bold text-slate-200">Lecture Generation Failed</h4>
                        <p class="text-xs text-slate-455 max-w-sm mx-auto">
                            The local AI model was unable to generate this lesson. You can try restarting Ollama or proceed in offline bypass mode.
                        </p>
                    </div>
                `;
            }
        } finally {
            appState.isGeneratingLecture = false;
        }
    }

    async function loadSocraticWelcome() {
        if (!appState.lesson) return;
        showTypingIndicator();
        try {
            const msg = await window.AnatomyTutor.getSocraticWelcome(appState.lesson.id, appState.syllabus);
            removeTypingIndicator();
            appendMessageBubble('assistant', msg);
            appState.messageHistory.push({ role: 'assistant', content: msg, stage: 'socratic' });
            saveSessionState(appState.lessonId, { stage: appState.stage, socraticCleared: appState.socraticCleared, sandboxCleared: appState.sandboxCleared }, appState.messageHistory);
        } catch (e) {
            removeTypingIndicator();
            appendMessageBubble('assistant', "Hello! Let's review this concept. What are your initial thoughts?");
        }
    }

    function loadSocraticChat() {
        if (!els.chatMessages) return;
        els.chatMessages.innerHTML = '';
        
        appState.messageHistory.forEach(msg => {
            appendMessageBubble(msg.role, msg.content);
        });
    }

    async function submitSocraticAnswer(text) {
        if (appState.isChatLocked) return;
        appState.isChatLocked = true;

        appendMessageBubble('user', text);
        appState.messageHistory.push({ role: 'user', content: text, stage: 'socratic' });
        
        if (els.chatInput) els.chatInput.value = '';
        showTypingIndicator();

        try {
            const res = await window.AnatomyTutor.evaluateSocraticAnswer(appState.lesson.id, appState.messageHistory, text, appState.syllabus);
            removeTypingIndicator();
            appendMessageBubble('assistant', res.feedback);
            appState.messageHistory.push({ role: 'assistant', content: res.feedback, stage: 'socratic' });

            if (res.passed) {
                appState.socraticCleared = true;
                if (window.AnatomyGamification) {
                    window.AnatomyGamification.awardXP(20, 'socratic');
                    window.AnatomyGamification.incrementStat('socraticCleared');
                }
                setTimeout(() => {
                    setStage(STAGE_SANDBOX);
                }, 1800);
            }
        } catch (err) {
            removeTypingIndicator();
            appendMessageBubble('assistant', "I was unable to verify your explanation. Could you try explaining it in a different way?");
        } finally {
            appState.isChatLocked = false;
        }
    }

    function loadSandbox() {
        if (els.sandboxStatusBadge) {
            const comp = localStorage.getItem(`anatomy3_sandbox_complete_${appState.lesson.id}`) === 'true';
            appState.sandboxCleared = comp;
            els.sandboxStatusBadge.textContent = comp ? "COMPLETED" : "UNRESOLVED";
            els.sandboxStatusBadge.className = comp
                ? "text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded px-1.5 py-0.5"
                : "text-[9px] font-mono bg-slate-855 text-slate-400 border border-slate-800 rounded px-1.5 py-0.5";
        }
        
        if (window.AnatomySkillsLab && els.sandboxViewport) {
            window.AnatomySkillsLab.renderSandboxWidget(appState.lesson.id, els.sandboxViewport);
        }
    }

    window.onSandboxSuccess = function() {
        appState.sandboxCleared = true;
        saveSessionState(appState.lessonId, { stage: appState.stage, socraticCleared: appState.socraticCleared, sandboxCleared: appState.sandboxCleared }, appState.messageHistory);
        setTimeout(() => {
            setStage(STAGE_FEYNMAN);
        }, 1200);
    };

    async function loadDynamicQuestion(mode) {
        showTypingIndicator();
        try {
            const prompt = await window.AnatomyTutor.fetchGeneratedQuestion(appState.lesson, mode);
            removeTypingIndicator();
            appendMessageBubble('assistant', prompt);
            appState.messageHistory.push({ role: 'assistant', content: prompt, stage: mode });
            saveSessionState(appState.lessonId, { stage: appState.stage, socraticCleared: appState.socraticCleared, sandboxCleared: appState.sandboxCleared }, appState.messageHistory);
        } catch (err) {
            removeTypingIndicator();
            const fallbackPrompt = mode === 'feynman' 
                ? `Explain the concept of **${appState.lesson.concept}** in simple terms, as if explaining to a 10-year-old child.`
                : `How does the clinical system stabilize itself in this scenario?`;
            appendMessageBubble('assistant', fallbackPrompt);
            appState.messageHistory.push({ role: 'assistant', content: fallbackPrompt, stage: mode });
        }
    }

    async function submitFeynmanExplanation(text) {
        if (appState.isChatLocked) return;
        appState.isChatLocked = true;

        appendMessageBubble('user', text);
        appState.messageHistory.push({ role: 'user', content: text, stage: 'feynman' });
        
        if (els.chatInput) els.chatInput.value = '';
        showTypingIndicator();

        try {
            const res = await window.AnatomyTutor.evaluateFeynmanExplanation(appState.lesson.id, text, appState.syllabus);
            removeTypingIndicator();
            appendMessageBubble('assistant', res.feedback);
            appState.messageHistory.push({ role: 'assistant', content: res.feedback, stage: 'feynman' });

            if (res.passed) {
                appState.feynmanCleared = true;
                if (window.AnatomyGamification) {
                    window.AnatomyGamification.awardXP(40, 'feynman');
                    window.AnatomyGamification.incrementStat('feynmanCleared');
                }
                window.updateLessonState(appState.lesson.id, STATE_HW_PENDING);

                setTimeout(() => {
                    if (els.masterCtaOverlay) {
                        els.masterCtaOverlay.classList.remove('hidden');
                    }
                }, 1800);
            }
        } catch (err) {
            removeTypingIndicator();
            appendMessageBubble('assistant', "Failed to check explanation. Try again or check details.");
        } finally {
            appState.isChatLocked = false;
        }
    }

    function setupEventListeners() {
        if (els.chatForm) {
            els.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = els.chatInput.value.trim();
                if (!text) return;

                if (appState.stage === STAGE_SOCRATIC) {
                    submitSocraticAnswer(text);
                } else if (appState.stage === STAGE_FEYNMAN) {
                    submitFeynmanExplanation(text);
                }
            });
        }

        if (els.chatInput) {
            els.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (els.chatForm) {
                        els.chatForm.dispatchEvent(new Event('submit'));
                    }
                }
            });
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

        if (els.btnRestartLesson) {
            els.btnRestartLesson.addEventListener('click', () => {
                if (confirm("Reset current lesson progression and start over?")) {
                    appState.messageHistory = [];
                    setStage(STAGE_LECTURE);
                    loadSocraticChat();
                }
            });
        }

        if (els.btnRegenerate) {
            els.btnRegenerate.addEventListener('click', () => {
                if (appState.stage === STAGE_LECTURE) {
                    generateLecture(appState.lesson, appState.activeLectureIdx, true);
                } else if (appState.stage === STAGE_SOCRATIC || appState.stage === STAGE_FEYNMAN) {
                    appState.messageHistory = [];
                    els.chatMessages.innerHTML = '';
                    setStage(appState.stage);
                }
            });
        }

        if (els.selectActiveLecture) {
            els.selectActiveLecture.addEventListener('change', () => {
                const idx = parseInt(els.selectActiveLecture.value);
                appState.activeLectureIdx = idx;
                localStorage.setItem(`anatomy3_lesson_active_lecture_idx_${appState.lesson.id}`, String(idx));
                renderLectureContent(appState.lesson, appState.lectures[idx]);
            });
        }

        if (els.btnAddLecture) {
            els.btnAddLecture.addEventListener('click', () => {
                const newIdx = appState.lectures.length;
                generateLecture(appState.lesson, newIdx, false);
            });
        }

        if (els.btnRegenerateLecture) {
            els.btnRegenerateLecture.addEventListener('click', () => {
                generateLecture(appState.lesson, appState.activeLectureIdx, true);
            });
        }

        if (els.btnDeleteLecture) {
            els.btnDeleteLecture.addEventListener('click', () => {
                if (appState.lectures.length <= 1) {
                    alert("You must keep at least one lecture variation. If you do not like this lecture, you can regenerate it instead.");
                    return;
                }
                if (confirm(`Delete Lecture Variation ${appState.activeLectureIdx + 1}? This action cannot be undone.`)) {
                    appState.lectures.splice(appState.activeLectureIdx, 1);
                    localStorage.setItem(`anatomy3_lesson_lectures_${appState.lesson.id}`, JSON.stringify(appState.lectures));
                    
                    // Adjust active index
                    if (appState.activeLectureIdx >= appState.lectures.length) {
                        appState.activeLectureIdx = appState.lectures.length - 1;
                    }
                    localStorage.setItem(`anatomy3_lesson_active_lecture_idx_${appState.lesson.id}`, String(appState.activeLectureIdx));
                    
                    renderLectureDropdown();
                    renderLectureContent(appState.lesson, appState.lectures[appState.activeLectureIdx]);
                }
            });
        }

        // Settings Modal and Bypass trigger
        const settingsModal = document.getElementById('settings-modal');
        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings && settingsModal) {
            btnSettings.addEventListener('click', () => {
                settingsModal.classList.toggle('hidden');
            });
        }

        // Model selector populate
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            const savedModel = localStorage.getItem('anatomy3_llm') || 'gemma';
            const endpoint = localStorage.getItem("anatomy3_ollama_endpoint") || "http://localhost:11434";
            const cleanEndpoint = endpoint.replace('/api/chat', '').replace('/api/generate', '');
            
            if (typeof window.populateModelSelector === 'function') {
                window.populateModelSelector(modelSelect, savedModel, cleanEndpoint, {
                    moduleKey: 'anatomy3_llm',
                    onStatusChange: (status) => {
                        console.log('[Anatomy III Coursework Model Select]', status.message);
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
                    localStorage.setItem('anatomy3_llm', modelSelect.value);
                });
            }
        }

        const bypassToggleBtn = document.getElementById('bypass-toggle-btn');
        const headerBypassBtn = document.getElementById('btn-curriculum-bypass');

        const updateBypassUis = () => {
            const enabled = window.isCurriculumBypassEnabled();
            if (bypassToggleBtn) {
                bypassToggleBtn.textContent = enabled ? "ENABLED" : "DISABLED";
                bypassToggleBtn.className = enabled 
                    ? "px-3 py-1 bg-rose-600 text-white rounded font-bold text-[10px] uppercase transition"
                    : "px-3 py-1 bg-slate-800 border border-slate-700 rounded font-semibold text-[10px] uppercase text-slate-350 hover:bg-slate-750 transition";
            }
            if (headerBypassBtn) {
                headerBypassBtn.setAttribute('aria-pressed', String(enabled));
                if (enabled) {
                    headerBypassBtn.classList.add('bg-rose-500/25', 'text-rose-200', 'border-rose-500');
                    headerBypassBtn.classList.remove('bg-rose-500/10', 'text-rose-355', 'border-rose-500/35');
                } else {
                    headerBypassBtn.classList.remove('bg-rose-500/25', 'text-rose-200', 'border-rose-500');
                    headerBypassBtn.classList.add('bg-rose-500/10', 'text-rose-355', 'border-rose-500/35');
                }
            }
        };

        if (bypassToggleBtn) {
            bypassToggleBtn.addEventListener('click', () => {
                window.toggleCurriculumBypass();
                updateBypassUis();
                if (window.syllabusData) {
                    const matrix = window.initMasteryMatrix(window.syllabusData);
                    window.renderSidebar(window.syllabusData, matrix);
                }
            });
        }
        if (headerBypassBtn) {
            headerBypassBtn.addEventListener('click', () => {
                window.toggleCurriculumBypass();
                updateBypassUis();
                if (window.syllabusData) {
                    const matrix = window.initMasteryMatrix(window.syllabusData);
                    window.renderSidebar(window.syllabusData, matrix);
                }
            });
        }

        window.addEventListener('curriculumBypassChanged', () => {
            updateBypassUis();
        });

        updateBypassUis();
    }

    window.addEventListener('syllabusLoaded', (e) => {
        appState.syllabus = e.detail.syllabus;
        appState.matrix = e.detail.matrix;

        let activeLessonId = getHighestUnlockedLesson(appState.matrix, appState.syllabus);
        
        const hash = window.location.hash;
        if (hash.startsWith('#lesson_')) {
            const possibleId = hash.substring(1);
            const found = Object.values(appState.syllabus.lessonsByModule).flat().find(l => l.id === possibleId);
            if (found) {
                const state = appState.matrix[possibleId] ? appState.matrix[possibleId].state : STATE_LOCKED;
                if (window.isCurriculumBypassEnabled() || state > STATE_LOCKED) {
                    activeLessonId = possibleId;
                }
            }
        }

        if (activeLessonId) {
            loadActiveLesson(activeLessonId);
        }
    });

    window.selectLesson = function(lessonId) {
        window.location.hash = `#${lessonId}`;
        loadActiveLesson(lessonId);
    };

    document.addEventListener('DOMContentLoaded', () => {
        cacheDom();
        setupEventListeners();
    });

})();
