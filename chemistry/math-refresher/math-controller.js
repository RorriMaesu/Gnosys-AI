import { createStage1Subbase } from './stages/stage1-subbase.js';
import { createStage2Division } from './stages/stage2-division.js';
import { createStage3Integers } from './stages/stage3-integers.js';
import { createStage4Fractions } from './stages/stage4-fractions.js';
import { createStage5Decimals } from './stages/stage5-decimals.js';
import { createStage6Scientific } from './stages/stage6-scientific.js';
import { createStage7Algebra } from './stages/stage7-algebra.js';
import { createStage8Graphing } from './stages/stage8-graphing.js';
import { createStage9Quadratics } from './stages/stage9-quadratics.js';
import { createStage10Advanced } from './stages/stage10-advanced.js';
import { createStage11Linearization } from './stages/stage11-linearization.js';
import { createStage12Equilibrium } from './stages/stage12-equilibrium.js';
import { CURRICULUM_MAP } from './curriculum-map.js';
import {
    COURSE_STATE_VERSION,
    createDefaultAdaptiveState,
    migrateCourseState,
    evaluateLessonMastery,
    validateChallengeItem
} from './adaptive-core.js';
import {
    generateAdaptiveChallenge,
    gradeAdaptiveResponse,
    generateQuestionVariant,
    QUESTION_TEMPLATES
} from './adaptive-service.js';
import {
    createCalculatorCoreState,
    mapKeyboardEventToCalculatorKey,
    normalizeCalculatorCoreState,
    reduceCalculatorState
} from './calculator-core.js';

const STORAGE_KEY = 'adaptive_math_refresher_engine_v3';

const courseState = {
    version: COURSE_STATE_VERSION,
    activePhase: 'stage1',
    struggleSignals: {
        moleConcept: 0,
        dimAnalysis: 0,
        stoichSetup: 0
    },
    phases: {},
    adaptive: createDefaultAdaptiveState()
};

const phaseRegistry = [
    createStage1Subbase(),
    createStage2Division(),
    createStage3Integers(),
    createStage4Fractions(),
    createStage5Decimals(),
    createStage6Scientific(),
    createStage7Algebra(),
    createStage8Graphing(),
    createStage9Quadratics(),
    createStage10Advanced(),
    createStage11Linearization(),
    createStage12Equilibrium()
];

const refs = {
    nav: null,
    canvas: null,
    currentPhase: null,
    saveState: null,
    resetScope: null,
    resetStatus: null,
    resetStageBtn: null,
    resetCourseBtn: null,
    resetUndoBtn: null,
    resetModal: null,
    resetModalCard: null,
    resetModalTitle: null,
    resetModalBody: null,
    resetModalConfirm: null,
    resetModalCancel: null,
    resetModalClose: null,
    resetToast: null,
    resetToastTitle: null,
    resetToastBody: null,
    resetToastRemaining: null,
    resetToastSeconds: null,
    resetToastBar: null
};

let mountedPhase = null;
let pendingResetUndo = null;
let pendingResetAction = null;
let resetUndoTimer = null;
let resetUndoTickTimer = null;
let resetModalKeyHandler = null;
let cmrLiteRtSetupStatusListener = null;

const QUESTION_HELP_STYLE_ID = 'cmr-question-help-style';
const RESET_UNDO_TIMEOUT_MS = 20000;
const GENERATED_SIGNATURE_HISTORY_LIMIT = 12;
const GENERATED_SIGNATURE_MAX_RETRIES = 5;

function createDefaultQuestionCalculatorState() {
    return createCalculatorCoreState();
}

function migrateCalculatorSnapshots() {
    Object.values(courseState.phases || {}).forEach((phaseState) => {
        if (!phaseState || typeof phaseState !== 'object') return;

        if (phaseState.concreteMission && typeof phaseState.concreteMission === 'object') {
            const normalizedMission = normalizeCalculatorCoreState(phaseState.concreteMission, {
                displayKey: 'calculatorDisplay'
            });
            phaseState.concreteMission.calculatorDisplay = normalizedMission.display;
            phaseState.concreteMission.error = normalizedMission.error;
            phaseState.concreteMission.accumulator = normalizedMission.accumulator;
            phaseState.concreteMission.pendingOperator = normalizedMission.pendingOperator;
            phaseState.concreteMission.awaitingNextInput = normalizedMission.awaitingNextInput;
            phaseState.concreteMission.lastOperatorValue = normalizedMission.lastOperatorValue;
            phaseState.concreteMission.exponentSignPending = normalizedMission.exponentSignPending;
        }

        const calculators = phaseState.__questionTools?.calculators;
        if (!calculators || typeof calculators !== 'object') return;
        Object.keys(calculators).forEach((questionId) => {
            calculators[questionId] = normalizeCalculatorCoreState(calculators[questionId], {
                displayKey: 'calculatorDisplay'
            });
        });
    });
}

function getQuestionToolsState(phaseId) {
    const phase = phaseById(phaseId);
    const stageState = courseState.phases[phaseId] || phase.getInitialState();
    if (!stageState.__questionTools || typeof stageState.__questionTools !== 'object') {
        stageState.__questionTools = {};
    }
    if (!stageState.__questionTools.calculators || typeof stageState.__questionTools.calculators !== 'object') {
        stageState.__questionTools.calculators = {};
    }
    courseState.phases[phaseId] = stageState;
    return stageState.__questionTools.calculators;
}

function readQuestionCalculatorState(phaseId, questionId) {
    if (!phaseId || !questionId) return createDefaultQuestionCalculatorState();
    const calculators = getQuestionToolsState(phaseId);
    return normalizeCalculatorCoreState(calculators[questionId], {
        displayKey: 'calculatorDisplay'
    });
}

function writeQuestionCalculatorState(phaseId, questionId, nextState) {
    if (!phaseId || !questionId || !nextState) return;
    const calculators = getQuestionToolsState(phaseId);
    calculators[questionId] = normalizeCalculatorCoreState(nextState, {
        displayKey: 'calculatorDisplay'
    });
}

function clearQuestionCalculatorState(phaseId, questionId) {
    if (!phaseId || !questionId) return;
    const calculators = getQuestionToolsState(phaseId);
    delete calculators[questionId];
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw);
        const migrated = migrateCourseState(parsed);

        courseState.version = migrated.version;
        courseState.activePhase = migrated.activePhase;
        courseState.struggleSignals = {
            ...courseState.struggleSignals,
            ...migrated.struggleSignals
        };
        courseState.phases = migrated.phases;
        courseState.adaptive = migrated.adaptive;
        migrateCalculatorSnapshots();
    } catch (_err) {
        // Ignore malformed state and continue with defaults.
    }
}

function saveState(status = 'Saved') {
    courseState.version = COURSE_STATE_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courseState));
    if (refs.saveState) refs.saveState.textContent = status;
}

function deepClone(value) {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
}

function createDefaultCourseState() {
    return {
        version: COURSE_STATE_VERSION,
        activePhase: 'stage1',
        struggleSignals: {
            moleConcept: 0,
            dimAnalysis: 0,
            stoichSetup: 0
        },
        phases: {},
        adaptive: createDefaultAdaptiveState()
    };
}

function applyCourseSnapshot(snapshot) {
    const next = deepClone(snapshot);
    courseState.version = next.version || COURSE_STATE_VERSION;
    courseState.activePhase = next.activePhase || 'stage1';
    courseState.struggleSignals = {
        moleConcept: 0,
        dimAnalysis: 0,
        stoichSetup: 0,
        ...(next.struggleSignals || {})
    };
    courseState.phases = next.phases || {};
    courseState.adaptive = next.adaptive || createDefaultAdaptiveState();
}

function setResetStatus(message) {
    if (refs.resetStatus) {
        refs.resetStatus.textContent = message;
    }
}

function hideResetUndo() {
    pendingResetUndo = null;
    if (resetUndoTimer) {
        clearTimeout(resetUndoTimer);
        resetUndoTimer = null;
    }
    if (resetUndoTickTimer) {
        clearInterval(resetUndoTickTimer);
        resetUndoTickTimer = null;
    }
    if (refs.resetToast) {
        refs.resetToast.classList.add('hidden');
    }
    if (refs.resetToastBar) {
        refs.resetToastBar.style.transition = 'none';
        refs.resetToastBar.style.transform = 'scaleX(1)';
    }
    if (refs.resetToastRemaining) {
        refs.resetToastRemaining.classList.remove('warn', 'urgent');
    }
    if (refs.resetToastSeconds) {
        refs.resetToastSeconds.textContent = '20s';
    }
    if (refs.resetUndoBtn) {
        refs.resetUndoBtn.textContent = 'Undo';
    }
}

function publishResetUndo(label, snapshot) {
    pendingResetUndo = {
        label,
        snapshot: deepClone(snapshot)
    };

    if (resetUndoTimer) {
        clearTimeout(resetUndoTimer);
    }

    if (refs.resetToast) {
        refs.resetToast.classList.remove('hidden');
    }
    if (refs.resetToastTitle) {
        refs.resetToastTitle.textContent = `${label} complete`;
    }
    if (refs.resetToastBody) {
        refs.resetToastBody.textContent = 'Your previous state is available for a short time. Use Undo to restore it.';
    }
    if (refs.resetToastRemaining) {
        refs.resetToastRemaining.classList.remove('warn', 'urgent');
    }
    if (refs.resetToastSeconds) {
        refs.resetToastSeconds.textContent = `${Math.ceil(RESET_UNDO_TIMEOUT_MS / 1000)}s`;
    }
    if (refs.resetToast) {
        refs.resetToast.classList.remove('urgent');
    }
    if (refs.resetToastBar) {
        refs.resetToastBar.style.transition = 'none';
        refs.resetToastBar.style.transform = 'scaleX(1)';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (refs.resetToastBar && pendingResetUndo) {
                    refs.resetToastBar.style.transition = `transform ${RESET_UNDO_TIMEOUT_MS}ms linear`;
                    refs.resetToastBar.style.transform = 'scaleX(0)';
                }
            });
        });
    }

    const resetDeadline = Date.now() + RESET_UNDO_TIMEOUT_MS;
    if (resetUndoTickTimer) {
        clearInterval(resetUndoTickTimer);
    }
    resetUndoTickTimer = setInterval(() => {
        if (!pendingResetUndo) {
            clearInterval(resetUndoTickTimer);
            resetUndoTickTimer = null;
            return;
        }
        const remainingMs = Math.max(0, resetDeadline - Date.now());
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        if (refs.resetToastSeconds) {
            refs.resetToastSeconds.textContent = `${remainingSeconds}s`;
        }
        if (refs.resetToastRemaining) {
            refs.resetToastRemaining.classList.toggle('warn', remainingSeconds <= 8 && remainingSeconds > 4);
            refs.resetToastRemaining.classList.toggle('urgent', remainingSeconds <= 4 && remainingSeconds > 0);
            refs.resetToast.classList.toggle('urgent', remainingSeconds <= 4 && remainingSeconds > 0);
        }
        if (remainingMs === 0) {
            if (refs.resetToastRemaining) {
                refs.resetToastRemaining.classList.remove('warn', 'urgent');
            }
            if (refs.resetToast) {
                refs.resetToast.classList.remove('urgent');
            }
            clearInterval(resetUndoTickTimer);
            resetUndoTickTimer = null;
        }
    }, 250);

    if (refs.resetUndoBtn) {
        refs.resetUndoBtn.textContent = `Undo ${label}`;
    }

    resetUndoTimer = setTimeout(() => {
        hideResetUndo();
        setResetStatus('Undo window expired. Reset is now final.');
    }, RESET_UNDO_TIMEOUT_MS);
}

function restoreFromResetUndo() {
    if (!pendingResetUndo) return;
    const undoLabel = pendingResetUndo.label;
    const snapshot = deepClone(pendingResetUndo.snapshot);
    hideResetUndo();
    applyCourseSnapshot(snapshot);
    updateMasteryProgress();
    setActivePhase(courseState.activePhase || 'stage1');
    updateCtas();
    setResetStatus(`Restored previous state after ${undoLabel || 'reset'}.`);
}

function openResetModal({ title, body, confirmLabel, onConfirm }) {
    pendingResetAction = typeof onConfirm === 'function' ? onConfirm : null;
    if (refs.resetModalTitle) {
        refs.resetModalTitle.textContent = title || 'Confirm Reset';
    }
    if (refs.resetModalBody) {
        refs.resetModalBody.textContent = body || 'This action cannot be undone immediately.';
    }
    if (refs.resetModalConfirm) {
        refs.resetModalConfirm.textContent = confirmLabel || 'Reset';
    }
    refs.resetModal?.classList.remove('hidden');
    document.body.classList.add('cmr-reset-modal-open');
    queueMicrotask(() => {
        refs.resetModalCard?.focus();
    });
}

function closeResetModal() {
    pendingResetAction = null;
    refs.resetModal?.classList.add('hidden');
    document.body.classList.remove('cmr-reset-modal-open');
}

function confirmResetModal() {
    const action = pendingResetAction;
    closeResetModal();
    if (action) action();
}

function ensureQuestionHelpStyles() {
    if (document.getElementById(QUESTION_HELP_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = QUESTION_HELP_STYLE_ID;
    style.textContent = `
        .cmr-question-help-btn {
            margin-left: 0.4rem;
            margin-top: 0.4rem;
            border: 1px solid rgba(245, 158, 11, 0.55);
            border-radius: 999px;
            background: rgba(15, 23, 42, 0.78);
            color: #fbbf24;
            padding: 0.28rem 0.62rem;
            font-size: 0.76rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            white-space: nowrap;
        }

        .cmr-question-help-btn:hover {
            background: rgba(30, 41, 59, 0.9);
            color: #fde68a;
            border-color: rgba(251, 191, 36, 0.85);
        }

        .cmr-question-help-btn:disabled {
            opacity: 0.55;
            cursor: not-allowed;
        }

        .cmr-question-help-btn.compact {
            padding: 0.26rem 0.45rem;
            min-width: 2rem;
            justify-content: center;
        }

        .cmr-question-help-btn.compact span {
            display: none;
        }

        @media (max-width: 640px) {
            .cmr-question-help-btn {
                padding: 0.34rem 0.66rem;
                font-size: 0.74rem;
            }
        }

        .cmr-question-reset-btn {
            margin-left: 0.35rem;
            margin-top: 0.4rem;
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 999px;
            background: rgba(15, 23, 42, 0.72);
            color: #cbd5e1;
            padding: 0.26rem 0.56rem;
            font-size: 0.72rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            white-space: nowrap;
        }

        .cmr-question-reset-btn:hover {
            border-color: rgba(239, 68, 68, 0.55);
            color: #fecaca;
            background: rgba(127, 29, 29, 0.18);
        }

        .cmr-question-reset-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .cmr-question-reset-btn.compact span {
            display: none;
        }

        .cmr-question-calc-btn {
            margin-left: 0.35rem;
            margin-top: 0.4rem;
            border: 1px solid rgba(56, 189, 248, 0.5);
            border-radius: 999px;
            background: rgba(15, 23, 42, 0.8);
            color: #7dd3fc;
            padding: 0.26rem 0.56rem;
            font-size: 0.72rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            white-space: nowrap;
        }

        .cmr-question-calc-btn:hover {
            border-color: rgba(125, 211, 252, 0.9);
            color: #e0f2fe;
            background: rgba(12, 74, 110, 0.3);
        }

        .cmr-question-calc-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .cmr-question-calc-btn.compact span {
            display: none;
        }

        .cmr-calc-fallback-badge {
            display: none;
            align-items: center;
            gap: 0.28rem;
            margin-left: 0.45rem;
            padding: 0.18rem 0.5rem;
            border-radius: 999px;
            border: 1px solid rgba(251, 191, 36, 0.35);
            background: rgba(146, 64, 14, 0.18);
            color: #fbbf24;
            font-size: 0.66rem;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .cmr-calc-fallback-badge.visible {
            display: inline-flex;
        }



        .s6-calc-screen { background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #38bdf8; font-family: monospace; font-size: 1.1rem; padding: 0.6rem; min-height: 2.2rem; display: flex; align-items: center; justify-content: flex-end; }
        .s6-keypad { margin-top: 0.5rem; display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
        .s6-key { border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 6px; background: rgba(30, 41, 59, 0.7); text-align: center; font-weight: bold; color: #f8fafc; font-size: 11px; cursor: pointer; }
        .s6-key.utility { background: rgba(51, 65, 85, 0.9); }
        .s6-key.ee { background: #fde68a; color: #0f172a; }
        .s6-key.operator { background: rgba(14, 116, 144, 0.8); color: #f0f9ff; }
        .s6-key.active { border-color: #fbbf24; background: rgba(245, 158, 11, 0.2); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.35); color: #fbbf24; }
        .s6-key.error { border-color: #ef4444; background: rgba(127, 29, 29, 0.35); box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.32); color: #fecaca; }
        .s6-calc-status { margin-top: 0.5rem; font-size: 0.82rem; color: #cbd5e1; }
        .s6-calc-status.error { color: #fca5a5; }
        .s6-calc-step { margin-top: 0.35rem; font-size: 0.78rem; color: #a5b4fc; }

        .cmr-question-practice-btn {
            margin-left: 0.35rem;
            margin-top: 0.4rem;
            border: 1px solid rgba(139, 92, 246, 0.45);
            border-radius: 999px;
            background: rgba(15, 23, 42, 0.72);
            color: #c084fc;
            padding: 0.26rem 0.56rem;
            font-size: 0.72rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            white-space: nowrap;
        }

        .cmr-question-practice-btn:hover {
            border-color: rgba(167, 139, 250, 0.9);
            color: #f3e8ff;
            background: rgba(76, 29, 149, 0.25);
        }

        .cmr-question-practice-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .cmr-question-practice-btn.compact span {
            display: none;
        }
    `;
    document.head.appendChild(style);
}

function openQuestionCalculatorPopup({ phaseId, questionId, label = 'Question Calculator' }) {
    if (!phaseId || !questionId) return;

    const liveState = courseState.phases[phaseId] || {};
    const el = document.getElementById(questionId) || refs.canvas;
    const context = buildQuestionTutorContext({ phaseId, state: liveState, target: el });
    const prompt = buildQuestionTutorPrompt(context);

    openQuestionTutorPopup({
        phaseId,
        questionId,
        label,
        prompt,
        questionContext: context,
        defaultMode: 'calculator',
        anchorEl: el
    });
}

function openQuestionTutorPopup({
    phaseId,
    questionId,
    label,
    defaultMode = 'chat',
    prompt,
    questionContext,
    anchorEl
}) {
    if (!phaseId || !questionId) return;

    if (!window.ChemTutor?.invoke) return;
    window.ChemTutor.invoke(prompt || '', anchorEl || refs.canvas, {
        questionContext,
        defaultMode,
        label
    });
}

function getStageLabel(phaseId) {
    const stageMap = curriculumById(phaseId);
    if (stageMap?.title) return stageMap.title;
    const phase = phaseById(phaseId);
    return phase?.title || phaseId;
}

function sanitizeQuestionText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

function getStage1AdditionStateParams(stageState) {
    const defaults = { text: '  143\n+  25', answerKey: '168' };
    const overrides = stageState?.questionOverrides || {};
    return overrides['s1-addition']?.parameters || overrides['s1-addition'] || defaults;
}

function getStage1AdditionTutorQuestion(stageState) {
    const addition = getStage1AdditionStateParams(stageState);
    const leftNum = Number(addition?.left);
    const rightNum = Number(addition?.right);
    if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
        return `Help me solve this aligned place-value columns problem: ${leftNum} + ${rightNum} = ?`;
    }

    const lines = String(addition?.text || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length >= 2) {
        const top = lines[0].replace(/[^0-9.-]/g, '');
        const bottom = lines[1].replace(/^[+]/, '').replace(/[^0-9.-]/g, '');
        if (top && bottom) {
            return `Help me solve this aligned place-value columns problem: ${top} + ${bottom} = ?`;
        }
    }

    return 'Help me solve this aligned place-value columns problem.';
}

function isGenericTutorQuestionText(text) {
    const normalized = sanitizeQuestionText(text).toLowerCase();
    if (!normalized) return true;
    return normalized.includes('aligned place-value columns problem') ||
        normalized.includes('problem using aligned place-value columns') ||
        normalized === 'help me with this current step.' ||
        normalized === 'help me with this math question.';
}

function getNearbyQuestionText(target) {
    const pane = target.closest('[class*="-pane"], .s1-card, .s2-card, .s3-card, .s4-card, .s5-card, .s6-card, .s7-card, .s8-card, .s9-card, .s10-card, .s11-card, .s12-card');
    if (!pane) return 'Help me with this math question.';

    const questionSelectors = [
        'div[style*="white-space:pre"]',
        'div[style*="font-family:monospace"]',
        'p > strong',
        'p',
        'label',
        'strong'
    ];

    for (const selector of questionSelectors) {
        const nodes = [...pane.querySelectorAll(selector)]
            .filter((node) => !node.closest('details'))
            .map((node) => sanitizeQuestionText(node.textContent))
            .filter(Boolean);

        const questionLike = nodes.find((line) => /\?|solve|evaluate|which|find|calculate|enter|choose|validate/i.test(line));
        if (questionLike) return questionLike;
    }

    return 'Help me with this current step.';
}

function getTargetValue(target) {
    if (!target) return '';
    if (target.tagName === 'SELECT') {
        const opt = target.options[target.selectedIndex];
        return opt?.textContent?.trim() || target.value || '';
    }
    if (target.type === 'checkbox' || target.type === 'radio') {
        return target.checked ? (target.value || 'checked') : 'not selected';
    }
    if (target.tagName === 'BUTTON') {
        return target.textContent?.trim() || target.id || 'button';
    }
    return target.value || '';
}

function parseAnswerKeys(raw) {
    if (!raw || typeof raw !== 'string') return [];
    return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

function getNestedStateValue(stateObj, keyPath) {
    if (!stateObj || !keyPath) return undefined;
    return keyPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), stateObj);
}

function setNestedStateValue(stateObj, keyPath, value) {
    if (!stateObj || !keyPath) return;
    const segments = keyPath.split('.');
    let cursor = stateObj;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const key = segments[index];
        if (cursor[key] == null || typeof cursor[key] !== 'object') {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = value;
}

function collectQuestionAnswerKeys(questionId) {
    if (!questionId || !refs.canvas) return [];
    const nodes = [...refs.canvas.querySelectorAll('[data-tutor-question-id]')]
        .filter((el) => el.getAttribute('data-tutor-question-id') === questionId);
    const unique = new Set();
    nodes.forEach((el) => {
        parseAnswerKeys(el.getAttribute('data-tutor-answer-keys')).forEach((key) => unique.add(key));
    });
    return [...unique];
}

function clearStageAdaptiveMastery(stageId) {
    const rows = courseState.adaptive?.lessonMastery || {};
    Object.keys(rows).forEach((lessonKey) => {
        if (lessonKey.startsWith(`${stageId}::`)) {
            delete rows[lessonKey];
        }
    });
}

function resetQuestionState(phaseId, questionId) {
    if (!phaseId || !questionId) return false;
    const phase = phaseById(phaseId);
    const stageState = courseState.phases[phaseId] || phase.getInitialState();
    const defaults = phase.getInitialState();

    if (stageState.questionOverrides && stageState.questionOverrides[questionId]) {
        delete stageState.questionOverrides[questionId];
    }

    const answerKeys = collectQuestionAnswerKeys(questionId);
    if (!answerKeys.length && !stageState.questionOverrides) return false;

    answerKeys.forEach((keyPath) => {
        const fallbackValue = getNestedStateValue(defaults, keyPath);
        setNestedStateValue(stageState, keyPath, deepClone(fallbackValue));
    });

    clearQuestionCalculatorState(phaseId, questionId);

    courseState.phases[phaseId] = stageState;
    setActivePhase(phaseId);
    setResetStatus('Question reset to its default textbook values.');
    return true;
}

function normalizeSignatureText(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function getQuestionGenerationBucket(stageState, questionId) {
    if (!stageState.__questionGeneration || typeof stageState.__questionGeneration !== 'object') {
        stageState.__questionGeneration = {};
    }
    if (!stageState.__questionGeneration[questionId] || typeof stageState.__questionGeneration[questionId] !== 'object') {
        stageState.__questionGeneration[questionId] = {};
    }
    const bucket = stageState.__questionGeneration[questionId];
    if (!Array.isArray(bucket.signatures)) {
        bucket.signatures = [];
    }
    return bucket;
}

function buildQuestionVariantSignature(questionId, variantData) {
    const params = variantData?.parameters || variantData || {};
    if (questionId === 's1-applied-tare') {
        const mode = normalizeSignatureText(params.responseMode || (Array.isArray(params.options) && params.options.length ? 'multiple-choice' : 'free-response'));
        const prompt = normalizeSignatureText(params.questionText);
        const answer = normalizeSignatureText(params.answerKey);
        const options = Array.isArray(params.options)
            ? params.options.map((opt) => normalizeSignatureText(opt?.text || opt?.id || '')).join('|')
            : '';
        return `${questionId}|${mode}|${prompt}|${answer}|${options}`;
    }
    return '';
}

function isDuplicateQuestionVariant(stageState, questionId, signature) {
    if (!signature) return false;
    const bucket = getQuestionGenerationBucket(stageState, questionId);
    return bucket.signatures.includes(signature);
}

function recordQuestionVariantSignature(stageState, questionId, signature) {
    if (!signature) return;
    const bucket = getQuestionGenerationBucket(stageState, questionId);
    bucket.signatures = [...bucket.signatures.filter((entry) => entry !== signature), signature]
        .slice(-GENERATED_SIGNATURE_HISTORY_LIMIT);
    bucket.lastSignature = signature;
    bucket.generatedAt = Date.now();
}

function normalizeStage1AppliedVariant(rawData) {
    const params = rawData?.parameters || rawData || {};
    const rawQuestion = typeof params.questionText === 'string' ? params.questionText.trim() : '';
    const normalizedQuestion = (() => {
        if (!rawQuestion) {
            return 'A container is tared on a balance before reagent is added. Explain why tare establishes a relative zero and how this differs from Kelvin absolute zero.';
        }
        if (/which statement is correct\??/i.test(rawQuestion)) {
            return 'A balance is tared with a container before reagent is added. Explain why tare defines a relative measurement zero and how this differs from Kelvin absolute zero (0 K).';
        }
        return rawQuestion;
    })();
    const rawAnswer = typeof params.answerKey === 'string' ? params.answerKey.trim() : '';
    const normalizedAnswer = (() => {
        if (!rawAnswer || /^(right|wrong)$/i.test(rawAnswer)) {
            return 'Tare resets a local measurement baseline, while Kelvin is an absolute thermodynamic scale with 0 K as absolute zero.';
        }
        return rawAnswer;
    })();
    const normalized = {
        ...params,
        responseMode: 'free-response',
        questionText: normalizedQuestion,
        answerKey: normalizedAnswer,
        rubric: (params.rubric && typeof params.rubric === 'object')
            ? params.rubric
            : { scoring: 'concept-match', max_points: 1 },
        workedSolution: typeof params.workedSolution === 'string' && params.workedSolution.trim()
            ? params.workedSolution.trim()
            : 'Expected explanation: tare is a relative reference reset for displayed mass; Kelvin remains an absolute thermodynamic scale.'
    };
    delete normalized.options;
    return normalized;
}

function isCoherentStage1AppliedVariant(variantData) {
    const params = variantData?.parameters || variantData || {};
    const question = normalizeSignatureText(params.questionText);
    const answer = normalizeSignatureText(params.answerKey);

    if (!question || !answer) return false;
    if (/which statement is correct\??/.test(question)) return false;
    if (/\bright\b|\bwrong\b/.test(answer)) return false;

    const hasRelative = /relative|tare|baseline|reference/.test(question) || /relative|tare|baseline|reference/.test(answer);
    const hasAbsolute = /absolute|kelvin|0 k|thermodynamic/.test(question) || /absolute|kelvin|0 k|thermodynamic/.test(answer);
    return hasRelative && hasAbsolute;
}

async function triggerQuestionGeneration(phaseId, questionId, btnEl) {
    if (btnEl.disabled) return;
    const originalHtml = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Generating...</span>';
    setResetStatus('Generating new practice problem...');

    try {
        // L1.6 is intentionally local-only for speed and deterministic grading.
        if (questionId === 's1-addition') {
            const success = applyOfflineFallbackQuestion(phaseId, questionId);
            if (success) {
                setResetStatus('New L1.6 practice problem generated locally.');
            } else {
                setResetStatus('Local L1.6 practice generation failed.');
            }
            return;
        }

        const activeModelLabel = typeof window.getActiveModelLabel === 'function'
            ? window.getActiveModelLabel('chemistry_llm')
            : (typeof window.getGnosysModel === 'function' ? window.getGnosysModel('chemistry_llm') : 'local model');
        setResetStatus(`Generating new practice problem with ${activeModelLabel}...`);
        const phase = phaseById(phaseId);
        const stageState = courseState.phases[phaseId] || phase.getInitialState();
        const maxRetries = questionId === 's1-applied-tare' ? GENERATED_SIGNATURE_MAX_RETRIES : 1;
        let generated = null;
        let acceptedSignature = '';
        let duplicateRejected = false;
        let qualityRejected = false;

        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            if (maxRetries > 1) {
                setResetStatus(`Generating new L1.9 practice challenge (attempt ${attempt}/${maxRetries})...`);
            }

            const result = await generateQuestionVariant(questionId, phaseId);
            if (!result.ok || !result.data) {
                throw new Error('Invalid generation response format.');
            }

            const nextData = questionId === 's1-applied-tare'
                ? normalizeStage1AppliedVariant(result.data)
                : result.data;
            if (questionId === 's1-applied-tare' && !isCoherentStage1AppliedVariant(nextData)) {
                qualityRejected = true;
                continue;
            }
            const signature = buildQuestionVariantSignature(questionId, nextData);
            if (questionId === 's1-applied-tare' && signature && isDuplicateQuestionVariant(stageState, questionId, signature)) {
                duplicateRejected = true;
                continue;
            }

            generated = {
                data: nextData,
                model: result.model || activeModelLabel
            };
            acceptedSignature = signature;
            break;
        }

        if (generated) {
            
            if (!stageState.questionOverrides) {
                stageState.questionOverrides = {};
            }
            stageState.questionOverrides[questionId] = generated.data;
            if (acceptedSignature) {
                recordQuestionVariantSignature(stageState, questionId, acceptedSignature);
            }

            const answerKeys = collectQuestionAnswerKeys(questionId);
            const defaults = phase.getInitialState();
            answerKeys.forEach((keyPath) => {
                const fallbackValue = getNestedStateValue(defaults, keyPath);
                setNestedStateValue(stageState, keyPath, deepClone(fallbackValue));
            });
            clearQuestionCalculatorState(phaseId, questionId);

            courseState.phases[phaseId] = stageState;
            saveState('New question generated');
            setActivePhase(phaseId);
            setResetStatus(`New practice question generated using ${generated.model}.`);
        } else {
            if (duplicateRejected) {
                throw new Error('The active model returned duplicate L1.9 prompts repeatedly. Try generating again for a fresh prompt.');
            }
            if (qualityRejected) {
                throw new Error('The active model returned low-quality L1.9 prompts repeatedly. Try generating again for a clearer conceptual prompt.');
            }
            throw new Error('Invalid generation response format.');
        }
    } catch (error) {
        console.error('Question generation failed:', error);
        const success = applyOfflineFallbackQuestion(phaseId, questionId);
        if (success) {
            setResetStatus('Local model offline or failed. Generated a practice problem variant locally.');
        } else {
            setResetStatus(`Generation failed: ${error.message}`);
        }
    } finally {
        btnEl.disabled = false;
        btnEl.innerHTML = originalHtml;
    }
}

function applyOfflineFallbackQuestion(phaseId, questionId) {
    const template = QUESTION_TEMPLATES[questionId];
    if (!template) return false;

    const phase = phaseById(phaseId);
    const stageState = courseState.phases[phaseId] || phase.getInitialState();
    
    const formatStage1AdditionText = (leftValue, rightValue) => {
        const top = String(leftValue).padStart(3, ' ');
        const bottom = String(rightValue).padStart(3, ' ');
        return `  ${top}\n+ ${bottom}`;
    };

    const generateStage1NoCarryAddition = () => {
        const hundreds = Math.floor(Math.random() * 9) + 1; // 1-9
        const rightTens = Math.floor(Math.random() * 9) + 1; // 1-9 (keeps right addend two-digit)
        const leftTens = Math.floor(Math.random() * (10 - rightTens)); // ensures leftTens + rightTens < 10
        const leftOnes = Math.floor(Math.random() * 10); // 0-9
        const rightOnes = Math.floor(Math.random() * (10 - leftOnes)); // ensures leftOnes + rightOnes < 10

        const left = (hundreds * 100) + (leftTens * 10) + leftOnes;
        const right = (rightTens * 10) + rightOnes;
        return { left, right };
    };

    let generated = null;
    if (questionId === 's1-addition') {
        if (!stageState.__questionGeneration || typeof stageState.__questionGeneration !== 'object') {
            stageState.__questionGeneration = {};
        }

        const previousPair = stageState.__questionGeneration[questionId];
        let pair = generateStage1NoCarryAddition();
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const isRepeat = previousPair && previousPair.left === pair.left && previousPair.right === pair.right;
            if (!isRepeat) break;
            pair = generateStage1NoCarryAddition();
        }

        stageState.__questionGeneration[questionId] = {
            left: pair.left,
            right: pair.right,
            generatedAt: Date.now()
        };

        generated = {
            questionId,
            parameters: {
                left: pair.left,
                right: pair.right,
                answerKey: `${pair.left + pair.right}`,
                text: formatStage1AdditionText(pair.left, pair.right)
            }
        };
    } else if (questionId === 's1-comparison-a') {
        const left = Math.floor(1 + Math.random() * 9);
        const right = Math.floor(1 + Math.random() * 9);
        const answerKey = left > right ? 'gt' : (left < right ? 'lt' : 'eq');
        generated = {
            questionId,
            parameters: { left, right, answerKey }
        };
    } else if (questionId === 's1-comparison-b') {
        const a = Math.floor(1 + Math.random() * 5);
        const b = Math.floor(1 + Math.random() * 5);
        const right = Math.floor(2 + Math.random() * 8);
        const sum = a + b;
        const answerKey = sum > right ? 'gt' : (sum < right ? 'lt' : 'eq');
        generated = {
            questionId,
            parameters: {
                leftText: `${a} + ${b}`,
                right,
                leftVal: sum,
                rightVal: right,
                answerKey
            }
        };
    } else if (questionId === 's2-division') {
        const divisor = Math.floor(2 + Math.random() * 8);
        const quotient = Math.floor(20 + Math.random() * 150);
        generated = {
            questionId,
            parameters: { dividend: divisor * quotient, divisor, answerKey: `${quotient}` }
        };
    } else if (questionId === 's3-calorimeter') {
        const ti = Math.floor(-30 + Math.random() * 25);
        const tf = Math.floor(5 + Math.random() * 50);
        generated = {
            questionId,
            parameters: { ti, tf, answerKey: `${tf - ti}` }
        };
    } else if (questionId === 's1-applied-tare') {
        const scenarios = [
            {
                questionText: 'A beaker reads 2.84 g on a balance, then Tare resets display to 0.00 g before solution is added. Explain why this is a relative zero and not absolute zero.',
                answerKey: 'Tare resets a local measurement baseline for net mass, while absolute zero in Kelvin is a physical thermodynamic limit at 0 K.'
            },
            {
                questionText: 'A weighing boat is tared before powder is added so only added mass is displayed. Explain how this tare zero differs from Kelvin zero.',
                answerKey: 'Tare defines a relative instrument reference; Kelvin zero is an absolute thermodynamic reference, not a user-defined baseline.'
            },
            {
                questionText: 'A flask plus stopper is zeroed with Tare, then reagent mass is tracked from 0.00 g. Explain what kind of zero this is and contrast with absolute temperature scales.',
                answerKey: 'Tare zero is a relative measurement origin for that setup, while Kelvin starts at absolute zero where thermal energy reaches its minimum limit.'
            }
        ];

        const bucket = getQuestionGenerationBucket(stageState, questionId);
        let pick = scenarios[Math.floor(Math.random() * scenarios.length)];
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const candidate = scenarios[Math.floor(Math.random() * scenarios.length)];
            const candidateSig = buildQuestionVariantSignature(questionId, {
                responseMode: 'free-response',
                questionText: candidate.questionText,
                answerKey: candidate.answerKey
            });
            if (!bucket.signatures.includes(candidateSig)) {
                pick = candidate;
                break;
            }
        }

        generated = {
            questionId,
            parameters: {
                responseMode: 'free-response',
                questionText: pick.questionText,
                answerKey: pick.answerKey,
                rubric: {
                    scoring: 'concept-match',
                    max_points: 1
                },
                workedSolution: 'Expected idea: tare sets a relative measurement baseline, while Kelvin uses absolute thermodynamic zero.'
            }
        };
    }

    if (!generated) {
        generated = {
            questionId,
            parameters: deepClone(template.defaults)
        };
    }

    if (!stageState.questionOverrides) {
        stageState.questionOverrides = {};
    }
    stageState.questionOverrides[questionId] = generated;
    if (questionId === 's1-applied-tare') {
        const signature = buildQuestionVariantSignature(questionId, generated);
        recordQuestionVariantSignature(stageState, questionId, signature);
    }
    courseState.phases[phaseId] = stageState;
    saveState('Offline fallback question generated');
    setActivePhase(phaseId);
    return true;
}

function resetStageState(stageId) {
    const phase = phaseById(stageId);
    const snapshot = deepClone(courseState);
    courseState.phases[stageId] = phase.getInitialState();
    clearStageAdaptiveMastery(stageId);
    updateMasteryProgress();
    setActivePhase(stageId);
    setResetStatus(`Reset complete for ${curriculumById(stageId)?.label || stageId}.`);
    publishResetUndo('Stage Reset', snapshot);
}

function resetCourseState() {
    const snapshot = deepClone(courseState);
    const defaults = createDefaultCourseState();
    applyCourseSnapshot(defaults);
    localStorage.removeItem(STORAGE_KEY);
    updateMasteryProgress();
    setActivePhase('stage1');
    saveState('Course reset');
    updateCtas();
    setResetStatus('Entire math refresher progress was reset to defaults.');
    publishResetUndo('Course Reset', snapshot);
}

function updateResetControls() {
    const stageMap = curriculumById(courseState.activePhase);
    if (refs.resetScope) {
        refs.resetScope.textContent = `Current scope: ${stageMap?.title || courseState.activePhase}`;
    }
    if (refs.resetStageBtn) {
        refs.resetStageBtn.textContent = `Reset ${stageMap?.label || 'Current Stage'}`;
    }
}

function bindResetActions() {
    refs.resetStageBtn?.addEventListener('click', () => {
        const stageMap = curriculumById(courseState.activePhase);
        const label = stageMap?.label || courseState.activePhase;
        openResetModal({
            title: `Reset ${label}?`,
            body: 'This clears all answers and adaptive mastery for this stage.',
            confirmLabel: 'Reset Stage',
            onConfirm: () => resetStageState(courseState.activePhase)
        });
    });

    refs.resetCourseBtn?.addEventListener('click', () => {
        openResetModal({
            title: 'Reset the entire Math Refresher course?',
            body: 'This clears all stage answers, progress, and adaptive mastery history.',
            confirmLabel: 'Reset Course',
            onConfirm: () => resetCourseState()
        });
    });

    refs.resetUndoBtn?.addEventListener('click', () => {
        restoreFromResetUndo();
    });

    refs.resetModalClose?.addEventListener('click', closeResetModal);
    refs.resetModalCancel?.addEventListener('click', closeResetModal);
    refs.resetModalConfirm?.addEventListener('click', confirmResetModal);
    refs.resetModal?.addEventListener('click', (event) => {
        if (event.target === refs.resetModal?.querySelector('.cmr-reset-modal-backdrop')) {
            closeResetModal();
        }
    });

    resetModalKeyHandler = (event) => {
        if (refs.resetModal?.classList.contains('hidden')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeResetModal();
        }
        if (event.key === 'Tab') {
            const focusable = [
                refs.resetModalClose,
                refs.resetModalCancel,
                refs.resetModalConfirm
            ].filter(Boolean);
            if (!focusable.length) return;
            const currentIndex = focusable.indexOf(document.activeElement);
            const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
            if (currentIndex !== -1) {
                event.preventDefault();
                focusable[nextIndex].focus();
            }
        }
        if (event.key === 'Enter' && document.activeElement === refs.resetModalCard) {
            event.preventDefault();
            confirmResetModal();
        }
    };
    document.addEventListener('keydown', resetModalKeyHandler);
}

function getAnswerSnapshotFromKeys(stageState, answerKeys) {
    if (!answerKeys.length) return null;
    if (answerKeys.length === 1) {
        return getNestedStateValue(stageState, answerKeys[0]);
    }

    const snapshot = {};
    answerKeys.forEach((key) => {
        snapshot[key] = getNestedStateValue(stageState, key);
    });
    return snapshot;
}

function getAdaptiveRowsForStage(stageId) {
    const rows = Object.values(courseState.adaptive?.lessonMastery || {});
    return rows
        .filter((row) => row.stageId === stageId)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 3)
        .map((row) => ({
            lessonId: row.lessonId,
            attempts: row.attempts,
            correct: row.correct,
            mastered: row.mastered,
            updatedAt: row.updatedAt
        }));
}

function buildQuestionTutorContext({ phaseId, state, target }) {
    const stageState = state || courseState.phases[phaseId] || {};
    const answerKeys = parseAnswerKeys(target.getAttribute('data-tutor-answer-keys'));
    const explicitQuestionId = target.getAttribute('data-tutor-question-id');
    const explicitQuestionText = target.getAttribute('data-tutor-question');
    const explicitLevel = target.getAttribute('data-tutor-level');

    const questionId = explicitQuestionId || target.id || target.name || target.getAttribute('data-question-id') || 'unknown-question';
    const nearbyQuestionText = getNearbyQuestionText(target);
    let questionText = explicitQuestionText || nearbyQuestionText;
    if (questionId === 's1-addition' && isGenericTutorQuestionText(questionText)) {
        questionText = getStage1AdditionTutorQuestion(stageState);
    }
    const currentAnswer = answerKeys.length
        ? getAnswerSnapshotFromKeys(stageState, answerKeys)
        : getTargetValue(target);
    const adaptiveRows = getAdaptiveRowsForStage(phaseId);

    return {
        phaseId,
        phaseTitle: getStageLabel(phaseId),
        level: explicitLevel || null,
        questionId,
        questionText,
        controlType: target.tagName.toLowerCase(),
        controlId: target.id || null,
        answerKeys,
        currentAnswer,
        stageState,
        adaptiveSnapshot: adaptiveRows,
        timestamp: new Date().toISOString()
    };
}

function buildQuestionTutorPrompt(context) {
    const answerText = (() => {
        if (context.currentAnswer === null || context.currentAnswer === undefined || context.currentAnswer === '') {
            return 'I have not entered an answer yet.';
        }
        
        const formatValue = (val) => {
            if (Array.isArray(val)) {
                const filtered = val.filter(item => item !== null && item !== undefined && item !== '');
                if (!filtered.length) return '';
                const allShort = filtered.every(item => String(item).length <= 2);
                return allShort ? filtered.join('') : filtered.join(', ');
            }
            return String(val);
        };

        if (typeof context.currentAnswer === 'object') {
            if (Array.isArray(context.currentAnswer)) {
                return formatValue(context.currentAnswer) || 'I have not entered an answer yet.';
            }
            
            // Filter entries to remove empty values and internal state variables/booleans
            const entries = Object.entries(context.currentAnswer).filter(([k, v]) => {
                if (v === null || v === undefined || v === '') return false;
                if (typeof v === 'boolean') return false; // Ignore internal boolean flags
                
                const lowerK = k.toLowerCase();
                // Filter out standard internal state/grading keys
                if (lowerK.endsWith('correct') || 
                    lowerK.endsWith('unlocked') || 
                    lowerK.endsWith('verified') || 
                    lowerK.endsWith('done') || 
                    lowerK.endsWith('ready') || 
                    lowerK.endsWith('flipped') ||
                    lowerK.endsWith('success') ||
                    lowerK.endsWith('status') ||
                    lowerK.endsWith('active') ||
                    lowerK.includes('mission') ||
                    lowerK.includes('flag')) {
                    return false;
                }
                return true;
            });
            
            if (entries.length === 0) {
                return 'I have not entered an answer yet.';
            }
            
            // Check for value/unit compound pairs
            const valueEntry = entries.find(([k]) => k.toLowerCase().endsWith('.value') || k.toLowerCase() === 'value');
            const unitEntry = entries.find(([k]) => k.toLowerCase().endsWith('.unit') || k.toLowerCase() === 'unit');
            
            if (valueEntry || unitEntry) {
                const val = valueEntry ? valueEntry[1] : '';
                const unit = unitEntry ? unitEntry[1] : '';
                if (val && unit) {
                    return `${val} ${unit}`;
                }
                return val || unit;
            }
            
            // If only one entry remains, just return its value directly for simplicity
            if (entries.length === 1) {
                return formatValue(entries[0][1]);
            }
            
            // Format multiple entries clearly
            return entries.map(([k, v]) => {
                const cleanKey = k.includes('.') ? k.split('.').pop() : k;
                
                let formattedKey = cleanKey
                    .replace(/^compQ(\d+)/i, 'Question $1')
                    .replace(/^step(\d+)/i, 'Step $1')
                    .replace(/^q(\d+)/i, 'Question $1')
                    .replace(/^f(\d+)/i, 'Factor $1')
                    .replace(/Num$/i, 'Numerator')
                    .replace(/Den$/i, 'Denominator')
                    .replace(/(Answer|Input|Val|Choice|Guess)$/i, '');
                
                if (!formattedKey) formattedKey = cleanKey;
                
                // Capitalize first letter
                formattedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
                
                // Insert space before capital letters to make compound keys readable
                formattedKey = formattedKey.replace(/([A-Z])/g, ' $1').trim();
                
                return `${formattedKey}: ${formatValue(v)}`;
            }).join(', ');
        }
        
        return `${context.currentAnswer}`;
    })();
    
    return `Help me with this question: ${context.questionText}\nMy current answer: ${answerText}`;
}

function hasExistingQuestionHelp(parentEl, questionId) {
    if (!parentEl || !questionId) return false;
    return [...parentEl.querySelectorAll('.cmr-question-help-btn')]
        .some((btn) => btn.getAttribute('data-cmr-question-id') === questionId);
}

function findQuestionContainer(el) {
    if (!el) return null;
    return el.closest('.s1-pane, .s2-pane, .s3-pane, .s4-pane, .s5-pane, .s6-pane, .s7-pane, .s8-pane, .s9-pane, .s10-pane, .s11-pane, .s12-pane, [class*="-pane"], [class*="-card"], .question, [data-question-group]');
}

function resolveQuestionId(el) {
    if (!el) return '';
    const explicit = el.getAttribute('data-tutor-question-id');
    if (explicit) return explicit;

    const container = findQuestionContainer(el);
    const grouped = container?.querySelector('[data-tutor-question-id]')?.getAttribute('data-tutor-question-id');
    return grouped || '';
}

function findPrimaryAnchor(phaseRoot, questionId) {
    if (!phaseRoot || !questionId) return null;
    const explicitTargets = [...phaseRoot.querySelectorAll('[data-tutor-question-id]')]
        .filter((node) => node.getAttribute('data-tutor-question-id') === questionId);
    if (!explicitTargets.length) return null;

    const primaryCheckSubmit = explicitTargets.find((node) => {
        if (!node.matches('button, input[type="button"], input[type="submit"]')) return false;
        const id = (node.id || '').toLowerCase();
        const text = (node.textContent || node.value || '').toLowerCase();
        return /check|submit|verify|validate|solve|run/.test(`${id} ${text}`);
    });

    if (primaryCheckSubmit) return primaryCheckSubmit;

    const primaryActionFallback = explicitTargets.find((node) => {
        if (!node.matches('button, input[type="button"], input[type="submit"]')) return false;
        const id = (node.id || '').toLowerCase();
        const text = (node.textContent || node.value || '').toLowerCase();
        return /guess|choose|right|wrong/.test(`${id} ${text}`);
    });

    return primaryActionFallback || explicitTargets[0];
}

function getDenseContainer(el) {
    if (!el) return null;
    const container = el.closest('.s1-grid, .s2-grid, .s3-grid, .s4-grid, .s5-grid, .s6-grid, .s7-grid, .s8-grid, .s9-grid, .s10-grid, .s11-grid, .s12-grid');
    if (!container) return null;
    const interactiveCount = container.querySelectorAll('input, select, textarea, button').length;
    return interactiveCount >= 4 ? container : null;
}

function shouldAttachQuestionHelpButton(el) {
    if (!el) return false;
    if (el.closest('details')) return false;
    if (el.closest('.tutor-popup-card')) return false;
    if (el.dataset?.cmrQuestionHelpSkip === 'true') return false;

    if (el.getAttribute('data-tutor-question') || el.getAttribute('data-tutor-question-id')) {
        return true;
    }

    if (el.matches('input, select, textarea')) {
        const inputType = (el.type || '').toLowerCase();
        if (['hidden', 'button', 'submit'].includes(inputType)) return false;
        return true;
    }

    if (el.matches('button')) {
        if (el.hasAttribute('data-diag')) return false;
        if (el.classList.contains('s3-op-btn')) return false;
        if (el.classList.contains('tutor-btn') || el.classList.contains('cmr-question-help-btn')) return false;
        const text = (el.textContent || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        if (/hint|reset|continue|prof\.?\s*beaker|tutor|flash|add proton|add electron|regroup hundreds|regroup tens/.test(text)) return false;
        if (/hint|reset|continue/.test(id)) return false;
        return /check|guess|validate|run|flip|solve|submit|choose|right|wrong|divide|estimate|hop|plot/.test(text + ' ' + id);
    }

    return false;
}

function addQuestionHelpButtons(phaseId, phaseState) {
    if (!refs.canvas || !mountedPhase || mountedPhase.id !== phaseId) return;
    ensureQuestionHelpStyles();

    const allCandidates = [...refs.canvas.querySelectorAll('input, select, textarea, button')]
        .filter((el) => shouldAttachQuestionHelpButton(el));

    const explicitQuestionIds = new Set(
        [...refs.canvas.querySelectorAll('[data-tutor-question-id]')]
            .map((el) => el.getAttribute('data-tutor-question-id'))
            .filter(Boolean)
    );

    const explicitCandidates = allCandidates.filter((el) => el.hasAttribute('data-tutor-question-id') || el.hasAttribute('data-tutor-question'));
    const inferredCandidates = allCandidates.filter((el) => !(el.hasAttribute('data-tutor-question-id') || el.hasAttribute('data-tutor-question')));
    const candidates = explicitCandidates.concat(inferredCandidates);
    const renderedQuestionIds = new Set();

    candidates.forEach((el) => {
        if (el.dataset.cmrQuestionHelpAttached === 'true') return;

        const questionId = resolveQuestionId(el);

        if (!questionId && explicitQuestionIds.size > 0) {
            el.dataset.cmrQuestionHelpAttached = 'true';
            return;
        }

        if (questionId && explicitQuestionIds.has(questionId)) {
            const primaryAnchor = findPrimaryAnchor(refs.canvas, questionId);
            if (primaryAnchor && primaryAnchor !== el) {
                el.dataset.cmrQuestionHelpAttached = 'true';
                return;
            }
        }

        const allowMultiple = el.getAttribute('data-tutor-allow-multiple') === 'true';
        if (questionId && !allowMultiple && renderedQuestionIds.has(questionId)) {
            el.dataset.cmrQuestionHelpAttached = 'true';
            return;
        }

        const denseContainer = getDenseContainer(el);
        const mountParent = denseContainer || el.parentElement;

        if (questionId && !allowMultiple && (hasExistingQuestionHelp(refs.canvas, questionId) || hasExistingQuestionHelp(mountParent, questionId))) {
            el.dataset.cmrQuestionHelpAttached = 'true';
            return;
        }

        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'cmr-question-help-btn';
        if (questionId) {
            helpBtn.setAttribute('data-cmr-question-id', questionId);
        }
        helpBtn.setAttribute('aria-label', 'Ask tutor about this question');
        helpBtn.innerHTML = '<i class="fa-solid fa-circle-question" aria-hidden="true"></i><span>Ask Tutor</span>';

        if (denseContainer) {
            helpBtn.classList.add('compact');
            helpBtn.title = 'Ask Tutor';
        }

        const disabled = el.disabled || el.closest('[class*="-locked"]');
        if (disabled) {
            helpBtn.disabled = true;
        }

        const resetBtn = questionId
            ? document.createElement('button')
            : null;
        if (resetBtn) {
            resetBtn.type = 'button';
            resetBtn.className = 'cmr-question-reset-btn';
            resetBtn.setAttribute('aria-label', 'Reset this question');
            resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>Reset Question</span>';
            if (denseContainer) {
                resetBtn.classList.add('compact');
                resetBtn.title = 'Reset Question';
            }
            if (disabled) {
                resetBtn.disabled = true;
            }
            resetBtn.addEventListener('click', () => {
                const didReset = resetQuestionState(phaseId, questionId);
                if (!didReset) {
                    setResetStatus('This question cannot be reset automatically yet.');
                }
            });
        }

        const calcBtn = questionId
            ? document.createElement('button')
            : null;
        if (calcBtn) {
            calcBtn.type = 'button';
            calcBtn.className = 'cmr-question-calc-btn';
            calcBtn.setAttribute('aria-label', 'Open calculator for this question');
            calcBtn.innerHTML = '<i class="fa-solid fa-calculator" aria-hidden="true"></i><span>Calculator</span>';
            if (denseContainer) {
                calcBtn.classList.add('compact');
                calcBtn.title = 'Open Calculator';
            }
            if (disabled) {
                calcBtn.disabled = true;
            }
            calcBtn.addEventListener('click', () => {
                const liveState = courseState.phases[phaseId] || phaseState || {};
                const context = buildQuestionTutorContext({ phaseId, state: liveState, target: el });
                const stageLabel = getStageLabel(phaseId);
                const prompt = buildQuestionTutorPrompt(context);
                openQuestionTutorPopup({
                    phaseId,
                    questionId: context.questionId,
                    label: `${stageLabel} • ${questionId} Calculator`,
                    prompt,
                    questionContext: context,
                    defaultMode: 'calculator'
                });
            });
        }

        const practiceBtn = (questionId && QUESTION_TEMPLATES[questionId])
            ? document.createElement('button')
            : null;
        if (practiceBtn) {
            practiceBtn.type = 'button';
            practiceBtn.className = 'cmr-question-practice-btn';
            practiceBtn.setAttribute('aria-label', 'Generate a new practice version of this question');
            practiceBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>New Practice</span>';
            if (denseContainer) {
                practiceBtn.classList.add('compact');
                practiceBtn.title = 'New Practice';
            }
            if (disabled) {
                practiceBtn.disabled = true;
            }
            practiceBtn.addEventListener('click', async () => {
                await triggerQuestionGeneration(phaseId, questionId, practiceBtn);
            });
        }

        helpBtn.addEventListener('click', () => {
            const liveState = courseState.phases[phaseId] || phaseState || {};
            const context = buildQuestionTutorContext({ phaseId, state: liveState, target: el });
            const prompt = buildQuestionTutorPrompt(context);
            openQuestionTutorPopup({
                phaseId,
                questionId: context.questionId,
                prompt,
                questionContext: context,
                defaultMode: 'chat',
                anchorEl: helpBtn.parentElement || refs.canvas
            });
        });

        if (denseContainer) {
            denseContainer.appendChild(helpBtn);
            if (resetBtn) {
                denseContainer.appendChild(resetBtn);
            }
            if (practiceBtn) {
                denseContainer.appendChild(practiceBtn);
            }
            if (calcBtn) {
                denseContainer.appendChild(calcBtn);
            }
        } else {
            el.insertAdjacentElement('afterend', helpBtn);
            if (resetBtn) {
                helpBtn.insertAdjacentElement('afterend', resetBtn);
            }
            if (practiceBtn) {
                const anchor = resetBtn || helpBtn;
                anchor.insertAdjacentElement('afterend', practiceBtn);
            }
            if (calcBtn) {
                const anchor = practiceBtn || resetBtn || helpBtn;
                anchor.insertAdjacentElement('afterend', calcBtn);
            }
        }

        if (questionId && !allowMultiple) {
            renderedQuestionIds.add(questionId);
        }
        el.dataset.cmrQuestionHelpAttached = 'true';
    });
}

function scheduleQuestionHelpRefresh(phaseId) {
    queueMicrotask(() => {
        const phaseState = courseState.phases[phaseId];
        addQuestionHelpButtons(phaseId, phaseState);
    });
}

function phaseById(phaseId) {
    return phaseRegistry.find((phase) => phase.id === phaseId) || phaseRegistry[0];
}

function curriculumById(phaseId) {
    return CURRICULUM_MAP.find((stage) => stage.id === phaseId) || null;
}

function isStageCompleted(phaseId) {
    const stageState = courseState.phases[phaseId];
    if (!stageState) return false;
    return !!(stageState.fastTrack || stageState.appliedCorrect === true || stageState.appliedChoice === 'right' || stageState.waveCorrect === true);
}

function updateMasteryProgress() {
    let completedCount = 0;
    phaseRegistry.forEach((phase) => {
        if (isStageCompleted(phase.id)) {
            completedCount++;
        }
    });
    const percent = Math.round((completedCount / phaseRegistry.length) * 100);
    if (refs.progressBar) {
        refs.progressBar.style.width = `${percent}%`;
    }
    if (refs.progressPercent) {
        refs.progressPercent.textContent = `${percent}%`;
    }
}

function setActivePhase(phaseId) {
    const phase = phaseById(phaseId);
    courseState.activePhase = phase.id;

    if (mountedPhase?.unmount) {
        mountedPhase.unmount();
    }

    refs.canvas.innerHTML = '';

    const phaseState = courseState.phases[phase.id] || phase.getInitialState();
    courseState.phases[phase.id] = phaseState;

    mountedPhase = phase;
    phase.mount({
        host: refs.canvas,
        state: phaseState,
        onStateChange: (nextState, message = 'Saved') => {
            courseState.phases[phase.id] = nextState;
            saveState(message);
            updateMasteryProgress();
            renderNav();
            scheduleQuestionHelpRefresh(phase.id);
        }
    });

    addQuestionHelpButtons(phase.id, phaseState);

    renderNav();
    renderHeader();
    updateResetControls();
    saveState('Saved');
}

function renderNav() {
    refs.nav.innerHTML = '';
    phaseRegistry.forEach((phase, index) => {
        const stageMap = curriculumById(phase.id);
        const completed = isStageCompleted(phase.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `cmr-phase-btn${phase.id === courseState.activePhase ? ' active' : ''}${completed ? ' cmr-completed' : ''}`;
        const stageLabel = stageMap?.label || phase.label;
        const lessonCount = stageMap?.lessons?.length || 0;
        button.textContent = `Stage ${index + 1}: ${stageLabel} (${lessonCount})${completed ? ' ✓' : ''}`;
        if (stageMap?.lessons?.length) {
            button.title = stageMap.lessons.join('\n');
        }
        button.addEventListener('click', () => setActivePhase(phase.id));
        refs.nav.appendChild(button);
    });
}

function renderHeader() {
    const phase = phaseById(courseState.activePhase);
    const stageMap = curriculumById(phase.id);
    if (refs.currentPhase) {
        refs.currentPhase.textContent = stageMap?.title || phase.title;
    }
    updateResetControls();
}

function updateCtas() {
    const ctaEls = [
        document.getElementById('math-refresher-cta-molar'),
        document.getElementById('math-refresher-cta-dimensions'),
        document.getElementById('math-refresher-cta-stoich')
    ].filter(Boolean);

    if (!ctaEls.length) return;

    let learningState = null;
    try {
        learningState = JSON.parse(localStorage.getItem('chemistry_learning_state_v1') || 'null');
    } catch (_err) {
        learningState = null;
    }

    const competency = learningState?.competencyProgress || {};
    const lowScore = (row) => row.attempts >= 2 && (row.correct / row.attempts) < 0.6;

    const shouldShow = lowScore(competency['mole-concept'] || { attempts: 0, correct: 0 })
        || lowScore(competency['dim-analysis'] || { attempts: 0, correct: 0 })
        || lowScore(competency['stoich-setup'] || { attempts: 0, correct: 0 })
        || Object.values(courseState.struggleSignals).some((value) => value > 0);

    ctaEls.forEach((el) => el.classList.toggle('hidden', !shouldShow));
}

function notifyCompetencyAttempt(competencyId, isCorrect) {
    if (isCorrect) return;

    if (competencyId === 'mole-concept') courseState.struggleSignals.moleConcept += 1;
    if (competencyId === 'dim-analysis') courseState.struggleSignals.dimAnalysis += 1;
    if (competencyId === 'stoich-setup') courseState.struggleSignals.stoichSetup += 1;

    saveState('Signal logged');
    updateCtas();
}

function dispatchToolCalls(toolCalls) {
    if (!Array.isArray(toolCalls) || !mountedPhase?.handleToolCalls) return;

    const currentState = courseState.phases[mountedPhase.id] || mountedPhase.getInitialState();
    const nextState = mountedPhase.handleToolCalls(currentState, toolCalls);
    courseState.phases[mountedPhase.id] = nextState;
    mountedPhase.mount({
        host: refs.canvas,
        state: nextState,
        onStateChange: (updatedState, message = 'Saved') => {
            courseState.phases[mountedPhase.id] = updatedState;
            saveState(message);
            updateMasteryProgress();
            renderNav();
            scheduleQuestionHelpRefresh(mountedPhase.id);
        }
    });
    addQuestionHelpButtons(mountedPhase.id, nextState);
    saveState('Tool updates applied');
}

function getLessonKey(stageId, lessonId) {
    return `${stageId}::${lessonId}`;
}

function recordAdaptiveAttempt({ stageId, lessonId, competencyId, isCorrect, source = 'unknown', confidence = null, score = null, model = null }) {
    if (!stageId || !lessonId) return null;

    const lessonKey = getLessonKey(stageId, lessonId);
    const row = courseState.adaptive.lessonMastery[lessonKey] || {
        stageId,
        lessonId,
        competencyId: competencyId || null,
        attempts: 0,
        correct: 0,
        recentResults: [],
        attemptLog: [],
        mastered: false,
        updatedAt: Date.now()
    };

    if (!Array.isArray(row.attemptLog)) {
        row.attemptLog = [];
    }

    row.attempts += 1;
    if (isCorrect) row.correct += 1;
    row.competencyId = competencyId || row.competencyId;
    row.recentResults = [...row.recentResults, Boolean(isCorrect)].slice(-20);
    row.attemptLog = [...row.attemptLog, {
        ts: Date.now(),
        isCorrect: Boolean(isCorrect),
        source,
        confidence: typeof confidence === 'number' ? confidence : null,
        score: typeof score === 'number' ? score : null,
        model: typeof model === 'string' && model ? model : null
    }].slice(-25);

    const evaluation = evaluateLessonMastery(row, courseState.adaptive.policy);
    row.mastered = evaluation.passed;
    row.updatedAt = Date.now();

    courseState.adaptive.lessonMastery[lessonKey] = row;
    saveState(row.mastered ? 'Lesson mastered' : 'Attempt recorded');
    return { lessonKey, row: { ...row }, evaluation };
}

function getAdaptiveLessonRow(stageId, lessonId) {
    if (!stageId || !lessonId) return null;
    return courseState.adaptive.lessonMastery[getLessonKey(stageId, lessonId)] || null;
}

function applyPersistedTheme() {
    const pref = localStorage.getItem('chemistry_darkmode');
    const darkEnabled = pref === null || pref === 'true';
    document.documentElement.classList.toggle('dark', darkEnabled);
    syncThemeButton(darkEnabled);
}

function syncThemeButton(darkEnabled = document.documentElement.classList.contains('dark')) {
    const darkBtn = document.getElementById('btn-darkmode');
    if (!darkBtn) return;

    darkBtn.classList.toggle('is-active', darkEnabled);
    darkBtn.setAttribute('aria-pressed', darkEnabled ? 'true' : 'false');
    darkBtn.setAttribute('title', darkEnabled ? 'Switch to light mode' : 'Switch to dark mode');
    const icon = darkBtn.querySelector('i');
    if (icon) {
        icon.className = darkEnabled ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        icon.setAttribute('aria-hidden', 'true');
    }
}

function closeSettingsModal() {
    if (cmrLiteRtSetupStatusListener) {
        window.removeEventListener('gnosys-litert-setup-status', cmrLiteRtSetupStatusListener);
        cmrLiteRtSetupStatusListener = null;
    }
    const modal = document.getElementById('cmr-settings-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.classList.remove('cmr-reset-modal-open');
}

function isStandaloneRefresherShellPresent() {
    return Boolean(
        document.getElementById('cmr-settings-modal') &&
        document.getElementById('cmr-phase-nav') &&
        document.getElementById('cmr-phase-canvas')
    );
}

async function openSettingsModal() {
    const modal = document.getElementById('cmr-settings-modal');
    if (!modal) {
        return;
    }

    const card = modal.querySelector('.cmr-settings-card');
    const selectEl = document.getElementById('cmr-settings-model-select');
    const bypassToggle = document.getElementById('cmr-settings-bypass-toggle');
    const offlineMsg = document.getElementById('cmr-settings-model-status');
    const actionStatus = document.getElementById('cmr-settings-model-action-status');

    if (!selectEl || !bypassToggle || !offlineMsg) {
        return;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('cmr-reset-modal-open');
    bypassToggle.checked = localStorage.getItem('chemistry_curriculum_bypass') === 'true';
    offlineMsg.classList.add('hidden');

    const setModelActionStatus = ({ state = 'idle', message = '' } = {}) => {
        if (!actionStatus) return;
        actionStatus.textContent = message || 'Ready to switch models or start download.';
        actionStatus.classList.remove('hidden');
        if (state === 'working') {
            actionStatus.style.color = '#d97706';
        } else if (state === 'success' || state === 'info') {
            actionStatus.style.color = '#059669';
        } else if (state === 'error') {
            actionStatus.style.color = '#dc2626';
        } else {
            actionStatus.style.color = '';
        }
    };

    if (cmrLiteRtSetupStatusListener) {
        window.removeEventListener('gnosys-litert-setup-status', cmrLiteRtSetupStatusListener);
    }
    cmrLiteRtSetupStatusListener = (event) => {
        const detail = event?.detail;
        if (!detail || typeof detail.message !== 'string') return;
        setModelActionStatus(detail);
    };
    window.addEventListener('gnosys-litert-setup-status', cmrLiteRtSetupStatusListener);

    const currentModel = typeof window.getGnosysModel === 'function'
        ? window.getGnosysModel('chemistry_llm')
        : (localStorage.getItem('gnosys_active_llm') || localStorage.getItem('chemistry_llm') || 'gemma4:e4b');
    const endpoint = (localStorage.getItem('chemistry_ollama_endpoint') || '')
        .replace('/api/chat', '')
        .replace('/api/generate', '');

    if (typeof window.populateModelSelector === 'function') {
        const online = await window.populateModelSelector(selectEl, currentModel, endpoint, {
            onStatusChange: setModelActionStatus,
        });
        if (!online) {
            offlineMsg.classList.remove('hidden');
        }
    } else {
        selectEl.innerHTML = '';
        const option = document.createElement('option');
        option.value = currentModel;
        option.textContent = currentModel;
        selectEl.appendChild(option);
        offlineMsg.textContent = 'Model list unavailable. Showing the saved selection only.';
        offlineMsg.classList.remove('hidden');
    }

    window.requestAnimationFrame(() => {
        card?.focus();
    });
}

function bindSettingsModal() {
    const modal = document.getElementById('cmr-settings-modal');
    const closeBtn = document.getElementById('cmr-settings-close');
    const doneBtn = document.getElementById('cmr-settings-done');
    const selectEl = document.getElementById('cmr-settings-model-select');
    const bypassToggle = document.getElementById('cmr-settings-bypass-toggle');

    if (!modal || !closeBtn || !doneBtn || !selectEl || !bypassToggle) return;

    closeBtn.addEventListener('click', closeSettingsModal);
    doneBtn.addEventListener('click', closeSettingsModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.classList.contains('cmr-settings-backdrop')) {
            closeSettingsModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSettingsModal();
        }
    });

    if (typeof window.populateModelSelector !== 'function') {
        selectEl.addEventListener('change', () => {
            const val = selectEl.value;
            if (!val || val === '__custom__') return;
            localStorage.setItem('gnosys_active_llm', val);
            localStorage.setItem('chemistry_llm', val);
        });
    }

    bypassToggle.addEventListener('change', () => {
        const enabled = bypassToggle.checked;
        localStorage.setItem('chemistry_curriculum_bypass', String(enabled));
        window.dispatchEvent(new CustomEvent('curriculumBypassChanged', { detail: { enabled } }));
    });
}

function bindHeaderControls() {
    if (!isStandaloneRefresherShellPresent()) return;

    const darkBtn = document.getElementById('btn-darkmode');
    if (darkBtn) {
        darkBtn.addEventListener('click', () => {
            const root = document.documentElement;
            root.classList.toggle('dark');
            const darkEnabled = root.classList.contains('dark');
            localStorage.setItem('chemistry_darkmode', String(darkEnabled));
            syncThemeButton(darkEnabled);
        });
    }

    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
}

function init() {
    applyPersistedTheme();
    refs.nav = document.getElementById('cmr-phase-nav');
    refs.canvas = document.getElementById('cmr-phase-canvas');
    refs.currentPhase = document.getElementById('cmr-current-phase');
    refs.saveState = document.getElementById('cmr-save-state');
    refs.resetScope = document.getElementById('cmr-reset-scope');
    refs.resetStatus = document.getElementById('cmr-reset-status');
    refs.resetStageBtn = document.getElementById('cmr-reset-stage-btn');
    refs.resetCourseBtn = document.getElementById('cmr-reset-course-btn');
    refs.resetUndoBtn = document.getElementById('cmr-reset-undo-btn');
    refs.resetModal = document.getElementById('cmr-reset-modal');
    refs.resetModalCard = document.querySelector('#cmr-reset-modal .cmr-reset-modal-card');
    refs.resetModalTitle = document.getElementById('cmr-reset-modal-title');
    refs.resetModalBody = document.getElementById('cmr-reset-modal-body');
    refs.resetModalConfirm = document.getElementById('cmr-reset-modal-confirm');
    refs.resetModalCancel = document.getElementById('cmr-reset-modal-cancel');
    refs.resetModalClose = document.getElementById('cmr-reset-modal-close');
    refs.resetToast = document.getElementById('cmr-reset-toast');
    refs.resetToastTitle = document.getElementById('cmr-reset-toast-title');
    refs.resetToastBody = document.getElementById('cmr-reset-toast-body');
    refs.resetToastRemaining = document.getElementById('cmr-reset-toast-remaining');
    refs.resetToastSeconds = document.getElementById('cmr-reset-toast-seconds');
    refs.resetToastBar = document.getElementById('cmr-reset-toast-bar');
    refs.progressBar = document.getElementById('cmr-progress-bar');
    refs.progressPercent = document.getElementById('cmr-progress-percent');

    bindSettingsModal();
    bindHeaderControls();

    if (!refs.nav || !refs.canvas) return;

    bindResetActions();
    loadState();
    updateMasteryProgress();
    setActivePhase(courseState.activePhase);
    updateCtas();
}

window.ChemMathRefresher = {
    init,
    updateCtas,
    notifyCompetencyAttempt,
    dispatchToolCalls,
    evaluateLessonMastery,
    validateChallengeItem,
    generateAdaptiveChallenge,
    gradeAdaptiveResponse,
    recordAdaptiveAttempt,
    getAdaptiveLessonRow,
    getAdaptiveSnapshot: () => JSON.parse(JSON.stringify(courseState.adaptive)),
    getQuestionCalculatorSnapshot: (phaseId, questionId) => readQuestionCalculatorState(phaseId, questionId),
    setQuestionCalculatorSnapshot: (phaseId, questionId, nextState) => {
        writeQuestionCalculatorState(phaseId, questionId, nextState);
        saveState('Calculator updated');
    },
    mapCalculatorKeyboard: (event) => mapKeyboardEventToCalculatorKey(event),
    reduceCalculatorState
};

window.addEventListener('DOMContentLoaded', init);
