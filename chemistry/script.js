const CHEM_STATE_KEY = "chemistry_learning_state_v1";
const CHEM_NOMEN_SRS_STATE_KEY = "chem_nomen_srs_state_v2";
const CHEM_POLY_SRS_STATE_KEY = "chem_polyatomic_srs_state_v1";
const CHEM_POLY_LEGACY_KEY = "chem_polyatomic_mastered_v1";
const CHEM_VIDEO_STATE_KEY = "chemistry_video_state_v1";
let learningState = null;
let activateChemTab = () => {};
let diagnosticSession = null;
let chemistrySessionGamification = { streak: 0, xp: 0 };
let chemistryVideoState = null;

function getChemistryModel() {
    if (typeof window.getGnosysModel === 'function') {
        return window.getGnosysModel('chemistry_llm');
    }
    return localStorage.getItem('gnosys_active_llm') || localStorage.getItem('chemistry_llm') || 'gemma4:e4b';
}

const chemistryDeckRegistry = {
    nomen: { state: null, cardIds: [] },
    poly: { state: null, cardIds: [] }
};

function ensureTypingIndicatorStyles() {
    const styleId = 'chem-typing-indicator-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        @keyframes chemTypingBounce {
            0%, 80%, 100% { transform: translateY(0) scale(1); opacity: 0.45; }
            40% { transform: translateY(-3px) scale(1.08); opacity: 1; }
        }
        .chem-typing-indicator {
            contain: layout style;
        }
        .chem-typing-bubble {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border-radius: 999px;
            padding: 8px 12px;
            border: 1px solid rgba(139, 92, 246, 0.2);
            background: linear-gradient(180deg, rgba(245, 243, 255, 0.95), rgba(237, 233, 254, 0.9));
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
        }
        .dark .chem-typing-bubble {
            border-color: rgba(167, 139, 250, 0.35);
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
            box-shadow: 0 4px 14px rgba(2, 6, 23, 0.5);
        }
        .chem-typing-dots {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .chem-typing-dot {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: rgb(139, 92, 246);
            animation: chemTypingBounce 1s ease-in-out infinite;
        }
        .chem-typing-dot:nth-child(2) { animation-delay: 0.14s; }
        .chem-typing-dot:nth-child(3) { animation-delay: 0.28s; }
        .chem-typing-label {
            font-size: 11px;
            font-weight: 600;
            color: rgb(109, 40, 217);
            letter-spacing: 0.01em;
        }
        .dark .chem-typing-label {
            color: rgb(196, 181, 253);
        }
        @media (prefers-reduced-motion: reduce) {
            .chem-typing-dot {
                animation: none;
                opacity: 0.8;
            }
        }
    `;
    document.head.appendChild(style);
}

function createTypingIndicatorElement(labelText = 'Prof. Beaker', compact = false) {
    ensureTypingIndicatorStyles();

    const wrap = document.createElement('div');
    wrap.className = `flex justify-start chem-typing-indicator${compact ? ' mt-1' : ''}`;
    wrap.setAttribute('aria-live', 'polite');
    wrap.innerHTML = `
        <div class="chem-typing-bubble" role="status" aria-label="${labelText} is typing">
            <span class="chem-typing-dots" aria-hidden="true">
                <span class="chem-typing-dot"></span>
                <span class="chem-typing-dot"></span>
                <span class="chem-typing-dot"></span>
            </span>
            <span class="chem-typing-label">${labelText} is typing</span>
        </div>
    `;
    return wrap;
}

function removeContainerTypingIndicator(containerEl) {
    if (!containerEl) return;
    const indicator = containerEl.querySelector('.chem-typing-indicator');
    if (indicator) indicator.remove();
}

function extractThinkingAndToolPayload(rawText) {
    const output = {
        visibleText: "",
        thinking: "",
        toolCalls: []
    };
    const safeRaw = typeof rawText === "string" ? rawText : "";

    const thinkingMatch = safeRaw.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    if (thinkingMatch) output.thinking = thinkingMatch[1].trim();

    const toolMatch = safeRaw.match(/<tool_calls>([\s\S]*?)<\/tool_calls>/i);
    if (toolMatch) {
        try {
            const parsed = JSON.parse(toolMatch[1].trim());
            if (Array.isArray(parsed)) output.toolCalls = parsed;
        } catch (_err) {
            output.toolCalls = [];
        }
    }

    output.visibleText = safeRaw
        .replace(/<thinking>[\s\S]*?<\/thinking>/ig, "")
        .replace(/<tool_calls>[\s\S]*?<\/tool_calls>/ig, "")
        .replace(/<student_response>/ig, "")
        .replace(/<\/student_response>/ig, "")
        .trim();

    return output;
}

async function streamOllamaWithThinkingFilter({
    endpoint = "local-provider",
    payload,
    onVisibleToken,
    onThinking,
    onToolCalls
}) {
    const shouldUseRouter = Boolean(window.GnosysLLM) && !String(endpoint).startsWith('https://');
    if (shouldUseRouter) {
        const safeMessages = Array.isArray(payload?.messages) ? payload.messages : [];
        const systemMessage = safeMessages.find((m) => m?.role === 'system');
        const nonSystem = safeMessages.filter((m) => m?.role !== 'system');
        const userEntry = nonSystem[nonSystem.length - 1] || { role: 'user', content: '' };
        const priorHistory = nonSystem.slice(0, -1);

        let rawText = '';
        await window.GnosysLLM.generateResponse(systemMessage?.content || '', userEntry?.content || '', {
            stream: true,
            history: priorHistory,
            model: payload?.model,
            moduleKey: 'chemistry_llm',
            onToken: (token) => {
                rawText += token;
                const parsedPayload = extractThinkingAndToolPayload(rawText);
                if (typeof onVisibleToken === 'function') onVisibleToken(parsedPayload.visibleText, rawText);
                if (typeof onThinking === 'function' && parsedPayload.thinking) onThinking(parsedPayload.thinking);
                if (typeof onToolCalls === 'function' && parsedPayload.toolCalls.length) onToolCalls(parsedPayload.toolCalls);
            },
        });

        const parsed = extractThinkingAndToolPayload(rawText);
        return {
            raw: rawText,
            visibleText: parsed.visibleText,
            thinking: parsed.thinking,
            toolCalls: parsed.toolCalls,
        };
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
        throw new Error(`Ollama stream failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = "";
    let rawText = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.trim()) continue;

            let chunk;
            try {
                chunk = JSON.parse(line);
            } catch (_err) {
                continue;
            }

            const token = typeof chunk?.message?.content === "string" ? chunk.message.content : "";
            if (!token) continue;

            rawText += token;
            const parsedPayload = extractThinkingAndToolPayload(rawText);
            if (typeof onVisibleToken === "function") onVisibleToken(parsedPayload.visibleText, rawText);
            if (typeof onThinking === "function" && parsedPayload.thinking) onThinking(parsedPayload.thinking);
            if (typeof onToolCalls === "function" && parsedPayload.toolCalls.length) onToolCalls(parsedPayload.toolCalls);
        }
    }

    const parsed = extractThinkingAndToolPayload(rawText);
    return {
        raw: rawText,
        visibleText: parsed.visibleText,
        thinking: parsed.thinking,
        toolCalls: parsed.toolCalls
    };
}

window.ChemOllamaStream = {
    extractThinkingAndToolPayload,
    streamOllamaWithThinkingFilter,
    dispatchMathRefresherToolCalls: (...args) => window.dispatchMathRefresherToolCalls?.(...args)
};

document.addEventListener("DOMContentLoaded", () => {
    learningState = loadLearningState();
    chemistryVideoState = loadVideoState();

    bindDarkModeToggle();
    bindChemistrySettingsButton();
    bindTabs();
    mountConstants();
    mountElementChips();
    mountConversionOptions();
    mountLabEquipment();
    bindMolarMassActions();
    bindConversionActions();
    bindDaTutorialActions();
    bindStoichActions();
    bindSigFigActions();
    bindMathRefresherActions();
    bindNomenclatureActions();
    bindPolyatomicSubTabs();
    bindPolyatomicIonsActions();
    bindLabActions();
    bindDiagnosticActions();
    bindTutorActions();
    bindVideoActions();
    renderCompetencyMap();
    renderLearningStatus();
    renderDiagnosticState();
    updateMathRefresherCtas();

    // Initialize mastery progress calculation from masteryMatrix
    updateIndexMasteryProgress();

    // Bind global syllabus/mastery matrix change events
    window.addEventListener('syllabusLoaded', updateIndexMasteryProgress);
    window.addEventListener('masteryMatrixChanged', updateIndexMasteryProgress);

    // Handle coursework sandbox handshake parameters
    handleCourseworkSandboxHandshake();

    // Initialize global tooltips for interactive chemical formulas
    initGlobalTooltip();
});

const daTutorialState = {
    lessons: [],
    lessonIdx: 0,
    stepIdx: 0,
    mode: "watch",
    isPlaying: false,
    timerId: null
};

function bindDaTutorialActions() {
    const modeSelect = document.getElementById("da-mode");
    const lessonSelect = document.getElementById("da-lesson");
    const btnStart = document.getElementById("btn-da-start-tutorial");
    const btnPlay = document.getElementById("btn-da-play");
    const btnPause = document.getElementById("btn-da-pause");
    const btnNext = document.getElementById("btn-da-next-step");
    const btnReset = document.getElementById("btn-da-reset-tutorial");
    const btnAsk = document.getElementById("btn-da-ask-step-tutor");
    const progress = document.getElementById("da-tutorial-progress");
    const stepExplanation = document.getElementById("da-step-explanation");
    const stepWhy = document.getElementById("da-step-why");
    const valueInput = document.getElementById("da-value");
    const fromSelect = document.getElementById("da-from");
    const toSelect = document.getElementById("da-to");
    const factorBank = document.getElementById("da-factor-bank");
    const btnAddFactor = document.getElementById("btn-add-factor");
    const btnCheck = document.getElementById("btn-check-da");
    const btnResetChain = document.getElementById("btn-reset-da");
    const tutorAnchor = document.getElementById("da-tutor-anchor");
    const chainContainer = document.getElementById("da-chain");
    const currentStepChip = document.getElementById("da-current-step-chip");
    const currentStepTarget = document.getElementById("da-current-step-target");
    const dimensionsSection = document.getElementById("view-dimensions");
    const outputPanel = document.getElementById("da-output");
    const stickyHeader = document.querySelector("header.glass-panel");
    const floatExplainer = document.getElementById("da-step-float");
    const floatExplainerKicker = document.getElementById("da-step-float-kicker");
    const floatExplainerText = document.getElementById("da-step-float-text");
    const floatExplainerWhy = document.getElementById("da-step-float-why");
    const floatExplainerControls = document.getElementById("da-step-float-controls");
    const btnPopupNext = document.getElementById("btn-da-popup-next");
    const tutorialPicker = document.getElementById("da-tutorial-picker");
    const tutorialPickerHeader = document.getElementById("da-tutorial-picker-header");
    const tutorialPickerOptions = document.getElementById("da-tutorial-picker-options");

    let pendingCenterRaf = null;
    let pendingCenterTimer = null;
    let cameraPathTimer = null;
    let explainerTimer = null;
    let explainerRaf = null;
    let lastCameraPoint = null;
    let explainerAnchor = null;
    let explainerPlacementOptions = null;
    let latestExplainerTitle = "Current Step";
    let explainerDismissedForStep = false;
    let guidedMicroActions = null;
    let guidedMicroIndex = -1;
    let watchMicroActions = null;
    let watchMicroDwellMs = [];
    let watchMicroIndex = -1;
    let watchMicroTimerId = null;
    const tutorialActionTimers = [];
    const WATCH_STEP_INTERVAL_MS = 4200;
    const WATCH_TRANSITION_MIN_MS = 2000;
    const POPUP_READING_WPM = 160;
    const POPUP_READING_BUFFER_SECONDS = 1.2;
    const POPUP_MIN_SECONDS = 4;
    const POPUP_MAX_SECONDS = 14;
    const FACTOR_POPUP_MESSAGES = {
        open: {
            explanation: "Open the conversion-factor dropdown to locate the next legal bridge.",
            why: "We choose a factor whose denominator matches the current unit so cancellation remains valid."
        },
        select: {
            explanation: "Select the factor option that has the current unit in the denominator.",
            why: "Correct orientation matters: wrong denominator blocks cancellation and breaks dimensional logic."
        },
        add: {
            explanation: "Now press Add Factor to append this conversion to the chain.",
            why: "Adding one verified factor at a time prevents hidden mistakes in multi-step conversions."
        },
        inserted: {
            explanation: "Factor inserted. Verify the previous unit cancels and track the new current unit.",
            why: "Dimensional analysis is a unit-audit process: every factor should reduce uncertainty, not add it."
        }
    };
    let cameraPathLayer = null;
    let cameraPathSvg = null;
    let cameraPathStroke = null;
    let cameraPathArrow = null;

    if (!modeSelect || !lessonSelect || !btnStart || !btnPlay || !btnPause || !btnNext || !btnReset || !btnAsk) return;
    if (!window.ChemData?.daTutorial?.lessons || window.ChemData.daTutorial.lessons.length === 0) return;

    daTutorialState.lessons = window.ChemData.daTutorial.lessons;

    function isSmallViewport() {
        return window.innerWidth < 768;
    }

    function isGuidedMode() {
        return (daTutorialState.mode || modeSelect?.value || "watch") === "guided";
    }

    function updatePopupGuidedControls() {
        if (!floatExplainerControls || !btnPopupNext) return;
        const guided = isGuidedMode();
        const watch = !guided;
        const showControls = guided || watch;
        floatExplainerControls.classList.toggle("hidden", !showControls);
        if (!showControls) return;

        const hasMicroPending = guided
            ? !!guidedMicroActions
            : isWatchMicroSequenceActive();
        btnPopupNext.textContent = hasMicroPending ? "Next Action" : "Next Step";
        btnPopupNext.disabled = false;
    }

    function setExplainerContent(titleText, explanationText, whyText) {
        latestExplainerTitle = titleText || latestExplainerTitle || "Current Step";
        if (floatExplainerKicker) {
            floatExplainerKicker.textContent = latestExplainerTitle;
        }
        if (floatExplainerText) {
            floatExplainerText.textContent = explanationText || "";
        }
        if (floatExplainerWhy) {
            floatExplainerWhy.textContent = whyText || "";
        }
    }

    function showExplainer() {
        if (!floatExplainer) return;
        if (explainerDismissedForStep) return;
        floatExplainer.classList.remove("hidden");
        floatExplainer.classList.add("is-visible");
    }

    function hideExplainer() {
        if (!floatExplainer) return;
        floatExplainer.classList.remove("is-visible");
        floatExplainer.classList.add("hidden");
    }

    function queueTutorialAction(delayMs, action) {
        const id = setTimeout(() => {
            const idx = tutorialActionTimers.indexOf(id);
            if (idx >= 0) tutorialActionTimers.splice(idx, 1);
            action();
        }, delayMs);
        tutorialActionTimers.push(id);
        return id;
    }

    function clearTutorialActions() {
        while (tutorialActionTimers.length > 0) {
            const id = tutorialActionTimers.pop();
            clearTimeout(id);
        }
    }

    function isWatchMicroSequenceActive() {
        return Array.isArray(watchMicroActions) && watchMicroActions.length > 0;
    }

    function clearWatchMicroActionState() {
        if (watchMicroTimerId) {
            clearTimeout(watchMicroTimerId);
            watchMicroTimerId = null;
        }
        watchMicroActions = null;
        watchMicroDwellMs = [];
        watchMicroIndex = -1;
    }

    function finishWatchMicroSequence(postStepDelayMs = WATCH_TRANSITION_MIN_MS) {
        clearWatchMicroActionState();

        daTutorialState.stepIdx += 1;
        updateProgress();

        const lesson = getCurrentLesson();
        if (!lesson) return;

        if (daTutorialState.stepIdx >= lesson.steps.length) {
            stopPlayback();
            return;
        }

        if (!daTutorialState.isPlaying) return;
        scheduleNextWatchAdvance(Math.max(postStepDelayMs || WATCH_TRANSITION_MIN_MS, WATCH_TRANSITION_MIN_MS));
    }

    function runNextWatchMicroAction(options = {}) {
        const scheduleFollowing = options.scheduleFollowing !== false;
        if (!isWatchMicroSequenceActive()) return false;

        const nextIndex = watchMicroIndex + 1;
        if (nextIndex >= watchMicroActions.length) {
            return false;
        }

        const action = watchMicroActions[nextIndex];
        const result = typeof action === "function" ? action() : true;
        if (result === false) {
            clearWatchMicroActionState();
            return false;
        }

        watchMicroIndex = nextIndex;
        updatePopupGuidedControls();

        const isLastAction = watchMicroIndex >= watchMicroActions.length - 1;
        if (isLastAction) {
            const insertedDwellMs = watchMicroDwellMs[Math.max(0, watchMicroIndex)] || WATCH_TRANSITION_MIN_MS;
            finishWatchMicroSequence(insertedDwellMs);
            return true;
        }

        if (scheduleFollowing && daTutorialState.isPlaying) {
            const dwellMs = watchMicroDwellMs[Math.max(0, watchMicroIndex)] || WATCH_TRANSITION_MIN_MS;
            if (watchMicroTimerId) {
                clearTimeout(watchMicroTimerId);
            }
            watchMicroTimerId = setTimeout(() => {
                watchMicroTimerId = null;
                if (!daTutorialState.isPlaying) return;
                runNextWatchMicroAction({ scheduleFollowing: true });
            }, Math.max(dwellMs, 0));
        }

        return true;
    }

    function pauseTutorialPlayback() {
        daTutorialState.isPlaying = false;
        if (daTutorialState.timerId) {
            clearInterval(daTutorialState.timerId);
            daTutorialState.timerId = null;
        }
        clearTutorialActions();
        clearWatchMicroActionState();
        guidedMicroActions = null;
        guidedMicroIndex = -1;
        updatePopupGuidedControls();
    }

    function failTutorialStep(summary, whyText, focusEl, chipText = "Step Paused", targetText = "Fix highlighted control") {
        setStatusTexts(summary, whyText);
        if (focusEl) {
            applyFocus([focusEl], chipText, targetText, "error");
            scheduleAutoCenter(focusEl || dimensionsSection, null, focusEl || dimensionsSection);
        } else {
            setFocusRail(chipText, targetText, "error");
            scheduleAutoCenter(dimensionsSection, null, dimensionsSection);
        }
        pauseTutorialPlayback();
    }

    function dispatchCommitEvents(el) {
        if (!el) return;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function verifySetupCommit(lesson) {
        if (!lesson) return false;
        const expectedValue = String(lesson.startValue ?? "");
        return (
            String(valueInput?.value ?? "") === expectedValue &&
            String(fromSelect?.value ?? "") === String(lesson.fromUnit ?? "") &&
            String(toSelect?.value ?? "") === String(lesson.toUnit ?? "")
        );
    }

    function countWords(text) {
        if (!text) return 0;
        return String(text)
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .length;
    }

    function getWatchSpeedMultiplier() {
        return 1;
    }

    function clampNumber(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getPopupReadMetrics(explanationText, whyText) {
        const words = countWords(explanationText) + countWords(whyText);
        if (words <= 0) {
            return {
                words: 0,
                seconds: WATCH_TRANSITION_MIN_MS / 1000,
                ms: WATCH_TRANSITION_MIN_MS
            };
        }

        const baseSeconds = (words / POPUP_READING_WPM) * 60;
        const boundedSeconds = clampNumber(
            baseSeconds + POPUP_READING_BUFFER_SECONDS,
            POPUP_MIN_SECONDS,
            POPUP_MAX_SECONDS
        );
        const scaledSeconds = boundedSeconds * getWatchSpeedMultiplier();
        return {
            words,
            seconds: Number(scaledSeconds.toFixed(1)),
            ms: Math.round(scaledSeconds * 1000)
        };
    }

    function computePopupPauseMs(explanationText, whyText) {
        return getPopupReadMetrics(explanationText, whyText).ms;
    }

    function logLessonPopupTimingEstimate(lesson) {
        if (!lesson || !Array.isArray(lesson.steps)) return;
        const timingRows = [];

        lesson.steps.forEach((step, idx) => {
            if (!step) return;
            if (step.type === "setup" || step.type === "evaluate") {
                const metrics = getPopupReadMetrics(step.explanation, step.why);
                timingRows.push({
                    step: idx + 1,
                    popup: `${step.type}: lesson message`,
                    words: metrics.words,
                    pauseSeconds: metrics.seconds
                });
                return;
            }

            if (step.type === "factor") {
                [
                    { key: "open", label: "factor: open dropdown" },
                    { key: "select", label: "factor: select option" },
                    { key: "add", label: "factor: press add" },
                    { key: "inserted", label: "factor: inserted check" }
                ].forEach((entry) => {
                    const msg = FACTOR_POPUP_MESSAGES[entry.key];
                    const metrics = getPopupReadMetrics(msg.explanation, msg.why);
                    timingRows.push({
                        step: idx + 1,
                        popup: entry.label,
                        words: metrics.words,
                        pauseSeconds: metrics.seconds
                    });
                });

                timingRows.push({
                    step: idx + 1,
                    popup: "factor: add transition",
                    words: 0,
                    pauseSeconds: Number((WATCH_TRANSITION_MIN_MS / 1000).toFixed(1))
                });
            }
        });

        const completeMetrics = getPopupReadMetrics(
            "Tutorial complete. Try Guided or Practice mode and replay the lesson for active recall.",
            "Mastery grows when you can predict each next factor before the system shows it."
        );
        timingRows.push({
            step: lesson.steps.length + 1,
            popup: "complete: lesson summary",
            words: completeMetrics.words,
            pauseSeconds: completeMetrics.seconds
        });

        if (timingRows.length > 0 && typeof console !== "undefined" && typeof console.table === "function") {
            console.groupCollapsed(`[DA Tutorial Timing] ${lesson.title}`);
            console.table(timingRows);
            console.groupEnd();
        }
    }

    function animateButtonPress(btn) {
        if (!btn) return;
        btn.classList.remove("da-btn-press");
        void btn.offsetWidth;
        btn.classList.add("da-btn-press");
        queueTutorialAction(240, () => {
            btn.classList.remove("da-btn-press");
        });
    }

    function hideTutorialPicker() {
        if (!tutorialPicker) return;
        tutorialPicker.classList.remove("is-open");
        tutorialPicker.classList.add("hidden");
        tutorialPicker.setAttribute("aria-hidden", "true");
        if (tutorialPickerOptions) tutorialPickerOptions.innerHTML = "";
    }

    function isTutorialPickerVisible() {
        return !!tutorialPicker && tutorialPicker.classList.contains("is-open") && !tutorialPicker.classList.contains("hidden");
    }

    function formatFactorForDisplay(factor) {
        if (!factor) return "";
        if (factor.type === "formula") {
            return `${factor.display} / 1 ${factor.denUnit}`;
        }
        return `${factor.numVal} ${factor.numUnit} / ${factor.denVal} ${factor.denUnit}`;
    }

    function showTutorialPicker(matchValue, expectedFactor) {
        if (!tutorialPicker || !tutorialPickerOptions || !factorBank) return [];
        const factorRect = factorBank.getBoundingClientRect();
        const margin = 10;
        const pickerWidth = Math.min(320, Math.max(window.innerWidth - 20, 220));
        const left = Math.min(Math.max(factorRect.left, margin), Math.max(window.innerWidth - pickerWidth - margin, margin));
        const top = Math.min(Math.max(factorRect.bottom + 8, getStickyOffset() + 8), Math.max(window.innerHeight - 220, getStickyOffset() + 8));

        tutorialPicker.style.left = `${left}px`;
        tutorialPicker.style.top = `${top}px`;
        tutorialPicker.style.width = `${pickerWidth}px`;
        if (tutorialPickerHeader) tutorialPickerHeader.textContent = "Open Dropdown -> Choose Factor";

        const options = Array.from(factorBank.options)
            .filter((opt) => !!opt.value)
            .slice(0, 8);
        if (matchValue && !options.some((opt) => opt.value === matchValue)) {
            const targetOption = Array.from(factorBank.options).find((opt) => opt.value === matchValue);
            if (targetOption) {
                options.unshift(targetOption);
            }
        }

        const selectedOptions = [];
        tutorialPickerOptions.innerHTML = "";
        options.forEach((opt) => {
            const line = document.createElement("div");
            line.className = "da-tutorial-picker-option";
            line.textContent = opt.textContent || "Factor";
            line.dataset.value = opt.value;
            if (opt.value === matchValue) {
                line.classList.add("is-target");
            }
            tutorialPickerOptions.appendChild(line);
            selectedOptions.push(line);
        });

        if (selectedOptions.length === 0) {
            const fallback = document.createElement("div");
            fallback.className = "da-tutorial-picker-option is-target";
            fallback.textContent = formatFactorForDisplay(expectedFactor) || "Expected conversion factor";
            fallback.dataset.value = matchValue || "";
            tutorialPickerOptions.appendChild(fallback);
            selectedOptions.push(fallback);
        }

        tutorialPicker.classList.remove("hidden");
        tutorialPicker.setAttribute("aria-hidden", "false");
        tutorialPicker.classList.add("is-open");

        return selectedOptions;
    }

    function findFactorMatchValue(factor) {
        if (!factorBank || !factor) return null;
        for (const option of factorBank.options) {
            if (!option.value) continue;
            try {
                const parsed = JSON.parse(option.value);
                if (factor.type === "formula") {
                    if (
                        parsed.type === "formula" &&
                        parsed.formula === factor.formula &&
                        parsed.numUnit === factor.numUnit &&
                        parsed.denUnit === factor.denUnit
                    ) {
                        return option.value;
                    }
                } else if (
                    parsed.type !== "formula" &&
                    Number(parsed.numVal) === Number(factor.numVal) &&
                    Number(parsed.denVal) === Number(factor.denVal) &&
                    parsed.numUnit === factor.numUnit &&
                    parsed.denUnit === factor.denUnit
                ) {
                    return option.value;
                }
            } catch (_err) {
                // ignore malformed option payloads
            }
        }
        return null;
    }

    function createFactorMicroActions(factor, matchValue) {
        let renderedOptions = [];
        const expectedChainLength = daChain.length + 1;

        const dwellMsByIndex = [
            Math.max(computePopupPauseMs(FACTOR_POPUP_MESSAGES.open.explanation, FACTOR_POPUP_MESSAGES.open.why) - 2000, WATCH_TRANSITION_MIN_MS),
            computePopupPauseMs(FACTOR_POPUP_MESSAGES.select.explanation, FACTOR_POPUP_MESSAGES.select.why),
            computePopupPauseMs(FACTOR_POPUP_MESSAGES.add.explanation, FACTOR_POPUP_MESSAGES.add.why),
            WATCH_TRANSITION_MIN_MS,
            computePopupPauseMs(FACTOR_POPUP_MESSAGES.inserted.explanation, FACTOR_POPUP_MESSAGES.inserted.why)
        ];

        const actions = [
            () => {
                setStatusTexts(
                    FACTOR_POPUP_MESSAGES.open.explanation,
                    FACTOR_POPUP_MESSAGES.open.why
                );
                applyFocus([factorBank], "Open Dropdown", "Factor dropdown", "check");
                scheduleAutoCenter(factorBank || dimensionsSection, null, factorBank || dimensionsSection);
                animateButtonPress(factorBank);
                renderedOptions = showTutorialPicker(matchValue, factor);
            },
            () => {
                setStatusTexts(
                    FACTOR_POPUP_MESSAGES.select.explanation,
                    FACTOR_POPUP_MESSAGES.select.why
                );
                const targetRow = renderedOptions.find((row) => row.dataset.value === matchValue) || renderedOptions[0];
                if (targetRow) {
                    targetRow.classList.add("is-selected");
                }
                factorBank.value = matchValue;
                dispatchCommitEvents(factorBank);
                if (factorBank.value !== matchValue) {
                    failTutorialStep(
                        "Could not commit the selected conversion factor to the real dropdown.",
                        "Automated mode pauses here to prevent adding the wrong factor.",
                        factorBank,
                        "Commit Failed",
                        "Factor dropdown"
                    );
                    return false;
                }
                scheduleAutoCenter(factorBank || dimensionsSection, null, factorBank || dimensionsSection);
                return true;
            },
            () => {
                if (factorBank.value !== matchValue) {
                    failTutorialStep(
                        "Factor dropdown is not committed to the expected option.",
                        "Select commit must succeed before Add Factor can run.",
                        factorBank,
                        "Commit Required",
                        "Factor dropdown"
                    );
                    return false;
                }
                setStatusTexts(
                    FACTOR_POPUP_MESSAGES.add.explanation,
                    FACTOR_POPUP_MESSAGES.add.why
                );
                applyFocus([btnAddFactor], "Press Add", "Add Factor button", "active");
                const pressAddExplainerAnchor = btnAddFactor || factorBank || dimensionsSection;

                // Clear the dropdown overlay during the Add step so the button stays unobscured.
                hideTutorialPicker();

                scheduleAutoCenter(
                    btnAddFactor || dimensionsSection,
                    null,
                    pressAddExplainerAnchor,
                    {
                        preferredSide: "below",
                        lockedSide: "below",
                        extraAvoidEls: [],
                        anchorPoint: null,
                        pointerGapPx: 18,
                        constrainWithinEl: btnAddFactor?.parentElement || null,
                        constrainMargin: 10
                    }
                );
                animateButtonPress(btnAddFactor);
                return true;
            },
            () => {
                btnAddFactor.click();
                hideTutorialPicker();
                if (daChain.length !== expectedChainLength) {
                    failTutorialStep(
                        "Add Factor did not update the chain.",
                        "The tutorial paused because the factor was not actually inserted.",
                        btnAddFactor,
                        "Add Failed",
                        "Add Factor button"
                    );
                    return false;
                }
                return true;
            },
            () => {
                if (!chainContainer) return;
                const lastFactor = chainContainer.querySelector('[data-da-role="factor"][data-da-factor-index="' + String(Math.max(daChain.length - 1, 0)) + '"]');
                if (!lastFactor) {
                    failTutorialStep(
                        "Chain visualization did not render the new factor.",
                        "The factor data was added, but the chain view did not reflect it.",
                        chainContainer,
                        "Render Failed",
                        "Factor chain"
                    );
                    return false;
                }
                setStatusTexts(
                    FACTOR_POPUP_MESSAGES.inserted.explanation,
                    FACTOR_POPUP_MESSAGES.inserted.why
                );
                applyFocus([lastFactor], "Factor Added", "Newest chain factor", "ok");
                scheduleAutoCenter(chainContainer, lastFactor, lastFactor);
                return true;
            }
        ];

        return {
            actions,
            dwellMsByIndex
        };
    }

    function runGuidedMicroAction() {
        if (!guidedMicroActions || guidedMicroActions.length === 0) return false;

        guidedMicroIndex += 1;
        const action = guidedMicroActions[guidedMicroIndex];
        let actionResult = true;
        if (typeof action === "function") {
            actionResult = action();
        }

        if (actionResult === false) {
            guidedMicroActions = null;
            guidedMicroIndex = -1;
            updatePopupGuidedControls();
            return false;
        }

        if (guidedMicroIndex >= guidedMicroActions.length - 1) {
            guidedMicroActions = null;
            guidedMicroIndex = -1;
            daTutorialState.stepIdx += 1;
            updateProgress();

            const lesson = getCurrentLesson();
            if (lesson && daTutorialState.stepIdx >= lesson.steps.length) {
                advanceOneStep();
            }
        }

        updatePopupGuidedControls();
        return true;
    }

    function playWatchMicroActions(actions, dwellMsByIndex = []) {
        if (!Array.isArray(actions) || actions.length === 0) return;
        clearWatchMicroActionState();
        watchMicroActions = actions;
        watchMicroDwellMs = Array.isArray(dwellMsByIndex) ? dwellMsByIndex : [];
        watchMicroIndex = -1;
        runNextWatchMicroAction({ scheduleFollowing: true });
    }

    function setStatusTexts(text, whyText) {
        if (stepExplanation) stepExplanation.textContent = text || "";
        if (stepWhy) stepWhy.textContent = whyText || "";
        setExplainerContent(latestExplainerTitle, text, whyText);
    }

    function cancelPendingAutoCenter() {
        if (pendingCenterRaf) {
            cancelAnimationFrame(pendingCenterRaf);
            pendingCenterRaf = null;
        }
        if (pendingCenterTimer) {
            clearTimeout(pendingCenterTimer);
            pendingCenterTimer = null;
        }
        if (cameraPathTimer) {
            clearTimeout(cameraPathTimer);
            cameraPathTimer = null;
        }
        if (explainerTimer) {
            clearTimeout(explainerTimer);
            explainerTimer = null;
        }
        if (explainerRaf) {
            cancelAnimationFrame(explainerRaf);
            explainerRaf = null;
        }
    }

    function placeExplainerNear(anchorEl, placementOptions = null) {
        if (!floatExplainer) return;
        if (explainerDismissedForStep) return;

        const fallbackAnchor = currentStepChip || dimensionsSection;
        const target = anchorEl || fallbackAnchor;
        if (!target) return;
        explainerAnchor = target;
        explainerPlacementOptions = placementOptions || null;

        const activePlacementOptions = explainerPlacementOptions || {};
        const {
            anchorPoint,
            extraAvoidEls: rawExtraAvoidEls,
            constrainWithinEl,
            constrainMargin: rawConstrainMargin,
            preferredSide,
            lockedSide,
            pointerGapPx: rawPointerGapPx
        } = activePlacementOptions;
        const anchorPointCandidate = anchorPoint;
        const hasCustomAnchorPoint = !!anchorPointCandidate
            && Number.isFinite(anchorPointCandidate.x)
            && Number.isFinite(anchorPointCandidate.y);
        const resolvedAnchorPoint = hasCustomAnchorPoint
            ? clampViewportPoint({ x: anchorPointCandidate.x, y: anchorPointCandidate.y })
            : null;

        showExplainer();

        const margin = 12;
        const pointerGap = Number.isFinite(rawPointerGapPx)
            ? Math.max(rawPointerGapPx, 0)
            : 10;
        const stickyOffset = getStickyOffset();
        const viewTop = stickyOffset + 8;
        const viewBottom = window.innerHeight - margin;
        const viewLeft = margin;
        const viewRight = window.innerWidth - margin;

        const targetRect = resolvedAnchorPoint
            ? {
                left: resolvedAnchorPoint.x - 12,
                right: resolvedAnchorPoint.x + 12,
                top: resolvedAnchorPoint.y - 12,
                bottom: resolvedAnchorPoint.y + 12,
                width: 24,
                height: 24
            }
            : target.getBoundingClientRect();

        if (isSmallViewport()) {
            const width = Math.max(window.innerWidth - (margin * 2), 220);
            const top = Math.max(viewTop, window.innerHeight - (floatExplainer.offsetHeight || 130) - margin);
            floatExplainer.dataset.side = "dock";
            floatExplainer.style.width = `${width}px`;
            floatExplainer.style.left = `${viewLeft}px`;
            floatExplainer.style.top = `${top}px`;
            return;
        }

        floatExplainer.style.width = "min(300px, calc(100vw - 24px))";
        const panelRect = floatExplainer.getBoundingClientRect();
        const clearRect = {
            left: targetRect.left - 16,
            right: targetRect.right + 16,
            top: targetRect.top - 14,
            bottom: targetRect.bottom + 14
        };

        const extraAvoidEls = Array.isArray(rawExtraAvoidEls)
            ? rawExtraAvoidEls.filter(Boolean)
            : [];

        const constrainMargin = Number.isFinite(rawConstrainMargin)
            ? Math.max(rawConstrainMargin, 0)
            : 0;
        const constrainRect = constrainWithinEl && typeof constrainWithinEl.getBoundingClientRect === "function"
            ? constrainWithinEl.getBoundingClientRect()
            : null;

        const avoidRects = [
            currentStepTarget,
            stepExplanation,
            stepWhy,
            ...extraAvoidEls
        ].filter(Boolean).map((el) => {
            const rect = el.getBoundingClientRect();
            return {
                left: rect.left - 6,
                right: rect.right + 6,
                top: rect.top - 6,
                bottom: rect.bottom + 6
            };
        });

        function clampRect(left, top) {
            let clampedLeft = Math.min(Math.max(left, viewLeft), Math.max(viewRight - panelRect.width, viewLeft));
            const clampedTop = Math.min(Math.max(top, viewTop), Math.max(viewBottom - panelRect.height, viewTop));

            if (constrainRect) {
                const minWithin = constrainRect.left + constrainMargin;
                const maxWithin = constrainRect.right - panelRect.width - constrainMargin;
                if (maxWithin >= minWithin) {
                    clampedLeft = Math.min(Math.max(clampedLeft, minWithin), maxWithin);
                }
            }

            return {
                left: clampedLeft,
                top: clampedTop
            };
        }

        function overlapArea(a, b) {
            const dx = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const dy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return dx * dy;
        }

        const centerX = targetRect.left + (targetRect.width / 2);
        const centerY = targetRect.top + (targetRect.height / 2);

        const horizontalRatio = centerX / Math.max(window.innerWidth, 1);
        const verticalRatio = centerY / Math.max(window.innerHeight, 1);
        const sidePriority = horizontalRatio < 0.35
            ? ["right", "below", "above", "left"]
            : horizontalRatio > 0.65
                ? ["left", "below", "above", "right"]
                : verticalRatio < 0.42
                    ? ["below", "right", "left", "above"]
                    : ["above", "right", "left", "below"];

        const normalizedSidePriority = [preferredSide, ...sidePriority]
            .filter((side) => side === "right" || side === "left" || side === "above" || side === "below")
            .filter((side, idx, arr) => arr.indexOf(side) === idx);

        const normalizedLockedSide = (lockedSide === "right" || lockedSide === "left" || lockedSide === "above" || lockedSide === "below")
            ? lockedSide
            : null;

        const candidateSides = normalizedLockedSide
            ? [normalizedLockedSide, ...normalizedSidePriority.filter((side) => side !== normalizedLockedSide)]
            : normalizedSidePriority;

        const candidates = candidateSides.map((side) => {
            if (side === "right") {
                return { side, left: targetRect.right + pointerGap, top: centerY - (panelRect.height / 2) };
            }
            if (side === "left") {
                return { side, left: targetRect.left - panelRect.width - pointerGap, top: centerY - (panelRect.height / 2) };
            }
            if (side === "above") {
                return { side, left: centerX - (panelRect.width / 2), top: targetRect.top - panelRect.height - pointerGap };
            }
            return { side, left: centerX - (panelRect.width / 2), top: targetRect.bottom + pointerGap };
        });

        const scored = candidates.map((candidate, idx) => {
            const clamped = clampRect(candidate.left, candidate.top);
            const box = {
                left: clamped.left,
                top: clamped.top,
                right: clamped.left + panelRect.width,
                bottom: clamped.top + panelRect.height
            };
            const overlap = overlapArea(box, clearRect);
            const textOverlap = avoidRects.reduce((sum, rect) => sum + overlapArea(box, rect), 0);
            const move = Math.abs(clamped.left - candidate.left) + Math.abs(clamped.top - candidate.top);
            const distance = Math.hypot((box.left + panelRect.width / 2) - centerX, (box.top + panelRect.height / 2) - centerY);
            const score = (overlap * 10000) + (textOverlap * 65) + (move * 9) + distance + (idx * 2);
            return { ...candidate, ...clamped, overlap, score };
        }).sort((a, b) => a.score - b.score);

        const best = scored[0];
        if (!best || best.overlap > 0) {
            floatExplainer.dataset.side = "dock";
            const dockLeft = Math.min(Math.max(centerX - (panelRect.width / 2), viewLeft), Math.max(viewRight - panelRect.width, viewLeft));
            const dockTop = Math.max(viewBottom - panelRect.height, viewTop);
            floatExplainer.style.left = `${dockLeft}px`;
            floatExplainer.style.top = `${dockTop}px`;
            return;
        }

        floatExplainer.dataset.side = best.side;
        floatExplainer.style.left = `${best.left}px`;
        floatExplainer.style.top = `${best.top}px`;
    }

    function ensureCameraPathLayer() {
        if (cameraPathLayer) return;

        cameraPathLayer = document.createElement("div");
        cameraPathLayer.className = "da-camera-path-layer";

        cameraPathSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        cameraPathSvg.setAttribute("class", "da-camera-path-svg");
        cameraPathSvg.setAttribute("aria-hidden", "true");

        cameraPathStroke = document.createElementNS("http://www.w3.org/2000/svg", "path");
        cameraPathStroke.setAttribute("class", "da-camera-path-stroke");

        cameraPathArrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        cameraPathArrow.setAttribute("class", "da-camera-path-arrow");

        cameraPathSvg.appendChild(cameraPathStroke);
        cameraPathSvg.appendChild(cameraPathArrow);
        cameraPathLayer.appendChild(cameraPathSvg);
        document.body.appendChild(cameraPathLayer);
    }

    function clampViewportPoint(point) {
        const stickyOffset = getStickyOffset();
        const marginX = 22;
        const minY = stickyOffset + 14;
        const maxX = Math.max(window.innerWidth - marginX, marginX);
        const maxY = Math.max(window.innerHeight - 14, minY);

        return {
            x: Math.min(Math.max(point.x, marginX), maxX),
            y: Math.min(Math.max(point.y, minY), maxY)
        };
    }

    function getViewportPointForElement(el) {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const point = {
            x: rect.left + (rect.width / 2),
            y: rect.top + (rect.height / 2)
        };
        return clampViewportPoint(point);
    }

    function drawCameraPathCue(fromPoint, toPoint) {
        if (!fromPoint || !toPoint) return;
        ensureCameraPathLayer();
        if (!cameraPathLayer || !cameraPathSvg || !cameraPathStroke || !cameraPathArrow) return;

        cameraPathSvg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
        cameraPathSvg.setAttribute("width", String(window.innerWidth));
        cameraPathSvg.setAttribute("height", String(window.innerHeight));

        const midpointX = (fromPoint.x + toPoint.x) / 2;
        const lift = Math.max(26, Math.min(84, Math.abs(toPoint.x - fromPoint.x) * 0.22 + 18));
        const controlY = Math.min(fromPoint.y, toPoint.y) - lift;

        cameraPathStroke.setAttribute("d", `M ${fromPoint.x} ${fromPoint.y} Q ${midpointX} ${controlY} ${toPoint.x} ${toPoint.y}`);

        const tangentX = toPoint.x - midpointX;
        const tangentY = toPoint.y - controlY;
        const angle = Math.atan2(tangentY, tangentX);
        const arrowLength = 12;
        const arrowWidth = 7;
        const backX = toPoint.x - Math.cos(angle) * arrowLength;
        const backY = toPoint.y - Math.sin(angle) * arrowLength;
        const leftX = backX + Math.cos(angle + Math.PI / 2) * arrowWidth;
        const leftY = backY + Math.sin(angle + Math.PI / 2) * arrowWidth;
        const rightX = backX + Math.cos(angle - Math.PI / 2) * arrowWidth;
        const rightY = backY + Math.sin(angle - Math.PI / 2) * arrowWidth;

        cameraPathArrow.setAttribute("points", `${toPoint.x},${toPoint.y} ${leftX},${leftY} ${rightX},${rightY}`);

        cameraPathLayer.classList.remove("is-active");
        void cameraPathLayer.offsetWidth;
        cameraPathLayer.classList.add("is-active");
    }

    function maybeShowCameraPathCue(targetEl, motionProfile) {
        if (!targetEl) return;

        const currentPoint = getViewportPointForElement(targetEl);
        if (!currentPoint) return;

        const mode = daTutorialState.mode || modeSelect?.value || "watch";
        const reducedMotion = motionProfile.behavior === "auto" && motionProfile.delayMs === 0;
        const shouldDraw = mode === "watch" && !reducedMotion && !!lastCameraPoint;

        if (shouldDraw) {
            const deltaX = currentPoint.x - lastCameraPoint.x;
            const deltaY = currentPoint.y - lastCameraPoint.y;
            const distance = Math.hypot(deltaX, deltaY);
            if (distance >= 34) {
                drawCameraPathCue(lastCameraPoint, currentPoint);
            }
        }

        lastCameraPoint = currentPoint;
    }

    function getMotionProfile() {
        const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
            return { behavior: "auto", delayMs: 0, deadZonePx: 26 };
        }

        const mode = daTutorialState.mode || modeSelect?.value || "watch";
        if (mode === "watch") {
            return { behavior: "smooth", delayMs: 140, deadZonePx: 88 };
        }

        return { behavior: "auto", delayMs: 35, deadZonePx: 54 };
    }

    function getStickyOffset() {
        return stickyHeader ? (stickyHeader.getBoundingClientRect().height + 10) : 0;
    }

    function getPreferredViewportCenterY() {
        const stickyOffset = getStickyOffset();
        return stickyOffset + ((window.innerHeight - stickyOffset) * 0.45);
    }

    function isNearViewportCenter(el, deadZonePx) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const elementCenter = rect.top + (rect.height / 2);
        const preferredCenter = getPreferredViewportCenterY();
        return Math.abs(elementCenter - preferredCenter) <= deadZonePx;
    }

    function centerElementInViewport(el, motionProfile) {
        if (!el) return;
        if (isNearViewportCenter(el, motionProfile.deadZonePx)) return;

        const rect = el.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        const preferredCenter = getPreferredViewportCenterY();
        const targetTop = absoluteTop - preferredCenter + (rect.height / 2);
        const maxTop = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
        const clampedTop = Math.max(0, Math.min(targetTop, maxTop));

        window.scrollTo({ top: clampedTop, behavior: motionProfile.behavior });
    }

    function isNearContainerCenter(target, container, deadZonePx) {
        if (!target || !container) return false;
        const targetRect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const targetCenter = targetRect.left + (targetRect.width / 2);
        const containerCenter = containerRect.left + (containerRect.width / 2);
        return Math.abs(targetCenter - containerCenter) <= deadZonePx;
    }

    function centerInChain(target, motionProfile) {
        if (!chainContainer || !target) return;
        if (isNearContainerCenter(target, chainContainer, motionProfile.deadZonePx)) return;

        const containerRect = chainContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const delta = (targetRect.left + (targetRect.width / 2)) - (containerRect.left + (containerRect.width / 2));
        const nextLeft = chainContainer.scrollLeft + delta;
        const maxLeft = Math.max(chainContainer.scrollWidth - chainContainer.clientWidth, 0);
        const clampedLeft = Math.max(0, Math.min(nextLeft, maxLeft));

        chainContainer.scrollTo({ left: clampedLeft, behavior: motionProfile.behavior });
    }

    function scheduleAutoCenter(pageTarget, chainTarget = null, explainerTarget = null, explainerOptions = null) {
        cancelPendingAutoCenter();
        const motionProfile = getMotionProfile();

        const runCenter = () => {
            const resolvedPageTarget = pageTarget || dimensionsSection;
            centerElementInViewport(resolvedPageTarget, motionProfile);
            if (chainTarget) {
                centerInChain(chainTarget, motionProfile);
            }

            const cueTarget = chainTarget || resolvedPageTarget || dimensionsSection;
            const cueDelay = motionProfile.behavior === "smooth" ? 220 : 40;
            cameraPathTimer = setTimeout(() => {
                maybeShowCameraPathCue(cueTarget, motionProfile);
            }, cueDelay);

            const explainerAnchorEl = explainerTarget || cueTarget || currentStepChip || dimensionsSection;
            const explainerDelay = motionProfile.behavior === "smooth" ? 250 : 60;
            explainerTimer = setTimeout(() => {
                placeExplainerNear(explainerAnchorEl, explainerOptions);
            }, explainerDelay);
        };

        if (motionProfile.delayMs > 0) {
            pendingCenterTimer = setTimeout(() => {
                pendingCenterRaf = requestAnimationFrame(runCenter);
            }, motionProfile.delayMs);
            return;
        }

        pendingCenterRaf = requestAnimationFrame(runCenter);
    }

    function setFocusRail(chipText, targetText, tone = "active") {
        if (currentStepChip) {
            currentStepChip.textContent = chipText || "Idle";
            currentStepChip.classList.remove("da-step-chip-active", "da-step-chip-check", "da-step-chip-ok", "da-step-chip-error");
            currentStepChip.classList.add(
                tone === "ok" ? "da-step-chip-ok"
                : tone === "check" ? "da-step-chip-check"
                : tone === "error" ? "da-step-chip-error"
                : "da-step-chip-active"
            );
        }
        if (currentStepTarget) {
            currentStepTarget.textContent = targetText || "Tutorial controls";
        }
        latestExplainerTitle = chipText || "Current Step";
        if (floatExplainerKicker) {
            floatExplainerKicker.textContent = latestExplainerTitle;
        }
    }

    function clearFocusVisuals() {
        const focusables = [valueInput, fromSelect, toSelect, factorBank, btnAddFactor, btnCheck, btnResetChain, chainContainer]
            .filter(Boolean);
        focusables.forEach((el) => {
            el.classList.remove("da-focus-active", "da-focus-dim");
        });

        if (chainContainer) {
            chainContainer.querySelectorAll("[data-da-role]").forEach((node) => {
                node.classList.remove("da-focus-active", "da-focus-dim");
            });
        }
    }

    function applyFocus(activeElements, chipText, targetText, tone = "active") {
        clearFocusVisuals();
        setFocusRail(chipText, targetText, tone);

        const focusables = [valueInput, fromSelect, toSelect, factorBank, btnAddFactor, btnCheck, btnResetChain, chainContainer]
            .filter(Boolean);
        focusables.forEach((el) => el.classList.add("da-focus-dim"));

        if (chainContainer) {
            chainContainer.querySelectorAll("[data-da-role]").forEach((node) => {
                node.classList.add("da-focus-dim");
            });
        }

        const actives = Array.isArray(activeElements) ? activeElements.filter(Boolean) : [activeElements].filter(Boolean);
        actives.forEach((el) => {
            el.classList.remove("da-focus-dim");
            el.classList.add("da-focus-active");
        });
    }

    function renderLessonOptions() {
        lessonSelect.innerHTML = "";
        daTutorialState.lessons.forEach((lesson, idx) => {
            const opt = document.createElement("option");
            opt.value = String(idx);
            opt.textContent = lesson.title;
            lessonSelect.appendChild(opt);
        });
    }

    function getCurrentLesson() {
        return daTutorialState.lessons[daTutorialState.lessonIdx] || null;
    }

    function getCurrentStep() {
        const lesson = getCurrentLesson();
        if (!lesson) return null;
        return lesson.steps[daTutorialState.stepIdx] || null;
    }

    function updateProgress() {
        const lesson = getCurrentLesson();
        const total = lesson?.steps?.length || 0;
        const now = Math.min(daTutorialState.stepIdx, total);
        if (progress) progress.textContent = `Step ${now}/${total}`;
    }

    function stopPlayback(options = {}) {
        const preserveVisualState = !!options.preserveVisualState;
        daTutorialState.isPlaying = false;
        if (daTutorialState.timerId) {
            clearInterval(daTutorialState.timerId);
            daTutorialState.timerId = null;
        }
        cancelPendingAutoCenter();
        clearTutorialActions();
        if (!preserveVisualState) {
            clearFocusVisuals();
        }
        lastCameraPoint = null;
        if (cameraPathLayer) {
            cameraPathLayer.classList.remove("is-active");
        }
        if (floatExplainer && !preserveVisualState) {
            hideExplainer();
        }
        if (!preserveVisualState) {
            hideTutorialPicker();
        }
        clearWatchMicroActionState();
        guidedMicroActions = null;
        guidedMicroIndex = -1;
        updatePopupGuidedControls();
    }

    function applyFactorStep(factor) {
        if (!factorBank || !btnAddFactor) return false;
        const matchValue = findFactorMatchValue(factor);
        if (!matchValue) return false;

        const factorPlan = createFactorMicroActions(factor, matchValue);
        if (isGuidedMode()) {
            guidedMicroActions = factorPlan.actions;
            guidedMicroIndex = -1;
            runGuidedMicroAction();
            return {
                ok: true,
                watchDwellMs: 0
            };
        }

        playWatchMicroActions(factorPlan.actions, factorPlan.dwellMsByIndex);

        const totalFactorDwellMs = factorPlan.dwellMsByIndex.reduce((sum, item) => sum + item, 0);

        return {
            ok: true,
            watchDwellMs: Math.max(totalFactorDwellMs, WATCH_TRANSITION_MIN_MS)
        };
    }

    function executeStep(step) {
        if (!step) return;
        const lesson = getCurrentLesson();
        if (!lesson) return;

        explainerDismissedForStep = false;

        setStatusTexts(step.explanation, step.why);

        if (step.type === "setup") {
            applyFocus([valueInput, fromSelect, toSelect], "Setup", "Start value + units", "active");
            if (valueInput) {
                valueInput.value = lesson.startValue;
                dispatchCommitEvents(valueInput);
            }
            if (fromSelect) {
                fromSelect.value = lesson.fromUnit;
                dispatchCommitEvents(fromSelect);
            }
            if (toSelect) {
                toSelect.value = lesson.toUnit;
                dispatchCommitEvents(toSelect);
            }
            if (btnResetChain) btnResetChain.click();
            if (!verifySetupCommit(lesson)) {
                if (valueInput) {
                    valueInput.value = lesson.startValue;
                    dispatchCommitEvents(valueInput);
                }
                if (fromSelect) {
                    fromSelect.value = lesson.fromUnit;
                    dispatchCommitEvents(fromSelect);
                }
                if (toSelect) {
                    toSelect.value = lesson.toUnit;
                    dispatchCommitEvents(toSelect);
                }
            }
            if (!verifySetupCommit(lesson)) {
                failTutorialStep(
                    "Setup values did not commit to the form.",
                    `Expected ${lesson.startValue} ${lesson.fromUnit} -> ${lesson.toUnit}.`,
                    valueInput || fromSelect || toSelect,
                    "Setup Failed",
                    "Given + units"
                );
                return;
            }
            scheduleAutoCenter(valueInput || fromSelect || toSelect || dimensionsSection, null, valueInput || fromSelect || toSelect || dimensionsSection);
            return Math.max(computePopupPauseMs(step.explanation, step.why) - 1000, WATCH_TRANSITION_MIN_MS);
        }

        if (step.type === "factor") {
            const factorResult = applyFactorStep(step.factor);
            if (!factorResult || !factorResult.ok) {
                setStatusTexts(
                    `Could not locate conversion factor for this scripted step: ${JSON.stringify(step.factor)}.`,
                    "The lesson script may reference a factor that is not present in the factor bank."
                );
                applyFocus([factorBank], "Factor Missing", "Required factor not found", "error");
                scheduleAutoCenter(factorBank || dimensionsSection, null, factorBank || dimensionsSection);
                stopPlayback();
                return WATCH_TRANSITION_MIN_MS;
            }
            return factorResult.watchDwellMs;
        }

        if (step.type === "evaluate") {
            applyFocus([btnCheck, chainContainer], "Evaluate", "Check result + units", "check");
            scheduleAutoCenter(btnCheck || chainContainer || dimensionsSection, null, btnCheck || chainContainer || dimensionsSection);
            animateButtonPress(btnCheck);
            if (btnCheck) btnCheck.click();
            const resultTarget = outputPanel && !outputPanel.classList.contains("hidden") ? outputPanel : chainContainer;
            setStatusTexts(step.explanation, step.why);
            const finalActives = [btnCheck, resultTarget || chainContainer].filter(Boolean);
            applyFocus(finalActives, "Result", "Evaluate Chain + final output", "ok");
            scheduleAutoCenter(btnCheck || resultTarget || dimensionsSection, null, btnCheck || resultTarget || dimensionsSection);
            return computePopupPauseMs(step.explanation, step.why);
        }

        return WATCH_TRANSITION_MIN_MS;
    }

    function handleGuidedNextRequest() {
        daTutorialState.isPlaying = false;
        if (daTutorialState.timerId) {
            clearInterval(daTutorialState.timerId);
            daTutorialState.timerId = null;
        }
        cancelPendingAutoCenter();

        if (guidedMicroActions) {
            runGuidedMicroAction();
            return;
        }

        advanceOneStep();
        updatePopupGuidedControls();
    }

    function handleWatchNextRequest() {
        if (daTutorialState.timerId) {
            clearTimeout(daTutorialState.timerId);
            daTutorialState.timerId = null;
        }
        cancelPendingAutoCenter();

        // Keep watch mode active: manual next should advance the current actionable unit.
        daTutorialState.isPlaying = true;

        if (isWatchMicroSequenceActive()) {
            if (watchMicroTimerId) {
                clearTimeout(watchMicroTimerId);
                watchMicroTimerId = null;
            }
            runNextWatchMicroAction({ scheduleFollowing: true });
            return;
        }

        const dwellMs = advanceOneStep();
        if (!daTutorialState.isPlaying) return;

        if (isWatchMicroSequenceActive()) return;

        const lesson = getCurrentLesson();
        if (!lesson || daTutorialState.stepIdx >= lesson.steps.length) return;
        scheduleNextWatchAdvance(Math.max(dwellMs || WATCH_STEP_INTERVAL_MS, WATCH_TRANSITION_MIN_MS));
    }

    function handleManualNextRequest() {
        if (isGuidedMode()) {
            handleGuidedNextRequest();
            return;
        }
        handleWatchNextRequest();
    }

    function advanceOneStep() {
        const lesson = getCurrentLesson();
        if (!lesson) return WATCH_TRANSITION_MIN_MS;

        if (daTutorialState.stepIdx >= lesson.steps.length) {
            setStatusTexts(
                "Tutorial complete. Try Guided or Practice mode and replay the lesson for active recall.",
                "Mastery grows when you can predict each next factor before the system shows it."
            );
            setFocusRail("Complete", "Lesson finished", "ok");
            scheduleAutoCenter(currentStepChip || dimensionsSection, null, currentStepChip || dimensionsSection);
            stopPlayback();
            updateProgress();
            return computePopupPauseMs(
                "Tutorial complete. Try Guided or Practice mode and replay the lesson for active recall.",
                "Mastery grows when you can predict each next factor before the system shows it."
            );
        }

        const step = getCurrentStep();
        const isWatchFactorStep = !!step && step.type === "factor" && !isGuidedMode();
        const isGuidedFactorStep = !!step && step.type === "factor" && isGuidedMode();
        const stepDwellMs = executeStep(step);
        if (isWatchFactorStep && isWatchMicroSequenceActive()) {
            return WATCH_TRANSITION_MIN_MS;
        }
        if (!(isGuidedFactorStep && guidedMicroActions)) {
            daTutorialState.stepIdx += 1;
            updateProgress();
        }

        if (daTutorialState.stepIdx >= lesson.steps.length) {
            const preserveFinalVisuals = !!step && step.type === "evaluate";
            stopPlayback({ preserveVisualState: preserveFinalVisuals });
        }

        return Math.max(stepDwellMs || WATCH_TRANSITION_MIN_MS, WATCH_TRANSITION_MIN_MS);
    }

    function scheduleNextWatchAdvance(delayMs) {
        if (!daTutorialState.isPlaying) return;
        if (daTutorialState.timerId) {
            clearTimeout(daTutorialState.timerId);
            daTutorialState.timerId = null;
        }

        daTutorialState.timerId = setTimeout(() => {
            daTutorialState.timerId = null;
            if (!daTutorialState.isPlaying) return;

            const lesson = getCurrentLesson();
            if (!lesson || daTutorialState.stepIdx >= lesson.steps.length) return;

            const dwellMs = advanceOneStep();
            if (!daTutorialState.isPlaying) return;

            if (isWatchMicroSequenceActive()) return;

            const updatedLesson = getCurrentLesson();
            if (!updatedLesson || daTutorialState.stepIdx >= updatedLesson.steps.length) return;
            scheduleNextWatchAdvance(Math.max(dwellMs || WATCH_STEP_INTERVAL_MS, WATCH_TRANSITION_MIN_MS));
        }, Math.max(delayMs, 0));
    }

    function startLesson() {
        stopPlayback();
        daTutorialState.lessonIdx = Number(lessonSelect.value || 0);
        daTutorialState.mode = modeSelect.value || "watch";
        daTutorialState.stepIdx = 0;
        explainerDismissedForStep = false;
        guidedMicroActions = null;
        guidedMicroIndex = -1;
        setStatusTexts(
            "Tutorial started. Use Next Step for Guided/Practice, or Play for Watch mode.",
            "Each step will explain both the operation and the chemistry reason behind it."
        );
        setFocusRail("Ready", "Click Play or Next Step", "active");
        scheduleAutoCenter(modeSelect || btnStart || dimensionsSection, null, modeSelect || btnStart || dimensionsSection);
        updateProgress();
        updatePopupGuidedControls();

        if (daTutorialState.mode === "watch") {
            const lesson = getCurrentLesson();
            logLessonPopupTimingEstimate(lesson);
        }

        if (daTutorialState.mode === "watch") {
            daTutorialState.isPlaying = true;
            scheduleNextWatchAdvance(0);
        } else if (daTutorialState.mode === "guided") {
            // Guided mode still begins with an explicit setup action so form fields are preloaded.
            advanceOneStep();
        }
    }

    function askAboutCurrentStep() {
        const lesson = getCurrentLesson();
        const step = getCurrentStep();
        if (!lesson || !step) return;
        if (!window.ChemTutor || typeof window.ChemTutor.invoke !== "function") return;

        const stepNumber = daTutorialState.stepIdx + 1;
        const systemContext = [
            "The student is in the Dimensional Analysis guided tutorial.",
            `Lesson: ${lesson.title}.`,
            `Mode: ${daTutorialState.mode}.`,
            `Step Number: ${stepNumber}.`,
            `Step Type: ${step.type}.`,
            `Step Explanation: ${step.explanation || ""}.`,
            `Step Why: ${step.why || ""}.`,
            `Current start value: ${valueInput?.value || ""}.`,
            `Current from unit: ${fromSelect?.value || ""}.`,
            `Current target unit: ${toSelect?.value || ""}.`
        ].join(" ");

        window.ChemTutor.invoke(
            `I'm on tutorial step ${stepNumber} (${step.type}). Explain this step and why it is valid using unit-cancellation logic.`,
            tutorAnchor,
            systemContext,
            { popup: true }
        );
    }

    modeSelect.addEventListener("change", () => {
        daTutorialState.mode = modeSelect.value;
        guidedMicroActions = null;
        guidedMicroIndex = -1;
        updatePopupGuidedControls();
    });

    lessonSelect.addEventListener("change", () => {
        daTutorialState.lessonIdx = Number(lessonSelect.value || 0);
        daTutorialState.stepIdx = 0;
        updateProgress();
        setStatusTexts(
            "Lesson selected. Click Start Tutorial to initialize the scripted walkthrough.",
            "The tutorial will set the given value, target unit, and factors for each step."
        );
        setFocusRail("Lesson Selected", "Start Tutorial button", "active");
        scheduleAutoCenter(lessonSelect || btnStart || dimensionsSection, null, lessonSelect || btnStart || dimensionsSection);
    });

    btnStart.addEventListener("click", startLesson);

    btnPlay.addEventListener("click", () => {
        if (daTutorialState.isPlaying) return;
        if (daTutorialState.mode !== "watch") {
            daTutorialState.mode = "watch";
            modeSelect.value = "watch";
        }
        daTutorialState.isPlaying = true;
        if (daTutorialState.stepIdx === 0) {
            scheduleNextWatchAdvance(0);
            return;
        }
        scheduleNextWatchAdvance(WATCH_TRANSITION_MIN_MS);
    });

    btnPause.addEventListener("click", stopPlayback);

    btnNext.addEventListener("click", () => {
        handleManualNextRequest();
    });

    if (btnPopupNext) {
        btnPopupNext.addEventListener("click", () => {
            handleManualNextRequest();
        });
    }

    btnReset.addEventListener("click", () => {
        stopPlayback();
        daTutorialState.stepIdx = 0;
        if (btnResetChain) btnResetChain.click();
        updateProgress();
        setStatusTexts(
            "Tutorial reset. Click Start Tutorial to replay from step 1.",
            "Repetition with explanation is how dimensional-analysis fluency develops."
        );
        setFocusRail("Reset", "Start Tutorial button", "check");
        scheduleAutoCenter(btnStart || modeSelect || dimensionsSection, null, btnStart || modeSelect || dimensionsSection);
    });

    btnAsk.addEventListener("click", askAboutCurrentStep);

    renderLessonOptions();
    updateProgress();
    const introText = window.ChemData?.daTutorial?.intro || "";
    setStatusTexts(
        introText || "Select a lesson and click Start Tutorial.",
        "The guided course is designed to teach both procedure and reasoning from beginner level."
    );
    setFocusRail("Idle", "Tutorial controls", "active");
    scheduleAutoCenter(modeSelect || dimensionsSection, null, modeSelect || dimensionsSection);
    updatePopupGuidedControls();

    window.addEventListener("resize", () => {
        if (explainerAnchor && floatExplainer && !floatExplainer.classList.contains("hidden")) {
            placeExplainerNear(explainerAnchor, explainerPlacementOptions);
        }
    });

    window.addEventListener("scroll", () => {
        if (!explainerAnchor || !floatExplainer || floatExplainer.classList.contains("hidden")) return;
        if (explainerRaf) {
            cancelAnimationFrame(explainerRaf);
        }
        explainerRaf = requestAnimationFrame(() => {
            placeExplainerNear(explainerAnchor, explainerPlacementOptions);
            explainerRaf = null;
        });
    }, { passive: true });

    document.addEventListener("pointerdown", (event) => {
        if (!floatExplainer) return;

        const explainerVisible = !floatExplainer.classList.contains("hidden");
        const pickerVisible = isTutorialPickerVisible();
        if (!explainerVisible && !pickerVisible) return;

        const clickedInsideExplainer = explainerVisible && floatExplainer.contains(event.target);
        const clickedInsidePicker = pickerVisible && tutorialPicker && tutorialPicker.contains(event.target);
        if (clickedInsideExplainer || clickedInsidePicker) return;

        // During autoplay, outside clicks should not dismiss tutorial overlays.
        if (daTutorialState.isPlaying) return;

        if (!explainerVisible) return;
        explainerDismissedForStep = true;
        hideExplainer();
    });
}

function getDefaultLearningState() {
    const competencies = window.ChemData?.curriculum?.competencies || [];
    const competencyProgress = {};

    competencies.forEach((item) => {
        competencyProgress[item.id] = { attempts: 0, correct: 0 };
    });

    return {
        diagnosticCompleted: false,
        diagnosticScore: 0,
        recommendedTrack: "Foundation",
        competencyProgress
    };
}

function loadLearningState() {
    const raw = localStorage.getItem(CHEM_STATE_KEY);
    const fallback = getDefaultLearningState();
    if (!raw) return fallback;

    try {
        const parsed = JSON.parse(raw);
        return {
            ...fallback,
            ...parsed,
            competencyProgress: {
                ...fallback.competencyProgress,
                ...(parsed.competencyProgress || {})
            }
        };
    } catch {
        return fallback;
    }
}

function saveLearningState() {
    localStorage.setItem(CHEM_STATE_KEY, JSON.stringify(learningState));
}

const CHEM_MATH_TAB_STATE_KEY = "chemistry_math_tab_state_v1";
const CHEM_MATH_TAB_STATE_VERSION = 1;
const CHEM_MATH_MIN_SESSIONS_FOR_MASTERY = 2;
const CHEM_MATH_MIN_SCORE_FOR_MASTERY = 0.75;
let chemistryMathTabState = null;
let currentMathQuizSession = null;

const CHEM_MATH_TAB_LESSONS = [
    {
        id: "dimensional",
        title: "Dimensional Analysis & Unit Cancellation",
        cardId: "math-card-track",
        summary: "Build factor-label chains that cancel units cleanly from one chemistry unit to the next.",
        why: "If the factor is flipped, the chain fails even when the arithmetic is fine.",
        nextCheck: "Choose the right factor direction, convert a value, and explain the cancellation."
    },
    {
        id: "sci-notation",
        title: "Scientific Notation & E-Notation",
        cardId: "math-card-sci",
        summary: "Use exponent direction to compare, convert, and enter tiny chemistry values without losing scale.",
        why: "Chemistry students often reverse exponent direction or misread calculator E-notation, which breaks concentration and particle-count work.",
        nextCheck: "Convert one value, compare one magnitude, and prove the calculator format is correct."
    },
    {
        id: "sigfigs",
        title: "Significant Figures in Multi-Step Work",
        cardId: "math-card-cache",
        summary: "Delay rounding until the final line so intermediate values stay trustworthy.",
        why: "Early rounding silently corrupts chemistry answers, especially in multi-step stoich and density work.",
        nextCheck: "Show an unrounded intermediate result and the correctly rounded final answer."
    },
    {
        id: "mole-conversions",
        title: "Molar Mass and Mole Conversions",
        cardId: "math-card-moles",
        summary: "Convert grams, moles, and particles while keeping the unit chain explicit.",
        why: "Students often memorize molar mass but still miss whether to multiply or divide.",
        nextCheck: "Translate one compound from grams to moles and another from moles to particles."
    },
    {
        id: "algebra",
        title: "Equation Isolation (PV=nRT / q=mcDeltaT / M1V1=M2V2)",
        cardId: "math-card-seesaw",
        summary: "Rearrange chemistry formulas without breaking the balance of the equation.",
        why: "Learners often divide only one side or lose track of the variable they are isolating.",
        nextCheck: "Rewrite one formula and solve one numeric example with units."
    },
    {
        id: "ph-log",
        title: "pH / log10 Inverse Reasoning",
        cardId: "math-card-ph",
        summary: "Convert between pH and hydrogen ion concentration while preserving the log scale meaning.",
        why: "A sign error or base confusion changes acidity by orders of magnitude.",
        nextCheck: "Compute one forward and one reverse pH conversion plus a comparison prompt."
    },
    {
        id: "percent-metrics",
        title: "Percent Yield, Percent Error, Percent Composition",
        cardId: "math-card-percent",
        summary: "Choose the right percent formula and interpret what the ratio tells you.",
        why: "Yield, error, and composition answer different chemistry questions and should not be mixed.",
        nextCheck: "Compute one yield and one error problem, then identify which formula is appropriate."
    },
    {
        id: "graphing",
        title: "Slope/Intercept for Chemistry Lab Graphs",
        cardId: "math-card-graph",
        summary: "Read slope and intercept as chemistry meaning, not just graph arithmetic.",
        why: "Calibration lines and rate plots only help if the learner can interpret the constant they represent.",
        nextCheck: "Find a slope, explain the intercept, and make one prediction from a line."
    }
];

function getDefaultMathRefresherState() {
    return {
        version: CHEM_MATH_TAB_STATE_VERSION,
        activeLessonId: CHEM_MATH_TAB_LESSONS[0].id,
        completedLessons: {},
        lessonAttempts: {},
        lessonCorrect: {},
        lessonQuizScores: {},
        misconceptionCounts: {}
    };
}

function loadMathRefresherState() {
    const fallback = getDefaultMathRefresherState();
    const raw = localStorage.getItem(CHEM_MATH_TAB_STATE_KEY);
    if (!raw) return fallback;

    try {
        const parsed = JSON.parse(raw);
        return {
            ...fallback,
            ...parsed,
            completedLessons: {
                ...fallback.completedLessons,
                ...(parsed.completedLessons || {})
            },
            lessonAttempts: {
                ...fallback.lessonAttempts,
                ...(parsed.lessonAttempts || {})
            },
            lessonCorrect: {
                ...fallback.lessonCorrect,
                ...(parsed.lessonCorrect || {})
            },
            lessonQuizScores: {
                ...fallback.lessonQuizScores,
                ...(parsed.lessonQuizScores || {})
            },
            misconceptionCounts: {
                ...fallback.misconceptionCounts,
                ...(parsed.misconceptionCounts || {})
            }
        };
    } catch {
        return fallback;
    }
}

function saveMathRefresherState() {
    if (!chemistryMathTabState) return;
    localStorage.setItem(CHEM_MATH_TAB_STATE_KEY, JSON.stringify(chemistryMathTabState));
}

function updateMathRefresherCtas() {
    renderMathLessonRail();
    window.ChemMathRefresher?.updateCtas?.();
}

function bindMathRefresherActions() {
    window.ChemMathRefresher?.init?.();
    initChemistryMathRefresherTab();
}

function getMathLessonIndexById(lessonId) {
    return CHEM_MATH_TAB_LESSONS.findIndex((lesson) => lesson.id === lessonId);
}

function getActiveMathLesson() {
    if (!chemistryMathTabState) return CHEM_MATH_TAB_LESSONS[0];
    const idx = getMathLessonIndexById(chemistryMathTabState.activeLessonId);
    if (idx < 0) return CHEM_MATH_TAB_LESSONS[0];
    return CHEM_MATH_TAB_LESSONS[idx];
}

function setActiveMathLesson(lessonId, options = {}) {
    if (!chemistryMathTabState) return;
    const idx = getMathLessonIndexById(lessonId);
    if (idx < 0) return;
    if (!isMathLessonUnlocked(lessonId)) return;

    chemistryMathTabState.activeLessonId = CHEM_MATH_TAB_LESSONS[idx].id;
    saveMathRefresherState();
    renderMathLessonRail();
    if (options.scroll !== false) {
        focusMathLessonCard(CHEM_MATH_TAB_LESSONS[idx]);
    }
}

function focusMathLessonCard(lesson) {
    CHEM_MATH_TAB_LESSONS.forEach((entry) => {
        if (!entry.cardId) return;
        const cardEl = document.getElementById(entry.cardId);
        if (!cardEl) return;
        const isActive = entry.id === lesson.id;
        cardEl.classList.toggle("ring-2", isActive);
        cardEl.classList.toggle("ring-amber-400", isActive);
        cardEl.classList.toggle("shadow-lg", isActive);
    });

    if (!lesson.cardId) return;
    const target = document.getElementById(lesson.cardId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function markMathLessonComplete(lessonId) {
    if (!chemistryMathTabState) return;
    chemistryMathTabState.completedLessons[lessonId] = true;
    saveMathRefresherState();
    renderMathLessonRail();
}

function isMathLessonUnlocked(lessonId) {
    const idx = getMathLessonIndexById(lessonId);
    if (idx <= 0) return true;
    const prior = CHEM_MATH_TAB_LESSONS[idx - 1];
    return Boolean(chemistryMathTabState?.completedLessons?.[prior.id]);
}

function getMathLessonMasterySnapshot(lessonId) {
    const scores = (chemistryMathTabState?.lessonQuizScores?.[lessonId] || []).map(Number).filter(Number.isFinite);
    const attempts = Number(chemistryMathTabState?.lessonAttempts?.[lessonId] || 0);
    const correct = Number(chemistryMathTabState?.lessonCorrect?.[lessonId] || 0);
    const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const recentTwo = scores.slice(-2);
    const recentPass = recentTwo.length === 2 && recentTwo.every((score) => score >= CHEM_MATH_MIN_SCORE_FOR_MASTERY);
    const passed = scores.length >= CHEM_MATH_MIN_SESSIONS_FOR_MASTERY
        && avg >= CHEM_MATH_MIN_SCORE_FOR_MASTERY
        && recentPass;

    return {
        scores,
        attempts,
        correct,
        avg,
        passed,
        recentPass
    };
}

function persistMathLessonScore(lessonId, score) {
    if (!chemistryMathTabState) return;
    if (!Array.isArray(chemistryMathTabState.lessonQuizScores[lessonId])) {
        chemistryMathTabState.lessonQuizScores[lessonId] = [];
    }
    chemistryMathTabState.lessonQuizScores[lessonId] = [
        ...chemistryMathTabState.lessonQuizScores[lessonId],
        score
    ].slice(-10);

    const mastery = getMathLessonMasterySnapshot(lessonId);
    if (mastery.passed) {
        markMathLessonComplete(lessonId);
    } else {
        saveMathRefresherState();
        renderMathLessonRail();
    }
}

function incrementMisconceptionCounter(lessonId, category) {
    if (!chemistryMathTabState || !lessonId || !category) return;
    if (!chemistryMathTabState.misconceptionCounts[lessonId] || typeof chemistryMathTabState.misconceptionCounts[lessonId] !== "object") {
        chemistryMathTabState.misconceptionCounts[lessonId] = {};
    }
    chemistryMathTabState.misconceptionCounts[lessonId][category] = (chemistryMathTabState.misconceptionCounts[lessonId][category] || 0) + 1;
}

function renderMathLessonRail() {
    if (!chemistryMathTabState) return;
    const rail = document.getElementById("math-tab-lesson-rail");
    const progressText = document.getElementById("math-tab-progress-text");
    const btnPrev = document.getElementById("btn-math-lesson-prev");
    const btnNext = document.getElementById("btn-math-lesson-next");
    const currentLessonTitle = document.getElementById("math-tab-current-lesson-title");
    const currentLessonDesc = document.getElementById("math-tab-current-lesson-desc");
    const currentLessonWhy = document.getElementById("math-tab-current-lesson-why");
    const currentLessonNext = document.getElementById("math-tab-current-lesson-next");
    const currentRun = document.getElementById("math-tab-current-run");
    const runBar = document.getElementById("math-tab-run-bar");
    const completedCountEl = document.getElementById("math-tab-completed-count");
    const nextLocked = document.getElementById("math-tab-next-locked");
    const lessonStateEl = document.getElementById("math-tab-current-lesson-state");
    if (!rail || !progressText || !btnPrev || !btnNext) return;

    const activeIndex = Math.max(0, getMathLessonIndexById(chemistryMathTabState.activeLessonId));
    const activeLesson = CHEM_MATH_TAB_LESSONS[activeIndex];
    const completedCount = CHEM_MATH_TAB_LESSONS.filter((lesson) => chemistryMathTabState.completedLessons[lesson.id]).length;
    const mastery = getMathLessonMasterySnapshot(activeLesson.id);

    progressText.textContent = `Lesson ${activeIndex + 1} of ${CHEM_MATH_TAB_LESSONS.length}: ${activeLesson.title} (${completedCount}/${CHEM_MATH_TAB_LESSONS.length} complete)`;
    if (currentLessonTitle) currentLessonTitle.textContent = activeLesson.title;
    if (currentLessonDesc) currentLessonDesc.textContent = activeLesson.summary || activeLesson.title;
    if (currentLessonWhy) currentLessonWhy.textContent = activeLesson.why || "This lesson targets a common chemistry math failure point.";
    if (currentLessonNext) currentLessonNext.textContent = activeLesson.nextCheck || "Complete the lesson checkpoint to advance.";
    if (currentRun) currentRun.textContent = `${Math.round((mastery.avg || 0) * 100)}/100 correct`;
    if (runBar) runBar.style.width = `${Math.max(0, Math.min(100, Math.round((mastery.avg || 0) * 100)))}%`;
    if (completedCountEl) completedCountEl.textContent = String(completedCount);
    if (nextLocked) {
        const lockedIdx = CHEM_MATH_TAB_LESSONS.findIndex((lesson) => !chemistryMathTabState.completedLessons[lesson.id]);
        nextLocked.textContent = lockedIdx >= 0 ? `Lesson ${lockedIdx + 1}` : "Course Complete";
    }
    if (lessonStateEl) {
        lessonStateEl.textContent = mastery.passed ? "Mastered" : (chemistryMathTabState.completedLessons[activeLesson.id] ? "Complete" : "Active");
    }

    rail.innerHTML = "";
    CHEM_MATH_TAB_LESSONS.forEach((lesson, idx) => {
        const completed = Boolean(chemistryMathTabState.completedLessons[lesson.id]);
        const isActive = lesson.id === chemistryMathTabState.activeLessonId;
        const unlocked = isMathLessonUnlocked(lesson.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${isActive
            ? "bg-amber-600 text-white border-amber-600"
            : completed
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                : unlocked
                    ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"}`;
        btn.textContent = `L${idx + 1}`;
        btn.title = unlocked ? lesson.title : `${lesson.title} (locked until prior lesson mastery)`;
        btn.disabled = !unlocked;
        btn.addEventListener("click", () => {
            if (!unlocked) return;
            setActiveMathLesson(lesson.id);
        });
        rail.appendChild(btn);
    });

    btnPrev.disabled = activeIndex === 0;
    btnNext.disabled = activeIndex === CHEM_MATH_TAB_LESSONS.length - 1;
}

function tryParseLooseJson(rawText) {
    const source = String(rawText || "").trim();
    if (!source) return null;

    try {
        return JSON.parse(source);
    } catch {
        const start = source.indexOf("{");
        const end = source.lastIndexOf("}");
        if (start < 0 || end < 0 || end <= start) return null;
        try {
            return JSON.parse(source.slice(start, end + 1));
        } catch {
            return null;
        }
    }
}

function buildMathFallbackQuiz(lessonId) {
    const fallbackMap = {
        dimensional: [
            {
                question: "For 25.0 mL -> L, should your factor include mL in numerator or denominator to cancel the starting unit?",
                answerType: "text",
                answerKey: "denominator",
                errorCategory: "unit-error",
                tolerance: 0
            },
            {
                question: "Convert 25.0 mL to L.",
                answerType: "numeric",
                answerKey: 0.025,
                errorCategory: "setup-error",
                tolerance: 0.0005
            },
            {
                question: "Convert 1.20 g/mL to kg/L.",
                answerType: "numeric",
                answerKey: 1.2,
                errorCategory: "unit-error",
                tolerance: 0.01
            }
        ],
        "sci-notation": [
            {
                question: "Convert 0.00045 to normalized scientific notation. Enter only coefficient a in a x 10^b.",
                answerType: "numeric",
                answerKey: 4.5,
                errorCategory: "arithmetic-error",
                tolerance: 0.001
            },
            {
                question: "Which is larger: 3.2E-4 or 3.2E-6? Enter: first or second.",
                answerType: "text",
                answerKey: "first",
                errorCategory: "interpretation-error",
                tolerance: 0
            },
            {
                question: "Enter exponent b for normalized form of 67000 as a x 10^b.",
                answerType: "numeric",
                answerKey: 4,
                errorCategory: "setup-error",
                tolerance: 0
            }
        ],
        sigfigs: [
            {
                question: "How many significant figures are in 0.00450?",
                answerType: "numeric",
                answerKey: 3,
                errorCategory: "precision-error",
                tolerance: 0
            },
            {
                question: "For multiplication/division, do you round by decimal places or significant figures? Enter: decimal or sigfig.",
                answerType: "text",
                answerKey: "sigfig",
                errorCategory: "precision-error",
                tolerance: 0
            },
            {
                question: "12.11 + 18.0 rounded by addition rule equals what?",
                answerType: "numeric",
                answerKey: 30.1,
                errorCategory: "precision-error",
                tolerance: 0.01
            }
        ],
        "mole-conversions": [
            {
                question: "How many moles are in 36.0 g H2O (18.0 g/mol)?",
                answerType: "numeric",
                answerKey: 2,
                errorCategory: "setup-error",
                tolerance: 0.01
            },
            {
                question: "For grams -> moles, do you multiply or divide by molar mass? Enter: multiply or divide.",
                answerType: "text",
                answerKey: "divide",
                errorCategory: "setup-error",
                tolerance: 0
            },
            {
                question: "How many molecules are in 0.500 mol? (Use 6.022E23/mol)",
                answerType: "numeric",
                answerKey: 3.011e23,
                errorCategory: "arithmetic-error",
                tolerance: 1e21
            }
        ],
        algebra: [
            {
                question: "From PV=nRT, solving for V requires dividing by which variable?",
                answerType: "text",
                answerKey: "p",
                errorCategory: "setup-error",
                tolerance: 0
            },
            {
                question: "If q=mcDeltaT and q=418 J, m=10 g, c=4.18 J/gC, what is DeltaT?",
                answerType: "numeric",
                answerKey: 10,
                errorCategory: "arithmetic-error",
                tolerance: 0.05
            },
            {
                question: "Is applying an operation to one side only a valid rearrangement step? Enter: yes or no.",
                answerType: "text",
                answerKey: "no",
                errorCategory: "setup-error",
                tolerance: 0
            }
        ],
        "ph-log": [
            {
                question: "If [H+] = 1.0E-3 M, what is pH?",
                answerType: "numeric",
                answerKey: 3,
                errorCategory: "setup-error",
                tolerance: 0.02
            },
            {
                question: "If pH changes from 5 to 3, is [H+] higher or lower at pH 3? Enter: higher or lower.",
                answerType: "text",
                answerKey: "higher",
                errorCategory: "interpretation-error",
                tolerance: 0
            },
            {
                question: "What is [H+] for pH = 2?",
                answerType: "numeric",
                answerKey: 1e-2,
                errorCategory: "setup-error",
                tolerance: 2e-4
            }
        ],
        "percent-metrics": [
            {
                question: "Theoretical yield 12.0 g, actual 9.0 g. Percent yield?",
                answerType: "numeric",
                answerKey: 75,
                errorCategory: "setup-error",
                tolerance: 0.2
            },
            {
                question: "Measured 10.8 and accepted 12.0. Percent error?",
                answerType: "numeric",
                answerKey: 10,
                errorCategory: "setup-error",
                tolerance: 0.2
            },
            {
                question: "For percent yield, denominator is actual or theoretical? Enter: actual or theoretical.",
                answerType: "text",
                answerKey: "theoretical",
                errorCategory: "interpretation-error",
                tolerance: 0
            }
        ],
        graphing: [
            {
                question: "Line through (1,2) and (4,8): slope m?",
                answerType: "numeric",
                answerKey: 2,
                errorCategory: "arithmetic-error",
                tolerance: 0.01
            },
            {
                question: "In y=mx+b, what does b represent? Enter: intercept or slope.",
                answerType: "text",
                answerKey: "intercept",
                errorCategory: "interpretation-error",
                tolerance: 0
            },
            {
                question: "If y=2x+0.5, what is y when x=3?",
                answerType: "numeric",
                answerKey: 6.5,
                errorCategory: "arithmetic-error",
                tolerance: 0.05
            }
        ]
    };

    return fallbackMap[lessonId] || fallbackMap["dimensional"];
}

async function generateMathQuizSetWithModel(lessonId) {
    if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
        return buildMathFallbackQuiz(lessonId);
    }
    const fallbackItems = buildMathFallbackQuiz(lessonId);
    const model = getChemistryModel();

    const prompt = [
        "Return strict JSON only.",
        "Schema: {\"items\":[{\"question\":\"string\",\"answerType\":\"numeric|text\",\"answerKey\":\"string|number\",\"tolerance\":number,\"errorCategory\":\"setup-error|arithmetic-error|unit-error|precision-error|interpretation-error\"}]}",
        "Generate exactly 3 intro-chem math checkpoint items for lesson: " + lessonId,
        "Items must be beginner-friendly and answerable without external data."
    ].join("\n");

    try {
        const result = await window.GnosysLLM.generateResponse('', prompt, {
            moduleKey: 'chemistry_llm',
            model,
            stream: false,
        });

        if (!result || typeof result.text !== 'string') {
            if (window.gnosysActiveModelsCache) {
                delete window.gnosysActiveModelsCache[model];
            }
            return fallbackItems;
        }
        const parsed = tryParseLooseJson(result.text || "");
        if (!parsed || !Array.isArray(parsed.items) || parsed.items.length < 3) {
            return fallbackItems;
        }

        const normalized = parsed.items.slice(0, 3).map((item) => ({
            question: String(item.question || "").trim(),
            answerType: item.answerType === "text" ? "text" : "numeric",
            answerKey: item.answerKey,
            tolerance: Number.isFinite(Number(item.tolerance)) ? Number(item.tolerance) : 0.05,
            errorCategory: ["setup-error", "arithmetic-error", "unit-error", "precision-error", "interpretation-error"].includes(item.errorCategory)
                ? item.errorCategory
                : "setup-error"
        })).filter((item) => item.question);

        return normalized.length === 3 ? normalized : fallbackItems;
    } catch {
        if (window.gnosysActiveModelsCache) {
            delete window.gnosysActiveModelsCache[model];
        }
        return fallbackItems;
    }
}

async function generateMathQuizWithModel(lessonId) {
    if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
        return buildMathFallbackQuiz(lessonId);
    }
    const fallback = buildMathFallbackQuiz(lessonId);
    const model = getChemistryModel();

    const prompt = [
        "Return strict JSON only.",
        "Schema: {\"question\":\"string\",\"answerType\":\"numeric|text\",\"answerKey\":\"string|number\",\"tolerance\":number}",
        "Generate one short intro-chem math checkpoint question for lesson: " + lessonId,
        "Avoid unsafe content. Keep beginner-friendly."
    ].join("\n");

    try {
        const result = await window.GnosysLLM.generateResponse('', prompt, {
            moduleKey: 'chemistry_llm',
            model,
            stream: false,
        });

        if (!result || typeof result.text !== 'string') {
            if (window.gnosysActiveModelsCache) {
                delete window.gnosysActiveModelsCache[model];
            }
            return fallback;
        }
        const parsed = tryParseLooseJson(result.text || "");
        if (!parsed || typeof parsed.question !== "string") return fallback;

        return {
            question: parsed.question,
            answerType: parsed.answerType === "text" ? "text" : "numeric",
            answerKey: parsed.answerKey,
            tolerance: Number.isFinite(Number(parsed.tolerance)) ? Number(parsed.tolerance) : 0.05
        };
    } catch {
        if (window.gnosysActiveModelsCache) {
            delete window.gnosysActiveModelsCache[model];
        }
        return fallback;
    }
}

function gradeMathQuizAnswer(questionItem, userAnswerRaw) {
    if (!questionItem) {
        return {
            correct: false,
            message: "Generate a quiz first."
        };
    }

    const userAnswer = String(userAnswerRaw || "").trim();
    if (!userAnswer) {
        return {
            correct: false,
            message: "Enter an answer before submitting."
        };
    }

    if (questionItem.answerType === "text") {
        const expected = String(questionItem.answerKey || "").trim().toLowerCase();
        const actual = userAnswer.toLowerCase();
        const ok = actual === expected || actual.includes(expected) || expected.includes(actual);
        return {
            correct: ok,
            message: ok
                ? "Correct. Great chemistry setup reasoning."
                : `Not yet. Expected idea: ${questionItem.answerKey}`
        };
    }

    const userNum = Number(userAnswer);
    const answerNum = Number(questionItem.answerKey);
    if (!Number.isFinite(userNum) || !Number.isFinite(answerNum)) {
        return {
            correct: false,
            message: "Please enter a valid numeric answer."
        };
    }

    const tol = Number.isFinite(Number(questionItem.tolerance)) ? Math.abs(Number(questionItem.tolerance)) : 0.05;
    const ok = Math.abs(userNum - answerNum) <= tol;
    return {
        correct: ok,
        message: ok
            ? "Correct. Numeric checkpoint passed."
            : `Not yet. Correct target is about ${answerNum}.`
    };
}

function bindMathRefresherWidgets() {
    const slider = document.getElementById("math-sci-zoom");
    const sliderReadout = document.getElementById("math-sci-zoom-readout");
    const calcToggle = document.getElementById("btn-math-calculator-toggle");
    const calcView = document.getElementById("math-calculator-view");
    const calcScreen = document.getElementById("math-calc-screen-value");
    const calcPlain = document.getElementById("math-calc-plain-readout");
    const parenthesisExample = document.getElementById("math-parenthesis-example");

    if (slider && sliderReadout) {
        const syncSlider = () => {
            const exponent = Number(slider.value);
            sliderReadout.textContent = `10^${exponent} chemical scale bridge`;
            if (calcScreen) {
                calcScreen.textContent = `6.022E${exponent}`;
            }
            if (calcPlain) {
                calcPlain.textContent = `Calculator display for 6.022 x 10^${exponent}`;
            }
            if (parenthesisExample) {
                parenthesisExample.textContent = `Use: (6.022E${exponent}) / (3.011E${exponent})`;
            }
        };
        slider.addEventListener("input", syncSlider);
        syncSlider();
    }

    if (calcToggle && calcView) {
        calcToggle.addEventListener("click", () => {
            const isHidden = calcView.classList.contains("hidden");
            calcView.classList.toggle("hidden", !isHidden);
            calcToggle.setAttribute("aria-pressed", String(isHidden));
            calcToggle.textContent = isHidden ? "Calculator View: On" : "Calculator View: Off";
        });
    }

    const cacheValue = document.getElementById("math-cache-value");
    const cacheNote = document.getElementById("math-cache-note");
    const cacheBtn = document.getElementById("btn-math-cache-add");
    const cacheList = document.getElementById("math-cache-list");
    const cacheRows = [];

    if (cacheBtn && cacheValue && cacheNote && cacheList) {
        const renderCache = () => {
            cacheList.innerHTML = "";
            cacheRows.slice(-8).forEach((row, idx) => {
                const p = document.createElement("p");
                p.textContent = `${idx + 1}. ${row.note}: ${row.value}`;
                cacheList.appendChild(p);
            });
        };

        cacheBtn.addEventListener("click", () => {
            const value = cacheValue.value.trim();
            const note = cacheNote.value.trim() || "working step";
            if (!value) return;
            cacheRows.push({ value, note });
            cacheValue.value = "";
            cacheNote.value = "";
            renderCache();
        });
    }

    const seesawState = {
        leftNum: ["P1", "V1"],
        leftDen: [],
        rightNum: ["P2", "V2"],
        rightDen: []
    };

    const leftNumEl = document.getElementById("math-seesaw-left-num");
    const leftDenEl = document.getElementById("math-seesaw-left-den");
    const rightNumEl = document.getElementById("math-seesaw-right-num");
    const rightDenEl = document.getElementById("math-seesaw-right-den");
    const seesawStatus = document.getElementById("math-shield-status");

    const cancelPair = (numArr, denArr, token) => {
        const nIdx = numArr.indexOf(token);
        const dIdx = denArr.indexOf(token);
        if (nIdx >= 0 && dIdx >= 0) {
            numArr.splice(nIdx, 1);
            denArr.splice(dIdx, 1);
            return true;
        }
        return false;
    };

    const renderTokenList = (host, arr, tone = "") => {
        if (!host) return;
        host.innerHTML = "";
        arr.forEach((token) => {
            const pill = document.createElement("span");
            pill.className = `math-token-pill${tone ? ` ${tone}` : ""}`;
            pill.textContent = token;
            host.appendChild(pill);
        });
        if (arr.length === 0) {
            const blank = document.createElement("span");
            blank.className = "text-xs text-gray-400";
            blank.textContent = "(empty)";
            host.appendChild(blank);
        }
    };

    const renderSeesaw = () => {
        renderTokenList(leftNumEl, seesawState.leftNum);
        renderTokenList(leftDenEl, seesawState.leftDen, "math-token-den");
        renderTokenList(rightNumEl, seesawState.rightNum);
        renderTokenList(rightDenEl, seesawState.rightDen, "math-token-den");
    };

    document.querySelectorAll(".math-op-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const { token } = btn.dataset;
            if (!token) return;
            seesawState.leftDen.push(token);
            seesawState.rightDen.push(token);
            const leftCancelled = cancelPair(seesawState.leftNum, seesawState.leftDen, token);
            const rightCancelled = cancelPair(seesawState.rightNum, seesawState.rightDen, token);

            if (seesawStatus) {
                seesawStatus.textContent = leftCancelled || rightCancelled
                    ? `Divided both sides by ${token}. Matching tokens cancelled where present.`
                    : `Divided both sides by ${token}. No immediate cancellation yet; continue isolating.`;
            }
            renderSeesaw();
        });
    });
    renderSeesaw();

    const phConcInput = document.getElementById("math-ph-concentration-input");
    const phInput = document.getElementById("math-ph-input");
    const phForwardBtn = document.getElementById("btn-math-ph-forward");
    const phReverseBtn = document.getElementById("btn-math-ph-reverse");
    const phForwardOut = document.getElementById("math-ph-forward-output");
    const phReverseOut = document.getElementById("math-ph-reverse-output");

    if (phForwardBtn && phConcInput && phForwardOut) {
        phForwardBtn.addEventListener("click", () => {
            const value = Number(phConcInput.value);
            if (!Number.isFinite(value) || value <= 0) {
                phForwardOut.textContent = "Forward result: enter a positive [H+] value.";
                return;
            }
            const ph = -Math.log10(value);
            phForwardOut.textContent = `Forward result: pH = ${ph.toFixed(3)}`;
        });
    }

    if (phReverseBtn && phInput && phReverseOut) {
        phReverseBtn.addEventListener("click", () => {
            const value = Number(phInput.value);
            if (!Number.isFinite(value)) {
                phReverseOut.textContent = "Reverse result: enter a numeric pH value.";
                return;
            }
            const concentration = Math.pow(10, -value);
            phReverseOut.textContent = `Reverse result: [H+] = ${concentration.toExponential(3)} M`;
        });
    }

    const trackGrid = document.getElementById("math-track-grid");
    const trackOutput = document.getElementById("math-identity-output");
    const trackOverlays = document.getElementById("math-identity-overlay-list");
    const trackState = {};

    let unitKeyboard = document.getElementById("math-track-keyboard-controls");
    if (!unitKeyboard && trackGrid) {
        unitKeyboard = document.createElement("div");
        unitKeyboard.id = "math-track-keyboard-controls";
        unitKeyboard.className = "mt-3 border border-gray-200 rounded-xl p-3 bg-white space-y-2";
        unitKeyboard.innerHTML = `
            <p class="text-xs font-bold uppercase tracking-wide text-gray-500">Keyboard Placement Mode</p>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select id="math-kb-unit" class="border border-gray-300 rounded-lg px-2 py-1 text-xs">
                    <option value="g">g</option>
                    <option value="mol">mol</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                </select>
                <select id="math-kb-row" class="border border-gray-300 rounded-lg px-2 py-1 text-xs">
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                </select>
                <select id="math-kb-col" class="border border-gray-300 rounded-lg px-2 py-1 text-xs">
                    <option value="0">Col 1</option>
                    <option value="1">Col 2</option>
                    <option value="2">Col 3</option>
                    <option value="3">Col 4</option>
                </select>
                <button id="btn-math-kb-place" type="button" class="rounded-lg px-2 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500">Place Unit</button>
            </div>
            <button id="btn-math-kb-clear" type="button" class="rounded-lg px-2 py-1 text-xs font-bold text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200">Clear Track</button>
        `;
        trackGrid.after(unitKeyboard);
    }

    const renderTrackState = () => {
        if (!trackGrid) return;
        const slots = trackGrid.querySelectorAll(".math-track-slot");
        const overlays = [];

        slots.forEach((slot) => {
            const { row, col } = slot.dataset;
            const key = `${row}-${col}`;
            const unit = trackState[key] || "";
            slot.innerHTML = unit ? `<span class="math-token-pill">${unit}</span>` : "";
            slot.classList.remove("math-track-cancelled");
        });

        for (let col = 0; col <= 2; col += 1) {
            const topKey = `top-${col}`;
            const bottomKey = `bottom-${col + 1}`;
            if (trackState[topKey] && trackState[bottomKey] && trackState[topKey] === trackState[bottomKey]) {
                overlays.push(`${trackState[topKey]} cancelled diagonally between top ${col + 1} and bottom ${col + 2}`);

                const topEl = trackGrid.querySelector(`.math-track-slot[data-row="top"][data-col="${col}"]`);
                const bottomEl = trackGrid.querySelector(`.math-track-slot[data-row="bottom"][data-col="${col + 1}"]`);
                topEl?.classList.add("math-track-cancelled");
                bottomEl?.classList.add("math-track-cancelled");
            }
        }

        if (trackOverlays) {
            trackOverlays.innerHTML = "";
            overlays.forEach((msg) => {
                const row = document.createElement("div");
                row.className = "math-identity-overlay-item";
                row.textContent = msg;
                trackOverlays.appendChild(row);
            });
        }

        if (trackOutput) {
            trackOutput.textContent = overlays.length
                ? `Great. ${overlays.length} diagonal cancellation identities detected.`
                : "Drag matching units into diagonal slots (top col n and bottom col n+1) to trigger identity cancellation.";
        }
    };

    document.querySelectorAll("#math-track-token-pool .math-unit-chip").forEach((chip) => {
        chip.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData("text/plain", chip.dataset.unit || "");
        });
    });

    if (trackGrid) {
        trackGrid.querySelectorAll(".math-track-slot").forEach((slot) => {
            slot.addEventListener("dragover", (event) => {
                event.preventDefault();
                slot.classList.add("math-track-hover");
            });
            slot.addEventListener("dragleave", () => {
                slot.classList.remove("math-track-hover");
            });
            slot.addEventListener("drop", (event) => {
                event.preventDefault();
                slot.classList.remove("math-track-hover");
                const unit = event.dataTransfer?.getData("text/plain") || "";
                const { row, col } = slot.dataset;
                if (!row || col === undefined || !unit) return;
                trackState[`${row}-${col}`] = unit;
                renderTrackState();
            });
        });
    }

    const kbUnit = document.getElementById("math-kb-unit");
    const kbRow = document.getElementById("math-kb-row");
    const kbCol = document.getElementById("math-kb-col");
    const kbPlace = document.getElementById("btn-math-kb-place");
    const kbClear = document.getElementById("btn-math-kb-clear");

    kbPlace?.addEventListener("click", () => {
        const unit = String(kbUnit?.value || "");
        const row = String(kbRow?.value || "");
        const col = String(kbCol?.value || "");
        if (!unit || !row || col === "") return;
        trackState[`${row}-${col}`] = unit;
        renderTrackState();
    });

    kbClear?.addEventListener("click", () => {
        Object.keys(trackState).forEach((key) => delete trackState[key]);
        renderTrackState();
    });

    const moleInput = document.getElementById("math-mole-input");
    const moleBtn = document.getElementById("btn-math-mole-check");
    const moleFeedback = document.getElementById("math-mole-feedback");
    moleBtn?.addEventListener("click", () => {
        const val = Number(moleInput?.value);
        if (!Number.isFinite(val)) {
            if (moleFeedback) moleFeedback.textContent = "Enter a numeric mole value.";
            return;
        }
        const ok = Math.abs(val - 1) <= 0.02;
        if (moleFeedback) {
            moleFeedback.textContent = ok
                ? "Correct. 18.0 g / (18.0 g/mol) = 1.00 mol."
                : "Not yet. Use moles = grams / molar mass."
        }
    });

    const percentInput = document.getElementById("math-percent-input");
    const percentBtn = document.getElementById("btn-math-percent-check");
    const percentFeedback = document.getElementById("math-percent-feedback");
    percentBtn?.addEventListener("click", () => {
        const val = Number(percentInput?.value);
        if (!Number.isFinite(val)) {
            if (percentFeedback) percentFeedback.textContent = "Enter a numeric percent yield.";
            return;
        }
        const ok = Math.abs(val - 75) <= 0.3;
        if (percentFeedback) {
            percentFeedback.textContent = ok
                ? "Correct. Percent yield = (actual/theoretical) x 100 = 75%."
                : "Not yet. Compute (9.0 / 12.0) x 100."
        }
    });

    const graphInput = document.getElementById("math-graph-input");
    const graphBtn = document.getElementById("btn-math-graph-check");
    const graphFeedback = document.getElementById("math-graph-feedback");
    graphBtn?.addEventListener("click", () => {
        const val = Number(graphInput?.value);
        if (!Number.isFinite(val)) {
            if (graphFeedback) graphFeedback.textContent = "Enter a numeric slope value.";
            return;
        }
        const ok = Math.abs(val - 2) <= 0.01;
        if (graphFeedback) {
            graphFeedback.textContent = ok
                ? "Correct. m = (8.0 - 2.0)/(4 - 1) = 2.0."
                : "Not yet. Apply m = delta y / delta x."
        }
    });
}

function bindMathRefresherLessonFlow() {
    const btnPrev = document.getElementById("btn-math-lesson-prev");
    const btnNext = document.getElementById("btn-math-lesson-next");
    const btnMark = document.getElementById("btn-math-mark-lesson");
    const btnQuizGenerate = document.getElementById("btn-math-quiz-generate");
    const btnQuizSubmit = document.getElementById("btn-math-quiz-submit");
    const quizQuestion = document.getElementById("math-quiz-question");
    const quizAnswer = document.getElementById("math-quiz-answer");
    const quizFeedback = document.getElementById("math-quiz-feedback");

    if (!btnPrev || !btnNext || !btnMark || !btnQuizGenerate || !btnQuizSubmit || !quizQuestion || !quizAnswer || !quizFeedback) {
        return;
    }

    btnPrev.addEventListener("click", () => {
        const idx = getMathLessonIndexById(chemistryMathTabState.activeLessonId);
        if (idx <= 0) return;
        setActiveMathLesson(CHEM_MATH_TAB_LESSONS[idx - 1].id);
    });

    btnNext.addEventListener("click", () => {
        const idx = getMathLessonIndexById(chemistryMathTabState.activeLessonId);
        if (idx < 0 || idx >= CHEM_MATH_TAB_LESSONS.length - 1) return;
        setActiveMathLesson(CHEM_MATH_TAB_LESSONS[idx + 1].id);
    });

    btnMark.addEventListener("click", () => {
        const lesson = getActiveMathLesson();
        const mastery = getMathLessonMasterySnapshot(lesson.id);
        if (mastery.passed) {
            quizFeedback.textContent = `Mastery confirmed for ${lesson.title}. You can advance.`;
            return;
        }
        quizFeedback.textContent = `Mastery pending for ${lesson.title}. Need at least ${CHEM_MATH_MIN_SESSIONS_FOR_MASTERY} quiz sessions and >= ${(CHEM_MATH_MIN_SCORE_FOR_MASTERY * 100).toFixed(0)}% recent performance.`;
    });

    btnQuizGenerate.addEventListener("click", async () => {
        const lesson = getActiveMathLesson();
        quizQuestion.textContent = "Generating checkpoint...";
        quizFeedback.textContent = "";
        const items = await generateMathQuizSetWithModel(lesson.id);
        currentMathQuizSession = {
            lessonId: lesson.id,
            items,
            currentIndex: 0,
            correctCount: 0
        };
        quizQuestion.textContent = `Q1/${items.length}: ${items[0].question}`;
        quizAnswer.value = "";
    });

    btnQuizSubmit.addEventListener("click", () => {
        const lesson = getActiveMathLesson();
        if (!currentMathQuizSession || currentMathQuizSession.lessonId !== lesson.id) {
            quizFeedback.textContent = "Generate a lesson quiz first.";
            return;
        }

        const item = currentMathQuizSession.items[currentMathQuizSession.currentIndex];
        const grade = gradeMathQuizAnswer(item, quizAnswer.value);
        const itemCategory = item?.errorCategory || "setup-error";
        const categoryLabelMap = {
            "setup-error": "setup",
            "arithmetic-error": "arithmetic",
            "unit-error": "unit",
            "precision-error": "precision",
            "interpretation-error": "interpretation"
        };

        chemistryMathTabState.lessonAttempts[lesson.id] = (chemistryMathTabState.lessonAttempts[lesson.id] || 0) + 1;
        if (grade.correct) {
            chemistryMathTabState.lessonCorrect[lesson.id] = (chemistryMathTabState.lessonCorrect[lesson.id] || 0) + 1;
            currentMathQuizSession.correctCount += 1;
        } else {
            incrementMisconceptionCounter(lesson.id, itemCategory);
        }

        const nextIndex = currentMathQuizSession.currentIndex + 1;
        if (nextIndex < currentMathQuizSession.items.length) {
            currentMathQuizSession.currentIndex = nextIndex;
            const next = currentMathQuizSession.items[nextIndex];
            quizQuestion.textContent = `Q${nextIndex + 1}/${currentMathQuizSession.items.length}: ${next.question}`;
            quizFeedback.textContent = grade.correct
                ? `${grade.message} Next question ready.`
                : `${grade.message} Focus area: ${categoryLabelMap[itemCategory] || "setup"}.`;
            quizAnswer.value = "";
            saveMathRefresherState();
            return;
        }

        const score = currentMathQuizSession.items.length > 0
            ? currentMathQuizSession.correctCount / currentMathQuizSession.items.length
            : 0;
        persistMathLessonScore(lesson.id, score);

        const mastery = getMathLessonMasterySnapshot(lesson.id);
        quizQuestion.textContent = `Session complete: ${(score * 100).toFixed(0)}% (${currentMathQuizSession.correctCount}/${currentMathQuizSession.items.length}).`;
        quizFeedback.textContent = mastery.passed
            ? `Mastery unlocked for ${lesson.title}. Recent score trend is strong.`
            : `Session recorded. Current average ${(mastery.avg * 100).toFixed(0)}%. Need ${(CHEM_MATH_MIN_SCORE_FOR_MASTERY * 100).toFixed(0)}% with consistent recent sessions.`;
        quizAnswer.value = "";
        currentMathQuizSession = null;
        renderMathLessonRail();
    });
}

function initChemistryMathRefresherTab() {
    const tabSection = document.getElementById("view-math-refresher");
    if (!tabSection) return;

    chemistryMathTabState = loadMathRefresherState();
    bindMathRefresherWidgets();
    bindMathRefresherLessonFlow();
    renderMathLessonRail();
    focusMathLessonCard(getActiveMathLesson());
}

function dispatchMathRefresherToolCalls(toolCalls) {
    window.ChemMathRefresher?.dispatchToolCalls?.(toolCalls);
}

window.dispatchMathRefresherToolCalls = dispatchMathRefresherToolCalls;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function formatRelativeDueText(dueTimestamp) {
    if (!dueTimestamp) return "New";
    const msUntilDue = dueTimestamp - Date.now();
    if (msUntilDue <= 0) return "Due now";

    const days = Math.ceil(msUntilDue / (24 * 60 * 60 * 1000));
    if (days < 1) return "Due today";
    if (days === 1) return "Due in 1 day";
    if (days < 30) return `Due in ${days} days`;

    const months = Math.round(days / 30);
    if (months === 1) return "Due in 1 month";
    return `Due in ${months} months`;
}

function formatInterval(days) {
    if (days === 0) return "< 1m";
    if (days < 30) return days + "d";
    if (days < 365) return Math.round(days / 30) + "mo";
    return Math.round(days / 365) + "y";
}

function calculateCardStrength(intervalDays, easeFactor) {
    if (!intervalDays || intervalDays <= 0) return 0;
    // Stricter strength curve: early intervals contribute less until retention horizon grows.
    const intervalNorm = clamp(
        Math.log1p(intervalDays) / Math.log1p(45),
        0,
        1
    );
    const boundedEase = clamp(easeFactor || 2.5, 1.3, 3.0);
    const easeNorm = (boundedEase - 1.3) / (3.0 - 1.3);
    return (Math.pow(intervalNorm, 1.2) * 0.8) + (easeNorm * 0.2);
}

function registerChemDeckState(deckKey, state, cardIds) {
    chemistryDeckRegistry[deckKey] = {
        state,
        cardIds: Array.from(new Set(cardIds || []))
    };
    updateChemistryScoreboard();
}

function applySessionGamification(grade) {
    let xpAwarded = 0;
    if (grade === 0) {
        chemistrySessionGamification.streak = 0;
        chemistrySessionGamification.xp = Math.max(0, chemistrySessionGamification.xp - 5);
    } else if (grade === 1) { // Hard
        chemistrySessionGamification.streak += 1;
        chemistrySessionGamification.xp += 5;
        xpAwarded = 10;
    } else if (grade === 2) { // Good
        chemistrySessionGamification.streak += 1;
        chemistrySessionGamification.xp += 10;
        xpAwarded = 15;
    } else if (grade === 3) { // Easy
        chemistrySessionGamification.streak += 1;
        chemistrySessionGamification.xp += 20;
        xpAwarded = 20;
    }

    if (typeof window.awardXP === 'function') {
        if (xpAwarded > 0) {
            window.awardXP(xpAwarded, 'flashcard');
        }
        if (typeof window.updateStatsCounter === 'function') {
            window.updateStatsCounter('nomenclatureReviews', 1);
        }
    }

    updateChemistryScoreboard();
}

function updateChemistryScoreboard() {
    const masteryEl = document.getElementById("nomen-mastery-score");
    const streakEl = document.getElementById("nomen-streak-counter");
    const xpEl = document.getElementById("nomen-xp-counter");
    if (!masteryEl || !streakEl || !xpEl) return;

    const deckStates = Object.values(chemistryDeckRegistry);
    let totalStrength = 0;
    let totalCards = 0;

    deckStates.forEach((deck) => {
        if (!deck.state || !deck.cardIds || deck.cardIds.length === 0) return;
        const state = deck.state;
        deck.cardIds.forEach((cardId) => {
            totalStrength += calculateCardStrength(
                state.intervals?.[cardId] || 0,
                state.easeFactors?.[cardId] || 2.5
            );
            totalCards += 1;
        });
    });

    const masteryPercent = totalCards > 0 ? Math.round((totalStrength / totalCards) * 100) : 0;
    masteryEl.textContent = `${masteryPercent}%`;
    streakEl.innerHTML = `${chemistrySessionGamification.streak} <i class="fa-solid fa-fire text-base animate-pulse"></i>`;
    xpEl.textContent = `${chemistrySessionGamification.xp} pts`;
}

function bindDarkModeToggle() {
    const btn = document.getElementById("btn-darkmode");
    if (!btn) return;

    const updateDarkModeUi = () => {
        const isDark = document.documentElement.classList.contains("dark");
        const icon = btn.querySelector("i");
        if (icon) {
            if (isDark) {
                icon.className = "fa-solid fa-sun";
                btn.title = "Toggle Light Mode";
            } else {
                icon.className = "fa-solid fa-moon";
                btn.title = "Toggle Dark Mode";
            }
        }
    };

    updateDarkModeUi();

    btn.addEventListener("click", () => {
        const root = document.documentElement;
        root.classList.toggle("dark");
        localStorage.setItem("chemistry_darkmode", String(root.classList.contains("dark")));
        updateDarkModeUi();
    });
}

function bindChemistrySettingsButton() {
    const btn = document.getElementById("btn-settings");
    if (!btn) return;

    const resetEventName = window.CHEMISTRY_PROGRESS_RESET_EVENT || "chemistryProgressReset";

    window.addEventListener(resetEventName, () => {
        if (typeof window.scheduleChemistryResetReload === "function") {
            window.scheduleChemistryResetReload("Progress reset accepted. Reloading module...");
            return;
        }
        window.location.reload();
    });

    btn.addEventListener("click", () => {
        if (typeof window.openChemistrySettingsModal === "function") {
            window.openChemistrySettingsModal();
        } else if (typeof window.confirmAndResetChemistryProgress === "function") {
            window.confirmAndResetChemistryProgress();
        } else {
            window.alert("Settings service unavailable on this page.");
        }
    });
}

// ---------------------------------------------------------------------------
// Progress Snapshot for the "Ask Tutor First" dashboard button
// ---------------------------------------------------------------------------

function buildProgressSnapshot() {
    // --- Coursework (masteryMatrix + syllabusData) ---
    let matrix = {};
    try { matrix = JSON.parse(localStorage.getItem('masteryMatrix') || '{}'); } catch (_) {}
    const syllabus = window.syllabusData || null;

    const STAGE_NAMES = { 1: 'Lecture', 2: 'Socratic', 3: 'Sandbox', 4: 'Feynman' };
    let session = null;
    try { session = JSON.parse(sessionStorage.getItem('activeLessonState') || 'null'); } catch (_) {}

    let activeLessonLine = 'No active lesson yet.';
    let masteredCount = 0;
    const hwPendingList = [];
    const rustedList = [];

    if (syllabus) {
        const allLessons = [];
        syllabus.modules.forEach((mod) => {
            (syllabus.lessonsByModule[mod.id] || []).forEach((l) => allLessons.push(l));
        });
        allLessons.forEach((lesson) => {
            const state = (matrix[lesson.id] && typeof matrix[lesson.id].state === 'number')
                ? matrix[lesson.id].state : 0;
            if (state === 1) {
                const stage = (session && session.lessonId === lesson.id && session.stageState)
                    ? session.stageState : 1;
                const stageName = STAGE_NAMES[stage] || 'Stage 1';
                activeLessonLine = `Lesson ${lesson.numStr} "${lesson.title}" — Stage ${stage}: ${stageName}`;
            }
            if (state === 3) masteredCount++;
            if (state === 2) hwPendingList.push(`${lesson.numStr} "${lesson.title}"`);
            if (state === 4) rustedList.push(`${lesson.numStr} "${lesson.title}"`);
        });
    }

    // --- Diagnostic track ---
    let learnState = {};
    try { learnState = JSON.parse(localStorage.getItem('chemistry_learning_state_v1') || '{}'); } catch (_) {}
    const diagDone = learnState.diagnosticCompleted
        ? `Complete — Track: ${learnState.recommendedTrack || 'Unknown'}`
        : 'Not yet completed';

    // --- Crash Course Videos ---
    let videoState = {};
    try { videoState = JSON.parse(localStorage.getItem('chemistry_video_state_v1') || '{}'); } catch (_) {}
    const completedIds = Array.isArray(videoState.completedEpisodeIds) ? videoState.completedEpisodeIds : [];
    const allEpisodes = Array.isArray(window.ChemData && window.ChemData.videoCurriculum)
        ? window.ChemData.videoCurriculum : [];
    const totalVideos = allEpisodes.length;
    const lastEp = videoState.lastEpisodeId
        ? allEpisodes.find((ep) => ep.id === videoState.lastEpisodeId) : null;
    const nextEp = allEpisodes.find((ep) => !completedIds.includes(ep.id));
    const videoLine = totalVideos > 0
        ? `${completedIds.length} of ${totalVideos} episodes complete`
        : 'No video data available';
    const lastVideoLine = lastEp
        ? `Last watched: Ep. ${lastEp.episodeNumber} "${lastEp.title}"`
        : 'No episode watched yet';
    const nextVideoLine = nextEp
        ? `Next up: Ep. ${nextEp.episodeNumber} "${nextEp.title}"`
        : 'All episodes complete!';

    // --- Homework Binder ---
    const hwLine = hwPendingList.length > 0
        ? `Pending sheets: ${hwPendingList.join(', ')}`
        : 'No pending homework sheets';

    // --- Math Refresher ---
    let mathState = {};
    try { mathState = JSON.parse(localStorage.getItem('chemistry_math_tab_state_v1') || '{}'); } catch (_) {}
    const mathDoneCount = mathState.completedLessons
        ? Object.values(mathState.completedLessons).filter(Boolean).length : 0;

    // --- Assemble message ---
    const lines = [
        'Hi Prof. Beaker! I need your expert guidance on what to focus on next.',
        'Here is my full current status across the course:',
        '',
        '--- COURSEWORK ---',
        `Active lesson: ${activeLessonLine}`,
        `Mastered lessons: ${masteredCount}`,
        rustedList.length > 0 ? `Rusted (need review): ${rustedList.join(', ')}` : 'No rusted lessons.',
        `Diagnostic placement: ${diagDone}`,
        '',
        '--- CRASH COURSE VIDEOS ---',
        videoLine,
        lastVideoLine,
        nextVideoLine,
        '',
        '--- HOMEWORK BINDER ---',
        hwLine,
        '',
        '--- MATH REFRESHER ---',
        `Math lessons completed: ${mathDoneCount}`,
        '',
        'Based on all of this, what should I prioritize working on today? Please give me a specific, concrete recommendation.'
    ].filter((l) => l !== null).join('\n');

    return lines;
}

function openTutorWithProgressContext() {
    activateChemTab('tutor');
    // Wait for the tab switch to render before injecting the message
    requestAnimationFrame(() => {
        setTimeout(() => {
            const inputEl = document.getElementById('chat-input');
            const sendBtn = document.getElementById('chat-btn-send');
            if (!inputEl || !sendBtn || inputEl.disabled) return;
            inputEl.value = buildProgressSnapshot();
            sendBtn.click();
        }, 180);
    });
}

function bindTutorActions() {
    const checkStatus = async () => {
        const dot = document.getElementById("chat-status-dot");
        const text = document.getElementById("chat-status-text");
        if (!dot || !text) return false;
        try {
            await window.GnosysLLM?.init?.();
            const status = window.GnosysLLM?.getStatus?.();
            const display = window.GnosysLLM?.getTutorStatusDisplay?.(status);
            if (display) {
                dot.className = display.dotClass;
                text.textContent = display.text;
                return display.connected;
            }
        } catch {}
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        dot.className = "inline-block w-2 h-2 rounded-full bg-amber-500";
        text.textContent = isMobile ? "Mobile Setup Required" : "Ollama Offline (Tap to Launch)";
        return false;
    };

    // run status check when tab activates
    document.getElementById("nav-tutor").addEventListener("click", checkStatus);
    document.getElementById("bnav-tutor").addEventListener("click", checkStatus);

    const msgsEl = document.getElementById("chat-messages");
    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-btn-send");
    const clearBtn = document.getElementById("chat-btn-clear");
    let chatHistory = [];

    const TUTOR_SYSTEM = `You are "Prof. Beaker", an expert Intro to Chemistry tutor. 
1. Help the user understand stoichiometry, nomenclature, dimensional analysis, and sig figs.
2. If they ask dangerous chemical queries (e.g. how to make explosives), firmly refuse.
3. Be encouraging. Use socratic questioning instead of just giving away the final numeric answer.
4. Keep your responses concise (2-4 sentences max). Use markdown lists if helpful.
5. When a student shares a full progress summary with sections like COURSEWORK, VIDEOS, and HOMEWORK BINDER, analyze it carefully and give a concrete, prioritized recommendation for exactly what they should work on next — covering coursework, videos, and homework in order of importance.`;

    const parseMD = (text) => {
        if (typeof text !== 'string') return '';

        // Escape HTML tags to prevent XSS
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Extract code blocks and inline code to protect them
        const codeBlocks = [];
        
        // Match code blocks: ``` ... ```
        html = html.replace(/```(?:javascript|js|chemistry|html|css)?\n([\s\S]*?)\n```/g, (match, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<pre class="bg-gray-800 text-gray-100 p-3 rounded-lg my-2 overflow-x-auto font-mono text-xs">${code}</pre>`);
            return id;
        });

        // Match inline backticks: `...`
        html = html.replace(/`([^`\n]+?)`/g, (match, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<code class="bg-gray-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded font-mono text-xs">${code}</code>`);
            return id;
        });

        // Run consolidated math and LaTeX cleanup on the remaining text
        if (window.CLINICAL_TUTOR && typeof window.CLINICAL_TUTOR.cleanMathAndLaTeX === 'function') {
            html = window.CLINICAL_TUTOR.cleanMathAndLaTeX(html);
        } else {
            // Fallback simple clean
            html = html.replace(/\\mathrm\{([^{}]+)\}/g, '$1')
                       .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
                       .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
                       .replace(/([A-Za-z0-9)])_([0-9]+)/g, '$1<sub>$2</sub>')
                       .replace(/([A-Za-z0-9)])\^([0-9+\-]+)/g, '$1<sup>$2</sup>')
                       .replace(/\$\$/g, '')
                       .replace(/\$/g, '');
        }

        // Headers
        html = html.replace(/^####\s+(.*)$/gm, '<h4 class="font-bold text-gray-800 dark:text-gray-200 mt-3 mb-1">$1</h4>');
        html = html.replace(/^###\s+(.*)$/gm, '<h3 class="font-bold text-gray-900 dark:text-white mt-4 mb-2">$1</h3>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italics
        html = html.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');
        
        // Lists
        html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li class="ml-5 list-disc marker:text-indigo-500">$1</li>');
        
        // Newlines
        html = html.replace(/\n/g, '<br>');
        
        // Cleanup excessive breaks around block elements
        html = html.replace(/<\/(h3|h4|div|li)><br>/g, '</$1>');
        html = html.replace(/<br><li/g, '<li');
        html = html.replace(/(<br>\s*){2,}/g, '<br><br>');

        // Restore protected code blocks
        codeBlocks.forEach((codeHtml, index) => {
            html = html.replace(`__CODE_BLOCK_${index}__`, codeHtml);
        });

        return html;
    };

    function appendBubble(role, text) {
        const emptyState = document.getElementById("chat-empty-state");
        if (emptyState) emptyState.remove();

        const wrap = document.createElement("div");
        const bubble = document.createElement("div");
        if (role === "user") {
            wrap.className = "flex justify-end";
            bubble.className = "max-w-[80%] bg-violet-600 text-white px-4 py-3 rounded-3xl rounded-br-lg text-sm font-medium leading-relaxed";
        } else {
            wrap.className = "flex justify-start";
            bubble.className = "max-w-[85%] bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-3xl rounded-bl-lg text-sm font-medium leading-relaxed text-gray-800";
        }
        bubble.innerHTML = parseMD(text);
        wrap.appendChild(bubble);
        msgsEl.appendChild(wrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return bubble;
    }

    async function sendChat() {
        const text = input.value.trim();
        if (!text) return;
        
        if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
            appendBubble("assistant", "Shared local AI router is unavailable.");
            return;
        }
        
        appendBubble("user", text);
        chatHistory.push({ role: "user", content: text });
        if (typeof window.awardXP === 'function') {
            window.awardXP(5, 'tutor');
            window.updateStatsCounter('tutorMessages', 1);
        }
        if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
        
        input.value = "";
        input.disabled = true;
        sendBtn.disabled = true;

        removeContainerTypingIndicator(msgsEl);
        const typingWrap = createTypingIndicatorElement("Prof. Beaker", false);
        msgsEl.appendChild(typingWrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;

        let payload = [{ role: "system", content: TUTOR_SYSTEM }, ...chatHistory];
        
        const currentModel = getChemistryModel();
        try {
            const systemMessage = payload.find((msg) => msg.role === 'system');
            const nonSystem = payload.filter((msg) => msg.role !== 'system');
            const userEntry = nonSystem[nonSystem.length - 1] || { role: 'user', content: '' };
            const priorHistory = nonSystem.slice(0, -1);
            let assistantText = "";
            let firstToken = true;
            let bubble = null;

            await window.GnosysLLM.generateResponse(systemMessage?.content || '', userEntry.content || '', {
                moduleKey: 'chemistry_llm',
                model: currentModel,
                stream: true,
                history: priorHistory,
                onToken: (token) => {
                    if (firstToken) {
                        typingWrap.remove();
                        bubble = appendBubble("assistant", "");
                        firstToken = false;
                    }
                    assistantText += token;
                    bubble.innerHTML = parseMD(assistantText);
                    msgsEl.scrollTop = msgsEl.scrollHeight;
                }
            });

            if (firstToken) {
                typingWrap.remove();
            }
            chatHistory.push({ role: "assistant", content: assistantText });
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
        } catch (e) {
            if (window.gnosysActiveModelsCache) {
                delete window.gnosysActiveModelsCache[currentModel];
            }
            typingWrap.remove();
            appendBubble("assistant", `Could not connect to the local AI provider: ${e && e.message ? e.message : e}`);
        }

        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }

    sendBtn.addEventListener("click", sendChat);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendChat();
        }
    });

    clearBtn.addEventListener("click", () => {
        chatHistory = [];
        msgsEl.innerHTML = `<div id="chat-empty-state" class="flex flex-col items-center justify-center text-center py-8">
            <div class="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mb-4 border border-violet-100">
                <i class="fa-solid fa-robot text-2xl text-violet-400"></i>
            </div>
            <p class="text-gray-500 font-medium mb-5 text-sm">Chat cleared! How else can I help?</p>
        </div>`;
    });
}

function loadVideoState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CHEM_VIDEO_STATE_KEY) || "{}");
        const completedEpisodeIds = Array.isArray(parsed.completedEpisodeIds)
            ? Array.from(new Set(parsed.completedEpisodeIds.filter((id) => typeof id === "string" && id.trim().length > 0)))
            : [];
        return {
            completedEpisodeIds,
            lastEpisodeId: typeof parsed.lastEpisodeId === "string" ? parsed.lastEpisodeId : null,
            quizByEpisode: parsed.quizByEpisode && typeof parsed.quizByEpisode === "object" ? parsed.quizByEpisode : {}
        };
    } catch {
        return { completedEpisodeIds: [], lastEpisodeId: null, quizByEpisode: {} };
    }
}

function saveVideoState() {
    if (!chemistryVideoState) return;
    localStorage.setItem(CHEM_VIDEO_STATE_KEY, JSON.stringify(chemistryVideoState));
}

function getVideoEpisodes() {
    return Array.isArray(window.ChemData?.videoCurriculum) ? window.ChemData.videoCurriculum : [];
}

function buildVideoQuizSystemPrompt(episode) {
    const conceptText = (episode?.coreConcepts || []).join(", ");
    return [
        "You are Prof. Beaker, a novice-first Intro Chemistry tutor.",
        `The learner just finished video episode ${episode?.episodeNumber || ""}: ${episode?.title || "Unknown"}.`,
        `Focus only on these concepts: ${conceptText}.`,
        "Run a brief 3-question micro-quiz with one question at a time.",
        "After each answer, provide short corrective feedback and a confidence check.",
        "Use plain text only and avoid LaTeX syntax."
    ].join(" ");
}

function bindVideoActions() {
    const listEl = document.getElementById("video-episode-list");
    const modalEl = document.getElementById("video-episode-modal");
    const modalBackdropEl = document.getElementById("video-episode-modal-backdrop");
    const modalCloseBtn = document.getElementById("btn-video-modal-close");
    let iframeEl = document.getElementById("chem-video-player");
    const warningEl = document.getElementById("video-empty-warning");
    const titleEl = document.getElementById("video-active-title");
    const chipsEl = document.getElementById("video-concept-chips");
    const outcomeEl = document.getElementById("video-outcome-text");
    const prevTitleEl = document.getElementById("video-prev-title");
    const nextTitleEl = document.getElementById("video-next-title");
    const prevBtn = document.getElementById("btn-video-prev-episode");
    const nextBtn = document.getElementById("btn-video-next-episode");
    const completeBtn = document.getElementById("btn-video-mark-complete");
    const quizBtn = document.getElementById("btn-video-start-quiz");
    const quizPanel = document.getElementById("video-quiz-panel");
    const tutorAnchor = document.getElementById("video-tutor-anchor");
    const quizOverlayEl = document.getElementById("video-quiz-overlay");
    const quizOverlayHost = document.getElementById("video-quiz-overlay-host");
    const quizOverlayCloseBtn = document.getElementById("btn-video-quiz-overlay-close");
    const quizMobileEl = document.getElementById("video-quiz-mobile");
    const quizMobileHost = document.getElementById("video-quiz-mobile-host");
    const quizMobileCloseBtn = document.getElementById("btn-video-quiz-mobile-close");
    const completionPill = document.getElementById("video-completion-pill");
    const dashboardSummaryEl = document.getElementById("dashboard-video-summary");
    const dashboardProgressEl = document.getElementById("dashboard-video-progress");
    const dashboardVideosBtn = document.getElementById("btn-dashboard-open-videos");
    const dashboardTutorBtn = document.getElementById("btn-dashboard-open-tutor");

    if (!listEl || !modalEl || !modalBackdropEl || !modalCloseBtn || !iframeEl || !titleEl || !chipsEl || !completeBtn || !quizBtn || !tutorAnchor || !completionPill) return;

    dashboardVideosBtn?.addEventListener("click", () => activateChemTab("videos"));
    dashboardTutorBtn?.addEventListener("click", () => openTutorWithProgressContext());

    const episodes = getVideoEpisodes();
    if (episodes.length === 0) {
        listEl.innerHTML = `<div class="text-xs text-gray-500 p-3">No video curriculum entries found.</div>`;
        return;
    }

    if (!chemistryVideoState) {
        chemistryVideoState = loadVideoState();
    }

    let activeEpisodeId = chemistryVideoState.lastEpisodeId;
    let modalOpen = false;
    let lastTriggerEl = null;
    if (!activeEpisodeId || !episodes.some((ep) => ep.id === activeEpisodeId)) {
        activeEpisodeId = episodes[0].id;
    }

    const isComplete = (episodeId) => chemistryVideoState.completedEpisodeIds.includes(episodeId);
    const isMobileQuizView = () => window.matchMedia("(max-width: 767px)").matches;

    function setEpisodeCompletion(episodeId, shouldComplete) {
        if (!episodeId) return false;
        const alreadyComplete = isComplete(episodeId);
        if (alreadyComplete === shouldComplete) return false;

        if (shouldComplete) {
            chemistryVideoState.completedEpisodeIds = Array.from(new Set([
                ...chemistryVideoState.completedEpisodeIds,
                episodeId
            ]));
            if (typeof window.awardXP === 'function') {
                window.awardXP(30, 'video');
                window.updateStatsCounter('videosWatched', 1);
            }
        } else {
            chemistryVideoState.completedEpisodeIds = chemistryVideoState.completedEpisodeIds.filter((id) => id !== episodeId);
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
        quizOverlayEl?.classList.add("hidden");
        quizOverlayEl?.setAttribute("aria-hidden", "true");
        quizMobileEl?.classList.add("hidden");
        quizMobileEl?.setAttribute("aria-hidden", "true");
        iframeEl.classList.remove("video-player-frame-hidden");
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
            return "Complete this episode, then run a short micro-quiz to lock in the core ideas.";
        }
        const leadConcepts = concepts.slice(0, 2).join(" and ");
        return `After this episode, you should be able to explain ${leadConcepts} in your own words.`;
    }

    function updateCompletionPill() {
        const completeCount = chemistryVideoState.completedEpisodeIds.length;
        const remainingCount = Math.max(episodes.length - completeCount, 0);
        completionPill.textContent = `${completeCount} / ${episodes.length} Complete • ${remainingCount} to go`;
    }

    function openVideoEpisodeModal(triggerEl = null) {
        if (triggerEl) {
            lastTriggerEl = triggerEl;
        }
        closeVideoQuiz();
        modalOpen = true;

        const viewEl = document.getElementById("view-videos");
        if (viewEl) {
            viewEl.classList.add("video-active-flow");
        }

        modalEl.classList.remove("hidden");
        modalEl.setAttribute("aria-hidden", "false");
        modalCloseBtn.focus();
    }

    function closeVideoEpisodeModal() {
        if (!modalOpen) return;
        closeVideoQuiz();
        modalOpen = false;

        if (lastTriggerEl && typeof lastTriggerEl.focus === "function") {
            lastTriggerEl.focus();
        }

        const viewEl = document.getElementById("view-videos");
        if (viewEl) {
            viewEl.classList.remove("video-active-flow");
        }

        modalEl.classList.add("hidden");
        modalEl.setAttribute("aria-hidden", "true");
        iframeEl.src = "";
    }

    function updateDashboardCta() {
        if (dashboardProgressEl) {
            dashboardProgressEl.textContent = `${chemistryVideoState.completedEpisodeIds.length} of ${episodes.length} episodes complete`;
        }
        if (!dashboardSummaryEl) return;

        const active = episodes.find((ep) => ep.id === activeEpisodeId) || episodes[0];
        const next = getNextEpisode();
        if (!active) {
            dashboardSummaryEl.textContent = "Pick your next chemistry episode, then lock in concepts with a 3-question micro-quiz.";
            return;
        }
        const nextText = next ? `Next: Episode ${next.episodeNumber}` : "Final stretch";
        dashboardSummaryEl.textContent = `Continue with Episode ${active.episodeNumber}: ${active.title}. ${nextText}.`;
    }

    function renderEpisodeList() {
        listEl.innerHTML = "";
        episodes.forEach((episode) => {
            const row = document.createElement("div");
            const openBtn = document.createElement("button");
            const toggleBtn = document.createElement("button");
            const active = episode.id === activeEpisodeId;
            const completed = isComplete(episode.id);
            row.className = [
                "w-full rounded-xl border p-2 transition-colors flex items-start gap-2",
                active ? "bg-amber-50 border-amber-300" : "bg-white hover:bg-gray-50 border-gray-200",
            ].join(" ");

            openBtn.type = "button";
            openBtn.className = "flex-1 text-left rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400/40";
            openBtn.innerHTML = `
                <div class="flex items-start justify-between gap-2">
                    <p class="text-xs font-black text-gray-500">EP ${episode.episodeNumber}</p>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${completed ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}">${completed ? "Completed" : "Pending"}</span>
                </div>
                <p class="text-sm font-semibold text-gray-800 mt-1 leading-tight">${episode.title}</p>
            `;
            openBtn.addEventListener("click", () => {
                activeEpisodeId = episode.id;
                chemistryVideoState.lastEpisodeId = episode.id;
                saveVideoState();
                renderEpisodeList();
                renderActiveEpisode();
                openVideoEpisodeModal(openBtn);
            });

            toggleBtn.type = "button";
            toggleBtn.className = [
                "shrink-0 mt-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors",
                completed
                    ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
            ].join(" ");
            toggleBtn.textContent = completed ? "Unmark" : "Mark";
            toggleBtn.setAttribute("aria-label", `${completed ? "Unmark" : "Mark"} Episode ${episode.episodeNumber} as watched`);
            toggleBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                const changed = setEpisodeCompletion(episode.id, !isComplete(episode.id));
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
        chipsEl.innerHTML = "";
        (episode.coreConcepts || []).forEach((concept) => {
            const chip = document.createElement("span");
            chip.className = "px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200";
            chip.textContent = concept;
            chipsEl.appendChild(chip);
        });

        if (outcomeEl) {
            outcomeEl.textContent = buildOutcomeCopy(episode);
        }
        if (prevTitleEl) {
            prevTitleEl.textContent = previousEpisode
                ? `Previous episode: ${previousEpisode.episodeNumber} - ${previousEpisode.title}`
                : "Previous episode: this is the first episode";
        }
        if (nextTitleEl) {
            nextTitleEl.textContent = nextEpisode
                ? `Next episode: ${nextEpisode.episodeNumber} - ${nextEpisode.title}`
                : "Next episode: you reached the end of this sequence";
        }
        if (prevBtn) {
            const canGoBack = !!previousEpisode;
            prevBtn.disabled = !canGoBack;
            prevBtn.classList.toggle("opacity-60", !canGoBack);
            prevBtn.classList.toggle("cursor-not-allowed", !canGoBack);
        }
        if (nextBtn) {
            const canAdvance = !!nextEpisode;
            nextBtn.disabled = !canAdvance;
            nextBtn.classList.toggle("opacity-60", !canAdvance);
            nextBtn.classList.toggle("cursor-not-allowed", !canAdvance);
        }

        if (episode.youtubeId) {
            const newIframe = iframeEl.cloneNode(true);
            newIframe.src = `https://www.youtube.com/embed/${episode.youtubeId}?rel=0&modestbranding=1`;
            iframeEl.parentNode.replaceChild(newIframe, iframeEl);
            iframeEl = newIframe;
            if (warningEl) warningEl.classList.add("hidden");
        } else {
            const newIframe = iframeEl.cloneNode(true);
            newIframe.src = "about:blank";
            iframeEl.parentNode.replaceChild(newIframe, iframeEl);
            iframeEl = newIframe;
            if (warningEl) warningEl.classList.remove("hidden");
        }

        const completed = isComplete(episode.id);
        completeBtn.textContent = completed ? "Unmark Watched" : "Mark Watched";
        completeBtn.disabled = false;
        completeBtn.classList.remove(
            "opacity-60",
            "cursor-not-allowed",
            "text-white",
            "bg-emerald-600",
            "hover:bg-emerald-500",
            "border",
            "border-transparent",
            "text-amber-900",
            "bg-amber-200",
            "hover:bg-amber-300",
            "border-amber-300"
        );
        if (completed) {
            completeBtn.classList.add("border", "text-amber-900", "bg-amber-200", "hover:bg-amber-300", "border-amber-300");
        } else {
            completeBtn.classList.add("border", "text-white", "bg-emerald-600", "hover:bg-emerald-500", "border-transparent");
        }

        updateDashboardCta();
    }

    function launchMicroQuiz() {
        const episode = episodes.find((ep) => ep.id === activeEpisodeId);
        if (!episode) return;

        const starterPrompt = `I just finished Episode ${episode.episodeNumber}: ${episode.title}. Please run a short chemistry micro-quiz focused on: ${(episode.coreConcepts || []).join(", ")}.`;
        const systemContext = episode.customSystemPrompt || buildVideoQuizSystemPrompt(episode);

        if (window.ChemTutor && typeof window.ChemTutor.invoke === "function") {
            const mobile = isMobileQuizView();
            if (mobile) {
                quizMobileEl?.classList.remove("hidden");
                quizMobileEl?.setAttribute("aria-hidden", "false");
                quizOverlayEl?.classList.add("hidden");
                quizOverlayEl?.setAttribute("aria-hidden", "true");
                iframeEl.classList.add("video-player-frame-hidden");
                clearVideoQuizWidgets();
                window.ChemTutor.invoke(starterPrompt, quizMobileHost || tutorAnchor, systemContext, {
                    mountMode: "append",
                    widgetClassName: "video-quiz-widget",
                    showInnerClose: false
                });
            } else {
                quizOverlayEl?.classList.remove("hidden");
                quizOverlayEl?.setAttribute("aria-hidden", "false");
                quizMobileEl?.classList.add("hidden");
                quizMobileEl?.setAttribute("aria-hidden", "true");
                iframeEl.classList.add("video-player-frame-hidden");
                clearVideoQuizWidgets();
                window.ChemTutor.invoke(starterPrompt, quizOverlayHost || tutorAnchor, systemContext, {
                    mountMode: "append",
                    widgetClassName: "video-quiz-widget h-full",
                    showInnerClose: false
                });
            }
        }
    }

    completeBtn.addEventListener("click", () => {
        const episode = episodes.find((ep) => ep.id === activeEpisodeId);
        if (!episode) return;

        const changed = setEpisodeCompletion(episode.id, !isComplete(episode.id));
        if (!changed) return;
        chemistryVideoState.lastEpisodeId = episode.id;
        refreshVideoProgressViews();
    });

    quizBtn.addEventListener("click", launchMicroQuiz);

    prevBtn?.addEventListener("click", () => {
        const previousEpisode = getPreviousEpisode();
        if (!previousEpisode) return;
        closeVideoQuiz();
        activeEpisodeId = previousEpisode.id;
        chemistryVideoState.lastEpisodeId = previousEpisode.id;
        saveVideoState();
        renderEpisodeList();
        renderActiveEpisode();
    });

    nextBtn?.addEventListener("click", () => {
        const nextEpisode = getNextEpisode();
        if (!nextEpisode) return;
        closeVideoQuiz();
        activeEpisodeId = nextEpisode.id;
        chemistryVideoState.lastEpisodeId = nextEpisode.id;
        saveVideoState();
        renderEpisodeList();
        renderActiveEpisode();
    });

    quizOverlayCloseBtn?.addEventListener("click", closeVideoQuiz);
    quizMobileCloseBtn?.addEventListener("click", closeVideoQuiz);

    modalCloseBtn.addEventListener("click", closeVideoEpisodeModal);
    modalBackdropEl.addEventListener("click", closeVideoEpisodeModal);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modalOpen) {
            closeVideoEpisodeModal();
        }
    });

    updateCompletionPill();
    renderEpisodeList();
    renderActiveEpisode();
}

function bindTabs() {
    const tabs = ['dashboard', 'nomenclature', 'math-refresher', 'tutor', 'molar', 'dimensions', 'stoich', 'sigfigs', 'lab', 'videos'];

    window.activateChemTab = (tabId) => {
        const requestedTab = tabs.includes(tabId) ? tabId : 'dashboard';

        // Hide all panels and reset all nav buttons
        tabs.forEach(id => {
            const view = document.getElementById(`view-${id}`);
            if (view) {
                view.classList.add('hidden-tab');
                view.setAttribute('aria-hidden', 'true');
            }
            
            // Reset top nav button
            const btn = document.getElementById(`nav-${id}`);
            if (btn) {
                btn.className = "px-6 py-2.5 text-sm font-bold rounded-full transition-all duration-300 text-gray-500 hover:text-gray-800 hover:bg-gray-100/50";
                btn.setAttribute('role', 'tab');
                btn.setAttribute('aria-controls', `view-${id}`);
                btn.setAttribute('aria-selected', 'false');
                btn.setAttribute('tabindex', '-1');
            }

            // Reset bottom nav button
            const bBtn = document.getElementById(`bnav-${id}`);
            if (bBtn) {
                const icon = bBtn.querySelector('.bnav-icon');
                const label = bBtn.querySelector('.bnav-label');
                if (icon)  { icon.classList.remove('text-amber-600');  icon.classList.add('text-gray-400'); }
                if (label) { label.classList.remove('text-amber-600'); label.classList.add('text-gray-400'); }
                bBtn.setAttribute('role', 'tab');
                bBtn.setAttribute('aria-controls', `view-${id}`);
                bBtn.setAttribute('aria-selected', 'false');
                bBtn.setAttribute('tabindex', '-1');
            }
        });

        // Show selected panel
        const activeView = document.getElementById(`view-${requestedTab}`);
        if (activeView) {
            activeView.classList.remove('hidden-tab');
            activeView.setAttribute('aria-hidden', 'false');
        }

        if (requestedTab === 'videos') {
            const supportCard = document.getElementById('video-support-tribute');
            if (supportCard) {
                supportCard.classList.remove('fade-in');
                void supportCard.offsetWidth;
                supportCard.classList.add('fade-in');
            }
        }

        // Activate top nav button
        const activeBtn = document.getElementById(`nav-${requestedTab}`);
        if (activeBtn) {
            activeBtn.className = "px-6 py-2.5 text-sm font-bold rounded-full transition-all duration-300 bg-white text-amber-700 shadow shadow-gray-300/50";
            activeBtn.setAttribute('aria-selected', 'true');
            activeBtn.setAttribute('tabindex', '0');
        }

        // Activate bottom nav button
        const activeBBtn = document.getElementById(`bnav-${requestedTab}`);
        if (activeBBtn) {
            const icon = activeBBtn.querySelector('.bnav-icon');
            const label = activeBBtn.querySelector('.bnav-label');
            if (icon)  { icon.classList.add('text-amber-600');  icon.classList.remove('text-gray-400'); }
            if (label) { label.classList.add('text-amber-600'); label.classList.remove('text-gray-400'); }
            activeBBtn.setAttribute('aria-selected', 'true');
            activeBBtn.setAttribute('tabindex', '0');
            
            // Smooth scroll selected button to center of bottom nav bar
            activeBBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    };

    activateChemTab = window.activateChemTab;

    // Attach event listeners for programmatic safety
    tabs.forEach(id => {
        document.getElementById(`nav-${id}`)?.addEventListener('click', () => activateChemTab(id));
        document.getElementById(`bnav-${id}`)?.addEventListener('click', () => activateChemTab(id));
    });
}

function mountConstants() {
    const av = document.getElementById("constant-avogadro");
    const ra = document.getElementById("constant-r-atm");
    const rk = document.getElementById("constant-r-kpa");
    if (!av || !ra || !rk || !window.ChemData) return;

    av.textContent = `${window.ChemData.constants.avogadro.value} ${window.ChemData.constants.avogadro.unit}`;
    ra.textContent = `${window.ChemData.constants.idealGas_R_atm.value} ${window.ChemData.constants.idealGas_R_atm.unit}`;
    rk.textContent = `${window.ChemData.constants.idealGas_R_kpa.value} ${window.ChemData.constants.idealGas_R_kpa.unit}`;
}

function mountElementChips() {
    const container = document.getElementById("element-chip-list");
    if (!container || !window.ChemData) return;

    const entries = Object.entries(window.ChemData.elements);
    entries.forEach(([symbol, data]) => {
        const chip = document.createElement("span");
        chip.className = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs text-gray-700";
        chip.textContent = `${symbol} (${data.mass})`;
        container.appendChild(chip);
    });
}

function mountConversionOptions() {
    const fromSelect = document.getElementById("da-from");
    const toSelect = document.getElementById("da-to");
    const factorBank = document.getElementById("da-factor-bank");
    if (!fromSelect || !toSelect || !factorBank || !window.ChemData) return;

    const allUnits = getAllUnits(window.ChemData.conversions);
    allUnits.forEach((unit) => {
        fromSelect.add(new Option(unit, unit));
        toSelect.add(new Option(unit, unit));
    });

    if (allUnits.includes("kg") && allUnits.includes("mg")) {
        fromSelect.value = "kg";
        toSelect.value = "mg";
    }

    // Populate Factor Bank
    Object.values(window.ChemData.conversions).forEach((group) => {
        group.forEach((edge) => {
            if (edge.type === "formula") {
                // Forward formula option
                const f1 = document.createElement("option");
                f1.value = JSON.stringify({
                    type: "formula",
                    formula: edge.formula,
                    numUnit: edge.to,
                    denUnit: edge.from,
                    display: edge.display
                });
                f1.textContent = `${edge.display} / 1 ${edge.from}`;

                // Reverse formula option
                const f2 = document.createElement("option");
                f2.value = JSON.stringify({
                    type: "formula",
                    formula: edge.inverseFormula,
                    numUnit: edge.from,
                    denUnit: edge.to,
                    display: edge.displayInverse
                });
                f2.textContent = `${edge.displayInverse} / 1 ${edge.to}`;

                factorBank.appendChild(f1);
                factorBank.appendChild(f2);
            } else {
                // Forward factor option (e.g. 1000 g / 1 kg)
                const f1 = document.createElement("option");
                f1.value = JSON.stringify({ numVal: edge.factor, numUnit: edge.to, denVal: 1, denUnit: edge.from });
                f1.textContent = `${edge.factor} ${edge.to} / 1 ${edge.from}`;
                
                // Reverse factor option (e.g. 1 kg / 1000 g)
                const f2 = document.createElement("option");
                f2.value = JSON.stringify({ numVal: 1, numUnit: edge.from, denVal: edge.factor, denUnit: edge.to });
                f2.textContent = `1 ${edge.from} / ${edge.factor} ${edge.to}`;
                
                factorBank.appendChild(f1);
                factorBank.appendChild(f2);
            }
        });
    });
}

function mountLabEquipment() {
    const equipmentSelect = document.getElementById("lab-equipment");
    if (!equipmentSelect || !window.ChemData) return;

    Object.entries(window.ChemData.labEquipment).forEach(([key, spec]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        equipmentSelect.add(new Option(`${label} (${spec.decimalPlaces} dp)`, key));
    });
}

function bindDiagnosticActions() {
    const startButton = document.getElementById("btn-start-diagnostic");
    const nextButton = document.getElementById("btn-next-diagnostic");
    const intro = document.getElementById("diagnostic-intro");

    if (!startButton || !nextButton) return;

    const totalQuestions = window.ChemData?.curriculum?.diagnosticQuestions?.length || 0;
    if (intro && totalQuestions > 0) {
        intro.textContent = `Answer ${totalQuestions} quick questions to place into Foundation, Core, or Challenge track.`;
    }

    startButton.addEventListener("click", () => {
        let questions = JSON.parse(JSON.stringify(window.ChemData?.curriculum?.diagnosticQuestions || []));
        
        // Fisher-Yates shuffle algorithm to ensure true randomization
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        diagnosticSession = {
            index: 0,
            answers: {},
            questions
        };
        startButton.classList.add("hidden");
        nextButton.classList.remove("hidden");
        renderDiagnosticQuestion();
        renderDiagnosticState();
    });

    nextButton.addEventListener("click", () => {
        if (!diagnosticSession) return;

        const selected = document.querySelector("input[name='diagnostic-choice']:checked");
        if (!selected) {
            const resultBox = document.getElementById("diagnostic-result");
            resultBox.classList.remove("hidden");
            resultBox.textContent = "Choose an option before continuing.";
            return;
        }

        const question = diagnosticSession.questions[diagnosticSession.index];
        diagnosticSession.answers[question.id] = Number(selected.value);
        diagnosticSession.index += 1;

        if (diagnosticSession.index >= diagnosticSession.questions.length) {
            finishDiagnostic();
            return;
        }

        renderDiagnosticQuestion();
        renderDiagnosticState();
    });
}

function renderDiagnosticQuestion() {
    const wrap = document.getElementById("diagnostic-question-wrap");
    const questionEl = document.getElementById("diagnostic-question");
    const choicesEl = document.getElementById("diagnostic-choices");
    const resultBox = document.getElementById("diagnostic-result");
    if (!wrap || !questionEl || !choicesEl || !diagnosticSession) return;

    const question = diagnosticSession.questions[diagnosticSession.index];
    wrap.classList.remove("hidden");
    resultBox.classList.add("hidden");
    questionEl.textContent = question.prompt;

    choicesEl.innerHTML = "";
    question.choices.forEach((choice, index) => {
        const label = document.createElement("label");
        label.className = "flex items-center gap-2 p-3 border border-gray-200 rounded-xl text-sm cursor-pointer hover:bg-gray-50";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "diagnostic-choice";
        input.value = String(index);
        input.className = "accent-amber-500";

        const span = document.createElement("span");
        span.textContent = choice;

        label.appendChild(input);
        label.appendChild(span);
        choicesEl.appendChild(label);
    });
}

function renderDiagnosticState() {
    const progress = document.getElementById("diagnostic-progress");
    if (!progress) return;

    if (learningState.diagnosticCompleted && !diagnosticSession) {
        progress.textContent = `Completed (${learningState.recommendedTrack} track)`;
        return;
    }

    if (!diagnosticSession) {
        progress.textContent = "Not started";
        return;
    }

    progress.textContent = `Question ${diagnosticSession.index + 1} of ${diagnosticSession.questions.length}`;
}

function finishDiagnostic() {
    const resultBox = document.getElementById("diagnostic-result");
    const nextButton = document.getElementById("btn-next-diagnostic");
    const { questions } = diagnosticSession;

    let correct = 0;
    questions.forEach((question) => {
        if (diagnosticSession.answers[question.id] === question.correctIndex) {
            correct += 1;
            recordCompetencyAttempt(question.competencyId, true);
        } else {
            recordCompetencyAttempt(question.competencyId, false);
        }
    });

    const scorePercent = Math.round((correct / questions.length) * 100);
    let track = "Foundation";
    if (scorePercent >= 80) track = "Challenge";
    else if (scorePercent >= 55) track = "Core";

    learningState.diagnosticCompleted = true;
    learningState.diagnosticScore = scorePercent;
    learningState.recommendedTrack = track;
    saveLearningState();

    resultBox.classList.remove("hidden");
    resultBox.textContent = `Diagnostic complete: ${scorePercent}% | Recommended track: ${track}.`;
    nextButton.classList.add("hidden");
    diagnosticSession = null;

    renderCompetencyMap();
    renderLearningStatus();
    renderDiagnosticState();

    if (track === "Foundation") activateChemTab("molar");
    if (track === "Core") activateChemTab("dimensions");
    if (track === "Challenge") activateChemTab("lab");
}

function renderLearningStatus() {
    const status = document.getElementById("learning-status");
    if (!status) return;

    if (!learningState.diagnosticCompleted) {
        status.textContent = "Complete your diagnostic to receive a recommended learning track.";
        return;
    }

    const mastery = calculateOverallMastery();
    status.textContent = `Track: ${learningState.recommendedTrack} | Diagnostic: ${learningState.diagnosticScore}% | Overall mastery: ${mastery}%`;
}

function renderCompetencyMap() {
    const container = document.getElementById("competency-map");
    if (!container || !window.ChemData?.curriculum?.competencies) return;

    container.innerHTML = "";
    window.ChemData.curriculum.competencies.forEach((competency) => {
        const progress = learningState.competencyProgress[competency.id] || { attempts: 0, correct: 0 };
        const score = progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : 0;

        const card = document.createElement("div");
        card.className = "border border-gray-200 rounded-2xl p-4";
        card.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <h4 class="font-semibold text-sm text-gray-800">${competency.title}</h4>
                <span class="text-xs font-bold ${score >= 70 ? "text-green-700" : "text-amber-700"}">${score}%</span>
            </div>
            <p class="text-xs text-gray-600 mt-1">${competency.outcome}</p>
            <div class="mt-3 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="h-2 bg-amber-500" style="width:${Math.max(4, score)}%"></div>
            </div>
            <p class="text-[11px] text-gray-500 mt-2">Attempts: ${progress.attempts} | Correct: ${progress.correct}</p>
        `;
        container.appendChild(card);
    });
}

function recordCompetencyAttempt(competencyId, isCorrect) {
    if (!learningState.competencyProgress[competencyId]) {
        learningState.competencyProgress[competencyId] = { attempts: 0, correct: 0 };
    }

    const item = learningState.competencyProgress[competencyId];
    item.attempts += 1;
    if (isCorrect) item.correct += 1;

    if (isCorrect && typeof window.awardXP === 'function' && typeof window.updateStatsCounter === 'function') {
        if (competencyId === 'mole-concept') {
            window.awardXP(15, 'molar');
            window.updateStatsCounter('molarMassCalculated', 1);
        } else if (competencyId === 'dim-analysis') {
            window.awardXP(15, 'dimensions');
            window.updateStatsCounter('conversionsCompleted', 1);
        } else if (competencyId === 'stoich-setup') {
            window.awardXP(15, 'stoich');
            window.updateStatsCounter('equationsBalanced', 1);
        } else if (competencyId === 'measurement-precision') {
            window.awardXP(15, 'lab');
            window.updateStatsCounter('correctLabReadings', 1);
        }
    }

    window.ChemMathRefresher?.notifyCompetencyAttempt?.(competencyId, isCorrect);

    saveLearningState();
    renderCompetencyMap();
    renderLearningStatus();
    updateMathRefresherCtas();
}

function calculateOverallMastery() {
    const rows = Object.values(learningState.competencyProgress);
    if (!rows.length) return 0;

    const scores = rows.map((row) => (row.attempts ? row.correct / row.attempts : 0));
    const avg = scores.reduce((acc, value) => acc + value, 0) / scores.length;
    return Math.round(avg * 100);
}


let molarSession = null;

function bindMolarMassActions() {
    const input = document.getElementById("formula-input");
    const button = document.getElementById("btn-calc-mass");
    const output = document.getElementById("molar-output");
    
    const stepsDiv = document.getElementById("molar-steps");
    const stepContainer = document.getElementById("molar-step-container");
    const stepInput = document.getElementById("molar-step-input");
    const btnStepCheck = document.getElementById("btn-molar-step-check");

    if (!input || !button || !output || !stepsDiv) return;

    function startGuidedSolve() {
        const formula = input.value.trim();
        if (!formula) {
            setStatus(output, "Enter a formula first.", "warn");
            return;
        }

        const parseResult = parseFormula(formula);
        if (!parseResult.ok) {
            setStatus(output, parseResult.message, "error");
            return;
        }

        molarSession = {
            formula,
            elements: parseResult.elements,
            stepIndex: 0,
            totalMass: 0
        };

        stepsDiv.classList.remove("hidden");
        output.classList.add("hidden");
        
        renderMolarStep();
    }

    function renderMolarStep() {
        stepContainer.innerHTML = "";
        
        molarSession.elements.forEach((el, idx) => {
            const name = window.ChemData.elements[el.symbol].name;
            const mass = window.ChemData.elements[el.symbol].mass;
            
            const tr = document.createElement("tr");
            tr.className = "border-b border-gray-100";
            
            if (idx < molarSession.stepIndex) {
                // Completed row
                tr.innerHTML = `
                    <td class="p-3 text-gray-800">${name} (${el.symbol})</td>
                    <td class="p-3 text-gray-800">${el.count}</td>
                    <td class="p-3 text-gray-800">${mass}</td>
                    <td class="p-3 font-semibold text-green-700">${(el.count * mass).toFixed(3)}</td>
                `;
            } else if (idx === molarSession.stepIndex) {
                // Current row to solve
                tr.innerHTML = `
                    <td class="p-3 text-gray-800 font-semibold">${name} (${el.symbol})</td>
                    <td class="p-3 text-gray-800">${el.count}</td>
                    <td class="p-3 text-gray-800">${mass}</td>
                    <td class="p-3">
                        <input type="text" id="current-subtotal" class="border border-amber-300 rounded px-2 py-1 w-20 text-sm focus:ring-2 focus:ring-amber-200 outline-none" placeholder="?">
                    </td>
                `;
            } else {
                // Future row
                tr.innerHTML = `
                    <td class="p-3 text-gray-400">${name} (${el.symbol})</td>
                    <td class="p-3 text-gray-400">${el.count}</td>
                    <td class="p-3 text-gray-400">${mass}</td>
                    <td class="p-3 text-gray-400">-</td>
                `;
            }
            stepContainer.appendChild(tr);
        });

        if (molarSession.stepIndex < molarSession.elements.length) {
            btnStepCheck.textContent = "Check Subtotal";
            stepInput.disabled = true;
            stepInput.value = "";
            const currInput = document.getElementById("current-subtotal");
            if (currInput) currInput.focus();
        } else {
            // Final total step
            btnStepCheck.textContent = "Check Total Mass";
            stepInput.disabled = false;
            stepInput.focus();
        }
    }

    function checkStep() {
        if (molarSession.stepIndex < molarSession.elements.length) {
            const currInput = document.getElementById("current-subtotal");
            if (!currInput) return;
            
            const userVal = parseFloat(currInput.value);
            if (isNaN(userVal)) {
                alert("Please enter a numeric subtotal.");
                return;
            }

            const el = molarSession.elements[molarSession.stepIndex];
            const actualMass = window.ChemData.elements[el.symbol].mass * el.count;
            
            if (Math.abs(userVal - actualMass) / actualMass < 0.05) {
                molarSession.totalMass += actualMass;
                molarSession.stepIndex++;
                renderMolarStep();
            } else {
                recordCompetencyAttempt("mole-concept", false);
                window.ChemTutor.invoke(`I am trying to calculate the subtotal mass for ${el.count} atoms of ${el.symbol} (atomic mass from periodic table: ~${window.ChemData.elements[el.symbol].mass} g/mol). I entered ${userVal}. Explain step-by-step how to compute this properly.`, btnStepCheck.parentElement, `The user is working on Molar Mass calculation. The formula is ${molarSession.formula.toUpperCase()}. The molar mass is ${window.ChemData.elements[el.symbol].mass}. The elements are: ${JSON.stringify(molarSession.elements)}`);
            }
        } else {
            const userVal = parseFloat(stepInput.value);
            if (isNaN(userVal)) {
                alert("Please enter a valid total number.");
                return;
            }

            if (Math.abs(userVal - molarSession.totalMass) / molarSession.totalMass < 0.05) {
                recordCompetencyAttempt("mole-concept", true);
                if (window.activeSandboxHandshake && getTabForTarget(window.activeSandboxHandshake.target) === 'molar') {
                    completeActiveSandboxHandshake();
                }
                stepsDiv.classList.add("hidden");
                output.classList.remove("hidden");
                setStatus(output, `Excellent! Step-by-step solve complete. ${molarSession.formula.toUpperCase()} molar mass is ${userVal.toFixed(4)} g/mol`, "ok");
            } else {
                recordCompetencyAttempt("mole-concept", false);
                window.ChemTutor.invoke(`I just calculated the total molar mass for ${molarSession.formula.toUpperCase()} as ${userVal}. It's incorrect. Guide me on how to add the subtotals correctly.`, btnStepCheck.parentElement, `The user is working on Molar Mass calculation. The formula is ${molarSession.formula.toUpperCase()}. The expected molar mass is ${molarSession.mass}.`);
            }
        }
    }

    button.addEventListener("click", startGuidedSolve);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") startGuidedSolve();
    });

    btnStepCheck.addEventListener("click", checkStep);
    stepInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") checkStep();
    });
}

function parseFormula(formula) {
    const atomicWeights = window.ChemData?.elements || {};
    // Clean spaces but keep hydrate dots/asterisks
    let clean = formula.replace(/\s+/g, "");

    // Split compound from hydrates like .5H2O or *5H2O or �5H2O
    const hydrateParts = clean.split(/[.*�]/);
    clean = hydrateParts[0];

    function parseSegment(str, multiplier = 1) {
        let i = 0;
        
        function parseGroup() {
            let elements = [];
            while (i < str.length && str[i] !== ")" && str[i] !== "]") {
                if (str[i] === "(" || str[i] === "[") {
                    const closeChar = str[i] === "(" ? ")" : "]";
                    i++; // skip "(" or "["
                    const innerGroup = parseGroup();
                    if (i < str.length && str[i] === closeChar) i++; // skip ")" or "]"
                    else return { ok: false, message: "Mismatched parentheses or brackets." };
                    
                    let multStr = "";
                    while (i < str.length && /\d/.test(str[i])) {
                        multStr += str[i];
                        i++;
                    }
                    const mult = multStr ? parseInt(multStr, 10) : 1;
                    
                    if (innerGroup.ok === false) return innerGroup;
                    innerGroup.forEach(el => elements.push({ symbol: el.symbol, count: el.count * mult }));
                } else if (/[A-Z]/.test(str[i])) {
                    let symbol = str[i++];
                    if (i < str.length && /[a-z]/.test(str[i])) {
                        symbol += str[i++];
                    }
                    
                    let numStr = "";
                    while (i < str.length && /\d/.test(str[i])) {
                        numStr += str[i++];
                    }
                    const count = numStr ? parseInt(numStr, 10) : 1;
                    
                    elements.push({ symbol, count });
                } else {
                    return { ok: false, message: `Invalid character: ${str[i]}` };
                }
            }
            return elements;
        }

        const res = parseGroup();
        if (res.ok === false) return res;
        
        if (multiplier !== 1) {
            res.forEach(el => { el.count *= multiplier; });
        }
        return res;
    }

    const elementsArray = parseSegment(clean);
    if (elementsArray.ok === false) return elementsArray;

    // Handle hydrates if any
    for (let h = 1; h < hydrateParts.length; h++) {
        let hPart = hydrateParts[h];
        // Parse leading number for hydrate (e.g. 5 in 5H2O)
        let m = hPart.match(/^(\d+)/);
        let hydrateMultiplier = 1;
        if (m) {
            hydrateMultiplier = parseInt(m[1], 10);
            hPart = hPart.substring(m[1].length);
        }
        const hydArr = parseSegment(hPart, hydrateMultiplier);
        if (hydArr.ok === false) return hydArr;
        elementsArray.push(...hydArr);
    }

    const coalesced = {};
    for (const el of elementsArray) {
        if (!atomicWeights[el.symbol]) {
            return { ok: false, message: `Unknown element symbol: ${el.symbol}` };
        }
        coalesced[el.symbol] = (coalesced[el.symbol] || 0) + el.count;
    }

    const finalElements = Object.entries(coalesced).map(([symbol, count]) => ({symbol, count}));

    if (finalElements.length === 0) {
        return { ok: false, message: "Invalid formula format. Use symbols like H2O, NaCl, Ca(OH)2." };
    }

    return { ok: true, elements: finalElements };
}

let daChain = [];

function bindConversionActions() {
    const valueInput = document.getElementById("da-value");
    const fromSelect = document.getElementById("da-from");
    const toSelect = document.getElementById("da-to");
    const factorBank = document.getElementById("da-factor-bank");
    const btnAddFactor = document.getElementById("btn-add-factor");
    const btnCheckDa = document.getElementById("btn-check-da");
    const btnDaAskTutor = document.getElementById("btn-da-ask-tutor");
    const btnResetDa = document.getElementById("btn-reset-da");
    const chainContainer = document.getElementById("da-chain");
    const output = document.getElementById("da-output");
    const tutorAnchor = document.getElementById("da-tutor-anchor");
    
    if (!valueInput || !fromSelect || !toSelect || !btnAddFactor || !output || !window.ChemData) return;

    function summarizeFactor(factor) {
        if (factor.type === "formula") {
            return `${factor.display} / 1 ${factor.denUnit}`;
        }
        return `${factor.numVal} ${factor.numUnit} / ${factor.denVal} ${factor.denUnit}`;
    }

    function currentUnitAfterSteps(chain, startUnit, stepExclusive) {
        let unit = startUnit;
        for (let i = 0; i < stepExclusive; i++) {
            unit = chain[i].numUnit;
        }
        return unit;
    }

    function buildDaTutorContext(extra = {}) {
        return {
            module: "dimensional-analysis",
            startingValue: valueInput.value,
            fromUnit: fromSelect.value,
            targetUnit: toSelect.value,
            factorChain: daChain.map((factor, idx) => ({
                step: idx + 1,
                type: factor.type || "ratio",
                summary: summarizeFactor(factor),
                numeratorUnit: factor.numUnit,
                denominatorUnit: factor.denUnit
            })),
            ...extra
        };
    }

    function invokeDaTutor(initialPrompt, extra = {}) {
        if (!window.ChemTutor || typeof window.ChemTutor.invoke !== "function") return;
        const contextPayload = buildDaTutorContext(extra);
        const systemContext = [
            "The user is practicing Dimensional Analysis in Intro Chemistry.",
            "Tutor objective: diagnose unit-cancellation mistakes first, then arithmetic.",
            "Use concise scaffolded steps and ask the student for the next correction step.",
            "Treat temperature as equation-based conversion (offset) rather than pure ratio.",
            `Context JSON: ${JSON.stringify(contextPayload)}`
        ].join(" ");
        window.ChemTutor.invoke(initialPrompt, tutorAnchor || output, systemContext, { popup: true });
    }

    function renderChain() {
        if (daChain.length === 0) {
            chainContainer.innerHTML = `<span class="text-sm text-gray-400 italic" id="da-chain-empty">Conversion chain will appear here...</span>`;
            return;
        }
        
        chainContainer.innerHTML = "";
        
        // Start block
        const startDiv = document.createElement("div");
        startDiv.className = "flex flex-col items-center justify-center px-4 py-2 border-r-2 border-gray-300 shrink-0";
        startDiv.dataset.daRole = "start";
        startDiv.innerHTML = `<span class="font-bold text-gray-800">${valueInput.value || 0}</span><span class="text-gray-500 font-semibold">${fromSelect.value}</span>`;
        chainContainer.appendChild(startDiv);
        
        // Factor fractions
        daChain.forEach((factor, idx) => {
            const frac = document.createElement("div");
            frac.className = "flex flex-col items-center justify-center px-4 relative shrink-0";
            frac.dataset.daRole = "factor";
            frac.dataset.daFactorIndex = String(idx);
            if (factor.type === "formula") {
                frac.innerHTML = `
                    <div class="text-gray-800 font-bold border-b-2 border-gray-800 px-2 py-1 text-center min-w-[3rem] whitespace-nowrap">${factor.display}</div>
                    <div class="text-gray-800 font-bold px-2 py-1 text-center min-w-[3rem] whitespace-nowrap">1 ${factor.denUnit}</div>
                `;
            } else {
                frac.innerHTML = `
                    <div class="text-gray-800 font-bold border-b-2 border-gray-800 px-2 py-1 text-center min-w-[3rem] whitespace-nowrap">${factor.numVal} ${factor.numUnit}</div>
                    <div class="text-gray-800 font-bold px-2 py-1 text-center min-w-[3rem] whitespace-nowrap">${factor.denVal} ${factor.denUnit}</div>
                `;
            }
            chainContainer.appendChild(frac);
            
            if (idx < daChain.length - 1) {
                const mult = document.createElement("div");
                mult.className = "text-xl font-bold text-gray-400 px-1 shrink-0";
                mult.dataset.daRole = "multiply";
                mult.innerHTML = "&times;";
                chainContainer.appendChild(mult);
            }
        });
    }

    btnAddFactor.addEventListener("click", () => {
        const factorJson = factorBank.value;
        if (!factorJson) return;
        if (!valueInput.value) {
            output.classList.remove("hidden");
            setStatus(output, "Enter a starting value first.", "warn");
            return;
        }
        output.classList.add("hidden");
        const factor = JSON.parse(factorJson);
        daChain.push(factor);
        renderChain();
    });

    btnResetDa.addEventListener("click", () => {
        daChain = [];
        output.classList.add("hidden");
        renderChain();
    });

    btnCheckDa.addEventListener("click", () => {
        output.classList.remove("hidden");
        const value = Number(valueInput.value);
        if (Number.isNaN(value) || valueInput.value === "") {
            setStatus(output, "Enter a numeric starting value.", "warn");
            return;
        }
        if (daChain.length === 0) {
            setStatus(output, "Build at least one conversion factor before evaluating.", "warn");
            invokeDaTutor(
                "I clicked evaluate without a factor chain. Help me set up the first conversion factor correctly.",
                { errorType: "empty-chain" }
            );
            return;
        }
        
        let currentUnit = fromSelect.value;
        let finalValue = value;
        const stepLogs = [];
        
        for (let i = 0; i < daChain.length; i++) {
            const factor = daChain[i];
            const priorValue = finalValue;
            
            if (currentUnit !== factor.denUnit) {
                setStatus(output, `Mismatch at step ${i + 1}: Cannot cancel '${currentUnit}' with denominator '${factor.denUnit}'. Use a factor whose denominator is '${currentUnit}'.`, "error");
                recordCompetencyAttempt("dim-analysis", false);
                invokeDaTutor(
                    `At step ${i + 1}, my current unit is '${currentUnit}', but my denominator is '${factor.denUnit}'. Explain how to repair this chain using unit cancellation logic.`,
                    {
                        errorType: "unit-mismatch",
                        failedStep: i + 1,
                        currentUnit,
                        expectedDenominatorUnit: currentUnit,
                        providedDenominatorUnit: factor.denUnit,
                        priorUnitAfterStep: currentUnitAfterSteps(daChain, fromSelect.value, i)
                    }
                );
                return;
            }
            
            // Apply mathematics
            if (factor.type === "formula") {
                const expr = factor.formula.replace(/x/g, `(${finalValue})`);
                try {
                    finalValue = new Function(`return ${expr}`)();
                } catch (e) {
                    setStatus(output, `Error evaluating step ${i + 1} formula: ${e.message}`, "error");
                    invokeDaTutor(
                        `My formula-based conversion failed at step ${i + 1}. Help me identify the setup error and rebuild this step correctly.`,
                        {
                            errorType: "formula-evaluation",
                            failedStep: i + 1,
                            expression: factor.formula,
                            expressionError: e.message,
                            currentUnit
                        }
                    );
                    return;
                }
                stepLogs.push(`Step ${i + 1}: ${Number(priorValue.toPrecision(8))} ${factor.denUnit} -> ${Number(finalValue.toPrecision(8))} ${factor.numUnit}`);
                currentUnit = factor.numUnit;
            } else {
                finalValue = (finalValue * factor.numVal) / factor.denVal;
                stepLogs.push(`Step ${i + 1}: ${Number(priorValue.toPrecision(8))} ${factor.denUnit} x (${factor.numVal} ${factor.numUnit} / ${factor.denVal} ${factor.denUnit}) = ${Number(finalValue.toPrecision(8))} ${factor.numUnit}`);
                currentUnit = factor.numUnit;
            }
        }
        
        if (currentUnit !== toSelect.value) {
            setStatus(output, `Chain valid so far, but you ended up with '${currentUnit}' instead of the target '${toSelect.value}'.`, "warn");
            recordCompetencyAttempt("dim-analysis", false);
            invokeDaTutor(
                `My units cancel, but I ended at '${currentUnit}' instead of '${toSelect.value}'. What next factor should I add and why?`,
                {
                    errorType: "wrong-target-unit",
                    finalUnit: currentUnit,
                    targetUnit: toSelect.value,
                    finalValueEstimate: Number(finalValue.toPrecision(10))
                }
            );
            return;
        }
        
        const finalDisplay = Number(finalValue.toPrecision(10));
        const chainSummary = stepLogs.length ? ` Steps: ${stepLogs.join(" | ")}` : "";
        setStatus(output, `Correct! The units cross-cancel perfectly. Result: ${finalDisplay} ${toSelect.value}.${chainSummary}`, "ok");
        recordCompetencyAttempt("dim-analysis", true);
        if (window.activeSandboxHandshake && getTabForTarget(window.activeSandboxHandshake.target) === 'dimensions') {
            completeActiveSandboxHandshake();
        }
    });

    if (btnDaAskTutor) {
        btnDaAskTutor.addEventListener("click", () => {
            output.classList.remove("hidden");
            invokeDaTutor(
                "Coach me through this dimensional analysis setup. Check my unit orientation, cancellation logic, and what my next best step should be.",
                {
                    errorType: "manual-help-request",
                    currentKnownUnit: daChain.length > 0
                        ? daChain[daChain.length - 1].numUnit
                        : fromSelect.value
                }
            );
        });
    }

    // Bind quick questions to invoke tutor in popup mode
    const quickBtns = document.querySelectorAll('.da-quick-question-btn');
    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const qText = btn.getAttribute('data-question');
            if (qText) {
                invokeDaTutor(qText, {
                    errorType: "manual-help-request",
                    currentKnownUnit: daChain.length > 0
                        ? daChain[daChain.length - 1].numUnit
                        : fromSelect.value
                });
            }
        });
    });
}

let labSession = null;

function isEquationBalanced(rxn, userCoefficients) {
    const analysis = analyzeEquationBalance(rxn, userCoefficients);
    return analysis.balanced;
}

function analyzeEquationBalance(rxn, userCoefficients) {
    if (!userCoefficients || userCoefficients.length !== rxn.reactants.length + rxn.products.length) {
        return {
            balanced: false,
            reason: "Coefficient count does not match equation terms.",
            reactantCounts: {},
            productCounts: {},
            mismatches: []
        };
    }

    for (const c of userCoefficients) {
        if (isNaN(c) || c <= 0) {
            return {
                balanced: false,
                reason: "Coefficients must be positive integers.",
                reactantCounts: {},
                productCounts: {},
                mismatches: []
            };
        }
    }

    const reactantCounts = {};
    for (let i = 0; i < rxn.reactants.length; i++) {
        const formula = rxn.reactants[i];
        const coeff = userCoefficients[i];
        const res = parseFormula(formula);
        if (!res.ok) {
            return {
                balanced: false,
                reason: `Could not parse reactant formula '${formula}'.`,
                reactantCounts: {},
                productCounts: {},
                mismatches: []
            };
        }
        res.elements.forEach(el => {
            reactantCounts[el.symbol] = (reactantCounts[el.symbol] || 0) + el.count * coeff;
        });
    }

    const productCounts = {};
    for (let i = 0; i < rxn.products.length; i++) {
        const formula = rxn.products[i];
        const coeff = userCoefficients[rxn.reactants.length + i];
        const res = parseFormula(formula);
        if (!res.ok) {
            return {
                balanced: false,
                reason: `Could not parse product formula '${formula}'.`,
                reactantCounts,
                productCounts: {},
                mismatches: []
            };
        }
        res.elements.forEach(el => {
            productCounts[el.symbol] = (productCounts[el.symbol] || 0) + el.count * coeff;
        });
    }

    const allElements = new Set([...Object.keys(reactantCounts), ...Object.keys(productCounts)]);
    const mismatches = [];
    for (let sym of allElements) {
        const left = reactantCounts[sym] || 0;
        const right = productCounts[sym] || 0;
        if (left !== right) {
            mismatches.push({ symbol: sym, left, right });
        }
    }

    return {
        balanced: mismatches.length === 0,
        reason: mismatches.length === 0 ? "Balanced." : "Element counts do not match.",
        reactantCounts,
        productCounts,
        mismatches
    };
}

function bindStoichActions() {
    const btnLoad = document.getElementById("btn-load-reaction");
    const equationContainer = document.getElementById("stoich-equation");
    const statusDiv = document.getElementById("stoich-balance-status");
    const btnCheckBalance = document.getElementById("btn-check-balance");
    const scenarioContainer = document.getElementById("stoich-scenario-container");
    const promptEl = document.getElementById("stoich-prompt");
    const readingInput = document.getElementById("stoich-reading");
    const btnCheckStoich = document.getElementById("btn-check-stoich");
    const output = document.getElementById("stoich-output");
    
    if (!btnLoad || !window.ChemData || !window.ChemData.stoichiometry) return;

    const toggleBtnEl = document.getElementById('btn-stoich-tutor-toggle');
    if (toggleBtnEl) {
        toggleBtnEl.addEventListener('click', () => {
            const hasHistory = window.ChemTutor && typeof window.ChemTutor.hasHistory === 'function' && window.ChemTutor.hasHistory();
            if (hasHistory) {
                openStoichTutor(null);
            } else {
                openStoichTutor("Explain how to balance this chemical equation step-by-step.");
            }
        });
    }

    let currentRxn = null;
    let inputs = [];

    function getStoichTutorContext(extra = {}) {
        const rxn = currentRxn;
        const equationText = rxn
            ? `${rxn.reactants.map((r, i) => `${inputs[i]?.value || 1}${r}`).join(' + ')} -> ${rxn.products.map((p, i) => `${inputs[rxn.reactants.length + i]?.value || 1}${p}`).join(' + ')}`
            : '';

        const balancedEquationText = rxn && Array.isArray(rxn.coefficients)
            ? `${rxn.reactants.map((r, i) => `${rxn.coefficients[i]}${r}`).join(' + ')} -> ${rxn.products.map((p, i) => `${rxn.coefficients[rxn.reactants.length + i]}${p}`).join(' + ')}`
            : '';

        return {
            module: 'stoichiometry',
            reactionId: rxn ? rxn.id : null,
            equationText,
            balancedEquationText,
            userCoefficients: Array.isArray(inputs)
                ? inputs.map((inp, idx) => ({
                    index: idx,
                    value: inp ? inp.value : '',
                    formula: rxn
                        ? (idx < rxn.reactants.length ? rxn.reactants[idx] : rxn.products[idx - rxn.reactants.length])
                        : ''
                }))
                : [],
            activeScenario: rxn && rxn.activeScenario ? {
                prompt: rxn.activeScenario.prompt,
                correctAnswer: rxn.activeScenario.correctAnswer,
                unit: rxn.activeScenario.unit,
                sigFigs: rxn.activeScenario.sigFigs,
                molarMasses: rxn.activeScenario.molarMasses,
                m1: rxn.activeScenario.m1,
                m2: rxn.activeScenario.m2
            } : null,
            balanceStatus: statusDiv ? statusDiv.textContent : '',
            problemStatus: output ? output.textContent : '',
            scratchpadOpen: !document.getElementById('scratchpad-content')?.classList.contains('hidden'),
            ...extra
        };
    }

    function syncStoichTutorContext(extra = {}) {}

    function openStoichTutor(prompt, extra = {}) {
        const context = getStoichTutorContext(extra);
        if (window.ChemTutor && typeof window.ChemTutor.invoke === 'function') {
            window.ChemTutor.invoke(prompt, null, `Stoichiometry context: ${JSON.stringify(context)}`, { popup: true });
        }
    }

    btnLoad.addEventListener("click", () => {
        const rxns = window.ChemData.stoichiometry.reactions;
        currentRxn = JSON.parse(JSON.stringify(rxns[Math.floor(Math.random() * rxns.length)]));
        
        equationContainer.innerHTML = "";
        inputs = [];
        statusDiv.classList.add("hidden");
        btnCheckBalance.classList.remove("hidden");
        scenarioContainer.classList.add("hidden");
        output.classList.add("hidden");
        syncStoichTutorContext({ lastEvent: 'new-reaction-loaded' });

        const buildPart = (molecules) => {
            const wrap = document.createElement("div");
            wrap.className = "flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5";
            molecules.forEach((mol, idx) => {
                const molWrap = document.createElement("div");
                molWrap.className = "flex items-center gap-1.5 shrink-0";

                const inp = document.createElement("input");
                inp.type = "number";
                inp.min = "1";
                inp.value = "1";
                inp.className = "w-12 text-center border-b-2 border-gray-300 bg-transparent py-1 outline-none focus:border-amber-500 font-bold";
                
                // Clear validation colors on change
                inp.addEventListener("input", () => {
                    inp.classList.remove("text-rose-600", "text-green-600");
                });

                inputs.push(inp);
                
                const span = document.createElement("span");
                span.className = "whitespace-nowrap inline-flex items-baseline";
                span.innerHTML = renderInteractiveFormula(mol);
                
                molWrap.appendChild(inp);
                molWrap.appendChild(span);
                wrap.appendChild(molWrap);
                
                if (idx < molecules.length - 1) {
                    const plus = document.createElement("span");
                    plus.textContent = "+";
                    plus.className = "text-gray-400 mx-2";
                    wrap.appendChild(plus);
                }
            });
            return wrap;
        };

        equationContainer.appendChild(buildPart(currentRxn.reactants));
        const arrow = document.createElement("span");
        arrow.innerHTML = "&rarr;";
        arrow.className = "mx-4 text-gray-500";
        equationContainer.appendChild(arrow);
        equationContainer.appendChild(buildPart(currentRxn.products));
    });

    btnCheckBalance.addEventListener("click", () => {
        if (!currentRxn) return;
        
        statusDiv.classList.remove("hidden");
        
        const userCoeffs = inputs.map(inp => parseInt(inp.value, 10));
        const allPositive = userCoeffs.every(c => !isNaN(c) && c > 0);
        const balanceAnalysis = allPositive
            ? analyzeEquationBalance(currentRxn, userCoeffs)
            : {
                balanced: false,
                reason: "Coefficients must be positive integers.",
                mismatches: []
            };
        
        let allCorrect = false;
        if (allPositive) {
            allCorrect = balanceAnalysis.balanced;
        }

        inputs.forEach((inp, idx) => {
            if (allCorrect) {
                inp.classList.remove("text-rose-600");
                inp.classList.add("text-green-600");
                inp.disabled = true;
            } else {
                inp.classList.remove("text-green-600");
                inp.classList.add("text-rose-600");
            }
        });

        if (allCorrect) {
            // Save the user's balanced coefficients back into the current reaction object in memory
            currentRxn.coefficients = userCoeffs;

            statusDiv.textContent = "Equation Balanced!";
            statusDiv.className = "mt-4 text-center text-sm font-bold text-green-600";
            btnCheckBalance.classList.add("hidden");
            
            // Dynamic Problem Generation
            const r1 = currentRxn.reactants[0];
            const r2 = currentRxn.reactants.length > 1 ? currentRxn.reactants[1] : null;
            const p1 = currentRxn.products[0];
            
            // Generate random masses (between 10.0 and 150.0 grams)
            const m1 = (Math.random() * 140 + 10).toFixed(1);
            let m2 = null;
            if (r2) {
                m2 = (Math.random() * 140 + 10).toFixed(1);
            }
            
            // Calculate Limiting Reactant and Theoretical Yield
            const r1Mass = getMolarMass(r1);
            const p1Mass = getMolarMass(p1);
            const c1 = currentRxn.coefficients[0];
            const cp = currentRxn.coefficients[currentRxn.reactants.length]; // first product coeff
            
            let yield1 = (m1 / r1Mass) * (cp / c1) * p1Mass;
            let exact = yield1;
            let expectedSigFigs = getSigFigs(m1);
            
            if (r2) {
                const r2Mass = getMolarMass(r2);
                const c2 = currentRxn.coefficients[1];
                let yield2 = (m2 / r2Mass) * (cp / c2) * p1Mass;
                if (yield2 < yield1) {
                    exact = yield2;
                    expectedSigFigs = getSigFigs(m2);
                }
            }

            let promptText = `Given ${m1} g of ${r1}`;
            if (r2) {
                promptText += ` and ${m2} g of ${r2}, `;
            } else {
                promptText += `, `;
            }
            promptText += `how many grams of ${p1} can be produced theoretically?`;
            
            let molarMassesStr = `Molar Masses: ${r1}=${r1Mass.toFixed(2)} g/mol, ${p1}=${p1Mass.toFixed(2)} g/mol`;
            if (r2) molarMassesStr += `, ${r2}=${getMolarMass(r2).toFixed(2)} g/mol`;

            currentRxn.activeScenario = {
                prompt: promptText,
                correctAnswer: exact,
                unit: `g ${p1}`,
                sigFigs: expectedSigFigs,
                molarMasses: molarMassesStr,
                m1: m1,
                m2: m2
            };
            
            scenarioContainer.classList.remove("hidden");
            promptEl.textContent = currentRxn.activeScenario.prompt;
            readingInput.value = "";
            syncStoichTutorContext({ lastEvent: 'scenario-generated' });
            if (typeof initScratchpad === "function") {
                initScratchpad(currentRxn, currentRxn.activeScenario);
            }
        } else {
            const mismatchText = Array.isArray(balanceAnalysis.mismatches) && balanceAnalysis.mismatches.length > 0
                ? ` Mismatch: ${balanceAnalysis.mismatches
                    .slice(0, 4)
                    .map((m) => `${m.symbol} (left ${m.left}, right ${m.right})`)
                    .join(", ")}.`
                : "";
            statusDiv.textContent = `Not balanced yet.${mismatchText || " Check coefficients."}`;
            statusDiv.className = "mt-4 text-center text-sm font-bold text-rose-600";
            syncStoichTutorContext({ lastEvent: 'balance-check-failed' });

            const eqStrUser = currentRxn.reactants.map((r, i) => `${inputs[i].value}${r}`).join(" + ") + " -> " + 
                            currentRxn.products.map((p, i) => `${inputs[currentRxn.reactants.length + i].value}${p}`).join(" + ");
            openStoichTutor(
                `I am trying to balance a chemical equation, but my attempt is incorrect. I tried: ${eqStrUser}. Walk me through how to count the atoms on both sides and balance this correctly.`,
                { lastEvent: 'balance-check-failed', lastAttempt: eqStrUser }
            );
        }
    });

    btnCheckStoich.addEventListener("click", () => {
        if (!currentRxn || !currentRxn.activeScenario) return;
        
        output.classList.remove("hidden");
        const strVal = readingInput.value.trim();
        const userVal = parseFloat(strVal);
        
        if (isNaN(userVal)) {
            setStatus(output, "Please enter a valid numeric value.", "warn");
            return;
        }

        const exact = currentRxn.activeScenario.correctAnswer;
        const reqSigFigs = currentRxn.activeScenario.sigFigs;
        const userSigFigs = getSigFigs(strVal);
        
        // Reconstruct the balanced equation string for the tutor context
        let eqStr = currentRxn.reactants.map((r, i) => `${currentRxn.coefficients[i]}${r}`).join(" + ") + " -> " + 
                    currentRxn.products.map((p, i) => `${currentRxn.coefficients[currentRxn.reactants.length + i]}${p}`).join(" + ");

        // 2% tolerance for math rounding 
        const isMatch = Math.abs((userVal - exact) / exact) <= 0.02;
        
        if (isMatch) {
            if (userSigFigs === reqSigFigs) {
                setStatus(output, `Correct! The calculation yields exactly ${userVal} ${currentRxn.activeScenario.unit}.`, "ok");
                recordCompetencyAttempt("stoich-setup", true);
                syncStoichTutorContext({ lastEvent: 'stoich-correct' });
                if (window.activeSandboxHandshake && getTabForTarget(window.activeSandboxHandshake.target) === 'stoich') {
                    completeActiveSandboxHandshake();
                }
            } else {
                setStatus(output, `Mathematically correct, but check your Significant Figures! You provided ${userSigFigs} sig figs, but ${reqSigFigs} are required.`, "warn");
                recordCompetencyAttempt("stoich-setup", false);
                syncStoichTutorContext({ lastEvent: 'sig-fig-mismatch' });
                openStoichTutor(
                    `I am solving a stoichiometry problem. My calculation of ${userVal} was mathematically correct, but I used ${userSigFigs} significant figures instead of ${reqSigFigs}. Explain how to determine the correct significant figures for this problem.`,
                    { lastEvent: 'sig-fig-mismatch', expectedSigFigs: reqSigFigs, userSigFigs }
                );
            }
        } else {
            setStatus(output, `Incorrect. Please double check molar masses, limiting reactants, and mole ratios. Recalculate and try again.`, "error");
            recordCompetencyAttempt("stoich-setup", false);
            syncStoichTutorContext({ lastEvent: 'yield-mismatch' });
            openStoichTutor(
                `I am solving a stoichiometry problem: "${currentRxn.activeScenario.prompt}". I calculated ${userVal} but it is incorrect. Walk me through the steps to solve this: identifying the balanced equation, finding the limiting reactant (if applicable), and converting to the final yield.`,
                { lastEvent: 'yield-mismatch', equation: eqStr, correctAnswer: exact }
            );
        }
    });

    syncStoichTutorContext({ lastEvent: 'stoich-ready' });

    // Toggle scratch pad visibility
    const btnToggleScratch = document.getElementById("btn-toggle-scratchpad");
    const scratchContent = document.getElementById("scratchpad-content");
    const scratchToggleIcon = document.getElementById("scratchpad-toggle-icon");
    if (btnToggleScratch && scratchContent && scratchToggleIcon) {
        btnToggleScratch.addEventListener("click", () => {
            const isCollapsed = scratchContent.classList.contains("hidden");
            if (isCollapsed) {
                scratchContent.classList.remove("hidden");
                scratchToggleIcon.textContent = "▲";
            } else {
                scratchContent.classList.add("hidden");
                scratchToggleIcon.textContent = "▼";
            }
        });
        
        // Ensure it starts open
        scratchContent.classList.remove("hidden");
        scratchToggleIcon.textContent = "▲";
    }
}

function initScratchpad(rxn, activeScenario) {
    const tbody = document.getElementById("scratchpad-tbody");
    const btnImport = document.getElementById("btn-scratchpad-import");
    const notepad = document.getElementById("scratchpad-notes");
    
    if (!tbody) return;
    
    tbody.innerHTML = "";
    if (notepad) notepad.value = "";
    
    // Guard check: Ensure rxn and activeScenario are valid
    if (!rxn || !activeScenario) {
        console.warn("initScratchpad: Missing reaction or activeScenario.");
        return;
    }
    
    const speciesList = [];
    
    rxn.reactants.forEach((formula, idx) => {
        speciesList.push({
            formula,
            coeff: rxn.coefficients[idx],
            type: "reactant",
            index: idx
        });
    });
    
    rxn.products.forEach((formula, idx) => {
        speciesList.push({
            formula,
            coeff: rxn.coefficients[rxn.reactants.length + idx],
            type: "product",
            index: idx
        });
    });
    
    const rowInputs = [];
    
    // Helper to dispatch standard input/change events for reactivity
    const dispatchInputEvents = (el) => {
        if (!el) return;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    // Helper to clear error highlights on focus/input
    const registerClearOnErrorInput = (el) => {
        const handler = () => el.classList.remove("border-rose-500", "dark:border-rose-500");
        el.addEventListener("input", handler);
        el.addEventListener("change", handler);
    };

    speciesList.forEach((sp) => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100 dark:border-slate-800/50";
        
        // 1. Formula
        const tdFormula = document.createElement("td");
        tdFormula.className = "py-3 font-semibold text-slate-800 dark:text-slate-200";
        tdFormula.innerHTML = `${sp.coeff} <span class="ml-1 whitespace-nowrap inline-flex items-baseline">${renderInteractiveFormula(sp.formula)}</span>`;
        tr.appendChild(tdFormula);
        
        // 2. Molar Mass
        const tdMolarMass = document.createElement("td");
        tdMolarMass.className = "py-3 pr-2";
        const mmVal = getMolarMass(sp.formula);
        tdMolarMass.innerHTML = `
            <input type="number" step="0.01" data-field="molar-mass" data-type="${sp.type}" data-index="${sp.index}" class="w-full text-xs p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 font-mono transition-all duration-200" placeholder="MM (g/mol)">
            <button type="button" class="btn-fill-mm text-[10px] text-amber-600 dark:text-amber-400 hover:underline text-left block mt-0.5" data-mm="${mmVal.toFixed(2)}">Use ${mmVal.toFixed(2)}</button>
        `;
        tr.appendChild(tdMolarMass);
        
        // 3. Mass
        const tdMass = document.createElement("td");
        tdMass.className = "py-3 pr-2";
        tdMass.innerHTML = `
            <input type="number" step="0.1" data-field="mass" data-type="${sp.type}" data-index="${sp.index}" class="w-full text-xs p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 font-mono transition-all duration-200" placeholder="Mass (g)">
        `;
        tr.appendChild(tdMass);
        
        // 4. Moles
        const tdMoles = document.createElement("td");
        tdMoles.className = "py-3 pr-2";
        tdMoles.innerHTML = `
            <input type="number" step="0.0001" data-field="moles" data-type="${sp.type}" data-index="${sp.index}" class="w-full text-xs p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 font-mono transition-all duration-200" placeholder="Moles">
        `;
        tr.appendChild(tdMoles);
        
        // 5. Actions
        const tdActions = document.createElement("td");
        tdActions.className = "py-3 text-center space-y-1.5";
        
        if (sp.type === "reactant") {
            tdActions.innerHTML = `
                <button type="button" class="btn-calc-moles w-full py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded shadow-sm shadow-amber-500/25 transition-colors" title="Calculate Moles = Mass / Molar Mass">g &rarr; mol</button>
            `;
        } else {
            let ratioHtml = "";
            rxn.reactants.forEach((rFormula, rIdx) => {
                const rCoeff = rxn.coefficients[rIdx];
                const rName = rFormula;
                ratioHtml += `
                    <button type="button" class="btn-calc-ratio block w-full py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded transition-colors" data-reactant-idx="${rIdx}" data-ratio="${sp.coeff / rCoeff}" title="Calculate from ${rName}">from ${rName}</button>
                `;
            });
            ratioHtml += `
                <button type="button" class="btn-calc-mass block w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded transition-colors" title="Calculate Yield = Moles * Molar Mass">mol &rarr; g</button>
            `;
            tdActions.innerHTML = ratioHtml;
        }
        tr.appendChild(tdActions);
        
        tbody.appendChild(tr);
        
        const inpMM = tdMolarMass.querySelector("input");
        const inpMass = tdMass.querySelector("input");
        const inpMoles = tdMoles.querySelector("input");
        
        registerClearOnErrorInput(inpMM);
        registerClearOnErrorInput(inpMass);
        registerClearOnErrorInput(inpMoles);
        
        const rowData = {
            formula: sp.formula,
            coeff: sp.coeff,
            type: sp.type,
            index: sp.index,
            inpMM,
            inpMass,
            inpMoles
        };
        rowInputs.push(rowData);
        
        // Add event listener to the "Use Molar Mass" button
        const btnFillMM = tdMolarMass.querySelector(".btn-fill-mm");
        if (btnFillMM) {
            btnFillMM.addEventListener("click", () => {
                inpMM.value = btnFillMM.getAttribute("data-mm");
                inpMM.classList.remove("border-rose-500", "dark:border-rose-500");
                dispatchInputEvents(inpMM);
            });
        }
        
        // Add event listener to "Calculate Moles" for reactants
        if (sp.type === "reactant") {
            const btnCalcMoles = tdActions.querySelector(".btn-calc-moles");
            btnCalcMoles.addEventListener("click", () => {
                const mm = parseFloat(inpMM.value);
                const mass = parseFloat(inpMass.value);
                let hasError = false;
                
                if (isNaN(mm) || mm <= 0) {
                    inpMM.classList.add("border-rose-500", "dark:border-rose-500");
                    hasError = true;
                }
                if (isNaN(mass)) {
                    inpMass.classList.add("border-rose-500", "dark:border-rose-500");
                    hasError = true;
                }
                
                if (hasError) {
                    const firstErr = isNaN(mm) ? inpMM : inpMass;
                    firstErr.focus();
                    return;
                }
                
                inpMoles.value = (mass / mm).toFixed(4);
                inpMoles.classList.remove("border-rose-500", "dark:border-rose-500");
                dispatchInputEvents(inpMoles);
            });
        } else {
            // Add event listeners to "Calculate from Reactant" for products
            const btnsCalcRatio = tdActions.querySelectorAll(".btn-calc-ratio");
            btnsCalcRatio.forEach(btn => {
                btn.addEventListener("click", () => {
                    const rIdx = parseInt(btn.getAttribute("data-reactant-idx"), 10);
                    const reactantRow = rowInputs.find(ri => ri.type === "reactant" && ri.index === rIdx);
                    if (reactantRow) {
                        const rMoles = parseFloat(reactantRow.inpMoles.value);
                        const ratio = parseFloat(btn.getAttribute("data-ratio"));
                        
                        if (isNaN(rMoles)) {
                            reactantRow.inpMoles.classList.add("border-rose-500", "dark:border-rose-500");
                            reactantRow.inpMoles.focus();
                            return;
                        }
                        
                        if (!isNaN(ratio)) {
                            inpMoles.value = (rMoles * ratio).toFixed(4);
                            inpMoles.classList.remove("border-rose-500", "dark:border-rose-500");
                            dispatchInputEvents(inpMoles);
                        }
                    }
                });
            });
            
            // Add event listener to "Calculate Mass" (yield) for products
            const btnCalcMass = tdActions.querySelector(".btn-calc-mass");
            btnCalcMass.addEventListener("click", () => {
                const mm = parseFloat(inpMM.value);
                const moles = parseFloat(inpMoles.value);
                let hasError = false;
                
                if (isNaN(mm) || mm <= 0) {
                    inpMM.classList.add("border-rose-500", "dark:border-rose-500");
                    hasError = true;
                }
                if (isNaN(moles)) {
                    inpMoles.classList.add("border-rose-500", "dark:border-rose-500");
                    hasError = true;
                }
                
                if (hasError) {
                    const firstErr = isNaN(mm) ? inpMM : inpMoles;
                    firstErr.focus();
                    return;
                }
                
                inpMass.value = (moles * mm).toFixed(1);
                inpMass.classList.remove("border-rose-500", "dark:border-rose-500");
                dispatchInputEvents(inpMass);
            });
        }
    });
    
    // Auto-fill masses function
    const doAutoFill = () => {
        if (activeScenario.m1) {
            const r1Row = rowInputs.find(ri => ri.type === "reactant" && ri.index === 0);
            if (r1Row && r1Row.inpMass) {
                r1Row.inpMass.value = activeScenario.m1;
                r1Row.inpMass.classList.remove("border-rose-500", "dark:border-rose-500");
                dispatchInputEvents(r1Row.inpMass);
            } else {
                const fallback = tbody.querySelector('input[data-field="mass"][data-type="reactant"][data-index="0"]');
                if (fallback) {
                    fallback.value = activeScenario.m1;
                    fallback.classList.remove("border-rose-500", "dark:border-rose-500");
                    dispatchInputEvents(fallback);
                }
            }
        }
        if (activeScenario.m2) {
            const r2Row = rowInputs.find(ri => ri.type === "reactant" && ri.index === 1);
            if (r2Row && r2Row.inpMass) {
                r2Row.inpMass.value = activeScenario.m2;
                r2Row.inpMass.classList.remove("border-rose-500", "dark:border-rose-500");
                dispatchInputEvents(r2Row.inpMass);
            } else {
                const fallback = tbody.querySelector('input[data-field="mass"][data-type="reactant"][data-index="1"]');
                if (fallback) {
                    fallback.value = activeScenario.m2;
                    fallback.classList.remove("border-rose-500", "dark:border-rose-500");
                    dispatchInputEvents(fallback);
                }
            }
        }
    };
    
    // Call auto fill initially
    doAutoFill();
    
    // Bind click to Import button
    if (btnImport) {
        btnImport.onclick = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            doAutoFill();
        };
    }
}

function getMolarMass(formula) {
    const res = parseFormula(formula);
    if (!res.ok) return 1; // Fallback
    let mm = 0;
    res.elements.forEach(e => {
        mm += (window.ChemData.elements[e.symbol]?.mass || 1) * e.count;
    });
    return mm;
}

function getSigFigs(str) {
    let clean = str.replace(/[^0-9]/g, ""); // strip decimal and sign
    // Remove leading zeros
    while (clean.length > 0 && clean[0] === '0') {
        clean = clean.substring(1);
    }
    // If no decimal, trailing zeros in numbers like 100 are NOT sig figs typically, but let's assume standard input
    if (str.indexOf('.') === -1) {
        while (clean.length > 0 && clean[clean.length - 1] === '0') {
            clean = clean.substring(0, clean.length - 1);
        }
    }
    return Math.max(1, clean.length);
}

function getDecimals(str) {
    if (str.indexOf('.') === -1) return 0;
    return str.split('.')[1].length;
}

function bindSigFigActions() {
    const btnGen = document.getElementById("btn-generate-sigfig");
    const problemEl = document.getElementById("sigfig-problem");
    const inputEl = document.getElementById("sigfig-answer");
    const btnCheck = document.getElementById("btn-check-sigfig");
    const output = document.getElementById("sigfig-output");

    if (!btnGen) return;

    let currentSession = null;

    btnGen.addEventListener("click", () => {
        output.classList.add("hidden");
        inputEl.value = "";
        
        const isAdd = Math.random() > 0.5;
        const v1 = (Math.random() * 10).toFixed(Math.floor(Math.random() * 3) + 1);
        const v2 = (Math.random() * 10).toFixed(Math.floor(Math.random() * 3) + 1);
        
        let exactValue, expectedString;
        
        if (isAdd) {
            exactValue = parseFloat(v1) + parseFloat(v2);
            problemEl.textContent = `${v1} + ${v2} = ?`;
            const minDecimals = Math.min(getDecimals(v1), getDecimals(v2));
            expectedString = exactValue.toFixed(minDecimals);
        } else {
            exactValue = parseFloat(v1) * parseFloat(v2);
            problemEl.textContent = `${v1} \u00D7 ${v2} = ?`;
            const minSigFigs = Math.min(getSigFigs(v1), getSigFigs(v2));
            expectedString = Number(exactValue.toPrecision(minSigFigs)).toString();
            // Handle padding if needed, but standard toString is okay for this simple drill
        }
        
        currentSession = { expectedString, rawVal: exactValue };
    });

    btnCheck.addEventListener("click", () => {
        if (!currentSession) {
            setStatus(output, "Generate a problem first.", "warn");
            output.classList.remove("hidden");
            return;
        }

        const userVal = inputEl.value.trim();
        if (userVal === currentSession.expectedString || parseFloat(userVal) === parseFloat(currentSession.expectedString)) {
            setStatus(output, `Correct! The proper sig fig rounded answer is ${currentSession.expectedString}.`, "ok");
            if (typeof window.awardXP === 'function') {
                window.awardXP(15, 'sigfigs');
                window.updateStatsCounter('sigFigsSolved', 1);
            }
            if (window.activeSandboxHandshake && getTabForTarget(window.activeSandboxHandshake.target) === 'sigfigs') {
                completeActiveSandboxHandshake();
            }
        } else {
            setStatus(output, `Incorrect. The correctly rounded answer is ${currentSession.expectedString}.`, "error");
            const hasHistory = window.ChemTutor && typeof window.ChemTutor.hasHistory === 'function' && window.ChemTutor.hasHistory();
            const starterPrompt = hasHistory
                ? null
                : `I am trying to calculate significant figures for the math problem: ${problemEl.textContent}. I inputted ${userVal}. Explain rules for rounding significant figures involving ${problemEl.textContent.includes('+') ? 'addition' : 'multiplication'}, and why the answer should be ${currentSession.expectedString}.`;
            window.ChemTutor.invoke(
                starterPrompt,
                null,
                `The user is practicing Significant Figures math. The problem is ${problemEl.textContent} = ${currentSession.rawVal}. The correct rounded answer is ${currentSession.expectedString}.`,
                { popup: true }
            );
        }
        output.classList.remove("hidden");
    });
}

function formatFormula(str) {
    if (!str) return "";
    let formatted = str.replace(/ (\d?[+-])/g, "<sup>$1</sup>");
    formatted = formatted.replace(/(\d?[+-])$/, "<sup>$1</sup>");
    formatted = formatted.replace(/(?<!^)(?<!\s*)([A-Za-z\)])(\d+)(?!\s*<)/g, "$1<sub>$2</sub>");
    return formatted;
}

function renderInteractiveFormula(formula) {
    if (!formula) return "";
    const regex = /([A-Z][a-z]?)|(\d+)|([()+-[\]*·•])/g;
    let html = "";
    let match;
    regex.lastIndex = 0;
    
    let lastIndex = 0;
    while ((match = regex.exec(formula)) !== null) {
        if (match.index > lastIndex) {
            html += formula.slice(lastIndex, match.index);
        }
        
        const [token, element, subscript, special] = match;
        if (element) {
            const elData = window.ChemData?.elements?.[element];
            const name = elData ? elData.name : element;
            const mass = elData ? elData.mass : "";
            
            html += `<span tabindex="0" class="chem-tooltip-trigger inline-block cursor-help border-b border-dotted border-amber-500/60 hover:text-amber-600 focus:text-amber-600 outline-none select-none transition-colors" data-tooltip-name="${name}" ${mass ? `data-tooltip-mass="${mass}"` : ""}>${element}</span>`;
        } else if (subscript) {
            html += `<sub>${subscript}</sub>`;
        } else if (special) {
            html += special;
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < formula.length) {
        html += formula.slice(lastIndex);
    }
    return html;
}

function bindNomenclatureActions() {
    const card = document.getElementById("fc-card");
    const front = document.getElementById("fc-front");
    const back = document.getElementById("fc-back");
    const frontRepeat = document.getElementById("fc-front-repeat");
    const controls = document.getElementById("fc-controls");
    const statInterval = document.getElementById("fc-stat-interval");
    const statStreak = document.getElementById("fc-stat-streak");
    const statLapses = document.getElementById("fc-stat-lapses");
    
    // We expect these 4 buttons and their labels now matching Syngnosia style
    const btnAgain = document.getElementById("btn-fc-again");
    const btnHard = document.getElementById("btn-fc-hard");
    const btnGood = document.getElementById("btn-fc-good");
    const btnEasy = document.getElementById("btn-fc-easy");
    const intAgain = document.getElementById("fc-int-again");
    const intHard = document.getElementById("fc-int-hard");
    const intGood = document.getElementById("fc-int-good");
    const intEasy = document.getElementById("fc-int-easy");
    const categorySelect = document.getElementById("fc-category-select");
    const fcAskTutor = document.getElementById("btn-ask-tutor");
    const fcRule = document.getElementById("fc-rule");
    const btnReset = document.getElementById("btn-nomen-reset");

    if (!card || !front || !back || !frontRepeat || !controls || !btnAgain || !btnHard || !btnGood || !btnEasy || !categorySelect || !btnReset || !window.ChemData || !window.ChemData.nomenclature) return;

    const nomData = window.ChemData.nomenclature;
    let isFlipped = false;
    let currentCardData = null;
    let currentIntervals = [0, 0, 0, 0];
    let currentCategory = "";

    const categories = Object.keys(nomData);
    if (categories.length > 0) {
        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });
        currentCategory = categories[0];
    }
    
    categorySelect.addEventListener("change", (e) => {
        currentCategory = e.target.value;
        renderCard();
    });

    const allNomenCardIds = [];
    Object.values(nomData).forEach((cards) => {
        cards.forEach((c) => {
            allNomenCardIds.push(`${c.formula}-F2N`);
            allNomenCardIds.push(`${c.formula}-N2F`);
        });
    });

    let parsedState = null;
    try {
        parsedState = JSON.parse(localStorage.getItem(CHEM_NOMEN_SRS_STATE_KEY) || "null");
    } catch {
        parsedState = null;
    }

    let srsState = {
        intervals: {},
        dueDates: {},
        easeFactors: {},
        lapses: {},
        streaks: {},
        lastSeen: {},
        ...(parsedState || {})
    };

    const recentlyShown = [];

    function saveState() {
        localStorage.setItem(CHEM_NOMEN_SRS_STATE_KEY, JSON.stringify(srsState));
        registerChemDeckState("nomen", srsState, allNomenCardIds);
    }

    function calculateFutureInterval(cardId, grade) {
        const currentInterval = srsState.intervals[cardId] || 0;
        const currentEase = srsState.easeFactors[cardId] || 2.5;

        let newInterval = 0;
        if (grade === 0) {
            newInterval = currentInterval >= 7 ? Math.round(currentInterval * 0.35) : 0;
        } else if (grade === 1) {
            if (currentInterval === 0) newInterval = 1;
            else if (currentInterval === 1) newInterval = 2;
            else newInterval = Math.round(currentInterval * 1.2);
        } else if (grade === 2) {
            if (currentInterval === 0) newInterval = 2;
            else if (currentInterval === 1) newInterval = 3;
            else newInterval = Math.round(currentInterval * currentEase);
        } else if (grade === 3) {
            if (currentInterval === 0) newInterval = 4;
            else if (currentInterval === 1) newInterval = 6;
            else newInterval = Math.round(currentInterval * currentEase * 1.45) + 1;
        }
        return newInterval;
    }

    function getNextCard() {
        const poolData = nomData[currentCategory] || [];
        const now = Date.now();
        
        const allCards = [];
        poolData.forEach(c => {
            allCards.push({ ...c, direction: 'F2N', id: c.formula + '-F2N' });
            allCards.push({ ...c, direction: 'N2F', id: c.formula + '-N2F' });
        });

        if (allCards.length === 0) return { id: "Done-F2N", formula: "Done", name: "Change category!", direction: 'F2N' };

        let dueCards = allCards.filter(c => {
            const due = srsState.dueDates[c.id];
            return due && due <= now;
        });

        let newCards = allCards.filter(c => !srsState.dueDates[c.id]);

        let fallbackPool = allCards.filter((c) => (srsState.intervals[c.id] || 0) < 14);
        if (fallbackPool.length === 0) fallbackPool = allCards;

        fallbackPool.sort((a, b) => {
            const lastSeenA = srsState.lastSeen[a.id] || 0;
            const lastSeenB = srsState.lastSeen[b.id] || 0;
            if (lastSeenA !== lastSeenB) return lastSeenA - lastSeenB;

            const easeA = srsState.easeFactors[a.id] || 2.5;
            const easeB = srsState.easeFactors[b.id] || 2.5;
            if (easeA !== easeB) return easeA - easeB;

            const lapsesA = srsState.lapses[a.id] || 0;
            const lapsesB = srsState.lapses[b.id] || 0;
            return lapsesB - lapsesA;
        });

        const cooldownSize = Math.min(3, allCards.length - 1);
        if (cooldownSize > 0 && recentlyShown.length > 0) {
            const filteredDue = dueCards.filter(c => !recentlyShown.includes(c.id));
            if (filteredDue.length > 0) dueCards = filteredDue;

            const filteredNew = newCards.filter(c => !recentlyShown.includes(c.id));
            if (filteredNew.length > 0) newCards = filteredNew;

            const filteredFallback = fallbackPool.filter(c => !recentlyShown.includes(c.id));
            if (filteredFallback.length > 0) fallbackPool = filteredFallback;
        }

        if (dueCards.length > 0) return shuffleArray(dueCards)[0];
        if (newCards.length > 0) return shuffleArray(newCards)[0];
        return fallbackPool[0];
    }

    function updateCardStats(cardId) {
        if (!statInterval || !statStreak || !statLapses) return;
        statInterval.textContent = formatRelativeDueText(srsState.dueDates[cardId]);
        statStreak.textContent = `${srsState.streaks[cardId] || 0} 🔥`;
        statLapses.textContent = `${srsState.lapses[cardId] || 0}`;
    }

    function renderCard() {
        currentCardData = getNextCard();
        isFlipped = false;
        
        if (currentCardData && currentCardData.id !== "Done-F2N") {
            const idx = recentlyShown.indexOf(currentCardData.id);
            if (idx > -1) recentlyShown.splice(idx, 1);
            recentlyShown.push(currentCardData.id);
            
            const poolData = nomData[currentCategory] || [];
            const allCardsCount = poolData.length * 2;
            const maxCooldown = Math.min(3, allCardsCount - 1);
            while (recentlyShown.length > Math.max(0, maxCooldown)) {
                recentlyShown.shift();
            }
        }

        const fFmt = formatFormula(currentCardData.formula);
        
        if (currentCardData.direction === 'F2N') {
            front.innerHTML = fFmt;
            frontRepeat.innerHTML = fFmt;
            back.textContent = currentCardData.name;
        } else {
            front.textContent = currentCardData.name;
            frontRepeat.textContent = currentCardData.name;
            back.innerHTML = fFmt;
        }
        
        if (fcRule) {
            if (currentCardData.rule) {
                fcRule.innerHTML = `<strong>Rule:</strong> ${currentCardData.rule}`;
                fcRule.classList.remove("hidden");
            } else {
                fcRule.classList.add("hidden");
            }
        }

        updateCardStats(currentCardData.id);
        
        card.classList.remove("flipped");
        controls.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
        controls.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
    }

    function handleGrade(grade) {
        const cardId = currentCardData.id;
        const newInterval = currentIntervals[grade];
        let ease = srsState.easeFactors[cardId] || 2.5;

        if (grade === 0) ease = Math.max(1.3, ease - 0.2);
        else if (grade === 1) ease = Math.max(1.3, ease - 0.15);
        else if (grade === 3) ease = Math.min(3.0, ease + 0.12);

        if (grade === 0) {
            srsState.lapses[cardId] = (srsState.lapses[cardId] || 0) + 1;
        }

        if (grade >= 2) {
            srsState.streaks[cardId] = (srsState.streaks[cardId] || 0) + 1;
        } else {
            srsState.streaks[cardId] = 0;
        }

        let nextDue = Date.now();
        if (newInterval > 0) {
            const d = new Date();
            if (d.getHours() < 4) d.setDate(d.getDate() - 1);
            d.setDate(d.getDate() + newInterval);
            d.setHours(4, 0, 0, 0);
            nextDue = d.getTime();
        }

        srsState.intervals[cardId] = newInterval;
        srsState.dueDates[cardId] = nextDue;
        srsState.easeFactors[cardId] = ease;
        srsState.lastSeen[cardId] = Date.now();
        
        saveState();
        applySessionGamification(grade);

        if (grade >= 2 && window.activeSandboxHandshake && getTabForTarget(window.activeSandboxHandshake.target) === 'nomenclature') {
            completeActiveSandboxHandshake();
        }
        
        // FIX: hide controls and unflip BEFORE rendering next card to avoid flashing answers
        card.classList.remove("flipped");
        controls.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
        controls.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
        
        setTimeout(() => {
            renderCard();
        }, 400); // Wait 400ms for CSS flip transition to finish
    }

    registerChemDeckState("nomen", srsState, allNomenCardIds);
    renderCard();

    card.addEventListener("click", () => {
        if (!isFlipped) {
            isFlipped = true;
            card.classList.add("flipped");
            
            for (let i = 0; i < 4; i++) {
                currentIntervals[i] = calculateFutureInterval(currentCardData.id, i);
            }
            intAgain.textContent = formatInterval(currentIntervals[0]);
            intHard.textContent = formatInterval(currentIntervals[1]);
            intGood.textContent = formatInterval(currentIntervals[2]);
            intEasy.textContent = formatInterval(currentIntervals[3]);

            controls.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
            controls.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
        }
    });

    btnAgain.addEventListener("click", (e) => { e.stopPropagation(); handleGrade(0); });
    btnHard.addEventListener("click", (e) => { e.stopPropagation(); handleGrade(1); });
    btnGood.addEventListener("click", (e) => { e.stopPropagation(); handleGrade(2); });
    btnEasy.addEventListener("click", (e) => { e.stopPropagation(); handleGrade(3); });

    btnReset.addEventListener("click", () => {
        if (!confirm("Reset all Nomenclature SRS progress for all categories?")) return;
        localStorage.removeItem(CHEM_NOMEN_SRS_STATE_KEY);
        srsState = {
            intervals: {},
            dueDates: {},
            easeFactors: {},
            lapses: {},
            streaks: {},
            lastSeen: {}
        };
        saveState();
        renderCard();
    });

    if (fcAskTutor) {
        fcAskTutor.addEventListener("click", (e) => {
            e.stopPropagation();
            const hasHistory = window.ChemTutor && typeof window.ChemTutor.hasHistory === 'function' && window.ChemTutor.hasHistory();
            const starterPrompt = hasHistory
                ? null
                : `I am struggling with flashcard: Formula '${currentCardData.formula}', Name '${currentCardData.name}'. Explain rule, prefix/suffix, or provide a mnemonic hook.`;
            window.ChemTutor.invoke(
                starterPrompt,
                null,
                `The user is practicing Chemical Nomenclature flashcards in category "${currentCategory}". Current formula: ${currentCardData.formula}, name: ${currentCardData.name}.`,
                { popup: true }
            );
        });
    }

    document.addEventListener("keydown", (e) => {
        const nomenclView = document.getElementById("view-nomenclature");
        const srsPanel = document.getElementById("panel-nomen-srs");
        if (!nomenclView || !srsPanel || nomenclView.classList.contains("hidden-tab") || srsPanel.classList.contains("hidden-tab")) return;

        // Bypassing input elements to allow normal typing
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.isContentEditable)) return;

        if (e.code === "Space" || e.key === " ") {
            if (!isFlipped) {
                e.preventDefault();
                card.click();
            }
        } else if (["1", "2", "3", "4"].includes(e.key)) {
            if (isFlipped) {
                e.preventDefault();
                const grade = parseInt(e.key) - 1;
                handleGrade(grade);
            }
        }
    });
}

function bindPolyatomicSubTabs() {
    const srsTabBtn = document.getElementById("subnav-nomen-srs");
    const polyTabBtn = document.getElementById("subnav-nomen-polyatomic");
    const srsPanel = document.getElementById("panel-nomen-srs");
    const polyPanel = document.getElementById("panel-nomen-polyatomic");

    if (!srsTabBtn || !polyTabBtn || !srsPanel || !polyPanel) return;

    srsTabBtn.addEventListener("click", () => {
        srsPanel.classList.remove("hidden-tab");
        polyPanel.classList.add("hidden-tab");

        srsTabBtn.className = "px-5 py-2.5 text-sm font-bold border-b-2 border-amber-500 text-amber-700 dark:text-amber-400 transition-all focus:outline-none";
        polyTabBtn.className = "px-5 py-2.5 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all focus:outline-none";

        srsTabBtn.setAttribute("aria-selected", "true");
        polyTabBtn.setAttribute("aria-selected", "false");
    });

    polyTabBtn.addEventListener("click", () => {
        polyPanel.classList.remove("hidden-tab");
        srsPanel.classList.add("hidden-tab");

        polyTabBtn.className = "px-5 py-2.5 text-sm font-bold border-b-2 border-amber-500 text-amber-700 dark:text-amber-400 transition-all focus:outline-none";
        srsTabBtn.className = "px-5 py-2.5 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all focus:outline-none";

        polyTabBtn.setAttribute("aria-selected", "true");
        srsTabBtn.setAttribute("aria-selected", "false");

        if (window.buildPolyatomicDeck) {
            window.buildPolyatomicDeck(false);
        }
    });
}

function bindPolyatomicIonsActions() {
    const card = document.getElementById("poly-fc-card");
    const frontText = document.getElementById("poly-fc-front");
    const backText = document.getElementById("poly-fc-back");
    const frontBadge = document.getElementById("poly-front-group-badge");
    const backBadge = document.getElementById("poly-back-group-badge");
    const backTitle = document.getElementById("poly-fc-back-title");
    const controls = document.getElementById("poly-fc-controls");
    
    const btnStruggle = document.getElementById("btn-poly-struggle");
    const btnHard = document.getElementById("btn-poly-hard");
    const btnGood = document.getElementById("btn-poly-good");
    const btnEasy = document.getElementById("btn-poly-easy");
    const btnPolyAskTutor = document.getElementById("btn-poly-ask-tutor");

    const intStruggle = document.getElementById("poly-int-struggle");
    const intHard = document.getElementById("poly-int-hard");
    const intGood = document.getElementById("poly-int-good");
    const intEasy = document.getElementById("poly-int-easy");
    
    const btnShuffle = document.getElementById("btn-poly-shuffle");
    const btnReset = document.getElementById("btn-poly-reset");
    const btnRestart = document.getElementById("btn-poly-restart");
    
    const btnModeN2F = document.getElementById("btn-poly-mode-n2f");
    const btnModeF2N = document.getElementById("btn-poly-mode-f2n");
    const groupSelect = document.getElementById("poly-group-select");
    
    const progressRatio = document.getElementById("poly-progress-ratio");
    const progressLabel = document.getElementById("poly-progress-label");
    const progressBar = document.getElementById("poly-progress-bar");
    const trackerGrid = document.getElementById("poly-ions-tracker-grid");
    const victoryPanel = document.getElementById("poly-victory-panel");
    const polyStatInterval = document.getElementById("poly-stat-interval");
    const polyStatStreak = document.getElementById("poly-stat-streak");
    const polyStatLapses = document.getElementById("poly-stat-lapses");

    if (!card || !frontText || !backText || !frontBadge || !backBadge || !backTitle || !controls || !btnStruggle || !btnHard || !btnGood || !btnEasy || !btnShuffle || !btnReset || !btnRestart || !btnModeN2F || !btnModeF2N || !groupSelect || !progressRatio || !progressBar || !trackerGrid || !victoryPanel || !window.ChemData || !window.ChemData.polyatomicIons) return;

    let studyMode = "N2F";
    let currentFilter = "all";
    let currentCard = null;
    let isCardFlipped = false;

    const allIons = window.ChemData.polyatomicIons;
    const polyRecentlyShown = [];

    function safeJsonParse(raw, fallback) {
        try {
            return JSON.parse(raw);
        } catch {
            return fallback;
        }
    }

    function createDefaultPolyState() {
        return {
            intervals: {},
            dueDates: {},
            easeFactors: {},
            lapses: {},
            streaks: {},
            lastSeen: {}
        };
    }

    function getPolyCardId(ion) {
        return ion.name;
    }

    function initializePolySrsState() {
        const existing = safeJsonParse(localStorage.getItem(CHEM_POLY_SRS_STATE_KEY), null);
        if (existing) {
            return {
                ...createDefaultPolyState(),
                ...existing
            };
        }

        const state = createDefaultPolyState();
        const legacyMastered = safeJsonParse(localStorage.getItem(CHEM_POLY_LEGACY_KEY), []);
        if (!Array.isArray(legacyMastered) || legacyMastered.length === 0) return state;

        const now = Date.now();
        allIons.forEach((ion) => {
            if (!legacyMastered.includes(ion.name)) return;
            const cardId = getPolyCardId(ion);
            state.intervals[cardId] = 21;
            state.dueDates[cardId] = now + (21 * 24 * 60 * 60 * 1000);
            state.easeFactors[cardId] = 2.8;
            state.streaks[cardId] = 5;
            state.lapses[cardId] = 0;
            state.lastSeen[cardId] = now;
        });

        localStorage.setItem(CHEM_POLY_SRS_STATE_KEY, JSON.stringify(state));
        return state;
    }

    let polySrsState = initializePolySrsState();
    const allPolyCardIds = allIons.map((ion) => getPolyCardId(ion));

    function savePolyState() {
        localStorage.setItem(CHEM_POLY_SRS_STATE_KEY, JSON.stringify(polySrsState));
        registerChemDeckState("poly", polySrsState, allPolyCardIds);
    }

    function getFilteredIons() {
        return allIons.filter((ion) => currentFilter === "all" || ion.charge === currentFilter);
    }

    function calculatePolyFutureInterval(cardId, grade) {
        const currentInterval = polySrsState.intervals[cardId] || 0;
        const currentEase = polySrsState.easeFactors[cardId] || 2.5;

        if (grade === 0) {
            return currentInterval >= 7 ? Math.round(currentInterval * 0.35) : 0;
        }
        if (grade === 1) {
            if (currentInterval === 0) return 1;
            if (currentInterval === 1) return 2;
            return Math.round(currentInterval * 1.2);
        }
        if (grade === 2) {
            if (currentInterval === 0) return 2;
            if (currentInterval === 1) return 3;
            return Math.round(currentInterval * currentEase);
        }
        if (grade === 3) {
            if (currentInterval === 0) return 4;
            if (currentInterval === 1) return 6;
            return Math.round(currentInterval * currentEase * 1.45) + 1;
        }
        return 0;
    }

    function getNextPolyCard() {
        const candidates = getFilteredIons().map((ion) => ({
            ...ion,
            id: getPolyCardId(ion)
        }));

        if (candidates.length === 0) return null;

        const now = Date.now();
        let due = candidates.filter((c) => {
            const dueAt = polySrsState.dueDates[c.id];
            return dueAt && dueAt <= now;
        });

        let newCards = candidates.filter((c) => !polySrsState.dueDates[c.id]);

        let fallback = candidates.filter((c) => (polySrsState.intervals[c.id] || 0) < 14);
        if (fallback.length === 0) fallback = candidates;

        fallback.sort((a, b) => {
            const lastSeenA = polySrsState.lastSeen[a.id] || 0;
            const lastSeenB = polySrsState.lastSeen[b.id] || 0;
            if (lastSeenA !== lastSeenB) return lastSeenA - lastSeenB;

            const easeA = polySrsState.easeFactors[a.id] || 2.5;
            const easeB = polySrsState.easeFactors[b.id] || 2.5;
            if (easeA !== easeB) return easeA - easeB;

            const lapsesA = polySrsState.lapses[a.id] || 0;
            const lapsesB = polySrsState.lapses[b.id] || 0;
            return lapsesB - lapsesA;
        });

        const cooldownSize = Math.min(3, candidates.length - 1);
        if (cooldownSize > 0 && polyRecentlyShown.length > 0) {
            const filteredDue = due.filter(c => !polyRecentlyShown.includes(c.id));
            if (filteredDue.length > 0) due = filteredDue;

            const filteredNew = newCards.filter(c => !polyRecentlyShown.includes(c.id));
            if (filteredNew.length > 0) newCards = filteredNew;

            const filteredFallback = fallback.filter(c => !polyRecentlyShown.includes(c.id));
            if (filteredFallback.length > 0) fallback = filteredFallback;
        }

        if (due.length > 0) return shuffleArray(due)[0];
        if (newCards.length > 0) return shuffleArray(newCards)[0];
        return fallback[0];
    }

    function updatePolyStats(cardId) {
        if (!polyStatInterval || !polyStatStreak || !polyStatLapses) return;
        polyStatInterval.textContent = formatRelativeDueText(polySrsState.dueDates[cardId]);
        polyStatStreak.textContent = `${polySrsState.streaks[cardId] || 0} 🔥`;
        polyStatLapses.textContent = `${polySrsState.lapses[cardId] || 0}`;
    }

    function getFilteredProgressSummary() {
        const ions = getFilteredIons();
        const total = ions.length;
        const dueCount = ions.filter((ion) => {
            const dueAt = polySrsState.dueDates[getPolyCardId(ion)];
            return dueAt && dueAt <= Date.now();
        }).length;

        let strengthSum = 0;
        ions.forEach((ion) => {
            const cardId = getPolyCardId(ion);
            strengthSum += calculateCardStrength(
                polySrsState.intervals[cardId] || 0,
                polySrsState.easeFactors[cardId] || 2.5
            );
        });

        return {
            total,
            dueCount,
            masteryPercent: total > 0 ? Math.round((strengthSum / total) * 100) : 0
        };
    }

    function renderTracker() {
        const filteredIons = getFilteredIons();
        trackerGrid.innerHTML = "";
        filteredIons.forEach((ion) => {
            const cardId = getPolyCardId(ion);
            const interval = polySrsState.intervals[cardId] || 0;
            const dueAt = polySrsState.dueDates[cardId] || 0;

            let chipClass = "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border";
            let icon = "<i class=\"fa-regular fa-circle text-[9px] shrink-0 ml-1\"></i>";

            if (interval >= 14 && dueAt > Date.now()) {
                chipClass += " bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
                icon = "<i class=\"fa-solid fa-circle-check text-[10px] shrink-0 ml-1 text-emerald-500\"></i>";
            } else if (dueAt && dueAt <= Date.now()) {
                chipClass += " bg-rose-500/10 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-500/20";
                icon = "<i class=\"fa-solid fa-clock text-[10px] shrink-0 ml-1 text-rose-500\"></i>";
            } else if (interval > 0) {
                chipClass += " bg-amber-500/10 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-500/20";
                icon = "<i class=\"fa-solid fa-graduation-cap text-[10px] shrink-0 ml-1 text-amber-500\"></i>";
            } else {
                chipClass += " bg-gray-50 dark:bg-[#1a1d27] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#363a52]";
            }

            const chip = document.createElement("div");
            chip.className = chipClass;
            chip.innerHTML = `<span class="truncate">${ion.name}</span>${icon}`;
            trackerGrid.appendChild(chip);
        });
    }

    function renderPolyCard() {
        currentCard = getNextPolyCard();
        isCardFlipped = false;

        if (currentCard) {
            const idx = polyRecentlyShown.indexOf(currentCard.id);
            if (idx > -1) polyRecentlyShown.splice(idx, 1);
            polyRecentlyShown.push(currentCard.id);
            
            const maxCooldown = Math.min(3, getFilteredIons().length - 1);
            while (polyRecentlyShown.length > Math.max(0, maxCooldown)) {
                polyRecentlyShown.shift();
            }
        }

        card.classList.remove("flipped");
        controls.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
        controls.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0");

        const { total, dueCount, masteryPercent } = getFilteredProgressSummary();
        if (progressLabel) {
            progressLabel.textContent = "Mastery Strength";
        }
        progressRatio.textContent = total > 0 ? `${masteryPercent}% • ${dueCount} due` : "No cards";
        progressBar.style.width = `${masteryPercent}%`;

        if (!currentCard) {
            card.classList.add("hidden");
            controls.classList.add("hidden");
            victoryPanel.classList.remove("hidden");
            return;
        }

        card.classList.remove("hidden");
        controls.classList.remove("hidden");
        victoryPanel.classList.add("hidden");

        if (studyMode === "N2F") {
            frontText.textContent = currentCard.name;
            backTitle.textContent = "Chemical Formula";
            backText.innerHTML = currentCard.htmlFormula;
        } else {
            frontText.innerHTML = currentCard.htmlFormula;
            backTitle.textContent = "Ion Name";
            backText.textContent = currentCard.name;
        }

        frontBadge.textContent = currentCard.group;
        backBadge.textContent = currentCard.group;

        updatePolyStats(currentCard.id);
        renderTracker();
    }

    function setModeUi() {
        if (studyMode === "N2F") {
            btnModeN2F.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-white dark:bg-[#1a1d27] text-amber-700 dark:text-amber-400 shadow-sm focus:outline-none";
            btnModeF2N.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white focus:outline-none";
        } else {
            btnModeF2N.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-white dark:bg-[#1a1d27] text-amber-700 dark:text-amber-400 shadow-sm focus:outline-none";
            btnModeN2F.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white focus:outline-none";
        }
    }

    function handlePolyGrade(grade) {
        if (!currentCard) return;
        const cardId = currentCard.id;
        const newInterval = calculatePolyFutureInterval(cardId, grade);
        let ease = polySrsState.easeFactors[cardId] || 2.5;

        if (grade === 0) ease = Math.max(1.3, ease - 0.2);
        else if (grade === 1) ease = Math.max(1.3, ease - 0.15);
        else if (grade === 3) ease = Math.min(3.0, ease + 0.12);

        if (grade === 0) {
            polySrsState.lapses[cardId] = (polySrsState.lapses[cardId] || 0) + 1;
        }

        if (grade >= 2) {
            polySrsState.streaks[cardId] = (polySrsState.streaks[cardId] || 0) + 1;
        } else {
            polySrsState.streaks[cardId] = 0;
        }

        let nextDue = Date.now();
        if (newInterval > 0) {
            const d = new Date();
            if (d.getHours() < 4) d.setDate(d.getDate() - 1);
            d.setDate(d.getDate() + newInterval);
            d.setHours(4, 0, 0, 0);
            nextDue = d.getTime();
        }

        polySrsState.intervals[cardId] = newInterval;
        polySrsState.easeFactors[cardId] = ease;
        polySrsState.dueDates[cardId] = nextDue;
        polySrsState.lastSeen[cardId] = Date.now();

        savePolyState();
        applySessionGamification(grade);

        if (grade >= 2 && window.activeSandboxHandshake && getTabForTarget(window.activeSandboxHandshake.target) === "nomenclature") {
            completeActiveSandboxHandshake();
        }

        card.classList.remove("flipped");
        controls.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
        controls.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0");
        isCardFlipped = false;

        setTimeout(() => {
            renderPolyCard();
        }, 400);
    }

    function flipCard() {
        if (!currentCard) return;
        isCardFlipped = !isCardFlipped;
        if (isCardFlipped) {
            card.classList.add("flipped");
            
            // Calculate and display intervals
            const currentIntervals = [];
            for (let i = 0; i < 4; i++) {
                currentIntervals[i] = calculatePolyFutureInterval(currentCard.id, i);
            }
            if (intStruggle) intStruggle.textContent = formatInterval(currentIntervals[0]);
            if (intHard) intHard.textContent = formatInterval(currentIntervals[1]);
            if (intGood) intGood.textContent = formatInterval(currentIntervals[2]);
            if (intEasy) intEasy.textContent = formatInterval(currentIntervals[3]);

            controls.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
            controls.classList.add("opacity-100", "pointer-events-auto", "translate-y-0");
        } else {
            card.classList.remove("flipped");
            controls.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
            controls.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0");
        }
    }

    card.addEventListener("click", flipCard);

    document.addEventListener("keydown", (e) => {
        const nomenclView = document.getElementById("view-nomenclature");
        const polyPanel = document.getElementById("panel-nomen-polyatomic");
        if (!nomenclView || !polyPanel || nomenclView.classList.contains("hidden-tab") || polyPanel.classList.contains("hidden-tab")) return;

        // Bypassing input elements to allow normal typing
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.isContentEditable)) return;

        if (e.code === "Space" || e.key === " ") {
            if (!isCardFlipped) {
                e.preventDefault();
                flipCard();
            }
        } else if (["1", "2", "3", "4"].includes(e.key)) {
            if (isCardFlipped) {
                e.preventDefault();
                const grade = parseInt(e.key) - 1;
                handlePolyGrade(grade);
            }
        }
    });

    btnModeN2F.addEventListener("click", () => {
        if (studyMode === "N2F") return;
        studyMode = "N2F";
        setModeUi();
        renderPolyCard();
    });

    btnModeF2N.addEventListener("click", () => {
        if (studyMode === "F2N") return;
        studyMode = "F2N";
        setModeUi();
        renderPolyCard();
    });

    groupSelect.addEventListener("change", (e) => {
        currentFilter = e.target.value;
        renderPolyCard();
    });

    btnShuffle.addEventListener("click", () => {
        if (!currentCard) return;

        // Shuffle-like effect: add a slight due-time offset so a different eligible card is selected next.
        const cardId = currentCard.id;
        polySrsState.dueDates[cardId] = Date.now() + (20 * 60 * 1000);
        savePolyState();
        renderPolyCard();
    });

    btnReset.addEventListener("click", () => {
        if (!confirm("Reset all Polyatomic SRS progress for this module?")) return;
        localStorage.removeItem(CHEM_POLY_SRS_STATE_KEY);
        polySrsState = createDefaultPolyState();
        savePolyState();
        renderPolyCard();
    });

    btnRestart.addEventListener("click", () => {
        polySrsState = createDefaultPolyState();
        savePolyState();
        renderPolyCard();
    });

    btnStruggle.addEventListener("click", (e) => {
        e.stopPropagation();
        handlePolyGrade(0);
    });

    btnHard.addEventListener("click", (e) => {
        e.stopPropagation();
        handlePolyGrade(1);
    });

    btnGood.addEventListener("click", (e) => {
        e.stopPropagation();
        handlePolyGrade(2);
    });

    btnEasy.addEventListener("click", (e) => {
        e.stopPropagation();
        handlePolyGrade(3);
    });

    if (btnPolyAskTutor) {
        btnPolyAskTutor.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!currentCard) return;
            const hasHistory = window.ChemTutor && typeof window.ChemTutor.hasHistory === 'function' && window.ChemTutor.hasHistory();
            const starterPrompt = hasHistory
                ? null
                : `I am struggling with polyatomic ion: Name '${currentCard.name}', Formula '${currentCard.formula}'. Explain charge, rules, or provide a mnemonic hook.`;
            window.ChemTutor.invoke(
                starterPrompt,
                null,
                `The user is practicing Polyatomic Ions flashcards. Current ion: ${currentCard.name}, formula: ${currentCard.formula}, charge: ${currentCard.charge}, group: ${currentCard.group}.`,
                { popup: true }
            );
        });
    }

    registerChemDeckState("poly", polySrsState, allPolyCardIds);
    setModeUi();
    renderPolyCard();
    window.buildPolyatomicDeck = () => renderPolyCard();
}

function bindLabActions() {
    const equipmentSelect = document.getElementById("lab-equipment");
    const container = document.getElementById("lab-scenario-container");
    const btnGen = document.getElementById("btn-generate-scenario");
    const visualizer = document.getElementById("lab-visualizer");
    const readingInput = document.getElementById("lab-reading");
    const btnCheck = document.getElementById("btn-check-reading");
    const output = document.getElementById("lab-output");
    const step1 = document.getElementById("lab-step1");
    const step2 = document.getElementById("lab-step2");
    const step3 = document.getElementById("lab-step3");
    
    if (!equipmentSelect || !container || !btnGen || !readingInput || !btnCheck || !output || !window.ChemData) return;

    equipmentSelect.innerHTML = "";
    Object.entries(window.ChemData.labEquipment).forEach(([key, spec]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = spec.name;
        equipmentSelect.appendChild(opt);
    });

    function generateSVG(spec, value) {
        if (spec.type === "digital") {
            // Analytical Balance rendering
            return `
            <svg width="220" height="220" xmlns="http://www.w3.org/2000/svg" class="mx-auto select-none">
                <defs>
                    <linearGradient id="metalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#94a3b8" />
                        <stop offset="50%" stop-color="#f1f5f9" />
                        <stop offset="100%" stop-color="#64748b" />
                    </linearGradient>
                    <linearGradient id="lcdGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#020617" />
                        <stop offset="100%" stop-color="#0f172a" />
                    </linearGradient>
                    <linearGradient id="casingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#f8fafc" />
                        <stop offset="100%" stop-color="#cbd5e1" />
                    </linearGradient>
                </defs>

                <!-- Balance Base Shadow -->
                <rect x="8" y="105" width="204" height="106" fill="rgba(0, 0, 0, 0.15)" rx="12" />

                <!-- Balance Body -->
                <rect x="10" y="100" width="200" height="110" fill="url(#casingGradient)" stroke="#94a3b8" stroke-width="2.5" rx="10" />
                
                <!-- Feet of the balance -->
                <rect x="25" y="209" width="30" height="6" fill="#334155" rx="2" />
                <rect x="165" y="209" width="30" height="6" fill="#334155" rx="2" />
                
                <!-- Glass Draft Shield Back panel & floor -->
                <rect x="30" y="15" width="160" height="85" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1" rx="4" />
                <!-- Chamber Interior shadow -->
                <rect x="32" y="17" width="156" height="15" fill="rgba(148, 163, 184, 0.1)" />
                
                <!-- Weighing Pan Pillar -->
                <rect x="106" y="78" width="8" height="22" fill="#64748b" stroke="#475569" stroke-width="0.5" />
                <!-- Weighing Pan -->
                <ellipse cx="110" cy="78" rx="42" ry="5" fill="url(#metalGradient)" stroke="#475569" stroke-width="1" />
                
                <!-- Weighing Boat -->
                <path d="M 88 77 L 93 70 L 127 70 L 132 77 Z" fill="rgba(147, 197, 253, 0.5)" stroke="#2563eb" stroke-width="1.5" />
                <!-- Substance (Crystals represented as white and pale blue dots) -->
                <circle cx="106" cy="74" r="1.5" fill="#ffffff" opacity="0.9" />
                <circle cx="109" cy="73" r="1.5" fill="#e0f2fe" opacity="0.9" />
                <circle cx="112" cy="74" r="2" fill="#ffffff" opacity="0.9" />
                <circle cx="115" cy="73" r="1.5" fill="#bae6fd" opacity="0.9" />
                <circle cx="111" cy="72" r="1" fill="#ffffff" opacity="0.9" />
                <circle cx="118" cy="74" r="1.5" fill="#ffffff" opacity="0.9" />
                <circle cx="103" cy="75" r="1.5" fill="#ffffff" opacity="0.9" />
                <circle cx="107" cy="75" r="1" fill="#bae6fd" opacity="0.9" />
                <circle cx="114" cy="75" r="1" fill="#ffffff" opacity="0.9" />
                
                <!-- Draft Shield Glass Panels (Foreground) -->
                <rect x="30" y="15" width="160" height="85" fill="rgba(219, 234, 254, 0.15)" stroke="#94a3b8" stroke-width="1.5" rx="4" />
                <!-- Glass Reflections -->
                <path d="M 35 18 L 85 18 L 50 95 L 35 95 Z" fill="rgba(255, 255, 255, 0.25)" />
                <path d="M 145 18 L 185 18 L 175 95 L 145 95 Z" fill="rgba(255, 255, 255, 0.15)" />
                
                <!-- Digital Display Panel -->
                <rect x="30" y="115" width="160" height="46" fill="url(#lcdGradient)" stroke="#334155" stroke-width="2.5" rx="6" />
                <!-- Glowing digital readout -->
                <text x="110" y="146" fill="#06b6d4" font-family="monospace" font-weight="bold" font-size="22" text-anchor="middle" style="text-shadow: 0 0 8px rgba(6, 182, 212, 0.8);" class="select-none">
                    ${value.toFixed(spec.decimalPlaces)} <tspan font-size="15" fill="#0891b2">${spec.unit}</tspan>
                </text>
                
                <!-- Status text "STABLE" -->
                <text x="38" y="127" fill="#10b981" font-family="sans-serif" font-weight="bold" font-size="7" class="select-none">STABLE</text>
                <!-- Zero indicator -->
                <circle cx="176" cy="124" r="2" fill="#10b981" />
                <text x="176" y="132" fill="#64748b" font-family="sans-serif" font-size="6" text-anchor="middle" class="select-none">ZERO</text>
                
                <!-- Buttons -->
                <!-- Tare Button -->
                <g class="cursor-pointer">
                    <rect x="40" y="174" width="40" height="20" fill="#94a3b8" stroke="#475569" stroke-width="1" rx="4" />
                    <text x="60" y="187" fill="#1e293b" font-family="sans-serif" font-weight="bold" font-size="8" text-anchor="middle" class="select-none">TARE</text>
                </g>
                <!-- On/Off Button -->
                <g class="cursor-pointer">
                    <rect x="90" y="174" width="40" height="20" fill="#ef4444" stroke="#b91c1c" stroke-width="1" rx="4" />
                    <text x="110" y="187" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="8" text-anchor="middle" class="select-none">ON/OFF</text>
                </g>
                <!-- Cal Button -->
                <g class="cursor-pointer">
                    <rect x="140" y="174" width="40" height="20" fill="#94a3b8" stroke="#475569" stroke-width="1" rx="4" />
                    <text x="160" y="187" fill="#1e293b" font-family="sans-serif" font-weight="bold" font-size="8" text-anchor="middle" class="select-none">CAL</text>
                </g>
            </svg>
            `;
        }

        const major = spec.majorIncrement;
        const minor = spec.minorIncrement;
        const isBurette = !!spec.inverted;
        const isQualitative = !!spec.qualitative;
        const isThermometer = spec.unit === "°C";

        // Let's decide scale drawing range (minDraw to maxDraw)
        // Draw centered around target value, but clamped to spec limits.
        // A range of 3 major divisions is ideal for cylinders/thermometer.
        // For beaker we show the entire range.
        let minDraw, maxDraw;
        if (spec.name.includes("Beaker")) {
            minDraw = spec.min;
            maxDraw = spec.max;
        } else {
            minDraw = Math.floor(value / major) * major - major;
            maxDraw = Math.floor(value / major) * major + major * 2;
            if (minDraw < spec.min) minDraw = Math.floor(spec.min / major) * major;
            if (maxDraw > spec.max) maxDraw = Math.ceil(spec.max / major) * major;
            if (minDraw >= maxDraw) {
                minDraw = spec.min;
                maxDraw = spec.max;
            }
        }

        // Set dynamic tick spacing based on number of divisions
        let tickSpacing = 20;
        const totalMinorTicks = Math.round((maxDraw - minDraw) / minor);
        if (totalMinorTicks <= 5) {
            tickSpacing = 70;
        } else if (totalMinorTicks <= 15) {
            tickSpacing = 35;
        } else {
            tickSpacing = 22;
        }
        const h = totalMinorTicks * tickSpacing;

        // Visual setup depending on instrument type
        let svgWidth = 160;
        let svgHeight = h + 100;
        let tubeWidth = 70;
        let tubeX1 = 45;
        let tubeX2 = 115;
        let center = 80;
        let curveDepth = 10;
        let liquidColor = isQualitative ? "rgba(59, 130, 246, 0.3)" : "rgba(167, 139, 250, 0.35)";
        
        if (spec.name.includes("10 mL")) {
            tubeWidth = 50;
            tubeX1 = 55;
            tubeX2 = 105;
            curveDepth = 7;
        } else if (isBurette) {
            tubeWidth = 42;
            tubeX1 = 59;
            tubeX2 = 101;
            curveDepth = 6;
            svgHeight = h + 180; // Extra room for the burette stopcock assembly
        } else if (isThermometer) {
            tubeWidth = 24;
            tubeX1 = 68;
            tubeX2 = 92;
            curveDepth = 0; // The thermometer has a convex red capillary cap
        } else if (spec.name.includes("Beaker")) {
            tubeWidth = 140;
            tubeX1 = 30;
            tubeX2 = 170;
            center = 100;
            curveDepth = 14;
            svgWidth = 200;
            svgHeight = h + 80;
            liquidColor = "rgba(56, 189, 248, 0.35)"; // sky blue
        }

        // 1. Calculate Meniscus Y Coordinate
        // Non-inverted: minDraw at bottom (y = h + 40), maxDraw at top (y = 40)
        // Inverted: minDraw at top (y = 40), maxDraw at bottom (y = h + 40)
        let yTarget;
        if (isBurette) {
            yTarget = 40 + ((value - minDraw) / (maxDraw - minDraw)) * h;
        } else {
            yTarget = 40 + ((maxDraw - value) / (maxDraw - minDraw)) * h;
        }

        // Draw ticks and labels
        let pathMarks = "";
        let textMarks = "";

        for (let i = 0; i <= totalMinorTicks; i++) {
            const y = 40 + i * tickSpacing;
            const currentVal = isBurette ? (minDraw + i * minor) : (maxDraw - i * minor);
            const rem = currentVal % major;
            const isMajor = Math.abs(rem) < 1e-6 || Math.abs(rem - major) < 1e-6;

            let tickX1, tickX2, labelX, lineLength;

            if (isThermometer) {
                // Ticks drawn on the right stem wall going right
                tickX1 = tubeX2;
                lineLength = isMajor ? 14 : 7;
                tickX2 = tubeX2 + lineLength;
                labelX = tickX2 + 4;
            } else if (spec.name.includes("Beaker")) {
                // Beaker ticks starting from left wall going right
                tickX1 = tubeX1;
                lineLength = isMajor ? 26 : 14;
                tickX2 = tubeX1 + lineLength;
                labelX = tickX2 + 6;
            } else {
                // Cylinders/Burettes ticks starting from left wall going right
                tickX1 = tubeX1;
                lineLength = isMajor ? 24 : 12;
                tickX2 = tubeX1 + lineLength;
                labelX = tickX2 + 6;
            }

            pathMarks += `<line x1="${tickX1}" y1="${y}" x2="${tickX2}" y2="${y}" stroke="#334155" stroke-width="${isMajor ? 1.5 : 0.8}" />`;
            
            if (isMajor) {
                const dp = (major.toString().includes(".")) ? major.toString().split(".")[1].length : 0;
                const formattedVal = currentVal.toFixed(dp);
                textMarks += `<text x="${labelX}" y="${y + 4}" fill="#1e293b" font-size="12" font-family="monospace" font-weight="bold" class="select-none">${formattedVal}</text>`;
            }
        }

        // Liquid filling and meniscus path
        let fillPath = "";
        let meniscusPath = "";

        if (isThermometer) {
            // Thermometer red capillary line and bulb
            const capillaryWidth = 4;
            const capillaryX = center - capillaryWidth / 2;
            const bulbY = h + 65;
            
            // Red column from bulb to yTarget
            fillPath = `
                <!-- Bulb -->
                <circle cx="${center}" cy="${bulbY}" r="15" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5" />
                <circle cx="${center - 5}" cy="${bulbY - 5}" r="4" fill="#ffffff" opacity="0.3" />
                <!-- Capillary red liquid -->
                <rect x="${capillaryX}" y="${yTarget}" width="${capillaryWidth}" height="${bulbY - yTarget}" fill="#ef4444" />
                <!-- Rounded top on the column -->
                <circle cx="${center}" cy="${yTarget}" r="2" fill="#ef4444" />
            `;
            // For thermometer, we don't have a wide concave meniscus
            meniscusPath = ``;
        } else {
            // Concave meniscus curve
            // The bottom of the meniscus (center x) is exactly at yTarget.
            // The sides are shifted UP by curveDepth: (yTarget - curveDepth).
            const meniscusY = yTarget - curveDepth;
            
            let fillBottomY = h + 50;
            if (isBurette) fillBottomY = h + 100; // liquid fills down to the stopcock top

            fillPath = `<path d="M ${tubeX1} ${meniscusY} Q ${center} ${yTarget} ${tubeX2} ${meniscusY} L ${tubeX2} ${fillBottomY} L ${tubeX1} ${fillBottomY} Z" fill="${liquidColor}" />`;
            meniscusPath = `
                <!-- Main dark meniscus line -->
                <path d="M ${tubeX1} ${meniscusY} Q ${center} ${yTarget} ${tubeX2} ${meniscusY}" fill="none" stroke="#4f46e5" stroke-width="2.5" />
                <!-- Highlight line under the meniscus -->
                <path d="M ${tubeX1} ${meniscusY + 1} Q ${center} ${yTarget + 1} ${tubeX2} ${meniscusY + 1}" fill="none" stroke="#c084fc" stroke-width="1" opacity="0.6" />
            `;
        }

        // Draw the glassware frame and accessories
        let glasswareFrame = "";

        if (isThermometer) {
            // Glass outer bulb and stem
            glasswareFrame = `
                <!-- Stem -->
                <rect x="${tubeX1}" y="15" width="${tubeWidth}" height="${h + 50}" fill="rgba(241, 245, 249, 0.15)" stroke="#94a3b8" stroke-width="2" rx="6" />
                <!-- Rounded Cap -->
                <path d="M ${tubeX1} 15 Q ${center} 0 ${tubeX2} 15 Z" fill="rgba(241, 245, 249, 0.15)" stroke="#94a3b8" stroke-width="2" />
                <!-- Glass bulb outline -->
                <circle cx="${center}" cy="${h + 65}" r="18" fill="none" stroke="#94a3b8" stroke-width="2" />
                <!-- Capillary hollow channel background -->
                <rect x="${center - 1.5}" y="10" width="3" height="${h + 40}" fill="rgba(0, 0, 0, 0.05)" />
            `;
        } else if (spec.name.includes("Beaker")) {
            // Beaker shape: rectangular body with spout at top left
            glasswareFrame = `
                <!-- Beaker body -->
                <path d="M 30 20 L 170 20 L 170 ${h + 50} Q 170 ${h + 54} 166 ${h + 54} L 34 ${h + 54} Q 30 ${h + 54} 30 ${h + 50} Z" fill="rgba(241, 245, 249, 0.1)" stroke="#94a3b8" stroke-width="2.5" />
                <!-- Beaker Spout -->
                <path d="M 30 20 C 20 18, 18 10, 26 8 C 30 7, 32 15, 34 20" fill="none" stroke="#94a3b8" stroke-width="2.5" />
                <!-- White scale prints on beaker glass -->
                <text x="${center}" y="38" fill="#64748b" font-family="sans-serif" font-weight="bold" font-size="10" text-anchor="middle" class="select-none" opacity="0.8">100 mL</text>
                <text x="${center}" y="48" fill="#64748b" font-family="sans-serif" font-size="7" text-anchor="middle" class="select-none" opacity="0.7">APPROX. VOL.</text>
            `;
        } else if (isBurette) {
            // Burette glass tube extending to stopcock at the bottom
            const stopcockY = h + 110;
            glasswareFrame = `
                <!-- Glass Tube -->
                <rect x="${tubeX1}" y="0" width="${tubeWidth}" height="${h + 100}" fill="rgba(241, 245, 249, 0.05)" stroke="#94a3b8" stroke-width="2" />
                
                <!-- Stopcock Narrows -->
                <path d="M ${tubeX1} ${h + 100} L ${center - 6} ${stopcockY} L ${center + 6} ${stopcockY} L ${tubeX2} ${h + 100} Z" fill="rgba(241, 245, 249, 0.2)" stroke="#94a3b8" stroke-width="2" />
                <!-- Stopcock Liquid inside -->
                <path d="M ${tubeX1} ${h + 100} L ${center - 6} ${stopcockY} L ${center + 6} ${stopcockY} L ${tubeX2} ${h + 100} Z" fill="${liquidColor}" opacity="0.8" />
                
                <!-- Stopcock Valve Assembly -->
                <!-- Valve casing -->
                <circle cx="${center}" cy="${stopcockY}" r="11" fill="#cbd5e1" stroke="#475569" stroke-width="1.5" />
                <!-- Teflon Rotating Valve Knob (Red, showing open position: vertical alignment) -->
                <rect x="${center - 4}" y="${stopcockY - 14}" width="8" height="28" fill="#ef4444" rx="2" stroke="#b91c1c" stroke-width="1" />
                <rect x="${center - 7}" y="${stopcockY - 4}" width="14" height="8" fill="#ef4444" rx="1" stroke="#b91c1c" stroke-width="1" />
                
                <!-- Drip Tip glass -->
                <path d="M ${center - 5} ${stopcockY + 11} L ${center - 2} ${stopcockY + 45} L ${center + 2} ${stopcockY + 45} L ${center + 5} ${stopcockY + 11} Z" fill="rgba(241, 245, 249, 0.2)" stroke="#94a3b8" stroke-width="2" />
                <!-- Liquid in drip tip -->
                <path d="M ${center - 5} ${stopcockY + 11} L ${center - 2} ${stopcockY + 45} L ${center + 2} ${stopcockY + 45} L ${center + 5} ${stopcockY + 11} Z" fill="${liquidColor}" opacity="0.8" />
                
                <!-- Label Burette unit -->
                <text x="${center}" y="25" fill="#64748b" font-family="sans-serif" font-weight="bold" font-size="9" text-anchor="middle" class="select-none" opacity="0.7">50 mL</text>
            `;
        } else {
            // Graduated Cylinders
            const baseTopY = h + 50;
            const baseBottomY = h + 68;
            glasswareFrame = `
                <!-- Glass Tube -->
                <rect x="${tubeX1}" y="20" width="${tubeWidth}" height="${h + 30}" fill="rgba(241, 245, 249, 0.05)" stroke="#94a3b8" stroke-width="2" rx="4" />
                <!-- Flared Pouring Lip at top -->
                <path d="M ${tubeX1} 20 C ${tubeX1 - 8} 18, ${tubeX1 - 8} 5, ${tubeX1 + 4} 10 C ${tubeX1 + 10} 12, ${center} 12, ${center} 20" fill="none" stroke="#94a3b8" stroke-width="2" />
                
                <!-- Plastic Hexagonal Base -->
                <polygon points="${center - 50},${baseTopY} ${center + 50},${baseTopY} ${center + 60},${baseBottomY} ${center - 60},${baseBottomY}" fill="#334155" stroke="#1e293b" stroke-width="1.5" />
                <!-- Bumper guard ring (amber plastic collar) to prevent breakage -->
                <rect x="${tubeX1 - 5}" y="32" width="${tubeWidth + 10}" height="10" fill="#f59e0b" stroke="#d97706" stroke-width="1.5" rx="3" opacity="0.85" />
                
                <!-- White vertical highlights for glass reflection -->
                <rect x="${tubeX2 - 12}" y="22" width="4" height="${h + 26}" fill="#ffffff" opacity="0.25" rx="2" />
                
                <!-- Label for unit -->
                <text x="${center}" y="48" fill="#64748b" font-family="sans-serif" font-weight="bold" font-size="9" text-anchor="middle" class="select-none" opacity="0.7">${spec.unit}</text>
            `;
        }

        return `
        <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" class="mx-auto drop-shadow-md">
            ${fillPath}
            ${glasswareFrame}
            ${meniscusPath}
            ${pathMarks}
            ${textMarks}
        </svg>
        `;
    }

    btnGen.addEventListener("click", () => {
        const key = equipmentSelect.value;
        const spec = window.ChemData.labEquipment?.[key];
        if (!spec) return;

        const range = spec.max - spec.min;
        const randomVal = (spec.min + Math.random() * range).toFixed(spec.decimalPlaces);
        
        labSession = {
            targetVal: randomVal,
            spec: spec
        };
        
        readingInput.value = "";
        if (step1) step1.value = "";
        if (step2) step2.value = "";
        if (step3) step3.value = "";
        output.classList.add("hidden");
        container.classList.remove("hidden");
        if (visualizer) {
            visualizer.innerHTML = generateSVG(spec, parseFloat(randomVal));
        }
    });

    btnCheck.addEventListener("click", () => {
        if (!labSession) {
            setStatus(output, "Generate a scenario first.", "warn");
            output.classList.remove("hidden");
            return;
        }

        const readingRaw = readingInput.value.trim();
        if (!/^[-+]?\d+(\.\d+)?$/.test(readingRaw)) {
            setStatus(output, "Enter a valid numeric reading.", "error");
            output.classList.remove("hidden");
            return;
        }

        const decimalCount = (readingRaw.indexOf(".") !== -1) ? readingRaw.split(".")[1].length : 0;
        const enteredVal = parseFloat(readingRaw);
        const expectedVal = parseFloat(labSession.targetVal);

        output.classList.remove("hidden");

        if (Math.abs(enteredVal - expectedVal) > (labSession.spec.tolerance ?? 0.0001)) {
            let scaffoldFeedback = "";
            const step1Val = step1 ? step1.value.trim() : "";
            const step2Val = step2 ? step2.value.trim() : "";
            const step3Val = step3 ? step3.value.trim() : "";

            if (step1Val || step2Val || step3Val) {
                const minorVal = labSession.spec.minorIncrement;
                // Calculate certain digits limit (the nearest division mark the liquid is past)
                const certainVal = parseFloat((Math.floor((expectedVal + 1e-9) / minorVal) * minorVal).toFixed(labSession.spec.decimalPlaces - 1 > 0 ? labSession.spec.decimalPlaces - 1 : 0));
                const expectedEstDigit = labSession.targetVal.charAt(labSession.targetVal.length - 1);
                const estValueAlternative = parseFloat(expectedEstDigit) * Math.pow(10, -labSession.spec.decimalPlaces);

                let errors = [];
                if (step1Val && Math.abs(parseFloat(step1Val) - minorVal) > 1e-6) {
                    errors.push(`Step 1 (Value of 1 marking) is incorrect. The divisions are every ${minorVal} ${labSession.spec.unit}.`);
                }
                if (step2Val && Math.abs(parseFloat(step2Val) - certainVal) > 1e-6) {
                    errors.push(`Step 2 (Certain digits) is incorrect. Based on the meniscus level, you should be certain up to ${certainVal} ${labSession.spec.unit}.`);
                }
                if (step3Val && parseFloat(step3Val) !== parseFloat(expectedEstDigit) && Math.abs(parseFloat(step3Val) - estValueAlternative) > 1e-6) {
                    errors.push(`Step 3 (Estimated digit) is incorrect. You should estimate the digit between the markings (expected: ${expectedEstDigit}).`);
                }

                if (errors.length > 0) {
                    scaffoldFeedback = "<br/><strong class='text-red-700'>Scaffold Help:</strong><ul class='list-disc pl-5 mt-1 text-red-600'>" + errors.map(e => `<li>${e}</li>`).join("") + "</ul>";
                } else {
                    scaffoldFeedback = "<br/><span class='text-green-700 font-semibold'>Your scaffolded analysis steps are correct!</span> Re-evaluate how you combined them: reading = (certain digits) + (estimated digit).";
                }
            } else {
                scaffoldFeedback = "<br/><span class='text-gray-500 italic'>Tip: Use the \"Scaffolded Analysis\" fields above to break down your reading step-by-step!</span>";
            }

            setStatus(output, `Incorrect reading value. Re-check the meniscus and graduations. ${scaffoldFeedback}`, "error");
            recordCompetencyAttempt("measurement-precision", false);
            if (window.ChemTutor) {
                window.ChemTutor.invoke(`I am interpreting a lab instrument reading for a ${equipmentSelect.options[equipmentSelect.selectedIndex].text}. I entered ${readingRaw} but the value is off. Walk me through reading this instrument visually and estimating the uncertain digit.`, btnCheck.parentElement, `The user is practicing analog lab readings. Instrument: ${equipmentSelect.options[equipmentSelect.selectedIndex].text}. Expected decimal places: ${labSession.spec.decimalPlaces}. Correct value: ${labSession.targetVal}.`);
            }
            return;
        }

        if (decimalCount !== labSession.spec.decimalPlaces) {
            setStatus(output, `Precision mismatch. You recorded ${decimalCount} decimal place(s), but based on the graduations, you must record certain digits plus ONE estimated digit (total ${labSession.spec.decimalPlaces} decimal places).`, "error");
            // Only here we record a precision measurement failure
            recordCompetencyAttempt("measurement-precision", false);
            window.ChemTutor.invoke(`I am interpreting a lab instrument reading for a ${equipmentSelect.options[equipmentSelect.selectedIndex].text}. I recorded ${decimalCount} decimal places, but I need ${labSession.spec.decimalPlaces} decimal places. Explain the rules of precision and estimated digits for analog lab instruments.`, btnCheck.parentElement, `The user is practicing interpreting analog lab equipment. The instrument is a ${equipmentSelect.options[equipmentSelect.selectedIndex].text}. Measurements require ${labSession.spec.decimalPlaces} decimal places of precision. The correct value is ${labSession.targetVal}.`);
            return;
        }

        setStatus(output, `Excellent! Reading ${readingRaw} is accurate and correctly matches the ${labSession.spec.decimalPlaces} decimal place(s) required by the instrument's uncertainty.`, "ok");
        recordCompetencyAttempt("measurement-precision", true);
        if (window.activeSandboxHandshake && getTabForTarget(window.activeSandboxHandshake.target) === 'lab') {
            completeActiveSandboxHandshake();
        }
        labSession = null;
    });
}

function calculateMolarMass(formula) {
    const atomicWeights = window.ChemData?.elements || {};
    const clean = formula.replace(/\s+/g, "");
    const tokenRegex = /([A-Z][a-z]?)(\d*)/g;

    let totalMass = 0;
    let matchedText = "";
    let match;

    while ((match = tokenRegex.exec(clean)) !== null) {
        const symbol = match[1];
        const count = match[2] ? Number(match[2]) : 1;
        const entry = atomicWeights[symbol];

        matchedText += match[0];
        if (!entry) {
            return { ok: false, message: `Unknown element symbol: ${symbol}` };
        }
        totalMass += entry.mass * count;
    }

    if (!matchedText || matchedText !== clean) {
        return { ok: false, message: "Invalid formula format. Use symbols like H2O, NaCl, CaCO3." };
    }

    return { ok: true, mass: totalMass };
}

function getAllUnits(conversions) {
    const set = new Set();
    Object.values(conversions).forEach((group) => {
        group.forEach((edge) => {
            set.add(edge.from);
            set.add(edge.to);
        });
    });
    return Array.from(set);
}

function convertValue(value, from, to, conversions) {
    const graph = buildConversionGraph(conversions);
    const pathResult = bfsPath(graph, from, to);

    if (!pathResult.ok) {
        return { ok: false, message: `No conversion route from ${from} to ${to}.` };
    }

    let result = value;
    pathResult.edges.forEach((edge) => {
        result *= edge.multiplier;
    });

    return {
        ok: true,
        value: Number(result.toPrecision(10)),
        path: pathResult.path
    };
}

function buildConversionGraph(conversions) {
    const graph = {};
    Object.values(conversions).forEach((group) => {
        group.forEach((item) => {
            if (item.type === "formula") return;
            const factor = Number(item.factor);
            if (!Number.isFinite(factor) || factor === 0) return;
            if (!graph[item.from]) graph[item.from] = [];
            if (!graph[item.to]) graph[item.to] = [];

            graph[item.from].push({ to: item.to, multiplier: factor });
            graph[item.to].push({ to: item.from, multiplier: 1 / factor });
        });
    });
    return graph;
}

function bfsPath(graph, from, to) {
    if (!graph[from] || !graph[to]) return { ok: false };

    const queue = [{ unit: from, path: [from], edges: [] }];
    const visited = new Set([from]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.unit === to) {
            return { ok: true, path: current.path, edges: current.edges };
        }

        (graph[current.unit] || []).forEach((next) => {
            if (!visited.has(next.to)) {
                visited.add(next.to);
                queue.push({
                    unit: next.to,
                    path: current.path.concat(next.to),
                    edges: current.edges.concat(next)
                });
            }
        });
    }

    return { ok: false };
}

function setStatus(element, text, kind) {
    element.textContent = text;
    element.classList.remove("text-gray-700", "text-rose-700", "text-amber-700", "text-green-700");

    if (kind === "error") {
        element.classList.add("text-rose-700");
        return;
    }
    if (kind === "warn") {
        element.classList.add("text-amber-700");
        return;
    }
    if (kind === "ok") {
        element.classList.add("text-green-700");
        return;
    }

    element.classList.add("text-gray-700");
}



// --- GLOBAL INLINE AI TUTOR ---
window.ChemTutor = (() => {
    let popupHistory = [];
    let currentPopupSystemContext = "";

    const parseMD = (text) => {
        if (typeof text !== 'string') return '';

        // Escape HTML tags to prevent XSS
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Extract code blocks and inline code to protect them
        const codeBlocks = [];
        
        // Match code blocks: ``` ... ```
        html = html.replace(/```(?:javascript|js|chemistry|html|css)?\n([\s\S]*?)\n```/g, (match, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<pre class="bg-gray-800 text-gray-100 p-3 rounded-lg my-2 overflow-x-auto font-mono text-xs">${code}</pre>`);
            return id;
        });

        // Match inline backticks: `...`
        html = html.replace(/`([^`\n]+?)`/g, (match, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<code class="bg-gray-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded font-mono text-xs">${code}</code>`);
            return id;
        });

        // Run consolidated math and LaTeX cleanup on the remaining text
        if (window.CLINICAL_TUTOR && typeof window.CLINICAL_TUTOR.cleanMathAndLaTeX === 'function') {
            html = window.CLINICAL_TUTOR.cleanMathAndLaTeX(html);
        } else {
            // Fallback simple clean
            html = html.replace(/\\mathrm\{([^{}]+)\}/g, '$1')
                       .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
                       .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
                       .replace(/([A-Za-z0-9)])_([0-9]+)/g, '$1<sub>$2</sub>')
                       .replace(/([A-Za-z0-9)])\^([0-9+\-]+)/g, '$1<sup>$2</sup>')
                       .replace(/\$\$/g, '')
                       .replace(/\$/g, '');
        }

        // Headers
        html = html.replace(/^####\s+(.*)$/gm, '<h4 class="font-bold text-gray-800 dark:text-gray-200 mt-2 mb-1">$1</h4>');
        html = html.replace(/^###\s+(.*)$/gm, '<h3 class="font-bold text-gray-900 dark:text-white mt-3 mb-2">$1</h3>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italics
        html = html.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');
        
        // Lists
        html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li class="ml-5 list-disc marker:text-indigo-500">$1</li>');
        
        // Newlines
        html = html.replace(/\n/g, '<br>');
        
        // Cleanup excessive breaks around block elements
        html = html.replace(/<\/(h3|h4|div|li)><br>/g, '</$1>');
        html = html.replace(/<br><li/g, '<li');
        html = html.replace(/(<br>\s*){2,}/g, '<br><br>');

        // Restore protected code blocks
        codeBlocks.forEach((codeHtml, index) => {
            html = html.replace(`__CODE_BLOCK_${index}__`, codeHtml);
        });

        return html;
    };

    function appendInlineBubble(msgsEl, role, text) {
        const wrap = document.createElement("div");
        const bubble = document.createElement("div");
        if (role === "user") {
            wrap.className = "flex justify-end";
            bubble.className = "max-w-[80%] bg-violet-600 dark:bg-violet-700 text-white px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs font-semibold shadow-sm";
            bubble.innerHTML = parseMD(text);
        } else {
            wrap.className = "flex justify-start";
            bubble.className = "max-w-[85%] bg-gray-100 dark:bg-slate-900 border border-transparent dark:border-slate-800/80 px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-xs font-medium text-gray-800 dark:text-slate-100 shadow-sm leading-relaxed";
            if(text) bubble.innerHTML = parseMD(text);
        }
        wrap.appendChild(bubble);
        msgsEl.appendChild(wrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return bubble;
    }

    async function streamOllama(msgsEl, chatHistory, systemContext = "") {
        if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
            removeContainerTypingIndicator(msgsEl);
            appendInlineBubble(msgsEl, "assistant", "Shared local AI router is unavailable.");
            return;
        }
        removeContainerTypingIndicator(msgsEl);
        const typingWrap = createTypingIndicatorElement("ChemTutor", true);
        msgsEl.appendChild(typingWrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;

        let payload = [
            { role: "system", content: "You are Prof. Beaker. Be encouraging, precise, and concise. Explain step by step where the student went wrong. If there are calculations, outline the steps." + (systemContext ? "\n\n[Current App Context:\n" + systemContext + "]" : "") }, 
            ...chatHistory
        ];
        
        const currentModel = getChemistryModel();
        try {
            const systemMessage = payload.find((msg) => msg.role === 'system');
            const nonSystem = payload.filter((msg) => msg.role !== 'system');
            const userEntry = nonSystem[nonSystem.length - 1] || { role: 'user', content: '' };
            const priorHistory = nonSystem.slice(0, -1);
            let assistantText = "";
            let firstToken = true;
            let bubble = null;

            await window.GnosysLLM.generateResponse(systemMessage?.content || '', userEntry.content || '', {
                moduleKey: 'chemistry_llm',
                model: currentModel,
                stream: true,
                history: priorHistory,
                onToken: (token) => {
                    if (firstToken) {
                        typingWrap.remove();
                        bubble = appendInlineBubble(msgsEl, "assistant", "");
                        firstToken = false;
                    }
                    assistantText += token;
                    bubble.innerHTML = parseMD(assistantText);
                    msgsEl.scrollTop = msgsEl.scrollHeight;
                }
            });
            if (firstToken) {
                typingWrap.remove();
            }
            chatHistory.push({ role: "assistant", content: assistantText });
        } catch (e) {
            if (window.gnosysActiveModelsCache) {
                delete window.gnosysActiveModelsCache[currentModel];
            }
            typingWrap.remove();
            appendInlineBubble(msgsEl, "assistant", `Could not connect to the local AI provider: ${e && e.message ? e.message : e}`);
        }
    }

    function positionPopupCard(popupEl) {
        const card = popupEl.querySelector('.tutor-popup-card');
        const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
        const width = window.innerWidth;

        // Reset inline styles
        card.style.width = "";
        card.style.maxWidth = "";
        card.style.height = "";
        card.style.maxHeight = "";
        card.style.left = "";
        card.style.top = "";
        card.style.transform = "";
        card.style.opacity = "";
        popupEl.style.bottom = "";

        // Standard setup: Centered overlay across all sizes
        popupEl.className = 'fixed inset-0 z-[200] hidden flex items-center justify-center font-sans p-4';
        backdrop.className = "tutor-popup-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 opacity-0";

        if (width < 640) {
            // Mobile Centered Layout
            card.className = "tutor-popup-card bg-white dark:bg-slate-950 border border-violet-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 rounded-3xl w-[92%] h-[75vh] max-h-[540px] max-w-[400px]";
        } else {
            // Desktop Centered Layout (Static size)
            card.className = "tutor-popup-card bg-white dark:bg-slate-950 border border-violet-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 rounded-3xl w-[440px] h-[600px]";
        }

        // Set initial transition state
        card.style.transform = "translate(-50%, -50%) scale(0.95)";
        card.style.opacity = "0";
        card.style.left = "50%";
        card.style.top = "50%";
        card.classList.add('fixed');
        
        adjustVisualViewport(popupEl);
    }

    function adjustVisualViewport(popupEl) {
        if (!popupEl || popupEl.classList.contains('hidden')) return;
        const card = popupEl.querySelector('.tutor-popup-card');
        if (!card) return;

        if (window.innerWidth < 640 && window.visualViewport) {
            const vv = window.visualViewport;
            // Center the card in the shrunken visual viewport
            card.style.left = `${vv.offsetLeft + vv.width / 2}px`;
            card.style.top = `${vv.offsetTop + vv.height / 2}px`;
            
            // Constrain mobile height if keyboard shrinks viewport
            if (vv.height < window.innerHeight) {
                card.style.height = `${vv.height * 0.85}px`;
                card.style.maxHeight = `${vv.height * 0.85}px`;
            } else {
                card.style.height = "75vh";
                card.style.maxHeight = "540px";
            }
        } else {
            card.style.left = "50%";
            card.style.top = "50%";
            card.style.height = "";
            card.style.maxHeight = "";
        }
    }

    function openTutorPopup(initialPrompt, systemContext = "") {
        let popupEl = document.getElementById('tutor-popup-modal');
        if (!popupEl) {
            popupEl = document.createElement('div');
            popupEl.id = 'tutor-popup-modal';
            popupEl.className = 'fixed inset-0 z-[200] hidden flex items-center justify-center font-sans p-4';
            popupEl.innerHTML = `
                <!-- Backdrop -->
                <div class="tutor-popup-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 opacity-0"></div>
                
                <!-- Card Container -->
                <div class="tutor-popup-card bg-white dark:bg-slate-950 border border-violet-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 rounded-3xl">
                    <!-- Pull bar for mobile -->
                    <div class="tutor-popup-drag-bar w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0 sm:hidden"></div>
                    
                    <!-- Header -->
                    <div class="flex items-center justify-between px-4 py-3 bg-violet-50 dark:bg-slate-900 border-b border-violet-100 dark:border-slate-800 shrink-0">
                        <div class="flex items-center gap-2 min-w-0">
                            <div class="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 shadow-sm animate-pulse-slow">
                                <i class="fa-solid fa-robot text-xs text-white"></i>
                            </div>
                            <div class="min-w-0">
                                <span class="text-sm font-extrabold text-violet-900 dark:text-violet-200 block truncate">ChemTutor AI</span>
                                <span class="tutor-popup-status text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    Online
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button class="tutor-popup-clear w-8 h-8 rounded-full flex items-center justify-center text-violet-400 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors" title="Clear Conversation">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                            <button class="tutor-popup-minimize w-8 h-8 rounded-full flex items-center justify-center text-violet-400 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-100 dark:hover:bg-slate-800 transition-colors" title="Minimize">
                                <i class="fa-solid fa-minus text-xs"></i>
                            </button>
                            <button class="tutor-popup-close w-8 h-8 rounded-full flex items-center justify-center text-violet-400 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-100 dark:hover:bg-slate-800 transition-colors" title="Close">
                                <i class="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Messages List -->
                    <div class="tutor-popup-messages flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950">
                        <!-- Messages will appear here -->
                    </div>
                    
                    <!-- Input Form -->
                    <div class="tutor-popup-input-area border-t border-gray-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-950 shrink-0">
                        <div class="flex gap-2 items-end">
                            <textarea rows="1" placeholder="Ask ChemTutor a question..." class="tutor-popup-input flex-1 text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-slate-100 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition-all resize-none max-h-24 leading-relaxed"></textarea>
                            <button class="tutor-popup-send w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition-all shadow-sm shrink-0 hover:shadow-md active:scale-95 disabled:opacity-50">
                                <i class="fa-solid fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(popupEl);

            // Bind events for the newly created popup
            const closeBtn = popupEl.querySelector('.tutor-popup-close');
            const minimizeBtn = popupEl.querySelector('.tutor-popup-minimize');
            const clearBtn = popupEl.querySelector('.tutor-popup-clear');
            const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
            const input = popupEl.querySelector('.tutor-popup-input');
            const sendBtn = popupEl.querySelector('.tutor-popup-send');
            
            closeBtn.addEventListener('click', closeTutorPopup);
            if (minimizeBtn) minimizeBtn.addEventListener('click', closeTutorPopup);
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    popupHistory = [];
                    const msgsEl = popupEl.querySelector('.tutor-popup-messages');
                    if (msgsEl) {
                        msgsEl.innerHTML = "";
                        appendInlineBubble(msgsEl, "assistant", "Hello! I am ChemTutor. How can I help you with your chemistry workspace today?");
                    }
                });
            }
            backdrop.addEventListener('click', closeTutorPopup);
            
            const handleSend = () => {
                const text = input.value.trim();
                if (!text) return;
                const msgsEl = popupEl.querySelector('.tutor-popup-messages');
                appendInlineBubble(msgsEl, "user", text);
                popupHistory.push({ role: "user", content: text });
                input.value = "";
                input.style.height = "auto"; // Reset height on send
                streamOllama(msgsEl, popupHistory, currentPopupSystemContext);
            };
            
            sendBtn.addEventListener('click', handleSend);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            });
            input.addEventListener('input', () => {
                input.style.height = "auto";
                input.style.height = `${input.scrollHeight}px`;
            });
        }

        // Show the popup modal
        const card = popupEl.querySelector('.tutor-popup-card');
        const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
        const msgsEl = popupEl.querySelector('.tutor-popup-messages');
        const input = popupEl.querySelector('.tutor-popup-input');

        // History management (persistence)
        currentPopupSystemContext = systemContext;

        if (popupHistory.length === 0) {
            msgsEl.innerHTML = "";
            if (initialPrompt) {
                appendInlineBubble(msgsEl, "user", initialPrompt);
                popupHistory.push({ role: "user", content: initialPrompt });
                streamOllama(msgsEl, popupHistory, currentPopupSystemContext);
            } else {
                appendInlineBubble(msgsEl, "assistant", "Hello! I am ChemTutor. How can I help you with your chemistry workspace today?");
            }
        } else {
            // Re-render existing history
            msgsEl.innerHTML = "";
            popupHistory.forEach(msg => {
                appendInlineBubble(msgsEl, msg.role, msg.content);
            });
            
            // If they clicked a new prompt while it was closed, append it
            if (initialPrompt) {
                appendInlineBubble(msgsEl, "user", initialPrompt);
                popupHistory.push({ role: "user", content: initialPrompt });
                streamOllama(msgsEl, popupHistory, currentPopupSystemContext);
            }
        }

        // Re-calculate responsive position and styles
        positionPopupCard(popupEl);
        
        popupEl.classList.remove('hidden');
        
        // Trigger enter transitions
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            backdrop.classList.add('opacity-100');
            
            card.style.transform = "translate(-50%, -50%) scale(1)";
            card.style.opacity = "1";
        }, 50);

        // Autofocus input
        setTimeout(() => {
            if (input) input.focus();
        }, 350);
    }

    function closeTutorPopup() {
        const popupEl = document.getElementById('tutor-popup-modal');
        if (!popupEl || popupEl.classList.contains('hidden')) return;
        
        const card = popupEl.querySelector('.tutor-popup-card');
        const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
        
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('opacity-0');
        
        card.style.transform = "translate(-50%, -50%) scale(0.95)";
        card.style.opacity = "0";
        
        setTimeout(() => {
            popupEl.classList.add('hidden');
        }, 300);
    }

    // Window resize event handler to reposition popup dynamically
    window.addEventListener('resize', () => {
        const popupEl = document.getElementById('tutor-popup-modal');
        if (popupEl && !popupEl.classList.contains('hidden')) {
            positionPopupCard(popupEl);
            const card = popupEl.querySelector('.tutor-popup-card');
            const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
            
            backdrop.classList.remove('opacity-0');
            backdrop.classList.add('opacity-100');
            
            card.style.transform = "translate(-50%, -50%) scale(1)";
            card.style.opacity = "1";
        }
    });

    // Listen to visual viewport changes (especially for mobile soft keyboards)
    if (window.visualViewport) {
        const handleVisualViewportChange = () => {
            const popupEl = document.getElementById('tutor-popup-modal');
            if (popupEl && !popupEl.classList.contains('hidden')) {
                adjustVisualViewport(popupEl);
                const card = popupEl.querySelector('.tutor-popup-card');
                card.style.transform = "translate(-50%, -50%) scale(1)";
                card.style.opacity = "1";
                
                // Keep input in view
                const input = popupEl.querySelector('.tutor-popup-input');
                if (input === document.activeElement) {
                    setTimeout(() => {
                        input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                }
            }
        };
        window.visualViewport.addEventListener('resize', handleVisualViewportChange);
        window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }

    return {
        hasHistory: () => popupHistory.length > 0,
        // Asks a question, spawning the tutor either after or inside `containerEl`.
        invoke: (initialPrompt, containerEl, systemContext = "", options = {}) => {
            if (options && options.popup) {
                openTutorPopup(initialPrompt, systemContext);
                return;
            }

            if (!containerEl) return;
            const mountMode = options?.mountMode === 'append' ? 'append' : 'after';
            const widgetClassName = typeof options?.widgetClassName === 'string' ? options.widgetClassName.trim() : '';
            const showInnerClose = options?.showInnerClose !== false;

            const existingWidget = mountMode === 'append'
                ? containerEl.querySelector(':scope > .inline-tutor-widget')
                : (containerEl.nextElementSibling && containerEl.nextElementSibling.classList?.contains('inline-tutor-widget')
                    ? containerEl.nextElementSibling
                    : null);

            // Check if widget already exists here, don't spawn multiple
            if (existingWidget) {
                const existingInput = existingWidget.querySelector('.tutor-input');
                const existingSendBtn = existingWidget.querySelector('.tutor-send');
                existingWidget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                if (existingInput) {
                    existingInput.focus();
                    if (typeof initialPrompt === 'string' && initialPrompt.trim()) {
                        existingInput.value = initialPrompt.trim();
                        if (existingSendBtn) existingSendBtn.click();
                    }
                }
                return;
            }

            const template = document.getElementById("inline-tutor-template");
            if (!template) return;

            const clone = template.content.cloneNode(true);
            const widget = clone.querySelector('.inline-tutor-widget');
            if (widgetClassName) {
                widget.classList.add(...widgetClassName.split(/\s+/).filter(Boolean));
            }
            const msgsEl = clone.querySelector('.tutor-messages');
            const input = clone.querySelector('.tutor-input');
            const sendBtn = clone.querySelector('.tutor-send');
            const closeBtn = clone.querySelector('.tutor-close');
            
            let history = [];

            // Bind UI
            if (showInnerClose) {
                closeBtn.addEventListener('click', () => widget.remove());
            } else {
                closeBtn.classList.add('hidden');
            }
            
            const handleSend = () => {
                const text = input.value.trim();
                if (!text) return;
                appendInlineBubble(msgsEl, "user", text);
                history.push({ role: "user", content: text });
                input.value = "";
                streamOllama(msgsEl, history, systemContext);
            };

            sendBtn.addEventListener('click', handleSend);
            input.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });

            // Inject into DOM
            if (mountMode === 'append') {
                containerEl.appendChild(widget);
            } else {
                containerEl.after(widget);
            }

            // Auto-fire the initial prompt
            appendInlineBubble(msgsEl, "user", initialPrompt);
            history.push({ role: "user", content: initialPrompt });
            streamOllama(msgsEl, history, systemContext);
        }
    };
})();

function updateIndexMasteryProgress() {
    const matrixRaw = localStorage.getItem('masteryMatrix');
    if (!matrixRaw) return;

    try {
        const matrix = JSON.parse(matrixRaw);
        
        let totalLessons = 30; // fallback default
        let masteredCount = 0;
        let activeCount = 0;
        
        if (window.syllabusData) {
            totalLessons = 0;
            window.syllabusData.modules.forEach(mod => {
                window.syllabusData.lessonsByModule[mod.id].forEach(l => {
                    totalLessons++;
                    const status = matrix[l.id];
                    if (status) {
                        if (status.state === 3 || status.state === 4) { // STATE_MASTERED = 3, STATE_RUSTED = 4
                            masteredCount++;
                        }
                        if (status.state >= 1) { // STATE_ACTIVE, STATE_HW_PENDING, STATE_MASTERED, STATE_RUSTED
                            activeCount++;
                        }
                    }
                });
            });
        } else {
            Object.values(matrix).forEach(item => {
                if (item) {
                    if (item.state === 3 || item.state === 4) {
                        masteredCount++;
                    }
                    if (item.state >= 1) {
                        activeCount++;
                    }
                }
            });
        }
        
        const cwPercentage = totalLessons > 0 ? Math.round((activeCount / totalLessons) * 100) : 0;
        const hwPercentage = totalLessons > 0 ? Math.round((masteredCount / totalLessons) * 100) : 0;
        
        const cwBar = document.getElementById('index-cw-progress-bar');
        const cwVal = document.getElementById('index-cw-progress-val');
        const hwBar = document.getElementById('index-hw-progress-bar');
        const hwVal = document.getElementById('index-hw-progress-val');
        
        if (cwBar) cwBar.style.width = `${cwPercentage}%`;
        if (cwVal) cwVal.textContent = `${cwPercentage}% Unlocked`;
        if (hwBar) hwBar.style.width = `${hwPercentage}%`;
        if (hwVal) hwVal.textContent = `${hwPercentage}% Accredited`;
    } catch (e) {
        console.error("Error updating index mastery progress:", e);
    }
}

// ==========================================
// COURSEWORK SANDBOX HANDSHAKE SYSTEM
// ==========================================

function handleCourseworkSandboxHandshake() {
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('lessonId');
    const target = params.get('target');
    
    if (!lessonId || !target) return;
    
    // Store globally so the tools can check and report completion
    window.activeSandboxHandshake = { lessonId, target };
    
    // Map target to tab
    const tabId = getTabForTarget(target);
    if (tabId && typeof window.activateChemTab === 'function') {
        window.activateChemTab(tabId);
    }
    
    // Pre-populate temperature converter inputs if matching target
    if (tabId === 'dimensions' && target.toLowerCase().includes('temperature')) {
        const fromSelect = document.getElementById('da-from');
        const toSelect = document.getElementById('da-to');
        const valueInput = document.getElementById('da-value');
        if (fromSelect && toSelect && valueInput) {
            fromSelect.value = '°C';
            toSelect.value = 'K';
            valueInput.value = '25';
        }
    }
    
    // Show a beautiful, premium instruction banner
    showSandboxHandshakeBanner(lessonId, target, tabId);
}

function showSandboxHandshakeBanner(lessonId, target, tabId) {
    const existing = document.getElementById('sandbox-handshake-banner');
    if (existing) existing.remove();
    
    // Inject custom animation styles if they do not exist
    const styleId = 'sandbox-handshake-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateY(-100%); }
                to { transform: translateY(0); }
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeOutDown {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(20px); }
            }
            .animate-slide-down {
                animation: slideDown 0.3s ease-out forwards;
            }
            .animate-fade-in-up {
                animation: fadeInUp 0.4s ease-out forwards;
            }
            .animate-fade-out-down {
                animation: fadeOutDown 0.4s ease-in forwards;
            }
        `;
        document.head.appendChild(style);
    }
    
    const banner = document.createElement('div');
    banner.id = 'sandbox-handshake-banner';
    banner.className = 'fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-4 shadow-xl z-50 flex items-center justify-between border-b border-blue-400 font-sans animate-slide-down';
    
    const friendlyTabs = {
        'nomenclature': 'Nomenclature Flashcards',
        'molar': 'Molar Mass Calculator',
        'dimensions': 'Dimensional Analysis Builder',
        'stoich': 'Reaction & Stoichiometry',
        'sigfigs': 'Significant Figures Math Trainer',
        'lab': 'Lab Precision Trainer'
    };
    
    const targetDescriptions = {
        'temperature-converter': 'perform a unit conversion in the Dimensional Analysis tab to test temperature conversions.',
        'meniscus-reader-simulator': 'select an instrument like a Graduated Cylinder in the Lab Precision tab and submit a correct meniscus reading.',
        'notation-slider': 'perform a metric unit conversion factor in the Dimensional Analysis tab to test scaling powers.',
        'sig-fig-calculator': 'generate a math problem in the Significant Figures tab and input the correct rounded answer.',
        'dimensional-analysis-sandbox': 'set up a multi-step unit conversion chain (e.g. kg to g to mg) in the Dimensional Analysis Builder and verify it.',
        'density-visualizer': 'calculate a conversion involving metric density units (g/mL) in the Dimensional Analysis tab.',
        'specific-heat-grapher': 'select a glassware instrument and practice scale precision reading in the Lab Precision tab.',
        'atom-builder': 'select the Analytical Balance in the Lab Precision tab and successfully submit a reading.',
        'electron-jump-animator': 'select the Burette in the Lab Precision tab and read the scale level carefully.',
        'periodic-table-explorer': 'study naming rules and flip a card in the Nomenclature Flashcards tab.',
        'ion-charge-calculator': 'review polyatomic ion charges in the Nomenclature Flashcards tab.',
        'half-life-grapher': 'practice reading lab instrument scales in the Lab Precision tab.',
        'shielding-simulator': 'practice reading instrument scales at different levels in the Lab Precision tab.',
        'electronegativity-scale': 'practice covalent compound naming card groups in the Nomenclature tab.',
        'criss-cross-sandbox': 'balance a chemical equation successfully in the Reaction & Stoichiometry tab.',
        'polarity-visualizer': 'practice covalent compound flashcards in the Nomenclature tab.',
        'vsepr-3d-viewer': 'study molecular names and geometry naming rules in the Nomenclature tab.',
        'dna-imf-zipper': 'review polyatomic naming rules in the Nomenclature tab.',
        'nomenclature-builder': 'study chemical names and rate a nomenclature flashcard as Good or Easy.',
        'mole-visualizer': 'calculate the molar mass of a molecule (e.g., CO2 or H2O) in the Molar Mass tab.',
        'gram-to-mole-grader': 'complete a step-by-step molar mass calculation in the Molar Mass tab.',
        'equation-seesaw': 'load a reaction and balance it correctly in the Reaction & Stoichiometry tab.',
        'solubility-precipitate-sandbox': 'load a precipitation reaction and balance its coefficients in the Reaction & Stoichiometry tab.',
        'recipe-ratio-tool': 'solve a stoichiometry math problem yield in the Reaction & Stoichiometry tab.',
        'stoichiometry-grader': 'calculate the correct theoretical yield for a balanced equation in the Reaction & Stoichiometry tab.',
        'limiting-reactant-sandbox': 'balance an equation and solve its limiting reactant yield problem in the Reaction & Stoichiometry tab.',
        'boyles-law-syringe': 'select the 10 mL Graduated Cylinder and read its meniscus level in the Lab Precision tab.',
        'osmosis-cell-simulator': 'practice reading analytical balance measurements in the Lab Precision tab.',
        'dilution-calculator': 'read the meniscus level of a 50 mL Graduated Cylinder in the Lab Precision tab.',
        'activation-energy-graph': 'load a reaction and check the balanced counts in the Reaction & Stoichiometry tab.',
        'le-chatelier-seesaw': 'balance a reversible reaction seesaw in the Reaction & Stoichiometry tab.',
        'ph-buffer-visualizer': 'select the Lab Thermometer and read its temperature scale in the Lab Precision tab.',
        'carbon-chain-builder': 'select the Organic Category and practice naming cards in the Nomenclature tab.',
        'macromolecule-sorter': 'review organic compound chains in the Nomenclature Flashcards.',
        'free-radical-visualizer': 'practice balancing a decomposition reaction in the Reaction & Stoichiometry tab.',
        'radiation-dna-damage-sim': 'balance any reaction and solve its stoichiometry yield in the Reaction & Stoichiometry tab.'
    };
    
    const tabName = friendlyTabs[tabId] || 'Skills Lab';
    const action = targetDescriptions[target] || 'interact with the calculations and submit a correct solution.';
    
    banner.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="bg-white/20 p-1.5 rounded-full text-white">
                <i class="fa-solid fa-gamepad animate-bounce"></i>
            </div>
            <div class="text-sm col-span-1">
                <span class="font-bold">Active Coursework Handshake (Lesson ${escapeHtml(lessonId)}):</span> 
                In the <span class="underline font-semibold">${escapeHtml(tabName)}</span> tool, please <span class="font-semibold text-yellow-300">${action}</span>
            </div>
        </div>
        <button id="btn-close-handshake-banner" class="text-white/80 hover:text-white transition ml-4 text-xs font-semibold px-2 py-1 bg-white/10 rounded hover:bg-white/20">
            Cancel
        </button>
    `;
    
    document.body.appendChild(banner);
    document.body.style.paddingTop = '52px';
    
    document.getElementById('btn-close-handshake-banner').addEventListener('click', () => {
        banner.remove();
        document.body.style.paddingTop = '';
        window.activeSandboxHandshake = null;
    });
}

function completeActiveSandboxHandshake() {
    if (!window.activeSandboxHandshake) return;
    
    const { lessonId } = window.activeSandboxHandshake;
    
    // Set in localStorage to trigger storage listener on coursework tab
    localStorage.setItem(`sandbox_complete_${lessonId}`, 'true');
    
    // Show premium success toast
    showSandboxSuccessToast(lessonId);
    
    // Clean up
    window.activeSandboxHandshake = null;
    const banner = document.getElementById('sandbox-handshake-banner');
    if (banner) banner.remove();
    document.body.style.paddingTop = '';
}

function showSandboxSuccessToast(lessonId) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center space-x-3 border border-emerald-400 font-sans animate-fade-in-up max-w-sm';
    toast.innerHTML = `
        <div class="bg-white/20 p-2 rounded-full text-white text-lg">
            <i class="fa-solid fa-circle-check"></i>
        </div>
        <div>
            <h5 class="font-bold text-sm">Sandbox Stage Unlocked!</h5>
            <p class="text-xs text-emerald-100">You completed the handshake for Lesson ${escapeHtml(lessonId)}. Return to the coursework tab to proceed.</p>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('animate-fade-out-down');
        setTimeout(() => toast.remove(), 500);
    }, 6000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

function getTabForTarget(target) {
    if (!target) return 'dashboard';
    const t = target.toLowerCase();
    if (t.includes('nomenclature') || t.includes('naming')) return 'nomenclature';
    if (t.includes('mole-visualizer') || t.includes('gram-to-mole') || t.includes('molar-mass') || t.includes('mole-concept')) return 'molar';
    if (t.includes('dimensional-analysis') || t.includes('dimensions') || t.includes('density') || t.includes('specific-heat') || t.includes('notation-slider') || t.includes('temperature-converter')) return 'dimensions';
    if (t.includes('stoichiometry') || t.includes('stoich') || t.includes('reactant') || t.includes('equation') || t.includes('ratio') || t.includes('solubility') || t.includes('le-chatelier') || t.includes('equilibrium')) return 'stoich';
    if (t.includes('sig-fig') || t.includes('sigfig')) return 'sigfigs';
    if (t.includes('meniscus') || t.includes('precision') || t.includes('shielding') || t.includes('half-life') || t.includes('diffusion') || t.includes('osmosis') || t.includes('dilution') || t.includes('activation-energy') || t.includes('buffer') || t.includes('ph-')) return 'lab';
    if (t.includes('atom-builder') || t.includes('electron-jump') || t.includes('periodic-table') || t.includes('ion-charge') || t.includes('electronegativity') || t.includes('polarity') || t.includes('vsepr') || t.includes('dna-') || t.includes('carbon-chain') || t.includes('macromolecule') || t.includes('free-radical') || t.includes('radiation-dna')) return 'lab';
    return 'dashboard';
}

function initGlobalTooltip() {
    const tooltip = document.getElementById("chem-tooltip");
    if (!tooltip) return;
    const nameEl = document.getElementById("chem-tooltip-name");
    const massEl = document.getElementById("chem-tooltip-mass");
    const arrowEl = document.getElementById("chem-tooltip-arrow");
    if (!nameEl || !massEl || !arrowEl) return;
    
    let activeTrigger = null;
    let fadeTimeout = null;
    
    const showTooltip = (target) => {
        if (fadeTimeout) {
            clearTimeout(fadeTimeout);
            fadeTimeout = null;
        }
        
        const name = target.getAttribute("data-tooltip-name");
        const mass = target.getAttribute("data-tooltip-mass");
        if (!name) return;
        
        nameEl.textContent = name;
        if (mass) {
            massEl.textContent = `Mass: ${mass} g/mol`;
            massEl.classList.remove("hidden");
        } else {
            massEl.classList.add("hidden");
        }
        
        tooltip.classList.remove("hidden");
        
        // Reset positions to get clean bounds
        tooltip.style.left = "0px";
        tooltip.style.top = "0px";
        
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Center horizontally and offset vertically
        let top = rect.top - tooltipRect.height - 8;
        let placeBelow = false;
        
        if (top < 8) {
            top = rect.bottom + 8;
            placeBelow = true;
        }
        
        let left = rect.left + (rect.width - tooltipRect.width) / 2;
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        
        // Style Arrow depending on position
        if (placeBelow) {
            arrowEl.className = "absolute left-1/2 -translate-x-1/2 bottom-full border-4 border-transparent border-b-slate-900/95 dark:border-b-slate-800/95";
        } else {
            arrowEl.className = "absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-800/95";
        }
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        
        tooltip.classList.remove("opacity-0", "scale-95");
        tooltip.classList.add("opacity-100", "scale-100");
        activeTrigger = target;
    };
    
    const hideTooltip = () => {
        tooltip.classList.remove("opacity-100", "scale-100");
        tooltip.classList.add("opacity-0", "scale-95");
        
        if (fadeTimeout) clearTimeout(fadeTimeout);
        fadeTimeout = setTimeout(() => {
            if (tooltip.classList.contains("opacity-0")) {
                tooltip.classList.add("hidden");
            }
        }, 150);
        activeTrigger = null;
    };
    
    document.addEventListener("mouseover", (e) => {
        const trigger = e.target.closest(".chem-tooltip-trigger");
        if (trigger) {
            showTooltip(trigger);
        }
    });
    
    document.addEventListener("mouseout", (e) => {
        const trigger = e.target.closest(".chem-tooltip-trigger");
        if (trigger && activeTrigger === trigger) {
            hideTooltip();
        }
    });
    
    document.addEventListener("focusin", (e) => {
        const trigger = e.target.closest(".chem-tooltip-trigger");
        if (trigger) {
            showTooltip(trigger);
        }
    });
    
    document.addEventListener("focusout", (e) => {
        const trigger = e.target.closest(".chem-tooltip-trigger");
        if (trigger && activeTrigger === trigger) {
            hideTooltip();
        }
    });
    
    window.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("resize", hideTooltip, { passive: true });
}
