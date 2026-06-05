/**
 * BI 232Z Mastery State Manager & Syllabus Parser
 * Sits in mastery.js acting as the global state, persistence coordinator, and backup utility.
 */

const STATE_LOCKED = 0;
const STATE_ACTIVE = 1;
const STATE_HW_PENDING = 2;
const STATE_MASTERED = 3;
const STATE_RUSTED = 4;
const CURRICULUM_BYPASS_KEY = 'anatomy2_curriculum_bypass';
const PROGRESS_RESET_MARKER_KEY = 'anatomy2_progress_reset_at';
const PROGRESS_RESET_EVENT = 'anatomy2ProgressReset';
const MASTERY_MATRIX_KEY = 'anatomy2_masteryMatrix';

const RUST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days

function isCurriculumBypassEnabled() {
    return localStorage.getItem(CURRICULUM_BYPASS_KEY) === 'true';
}

function setCurriculumBypassEnabled(enabled) {
    localStorage.setItem(CURRICULUM_BYPASS_KEY, String(Boolean(enabled)));
    window.dispatchEvent(new CustomEvent('curriculumBypassChanged', {
        detail: { enabled: Boolean(enabled) }
    }));
}

function toggleCurriculumBypass() {
    const next = !isCurriculumBypassEnabled();
    setCurriculumBypassEnabled(next);
    return next;
}

// Backup Utilities: Export and Import progress
function exportProgressionJSON() {
    const backupData = {
        course: 'anatomy2',
        timestamp: new Date().toISOString(),
        data: {
            [MASTERY_MATRIX_KEY]: localStorage.getItem(MASTERY_MATRIX_KEY),
            'anatomy2_gamification_xp': localStorage.getItem('anatomy2_gamification_xp'),
            'anatomy2_gamification_streak': localStorage.getItem('anatomy2_gamification_streak'),
            'anatomy2_gamification_achievements': localStorage.getItem('anatomy2_gamification_achievements'),
            'anatomy2_gamification_quests': localStorage.getItem('anatomy2_gamification_quests'),
            'anatomy2_gamification_stats': localStorage.getItem('anatomy2_gamification_stats'),
            [CURRICULUM_BYPASS_KEY]: localStorage.getItem(CURRICULUM_BYPASS_KEY)
        }
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `anatomy2_progress_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importProgressionJSON(fileEvent) {
    const fileReader = new FileReader();
    const file = fileEvent.target.files[0];
    if (!file) return;

    fileReader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.course !== 'anatomy2' || !parsed.data) {
                alert('Invalid backup file. Make sure this is an Anatomy & Physiology II (BI 232Z) backup.');
                return;
            }
            
            // Restore keys
            Object.keys(parsed.data).forEach(key => {
                if (parsed.data[key] !== null) {
                    localStorage.setItem(key, parsed.data[key]);
                }
            });
            
            alert('Progression successfully restored! Reloading page...');
            window.location.reload();
        } catch (err) {
            alert('Failed to parse the backup file: ' + err.message);
        }
    };
    fileReader.readAsText(file);
}

function resetAnatomyProgressData() {
    const protectedKeys = new Set(['anatomy2_darkmode', 'anatomy2_llm']);
    const exactKeysToRemove = new Set([
        MASTERY_MATRIX_KEY,
        CURRICULUM_BYPASS_KEY,
        'anatomy2_gamification_xp',
        'anatomy2_gamification_streak',
        'anatomy2_gamification_achievements',
        'anatomy2_gamification_quests',
        'anatomy2_gamification_stats'
    ]);
    const prefixesToRemove = [
        'anatomy2_lesson_lectures_',
        'anatomy2_lesson_lecture_',
        'anatomy2_lesson_active_lecture_idx_',
        'anatomy2_sandbox_complete_'
    ];

    const localKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) localKeys.push(key);
    }

    localKeys.forEach((key) => {
        if (protectedKeys.has(key)) return;
        if (exactKeysToRemove.has(key)) {
            localStorage.removeItem(key);
            return;
        }
        if (prefixesToRemove.some((prefix) => key.startsWith(prefix))) {
            localStorage.removeItem(key);
        }
    });

    sessionStorage.removeItem('activeLessonState');

    const resetMarker = String(Date.now());
    localStorage.setItem(PROGRESS_RESET_MARKER_KEY, resetMarker);

    window.dispatchEvent(new CustomEvent(PROGRESS_RESET_EVENT, {
        detail: { resetAt: resetMarker }
    }));
    window.dispatchEvent(new CustomEvent('masteryMatrixChanged', { detail: {} }));
    window.dispatchEvent(new CustomEvent('curriculumBypassChanged', { detail: { enabled: false } }));

    return true;
}

function showAnatomyResetToast(message) {
    const id = 'anatomy2-reset-toast';
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = 'fixed right-4 top-4 z-[9999] max-w-xs rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-800 shadow-lg backdrop-blur dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200';
    toast.innerHTML = '<i class="fa-solid fa-circle-check mr-1.5"></i>' + (message || 'Progress reset accepted. Reloading...');
    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('opacity-0');
    }, 600);
    window.setTimeout(() => {
        toast.remove();
    }, 1000);
}

function scheduleAnatomyResetReload(message, delayMs = 900) {
    if (window.__anatomyResetReloadScheduled) return;
    window.__anatomyResetReloadScheduled = true;
    showAnatomyResetToast(message || 'Progress reset accepted. Reloading...');
    window.setTimeout(() => {
        window.location.reload();
    }, delayMs);
}

function confirmAndResetAnatomyProgress() {
    const promptText = [
        'This will erase Anatomy & Physiology II progress across Study Dashboard, Coursework, and Homework Binder.',
        'Preserved: dark mode and selected model.',
        'Type RESET to continue.'
    ].join('\n');
    const typed = window.prompt(promptText, '');
    if (typed !== 'RESET') {
        if (typed !== null) {
            window.alert('Reset cancelled. Type RESET exactly to confirm.');
        }
        return false;
    }
    const ok = resetAnatomyProgressData();
    if (ok) {
        scheduleAnatomyResetReload('Progress reset accepted. Reloading module...');
    }
    return ok;
}

window.addEventListener('storage', (event) => {
    if (event.key === CURRICULUM_BYPASS_KEY) {
        window.dispatchEvent(new CustomEvent('curriculumBypassChanged', {
            detail: { enabled: event.newValue === 'true' }
        }));
        return;
    }

    if (event.key === PROGRESS_RESET_MARKER_KEY) {
        sessionStorage.removeItem('activeLessonState');
        window.dispatchEvent(new CustomEvent(PROGRESS_RESET_EVENT, {
            detail: { resetAt: event.newValue }
        }));
    }
});

function initMasteryMatrix(syllabus) {
    let matrix = localStorage.getItem(MASTERY_MATRIX_KEY);
    if (!matrix) {
        matrix = {};
        syllabus.modules.forEach(mod => {
            syllabus.lessonsByModule[mod.id].forEach(lesson => {
                matrix[lesson.id] = {
                    state: STATE_LOCKED,
                    masteredAt: null
                };
            });
        });
        
        if (syllabus.modules.length > 0 && syllabus.lessonsByModule[syllabus.modules[0].id].length > 0) {
            const firstLessonId = syllabus.lessonsByModule[syllabus.modules[0].id][0].id;
            matrix[firstLessonId] = {
                state: STATE_ACTIVE,
                masteredAt: null
            };
        }
        localStorage.setItem(MASTERY_MATRIX_KEY, JSON.stringify(matrix));
    } else {
        matrix = JSON.parse(matrix);
        let updated = false;
        Object.keys(matrix).forEach(id => {
            const item = matrix[id];
            if (item.state === STATE_MASTERED && item.masteredAt) {
                const elapsed = Date.now() - new Date(item.masteredAt).getTime();
                if (elapsed >= RUST_INTERVAL_MS) {
                    item.state = STATE_RUSTED;
                    updated = true;
                }
            }
        });
        if (updated) {
            localStorage.setItem(MASTERY_MATRIX_KEY, JSON.stringify(matrix));
        }
    }
    return matrix;
}

function updateLessonState(lessonId, newState) {
    const syllabus = window.syllabusData;
    let matrix = JSON.parse(localStorage.getItem(MASTERY_MATRIX_KEY) || '{}');
    
    if (!matrix[lessonId]) {
        matrix[lessonId] = { state: STATE_LOCKED, masteredAt: null };
    }
    
    matrix[lessonId].state = newState;
    if (newState === STATE_MASTERED) {
        matrix[lessonId].masteredAt = new Date().toISOString();
        unlockNextChronologicalLesson(lessonId, matrix, syllabus);
    } else {
        matrix[lessonId].masteredAt = null;
    }
    
    localStorage.setItem(MASTERY_MATRIX_KEY, JSON.stringify(matrix));
    window.dispatchEvent(new CustomEvent('masteryMatrixChanged', { detail: matrix }));
    updateGlobalProgress(matrix, syllabus);
}

function unlockNextChronologicalLesson(completedLessonId, matrix, syllabus) {
    if (!syllabus) return;
    
    let allLessonIds = [];
    syllabus.modules.forEach(mod => {
        syllabus.lessonsByModule[mod.id].forEach(l => {
            allLessonIds.push(l.id);
        });
    });
    
    const currentIndex = allLessonIds.indexOf(completedLessonId);
    if (currentIndex !== -1 && currentIndex < allLessonIds.length - 1) {
        const nextLessonId = allLessonIds[currentIndex + 1];
        if (!matrix[nextLessonId] || matrix[nextLessonId].state === STATE_LOCKED) {
            matrix[nextLessonId] = {
                state: STATE_ACTIVE,
                masteredAt: null
            };
        }
    }
}

function updateGlobalProgress(matrix, syllabus) {
    if (!syllabus) return;
    
    let totalLessons = 0;
    let masteredCount = 0;
    
    syllabus.modules.forEach(mod => {
        syllabus.lessonsByModule[mod.id].forEach(l => {
            totalLessons++;
            const status = matrix[l.id];
            if (status && (status.state === STATE_MASTERED || status.state === STATE_RUSTED)) {
                masteredCount++;
            }
        });
    });
    
    const percentage = totalLessons > 0 ? Math.round((masteredCount / totalLessons) * 100) : 0;
    
    const progressVal = document.getElementById('progress-val');
    const progressBar = document.getElementById('progress-bar');
    
    if (progressVal) progressVal.textContent = `${percentage}% Completed`;
    if (progressBar) progressBar.style.width = `${percentage}%`;
    
    const activeCountSpan = document.getElementById('sidebar-lesson-count');
    if (activeCountSpan) {
        activeCountSpan.textContent = `${masteredCount}/${totalLessons} Lessons`;
    }
}

function saveSessionState(lessonId, stageState, messageHistory) {
    const sessionData = {
        lessonId: lessonId,
        stageState: stageState,
        messageHistory: messageHistory
    };
    sessionStorage.setItem('activeLessonState', JSON.stringify(sessionData));
}

function getSessionState() {
    const cached = sessionStorage.getItem('activeLessonState');
    return cached ? JSON.parse(cached) : null;
}

function getHighestUnlockedLesson(matrix, syllabus) {
    if (!syllabus) return null;
    
    let allLessons = [];
    syllabus.modules.forEach(mod => {
        syllabus.lessonsByModule[mod.id].forEach(l => {
            allLessons.push(l);
        });
    });
    
    let activeLesson = allLessons.find(l => {
        const item = matrix[l.id];
        return item && (item.state === STATE_ACTIVE || item.state === STATE_HW_PENDING || item.state === STATE_RUSTED);
    });
    
    if (activeLesson) return activeLesson.id;
    
    let highestUnlocked = allLessons[0];
    for (let i = 0; i < allLessons.length; i++) {
        const item = matrix[allLessons[i].id];
        if (item && item.state > STATE_LOCKED) {
            highestUnlocked = allLessons[i];
        }
    }
    return highestUnlocked ? highestUnlocked.id : null;
}

async function loadSyllabus() {
    try {
        const response = await fetch('anatomy2_lesson_plan_BI232Z.md');
        if (!response.ok) throw new Error('Failed to load lesson plan file');
        const markdown = await response.text();
        
        const lines = markdown.split('\n');
        
        let modules = [];
        let lessonsByModule = {};
        
        let currentModule = null;
        let currentLesson = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('## Module ')) {
                const modText = line.replace('## Module ', '').trim();
                const splitIndex = modText.indexOf(':');
                const num = modText.slice(0, splitIndex).trim();
                const title = modText.slice(splitIndex + 1).trim();
                
                currentModule = {
                    id: `module_${num}`,
                    number: num,
                    title: title
                };
                modules.push(currentModule);
                lessonsByModule[currentModule.id] = [];
                currentLesson = null;
                continue;
            }
            
            if (line.startsWith('### Lesson ')) {
                const lesText = line.replace('### Lesson ', '').trim();
                const splitIndex = lesText.indexOf(':');
                const numStr = lesText.slice(0, splitIndex).trim();
                const titleStr = lesText.slice(splitIndex + 1).trim();
                
                currentLesson = {
                    id: `lesson_${numStr.replace('.', '_')}`,
                    numStr: numStr,
                    title: titleStr,
                    concept: '',
                    clinical_tie_in: '',
                    interactive_target: '',
                    feynman_prompt: ''
                };
                
                if (currentModule) {
                    lessonsByModule[currentModule.id].push(currentLesson);
                }
                continue;
            }
            
            if (currentLesson && line.startsWith('* **')) {
                if (line.includes('**Concept:**')) {
                    currentLesson.concept = line.split('**Concept:**')[1].trim();
                } else if (line.includes('**Clinical/Real-World Hook:**')) {
                    currentLesson.clinical_tie_in = line.split('**Clinical/Real-World Hook:**')[1].trim();
                } else if (line.includes('**Interactive Target:**')) {
                    currentLesson.interactive_target = line.split('**Interactive Target:**')[1].trim().replace(/`/g, '');
                } else if (line.includes('**Feynman Prompt:**')) {
                    currentLesson.feynman_prompt = line.split('**Feynman Prompt:**')[1].trim().replace(/"/g, '');
                }
            }
        }
        
        const syllabus = { modules, lessonsByModule };
        window.syllabusData = syllabus;
        return syllabus;
        
    } catch (e) {
        console.error('Error loading or parsing syllabus:', e);
        return null;
    }
}

function getLessonStateMeta(state) {
    switch (state) {
        case STATE_LOCKED:
            return {
                icon: 'fa-lock text-slate-600',
                btnClass: 'text-slate-500 hover:text-slate-400 cursor-not-allowed bg-slate-900/40 p-2.5 rounded border border-slate-950 flex items-center justify-between',
                badgeText: 'LOCKED',
                badgeClass: 'bg-slate-900 border border-slate-800 text-slate-500'
            };
        case STATE_ACTIVE:
            return {
                icon: 'fa-graduation-cap text-rose-500',
                btnClass: 'text-rose-400 hover:bg-slate-850 bg-slate-850 p-2.5 rounded border border-rose-500/20 flex items-center justify-between shadow-inner',
                badgeText: 'ACTIVE',
                badgeClass: 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
            };
        case STATE_HW_PENDING:
            return {
                icon: 'fa-file-signature text-blue-400',
                btnClass: 'text-blue-300 hover:bg-slate-850 bg-slate-900/80 p-2.5 rounded border border-blue-500/20 flex items-center justify-between',
                badgeText: 'HW PENDING',
                badgeClass: 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
            };
        case STATE_MASTERED:
            return {
                icon: 'fa-circle-check text-emerald-500',
                btnClass: 'text-slate-300 hover:text-white hover:bg-slate-850 bg-slate-900/60 p-2.5 rounded border border-emerald-500/10 flex items-center justify-between',
                badgeText: 'MASTERED',
                badgeClass: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-bold'
            };
        case STATE_RUSTED:
            return {
                icon: 'fa-triangle-exclamation text-amber-500',
                btnClass: 'text-amber-400 hover:bg-slate-850 bg-slate-900/90 p-2.5 rounded border border-amber-500/20 flex items-center justify-between',
                badgeText: 'RUSTED',
                badgeClass: 'bg-amber-500/10 border border-amber-500/30 text-amber-500'
            };
        default:
            return {};
    }
}

function renderSidebar(syllabus, matrix) {
    const targetCw = document.getElementById('sidebar-skill-tree');
    const targetAs = document.getElementById('assignment-list');
    const bypassEnabled = isCurriculumBypassEnabled();
    
    if (targetCw) {
        let html = '';
        syllabus.modules.forEach(mod => {
            const lessons = syllabus.lessonsByModule[mod.id];
            
            let isModuleActive = lessons.some(l => {
                const st = matrix[l.id] ? matrix[l.id].state : STATE_LOCKED;
                return st === STATE_ACTIVE || st === STATE_HW_PENDING || st === STATE_RUSTED;
            });
            
            if (mod.id === 'module_1' && lessons.every(l => !matrix[l.id] || matrix[l.id].state === STATE_LOCKED)) {
                isModuleActive = true;
            }

            html += `
            <div class="border border-slate-850 rounded overflow-hidden">
                <button onclick="this.nextElementSibling.classList.toggle('hidden')" class="w-full bg-slate-950 hover:bg-slate-900 text-left px-3 py-2.5 flex items-center justify-between text-xs font-bold font-mono tracking-wider border-b border-slate-855 select-none">
                    <span class="text-rose-455 leading-tight">M${mod.number}: ${mod.title}</span>
                    <i class="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
                </button>
                <div class="p-2 space-y-1 bg-slate-900/30 ${isModuleActive ? '' : 'hidden'}">
            `;
            
            lessons.forEach(l => {
                const st = matrix[l.id] ? matrix[l.id].state : STATE_LOCKED;
                const meta = getLessonStateMeta(st);
                const canSelectLesson = bypassEnabled || st > STATE_LOCKED;
                const displayMeta = (bypassEnabled && st === STATE_LOCKED)
                    ? {
                        icon: 'fa-compass text-rose-300',
                        btnClass: 'text-rose-200 hover:text-white hover:bg-slate-850 bg-slate-900/70 p-2.5 rounded border border-rose-500/25 flex items-center justify-between',
                        badgeText: 'EXPLORE',
                        badgeClass: 'bg-rose-500/10 border border-rose-500/35 text-rose-300'
                    }
                    : meta;
                
                html += `
                <button 
                    onclick="if(${canSelectLesson}) { selectLesson('${l.id}') } else { alert('This Anatomy & Physiology lecture is currently locked. Complete previous courseworks first!') }" 
                    class="w-full ${displayMeta.btnClass} transition group text-left" 
                    id="sidebar-item-${l.id}"
                >
                    <div class="flex items-center space-x-2.5 truncate mr-2">
                        <i class="fa-solid ${displayMeta.icon} shrink-0 w-4 text-center"></i>
                        <div class="truncate">
                            <span class="text-[10px] font-mono block text-slate-500 group-hover:text-slate-400">Lesson ${l.numStr}</span>
                            <span class="text-xs font-semibold block truncate leading-snug">${l.title}</span>
                        </div>
                    </div>
                    <span class="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded leading-none shrink-0 ${displayMeta.badgeClass}">${displayMeta.badgeText}</span>
                </button>
                `;
            });
            
            html += `
                </div>
            </div>
            `;
        });
        targetCw.innerHTML = html;
    }
    
    if (targetAs) {
        let html = '';
        syllabus.modules.forEach(mod => {
            const lessons = syllabus.lessonsByModule[mod.id];
            
            let hasUnlockedHomework = bypassEnabled || lessons.some(l => {
                const st = matrix[l.id] ? matrix[l.id].state : STATE_LOCKED;
                return st >= STATE_HW_PENDING;
            });

            html += `
            <div class="border border-slate-850 rounded overflow-hidden">
                <button onclick="this.nextElementSibling.classList.toggle('hidden')" class="w-full bg-slate-950 hover:bg-slate-900 text-left px-3 py-2 flex items-center justify-between text-xs font-bold font-mono tracking-wider border-b border-slate-850 select-none">
                    <span class="text-blue-400">M${mod.number} Homework Sheets</span>
                    <i class="fa-solid fa-chevron-down text-slate-500 text-[10px]"></i>
                </button>
                <div class="p-2 space-y-1 bg-slate-900/30 ${hasUnlockedHomework ? '' : 'hidden'}">
            `;
            
            lessons.forEach(l => {
                const st = matrix[l.id] ? matrix[l.id].state : STATE_LOCKED;
                const meta = getLessonStateMeta(st);
                const isHwLocked = !bypassEnabled && st < STATE_HW_PENDING;
                
                let buttonClass = 'p-2 rounded text-left w-full transition flex items-center justify-between ';
                let badgeTxt = meta.badgeText;
                let badgeCls = meta.badgeClass;
                
                if (isHwLocked) {
                    buttonClass += 'text-slate-500 bg-slate-900/40 border border-slate-950 cursor-not-allowed';
                    badgeTxt = 'LOCKED';
                    badgeCls = 'bg-slate-900 border border-slate-805 text-slate-600';
                } else if (st === STATE_HW_PENDING) {
                    buttonClass += 'text-blue-300 bg-slate-850 hover:bg-slate-800 border border-blue-500/20 shadow-inner';
                } else {
                    buttonClass += 'text-emerald-400 bg-slate-900/60 hover:bg-slate-850 border border-emerald-500/10';
                }
                
                html += `
                <button 
                    onclick="if(!${isHwLocked}) { selectAssignment('${l.id}') } else { alert('Theory not qualified. You must pass this lesson\\'s Socratic lecture and its Sandbox mapping before testing anatomy concepts!') }" 
                    class="${buttonClass}" 
                    id="assignment-item-${l.id}"
                >
                    <div class="truncate mr-2 flex items-center space-x-2">
                        <i class="fa-solid ${isHwLocked ? 'fa-lock text-slate-600' : 'fa-clipboard-question text-blue-400'} shrink-0 text-xs"></i>
                        <div class="truncate">
                            <span class="text-[9px] font-mono block text-slate-500">HW ${l.numStr}</span>
                            <span class="text-xs font-semibold block truncate leading-snug">${l.title}</span>
                        </div>
                    </div>
                    <span class="text-[8px] font-mono px-1 py-0.5 rounded leading-none shrink-0 ${badgeCls}">${badgeTxt}</span>
                </button>
                `;
            });
            
            html += `
                </div>
            </div>
            `;
        });
        targetAs.innerHTML = html;
    }
    
    highlightActiveInSidebar();
}

function highlightActiveInSidebar() {
    const session = getSessionState();
    if (!session) return;
    
    const activeId = session.lessonId;
    if (!activeId) return;
    
    const cwItem = document.getElementById(`sidebar-item-${activeId}`);
    if (cwItem) {
        cwItem.classList.add('ring-1', 'ring-rose-500', 'bg-slate-800/80');
    }
    const asItem = document.getElementById(`assignment-item-${activeId}`);
    if (asItem) {
        asItem.classList.add('ring-1', 'ring-blue-500', 'bg-slate-800/80');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const syllabus = await loadSyllabus();
    if (syllabus) {
        const matrix = initMasteryMatrix(syllabus);
        renderSidebar(syllabus, matrix);
        updateGlobalProgress(matrix, syllabus);
        window.dispatchEvent(new CustomEvent('syllabusLoaded', { detail: { syllabus, matrix } }));
    }
});

window.isCurriculumBypassEnabled = isCurriculumBypassEnabled;
window.setCurriculumBypassEnabled = setCurriculumBypassEnabled;
window.toggleCurriculumBypass = toggleCurriculumBypass;
window.resetAnatomyProgressData = resetAnatomyProgressData;
window.confirmAndResetAnatomyProgress = confirmAndResetAnatomyProgress;
window.PROGRESS_RESET_EVENT = PROGRESS_RESET_EVENT;
window.showAnatomyResetToast = showAnatomyResetToast;
window.scheduleAnatomyResetReload = scheduleAnatomyResetReload;
window.exportProgressionJSON = exportProgressionJSON;
window.importProgressionJSON = importProgressionJSON;
