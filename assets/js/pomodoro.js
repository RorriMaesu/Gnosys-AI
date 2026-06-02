// Global Persistent Pomodoro Focus Timer for Gnosys-AI Universal Study Suite
// Handles state, countdown ticking, multi-tab synchronization, browser notifications, sound alerts, and focus statistics.
// Includes expert-level loop-until-dismissed alarm suite (audio, tab title flash, fullscreen overlay, and haptics).

(function() {
    const POMODORO_COURSES = [
        { id: 'medical-terminology', title: 'Medical Terminology', icon: 'fa-staff-snake' },
        { id: 'intro-to-chemistry', title: 'Intro to Chemistry', icon: 'fa-flask-vial' },
        { id: 'chemistry-math-refresher', title: 'Chemistry Math Refresher', icon: 'fa-square-root-variable' },
        { id: 'clinical-mathematics', title: 'Clinical Mathematics', icon: 'fa-square-root-variable' },
        { id: 'psychology-care', title: 'Psychology & Care', icon: 'fa-brain' }
    ];

    // Local state tracking
    let localInterval = null;
    let alarmAudioInterval = null;
    let titleFlashInterval = null;
    let originalTitle = document.title;
    let timerExpanded = false;

    // Helper to determine relative paths for icon image or assets depending on depth
    function getRootPath() {
        const path = window.location.pathname;
        if (path.includes('/chemistry/math-refresher/')) {
            return '../../';
        } else if (path.includes('/syngnosia/') || path.includes('/chemistry/') || path.includes('/math/') || path.includes('/psychology/')) {
            return '../';
        }
        return './';
    }

    // Auto-detect current course based on URL path
    function detectCurrentCourse() {
        const path = window.location.pathname;
        if (path.includes('/syngnosia/')) {
            return 'medical-terminology';
        } else if (path.includes('/chemistry/math-refresher/')) {
            return 'chemistry-math-refresher';
        } else if (path.includes('/chemistry/')) {
            return 'intro-to-chemistry';
        } else if (path.includes('/math/')) {
            return 'clinical-mathematics';
        } else if (path.includes('/psychology/')) {
            return 'psychology-care';
        }
        return 'general';
    }

    // Retrieve global timer state from localStorage
    function getTimerState() {
        try {
            const stateStr = localStorage.getItem('study_pomodoro_state');
            if (stateStr) {
                return JSON.parse(stateStr);
            }
        } catch (e) {
            console.error('Failed to parse Pomodoro state:', e);
        }
        return {
            timeLeft: 25 * 60,
            maxTime: 25 * 60,
            isRunning: false,
            mode: 'focus',
            selectedCourseId: detectCurrentCourse(),
            targetTime: null,
            alarmActive: false,
            alarmMode: null
        };
    }

    // Save state to localStorage and trigger storage sync event
    function setTimerState(state) {
        localStorage.setItem('study_pomodoro_state', JSON.stringify(state));
    }

    // Load focus statistics
    function getFocusStats() {
        try {
            const stored = localStorage.getItem('study_hub_focus_stats');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    function saveFocusStats(stats) {
        localStorage.setItem('study_hub_focus_stats', JSON.stringify(stats));
        window.dispatchEvent(new Event('studyStatsUpdated'));
    }

    // Add styles to document head
    function injectStyles() {
        if (document.getElementById('pomodoro-global-styles')) return;

        const style = document.createElement('style');
        style.id = 'pomodoro-global-styles';
        style.textContent = `
            #floating-timer-widget {
                font-family: 'Inter', sans-serif;
            }
            .glass-card-pomo {
                background: rgba(15, 23, 42, 0.9);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            #timer-expanded-panel {
                transition: opacity 0.25s ease-out, transform 0.25s ease-out;
            }
            .animate-pulse-slow {
                animation: pulseSlow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            @keyframes pulseSlow {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.01); opacity: 0.96; }
            }
            @media (max-width: 640px) {
                #floating-timer-widget {
                    bottom: calc(1rem + env(safe-area-inset-bottom, 0px)) !important;
                    left: 1rem !important;
                    right: auto !important;
                }
                #timer-expanded-panel {
                    width: calc(100vw - 2rem) !important;
                    max-width: 320px !important;
                    position: fixed !important;
                    bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px)) !important;
                    left: 1rem !important;
                    z-index: 260 !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Construct and inject widget HTML
    function injectHTML() {
        if (document.getElementById('floating-timer-widget')) return;

        // Container
        const container = document.createElement('div');
        container.id = 'floating-timer-widget';
        container.className = 'fixed bottom-6 left-6 z-[250] flex flex-col-reverse items-start gap-3 transition-all duration-300 pointer-events-auto';

        // Collapsed Button
        const btn = document.createElement('button');
        btn.id = 'timer-toggle-btn';
        btn.className = 'w-14 h-14 rounded-full bg-slate-900/90 border border-indigo-500/30 text-white flex items-center justify-center shadow-2xl backdrop-blur-md hover:scale-105 transition-all relative group';
        btn.innerHTML = `
            <span id="timer-pulse-ring" class="absolute inset-0 rounded-full border border-indigo-500/40 scale-100 opacity-0 pointer-events-none"></span>
            <i class="fa-solid fa-clock text-xl text-indigo-400 group-hover:rotate-12 transition-transform"></i>
            <span id="timer-badge" class="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-[9px] font-extrabold text-white hidden">25m</span>
        `;
        container.appendChild(btn);

        // Expanded Panel
        const panel = document.createElement('div');
        panel.id = 'timer-expanded-panel';
        panel.className = 'hidden flex-col bg-slate-950/95 border border-white/10 rounded-2xl p-5 shadow-2xl w-80 max-w-sm fade-in backdrop-blur-lg';
        panel.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-xs uppercase tracking-widest text-slate-400 font-extrabold flex items-center gap-1.5">
                    <i class="fa-solid fa-hourglass-half text-indigo-400"></i> Focus Workspace
                </h3>
                <button id="timer-close-panel-btn" class="text-slate-500 hover:text-white transition-colors">
                    <i class="fa-solid fa-xmark text-xs"></i>
                </button>
            </div>
            
            <div class="flex items-center gap-4 py-2 border-b border-white/5 mb-3">
                <div class="relative w-20 h-20 flex items-center justify-center shrink-0">
                    <svg class="absolute w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r="34" class="stroke-slate-800 fill-none" stroke-width="4"></circle>
                        <circle cx="40" cy="40" r="34" class="stroke-indigo-500 fill-none transition-all duration-300" stroke-width="4" stroke-dasharray="213" stroke-dashoffset="0" id="timer-progress-ring"></circle>
                    </svg>
                    <span id="timer-display" class="text-base font-black text-white tracking-tight z-10">25:00</span>
                </div>
                <div class="flex-grow">
                    <span id="timer-mode-indicator" class="text-[9px] font-extrabold text-indigo-400 uppercase tracking-widest block mb-1">Focus Session Active</span>
                    <select id="timer-course-select" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-300">
                        <option value="general">General Focus</option>
                    </select>
                </div>
            </div>

            <div class="flex gap-2">
                <button id="timer-play" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all">
                    <i class="fa-solid fa-play"></i> Start
                </button>
                <button id="timer-pause" class="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-white/5 transition-all hidden">
                    <i class="fa-solid fa-pause"></i> Pause
                </button>
                <button id="timer-reset" class="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-white/5 transition-colors">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>
            </div>
        `;
        container.appendChild(panel);
        document.body.appendChild(container);

        // Populate Select Option list
        const select = document.getElementById('timer-course-select');
        let options = '<option value="general">General Study Focus</option>';
        POMODORO_COURSES.forEach(c => {
            options += `<option value="${c.id}">${c.title}</option>`;
        });
        select.innerHTML = options;

        // Floating Stats Button
        if (!document.getElementById('floating-stats-btn-container')) {
            const statsBtnContainer = document.createElement('div');
            statsBtnContainer.id = 'floating-stats-btn-container';
            statsBtnContainer.className = 'fixed bottom-6 right-6 z-[250] pointer-events-auto';
            statsBtnContainer.innerHTML = `
                <button id="stats-modal-trigger-btn" class="w-14 h-14 rounded-full bg-slate-900/90 border border-teal-500/30 text-white flex items-center justify-center shadow-2xl backdrop-blur-md hover:scale-105 transition-all group">
                    <i class="fa-solid fa-chart-simple text-xl text-teal-400 group-hover:scale-110 transition-transform"></i>
                </button>
            `;
            document.body.appendChild(statsBtnContainer);
        }

        // Stats Modal Overlay
        if (!document.getElementById('modal-stats')) {
            const modal = document.createElement('div');
            modal.id = 'modal-stats';
            modal.className = 'hidden fixed inset-0 z-[400] items-center justify-center p-4';
            modal.innerHTML = `
                <div id="stats-modal-backdrop" class="absolute inset-0 bg-black/65 backdrop-blur-sm"></div>
                <div class="glass-card-pomo w-full max-w-md rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-extrabold text-white flex items-center gap-2">
                            <i class="fa-solid fa-chart-line text-teal-400"></i> Study Metrics
                        </h2>
                        <button id="stats-modal-close-btn" class="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/5 transition-colors">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-slate-950/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center shadow-inner">
                            <span id="stat-total-focus" class="text-2xl font-black text-indigo-400">0.0 hrs</span>
                            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total Focus Time</span>
                        </div>
                        <div class="bg-slate-950/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center shadow-inner">
                            <span id="stat-streak" class="text-2xl font-black text-amber-400">3 Days</span>
                            <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Study Streak 🔥</span>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-xs uppercase tracking-widest text-slate-400 font-extrabold mb-3">Focus Hours by Module</h3>
                        <div id="stats-course-breakdown" class="space-y-2"></div>
                    </div>

                    <div class="flex justify-end mt-6 pt-4 border-t border-white/5">
                        <button id="stats-modal-close-btn-footer" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30">Close Stats</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Add toast container if missing
        if (!document.getElementById('toast-container')) {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'fixed bottom-6 right-6 z-[300] flex flex-col gap-3 max-w-sm pointer-events-none';
            document.body.appendChild(toastContainer);
        }
    }

    // Toggle panel view
    function toggleFloatingTimer() {
        const panel = document.getElementById('timer-expanded-panel');
        const btn = document.getElementById('timer-toggle-btn');
        if (!panel || !btn) return;

        timerExpanded = !timerExpanded;
        if (timerExpanded) {
            panel.classList.remove('hidden');
            panel.classList.add('flex');
            btn.classList.add('border-indigo-400');
        } else {
            panel.classList.add('hidden');
            panel.classList.remove('flex');
            btn.classList.remove('border-indigo-400');
        }
    }

    // Show/Close Metrics Modal
    function openStatsModal() {
        updateStatsView();
        const modal = document.getElementById('modal-stats');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeStatsModal() {
        const modal = document.getElementById('modal-stats');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    // Updates the breakdown metrics inside stats modal
    function updateStatsView() {
        const stats = getFocusStats();
        const statFocusText = document.getElementById('stat-total-focus');
        const statStreakText = document.getElementById('stat-streak');
        const breakdownContainer = document.getElementById('stats-course-breakdown');

        if (statFocusText) {
            let totalSeconds = 0;
            Object.values(stats).forEach(s => totalSeconds += s);
            statFocusText.textContent = `${(totalSeconds / 3600).toFixed(1)} hrs`;
        }

        if (statStreakText) {
            const streak = localStorage.getItem('study_streak_count') || '3';
            statStreakText.textContent = `${streak} Days`;
        }

        if (breakdownContainer) {
            let breakdownHTML = POMODORO_COURSES.map(c => {
                const seconds = stats[c.id] || 0;
                const hours = (seconds / 3600).toFixed(1);
                return `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/5 text-slate-200">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid ${c.icon} text-slate-400"></i>
                            <span class="text-xs font-semibold">${c.title}</span>
                        </div>
                        <span class="text-xs font-extrabold text-indigo-400">${hours} hrs</span>
                    </div>
                `;
            }).join('');

            const generalSeconds = stats['general'] || 0;
            const generalHours = (generalSeconds / 3600).toFixed(1);
            breakdownHTML += `
                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/5 text-slate-200">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-hourglass-half text-indigo-400"></i>
                        <span class="text-xs font-semibold">General Study Focus</span>
                    </div>
                    <span class="text-xs font-extrabold text-indigo-400">${generalHours} hrs</span>
                </div>
            `;
            breakdownContainer.innerHTML = breakdownHTML;
        }
    }

    // Alarm Sound Loops
    function startAlarmAudio() {
        if (alarmAudioInterval) return;
        playDoubleBeep();
        alarmAudioInterval = setInterval(playDoubleBeep, 1800);
    }

    function stopAlarmAudio() {
        if (alarmAudioInterval) {
            clearInterval(alarmAudioInterval);
            alarmAudioInterval = null;
        }
    }

    function playDoubleBeep() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // First chime
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start();
            osc1.stop(audioCtx.currentTime + 0.35);
            
            // Second chime delayed slightly
            setTimeout(() => {
                try {
                    const osc2 = audioCtx.createOscillator();
                    const gain2 = audioCtx.createGain();
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
                    gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
                    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
                    osc2.connect(gain2);
                    gain2.connect(audioCtx.destination);
                    osc2.start();
                    osc2.stop(audioCtx.currentTime + 0.35);
                } catch (e) {}
            }, 180);
        } catch (e) {
            console.warn('Audio alarm blocked by browser safety rules.');
        }
    }

    // Document Tab Title Flashing
    function startTabTitleFlash(mode) {
        if (titleFlashInterval) return;
        originalTitle = document.title;
        let showAlternate = false;
        const alertMsg = mode === 'focus' ? '🔔 SESSION FINISHED' : '☕ BREAK OVER';
        titleFlashInterval = setInterval(() => {
            document.title = showAlternate ? originalTitle : alertMsg;
            showAlternate = !showAlternate;
        }, 800);
    }

    function stopTabTitleFlash() {
        if (titleFlashInterval) {
            clearInterval(titleFlashInterval);
            titleFlashInterval = null;
            document.title = originalTitle;
        }
    }

    // Fullscreen Intervention Overlay
    function showDismissalOverlay(mode) {
        if (document.getElementById('pomodoro-alarm-overlay')) return;

        const isFocus = mode === 'focus';
        const accentGradient = isFocus ? 'from-amber-500 to-rose-600' : 'from-indigo-500 to-teal-500';
        const ringGlow = isFocus ? 'shadow-[0_0_50px_rgba(245,158,11,0.25)]' : 'shadow-[0_0_50px_rgba(99,102,241,0.25)]';
        const title = isFocus ? 'Focus Session Complete!' : 'Break Time Over!';
        const detail = isFocus ? 'Take a well-deserved 5-minute break.' : 'Ready to lock back into your study modules?';
        const button = isFocus ? 'Acknowledge & Rest' : 'Acknowledge & Focus';
        const icon = isFocus ? 'fa-mug-hot' : 'fa-brain';

        const overlay = document.createElement('div');
        overlay.id = 'pomodoro-alarm-overlay';
        overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/80 fade-in';
        overlay.innerHTML = `
            <div class="glass-card-pomo w-full max-w-md rounded-3xl p-8 border border-white/10 text-center relative overflow-hidden ${ringGlow} animate-pulse-slow">
                <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                
                <div class="w-20 h-20 rounded-full bg-gradient-to-br ${accentGradient} flex items-center justify-center mx-auto mb-6 border-4 border-white/10 shadow-lg">
                    <i class="fa-solid ${icon} text-3xl text-white"></i>
                </div>
                
                <h2 class="text-3xl font-black text-white mb-3 tracking-tight">${title}</h2>
                <p class="text-slate-300 text-sm mb-8 leading-relaxed">${detail}</p>
                
                <button id="pomodoro-alarm-dismiss-btn" class="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r ${accentGradient} hover:scale-[1.02] active:scale-[0.98] transition-all text-base shadow-lg shadow-indigo-600/20">
                    ${button}
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('pomodoro-alarm-dismiss-btn').addEventListener('click', dismissAlarm);
    }

    function removeDismissalOverlay() {
        const overlay = document.getElementById('pomodoro-alarm-overlay');
        if (overlay) overlay.remove();
    }

    // Trigger local elements of alarm suite
    function triggerLocalAlarm(mode) {
        startTabTitleFlash(mode);
        showDismissalOverlay(mode);
        
        // Audio: play if active tab
        if (!document.hidden) {
            startAlarmAudio();
        }

        // Haptics (Vibration API)
        if ('vibrate' in navigator) {
            const pattern = mode === 'focus' ? [300, 100, 300, 100, 300] : [150, 100, 150, 100, 150];
            navigator.vibrate(pattern);
        }
    }

    // Dismiss alarm (locally stops variables)
    function dismissLocalAlarm() {
        stopAlarmAudio();
        stopTabTitleFlash();
        removeDismissalOverlay();
    }

    // Centrally dismiss alarm state across all tabs
    function dismissAlarm() {
        dismissLocalAlarm();

        // Update state in localStorage so other tabs close the overlays too
        const state = getTimerState();
        state.alarmActive = false;
        state.alarmMode = null;
        setTimerState(state);
    }

    // Show HTML5 system browser notification
    function showBrowserNotification(title, message) {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            new Notification(title, { body: message, icon: getRootPath() + 'assets/GnosysAILogo.jpg' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body: message, icon: getRootPath() + 'assets/GnosysAILogo.jpg' });
                }
            });
        }
    }

    // Log focus second in stats using cross-tab safety guard to prevent double-logging
    function logFocusSecond(courseId) {
        const now = Date.now();
        const lastLog = parseInt(localStorage.getItem('pomodoro_last_log_time') || '0', 10);
        
        if (now - lastLog >= 900) {
            localStorage.setItem('pomodoro_last_log_time', now.toString());
            const stats = getFocusStats();
            if (!stats[courseId]) {
                stats[courseId] = 0;
            }
            stats[courseId]++;
            saveFocusStats(stats);
        }
    }

    // Updates visual representation of the widgets on the page
    function updateTimerUI(state) {
        const display = document.getElementById('timer-display');
        const modeIndicator = document.getElementById('timer-mode-indicator');
        const progressRing = document.getElementById('timer-progress-ring');
        const badge = document.getElementById('timer-badge');
        const btnPlay = document.getElementById('timer-play');
        const btnPause = document.getElementById('timer-pause');
        const select = document.getElementById('timer-course-select');
        const pulse = document.getElementById('timer-pulse-ring');
        
        const globalDisplay = document.getElementById('pomo-timer-display');
        const globalToggleBtn = document.getElementById('pomo-toggle-btn');

        // Correctly calculate current remaining seconds
        let secondsToShow = state.timeLeft;
        if (state.isRunning && state.targetTime) {
            secondsToShow = Math.max(0, Math.round((state.targetTime - Date.now()) / 1000));
        }

        const mins = Math.floor(secondsToShow / 60);
        const secs = secondsToShow % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (display) {
            display.textContent = timeStr;
        }

        if (globalDisplay) {
            globalDisplay.textContent = timeStr;
        }

        if (globalToggleBtn) {
            if (state.isRunning) {
                globalToggleBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                globalToggleBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        }

        if (modeIndicator) {
            modeIndicator.textContent = state.mode === 'focus' ? 'Focus Session Active' : 'Break Time Active';
        }

        if (select) {
            select.value = state.selectedCourseId;
        }

        if (progressRing) {
            const total = state.maxTime;
            const progress = (total - secondsToShow) / total;
            const offset = 213 - (progress * 213);
            progressRing.style.strokeDashoffset = offset;
        }

        if (badge) {
            badge.textContent = `${mins}m`;
            if (state.isRunning) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Toggle buttons visibility based on status
        if (state.isRunning) {
            if (btnPlay) btnPlay.classList.add('hidden');
            if (btnPause) btnPause.classList.remove('hidden');
            if (pulse) pulse.classList.add('animate-ping', 'opacity-100');
        } else {
            if (btnPlay) btnPlay.classList.remove('hidden');
            if (btnPause) btnPause.classList.add('hidden');
            if (pulse) pulse.classList.remove('animate-ping', 'opacity-100');
        }
    }

    // Handles ticking updates locally
    function startTicker() {
        if (localInterval) clearInterval(localInterval);
        
        localInterval = setInterval(() => {
            const state = getTimerState();
            
            if (!state.isRunning) {
                clearInterval(localInterval);
                updateTimerUI(state);
                return;
            }

            const now = Date.now();
            const delta = Math.round((state.targetTime - now) / 1000);

            if (delta <= 0) {
                // Phase completed
                clearInterval(localInterval);
                
                const finishedMode = state.mode;
                state.alarmActive = true;
                state.alarmMode = finishedMode;
                state.isRunning = false;
                state.targetTime = null;
                
                // Auto switch phase values for next session
                if (finishedMode === 'focus') {
                    state.mode = 'break';
                    state.timeLeft = 5 * 60;
                    state.maxTime = 5 * 60;
                    showBrowserNotification('Focus Session Complete!', 'Take a 5-minute break.');
                } else {
                    state.mode = 'focus';
                    state.timeLeft = 25 * 60;
                    state.maxTime = 25 * 60;
                    showBrowserNotification('Break Over!', 'Lock back into your learning.');
                }
                
                setTimerState(state);
                triggerLocalAlarm(finishedMode);
                updateTimerUI(state);
            } else {
                // Tick and log study focus metric
                if (state.mode === 'focus') {
                    logFocusSecond(state.selectedCourseId);
                }
                updateTimerUI(state);
            }
        }, 1000);
    }

    // Event Actions
    function handlePlay() {
        const state = getTimerState();
        if (state.isRunning) return;

        state.isRunning = true;
        state.targetTime = Date.now() + (state.timeLeft * 1000);
        setTimerState(state);
        
        updateTimerUI(state);
        startTicker();
    }

    function handlePause() {
        const state = getTimerState();
        if (!state.isRunning) return;

        // Compute remaining seconds before pausing
        const remaining = Math.max(0, Math.round((state.targetTime - Date.now()) / 1000));
        state.isRunning = false;
        state.timeLeft = remaining;
        state.targetTime = null;
        setTimerState(state);

        updateTimerUI(state);
        if (localInterval) clearInterval(localInterval);
    }

    function handleReset() {
        const state = getTimerState();
        state.isRunning = false;
        state.targetTime = null;
        state.timeLeft = state.mode === 'focus' ? 25 * 60 : 5 * 60;
        setTimerState(state);

        updateTimerUI(state);
        if (localInterval) clearInterval(localInterval);
    }

    function handleCourseChange(e) {
        const state = getTimerState();
        state.selectedCourseId = e.target.value;
        setTimerState(state);
        updateTimerUI(state);
    }

    // Hooks up interactions to DOM elements
    function setupListeners() {
        const btnPlay = document.getElementById('timer-play');
        const btnPause = document.getElementById('timer-pause');
        const btnReset = document.getElementById('timer-reset');
        const select = document.getElementById('timer-course-select');
        const toggleBtn = document.getElementById('timer-toggle-btn');
        const closeBtn = document.getElementById('timer-close-panel-btn');
        const statsTrigger = document.getElementById('stats-modal-trigger-btn');
        const statsClose = document.getElementById('stats-modal-close-btn');
        const statsCloseFooter = document.getElementById('stats-modal-close-btn-footer');
        const statsBackdrop = document.getElementById('stats-modal-backdrop');
        const globalToggleBtn = document.getElementById('pomo-toggle-btn');

        if (btnPlay) btnPlay.addEventListener('click', handlePlay);
        if (btnPause) btnPause.addEventListener('click', handlePause);
        if (btnReset) btnReset.addEventListener('click', handleReset);
        if (select) select.addEventListener('change', handleCourseChange);
        if (toggleBtn) toggleBtn.addEventListener('click', toggleFloatingTimer);
        if (closeBtn) closeBtn.addEventListener('click', toggleFloatingTimer);

        if (globalToggleBtn) {
            globalToggleBtn.addEventListener('click', () => {
                const state = getTimerState();
                if (state.isRunning) {
                    handlePause();
                } else {
                    handlePlay();
                }
            });
        }
        
        if (statsTrigger) statsTrigger.addEventListener('click', openStatsModal);
        if (statsClose) statsClose.addEventListener('click', closeStatsModal);
        if (statsCloseFooter) statsCloseFooter.addEventListener('click', closeStatsModal);
        if (statsBackdrop) statsBackdrop.addEventListener('click', closeStatsModal);

        // Sync updates across open browser tabs in real-time
        window.addEventListener('storage', (event) => {
            if (event.key === 'study_pomodoro_state') {
                const newState = getTimerState();
                
                // Synchronize alarms state
                if (newState.alarmActive) {
                    triggerLocalAlarm(newState.alarmMode);
                } else {
                    dismissLocalAlarm();
                }

                updateTimerUI(newState);
                if (newState.isRunning) {
                    startTicker();
                } else {
                    if (localInterval) clearInterval(localInterval);
                }
            } else if (event.key === 'study_hub_focus_stats') {
                updateStatsView();
            }
        });
        
        // Also trigger sound on tab gain focus if alarm is active but was blocked/silent
        window.addEventListener('focus', () => {
            const state = getTimerState();
            if (state.alarmActive) {
                startAlarmAudio();
            }
        });
    }

    // Initialize Timer widget
    function init() {
        injectStyles();
        injectHTML();
        setupListeners();
        
        // Initial setup
        const state = getTimerState();
        
        // Auto-select course on load if user hasn't overridden it in the current run
        const currentDet = detectCurrentCourse();
        if (currentDet !== 'general' && state.selectedCourseId !== currentDet && !state.isRunning) {
            state.selectedCourseId = currentDet;
            setTimerState(state);
        }

        updateTimerUI(state);
        
        // Handle alarm if already active in state on page load/navigate
        if (state.alarmActive) {
            triggerLocalAlarm(state.alarmMode);
        } else if (state.isRunning) {
            startTicker();
        }
    }

    // Auto boot on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
