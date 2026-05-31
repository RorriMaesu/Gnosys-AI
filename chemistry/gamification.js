/* Chemistry Gamification Engine */

(function () {
    // ==========================================
    // GAMIFICATION CONSTANTS
    // ==========================================
    const LEVELS = [
        { level: 1,  title: 'Chemistry Novice',           xpRequired: 0      },
        { level: 2,  title: 'Lab Assistant',              xpRequired: 200    },
        { level: 3,  title: 'Balancer of Beakers',        xpRequired: 500    },
        { level: 4,  title: 'Stoichiometry Apprentice',   xpRequired: 1000   },
        { level: 5,  title: 'Molar Master',               xpRequired: 1800   },
        { level: 6,  title: 'Valency Victor',             xpRequired: 3000   },
        { level: 7,  title: 'Kinetics Intern',            xpRequired: 4800   },
        { level: 8,  title: 'Acid-Base Analyst',          xpRequired: 7200   },
        { level: 9,  title: 'Thermodynamics Fellow',      xpRequired: 10500  },
        { level: 10, title: 'Organic Synthesis Scholar',   xpRequired: 15000  },
        { level: 11, title: 'Quantum Chemist',            xpRequired: 21000  },
        { level: 12, title: 'Lab Supervisor',             xpRequired: 29000  },
        { level: 13, title: 'Department Chair',            xpRequired: 40000  },
        { level: 14, title: 'Distinguished Professor',    xpRequired: 56000  },
        { level: 15, title: 'Nobel Laureate',             xpRequired: 78000  },
        { level: 16, title: 'Alchemical Adept',           xpRequired: 108000 },
        { level: 17, title: 'Master of Matter',            xpRequired: 150000 },
    ];

    const ACHIEVEMENTS = [
        { id: 'first_nomen',       label: 'First Nomenclature',   desc: 'Rate your first Nomenclature card',               icon: 'fa-solid fa-layer-group',       xp: 15,   color: '#f59e0b' },
        { id: 'first_lab',         label: 'Safety First',         desc: 'Submit first correct Lab measurement',            icon: 'fa-solid fa-scale-balanced',    xp: 15,   color: '#10b981' },
        { id: 'first_molar',       label: "Avogadro's Ally",      desc: 'Calculate first correct molar mass',              icon: 'fa-solid fa-cubes',             xp: 15,   color: '#3b82f6' },
        { id: 'first_da',          label: 'Dimensional Pioneer',  desc: 'Perform first dimensional analysis conversion',   icon: 'fa-solid fa-ruler-combined',    xp: 15,   color: '#8b5cf6' },
        { id: 'first_stoich',      label: 'Stoichiometric Spark', desc: 'Balance first chemical equation correctly',       icon: 'fa-solid fa-flask',             xp: 15,   color: '#ef4444' },
        { id: 'first_sigfigs',     label: 'Sig Fig Scholar',      desc: 'Submit first correct Significant Figures answer', icon: 'fa-solid fa-bullseye',          xp: 15,   color: '#ec4899' },
        { id: 'first_video',       label: 'Video Analyst',        desc: 'Complete first Crash Course video quiz',          icon: 'fa-solid fa-play',              xp: 20,   color: '#14b8a6' },
        { id: 'first_tutor',       label: "Prof's Apprentice",    desc: 'Ask Prof. Beaker first question',                 icon: 'fa-solid fa-robot',             xp: 10,   color: '#6366f1' },
        { id: 'lesson_mastered',   label: 'Feynman Elite',        desc: 'Master a Coursework Lesson',                      icon: 'fa-solid fa-graduation-cap',    xp: 50,   color: '#f59e0b' },
        { id: 'perfect_assignment',label: 'A+ Student',           desc: 'Get 100% on any Homework Binder assignment',      icon: 'fa-solid fa-award',             xp: 40,   color: '#10b981' },
        { id: 'rising_chemist',    label: 'Rising Chemist',       desc: 'Reach Level 5 — Molar Master',                    icon: 'fa-solid fa-star-half-stroke',  xp: 50,   color: '#a855f7' },
        { id: 'lab_specialist',    label: 'Lab Specialist',       desc: 'Reach Level 6 — Valency Victor',                  icon: 'fa-solid fa-flask-vial',        xp: 75,   color: '#06b6d4' },
        { id: 'quantum_master',    label: 'Quantum Master',       desc: 'Reach Level 11 — Attending Quantum Chemist',      icon: 'fa-solid fa-crown',             xp: 200,  color: '#ef4444' },
        { id: 'habit_3',           label: 'Three-Day Reaction',   desc: '3-day study streak',                              icon: 'fa-solid fa-fire',              xp: 30,   color: '#f97316' },
        { id: 'week_warrior',      label: 'Catalyst',             desc: '7-day study streak',                              icon: 'fa-solid fa-fire-flame-curved', xp: 50,   color: '#ef4444' },
        { id: 'monthly_devotion',  label: 'Chemical Equilibrium', desc: '30-day study streak',                             icon: 'fa-solid fa-calendar-check',    xp: 150,  color: '#8b5cf6' },
        { id: 'comeback',          label: 'Comeback Catalyst',    desc: 'Return after a 3+ day absence',                   icon: 'fa-solid fa-rotate-right',      xp: 20,   color: '#14b8a6' },
        { id: 'dedicated',         label: 'Dedicated Lab Partner',desc: 'Complete all daily quests 7 days running',        icon: 'fa-solid fa-calendar-days',     xp: 100,  color: '#8b5cf6' },
    ];

    const QUEST_TEMPLATES = [
        { id: 'review_nomen',    category: 'volume',      label: 'Review 5 Nomenclature cards',          target: 5,  xpReward: 20, field: 'nomenclatureReviews' },
        { id: 'correct_lab',     category: 'volume',      label: 'Record 3 correct lab measurements',    target: 3,  xpReward: 25, field: 'correctLabReadings' },
        { id: 'solve_sigfigs',   category: 'volume',      label: 'Solve 3 Sig Fig problems',             target: 3,  xpReward: 20, field: 'sigFigsSolved' },
        { id: 'calc_molar',      category: 'volume',      label: 'Calculate 3 molar masses',             target: 3,  xpReward: 20, field: 'molarMassCalculated' },
        { id: 'balance_eqn',     category: 'volume',      label: 'Balance 2 chemical equations',         target: 2,  xpReward: 30, field: 'equationsBalanced' },
        { id: 'watch_video',     category: 'exploration', label: 'Watch 1 chemistry video & quiz',       target: 1,  xpReward: 20, field: 'videosWatched' },
        { id: 'master_lesson',   category: 'mastery',     label: 'Master 1 Coursework lesson',           target: 1,  xpReward: 50, field: 'lessonsMastered' },
        { id: 'complete_hw',     category: 'mastery',     label: 'Complete 1 homework assignment',       target: 1,  xpReward: 40, field: 'assignmentsCompleted' },
        { id: 'tutor_ask',       category: 'exploration', label: 'Ask Prof. Beaker 3 questions',         target: 3,  xpReward: 20, field: 'tutorMessages' },
        { id: 'do_da_conversion',category: 'volume',      label: 'Perform 3 dimensional conversions',    target: 3,  xpReward: 25, field: 'conversionsCompleted' },
    ];

    // ==========================================
    // INITIALIZATION & STATE MANAGEMENT
    // ==========================================
    let xpData = { total: 0, level: 1, dailyXP: {}, dailyFcXP: {}, dailyActivities: {}, streakShields: 0, questCompleteDates: [] };
    let streakData = { lastDate: '', count: 0, newLearned: 0, shields: 0 };
    let achievementsData = { unlocked: [], unlockedDates: {} };
    let dailyQuestsData = { date: '', quests: [] };
    let statsData = {
        nomenclatureReviews: 0,
        correctLabReadings: 0,
        sigFigsSolved: 0,
        molarMassCalculated: 0,
        conversionsCompleted: 0,
        equationsBalanced: 0,
        videosWatched: 0,
        lessonsMastered: 0,
        assignmentsCompleted: 0,
        tutorMessages: 0,
        lastEncounteredGrades: {}
    };

    let sessionXP = 0;

    function saveXPData() { localStorage.setItem('chemistry_gamification_xp', JSON.stringify(xpData)); }
    function saveStreakData() { localStorage.setItem('chemistry_gamification_streak', JSON.stringify(streakData)); }
    function saveAchievements() { localStorage.setItem('chemistry_gamification_achievements', JSON.stringify(achievementsData)); }
    function saveDailyQuests() { localStorage.setItem('chemistry_gamification_quests', JSON.stringify(dailyQuestsData)); }
    function saveStats() { localStorage.setItem('chemistry_gamification_stats', JSON.stringify(statsData)); }

    function loadGamificationData() {
        const savedXP = localStorage.getItem('chemistry_gamification_xp');
        if (savedXP) xpData = JSON.parse(savedXP);

        const savedStreak = localStorage.getItem('chemistry_gamification_streak');
        if (savedStreak) streakData = JSON.parse(savedStreak);

        const savedAch = localStorage.getItem('chemistry_gamification_achievements');
        if (savedAch) achievementsData = JSON.parse(savedAch);

        const savedQuests = localStorage.getItem('chemistry_gamification_quests');
        if (savedQuests) dailyQuestsData = JSON.parse(savedQuests);

        const savedStats = localStorage.getItem('chemistry_gamification_stats');
        if (savedStats) statsData = JSON.parse(savedStats);

        const today = new Date().toDateString();
        if (dailyQuestsData.date !== today) generateDailyQuests();
    }

    function checkStreakOnLoad() {
        const today = new Date().toDateString();
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (streakData.lastDate) {
            if (streakData.lastDate === today) {
                // Streak already checked today
            } else if (streakData.lastDate === yesterdayStr) {
                // Consecutive study day!
                streakData.count += 1;
                streakData.lastDate = today;
                saveStreakData();
            } else {
                // Streak is broken, check for shield protection
                if (xpData.streakShields > 0) {
                    xpData.streakShields--;
                    saveXPData();
                    streakData.lastDate = today; // preserve count via shield
                    saveStreakData();
                } else {
                    // Check if comeback (>=3 days absence)
                    const lastDate = new Date(streakData.lastDate);
                    const diffDays = Math.floor((new Date(today) - lastDate) / 86400000);
                    if (diffDays >= 3) {
                        setTimeout(() => checkAchievements('comeback', {}), 600);
                    }
                    streakData.count = 1;
                    streakData.lastDate = today;
                    saveStreakData();
                }
            }
        } else {
            // First time ever study day!
            streakData.count = 1;
            streakData.lastDate = today;
            saveStreakData();
        }

        checkStreakMilestones(streakData.count);
    }

    function checkStreakMilestones(count) {
        const milestones = [
            { days: 3, id: 'habit_3' },
            { days: 7, id: 'week_warrior' },
            { days: 30, id: 'monthly_devotion' }
        ];

        milestones.forEach(m => {
            if (count >= m.days) checkAchievements('streak_milestone', { id: m.id });
        });

        // Grant streak shields at milestones
        const shieldMilestones = [7, 30];
        if (shieldMilestones.includes(count)) {
            xpData.streakShields = Math.min(3, (xpData.streakShields || 0) + 1);
            saveXPData();
        }

        milestones.forEach(m => {
            if (count === m.days) unlockAchievement(m.id);
        });
    }

    function getStreakMultiplier() {
        const count = streakData.count || 0;
        if (count >= 100) return 2.0;
        if (count >= 30) return 1.5;
        if (count >= 7) return 1.25;
        return 1.0;
    }

    function getDailyFcXP() {
        const today = new Date().toDateString();
        return (xpData.dailyFcXP && xpData.dailyFcXP[today]) || 0;
    }

    // ==========================================
    // CORE GAMIFICATION TRIGGERS
    // ==========================================
    function awardXP(baseAmount, source) {
        if (baseAmount <= 0) return 0;
        const today = new Date().toDateString();

        let amount = baseAmount;
        // Soft cap for flashcards (nomenclature)
        if (source === 'flashcard') {
            const fcToday = getDailyFcXP();
            if (fcToday >= 250) {
                amount = Math.round(baseAmount * 0.5);
            }
            xpData.dailyFcXP = xpData.dailyFcXP || {};
            xpData.dailyFcXP[today] = (xpData.dailyFcXP[today] || 0) + amount;
        }

        // Streak multiplier
        const mult = getStreakMultiplier();
        amount = Math.round(amount * mult);

        // Interleaving activity bonus (+15% per unique activity today)
        xpData.dailyActivities = xpData.dailyActivities || {};
        const todayActs = xpData.dailyActivities[today] || [];
        if (!todayActs.includes(source)) todayActs.push(source);
        xpData.dailyActivities[today] = todayActs;
        const interleavingBonus = Math.max(0, todayActs.length - 1) * 0.15;
        if (interleavingBonus > 0) amount = Math.round(amount * (1 + interleavingBonus));

        // Add to total
        xpData.total = (xpData.total || 0) + amount;
        xpData.dailyXP = xpData.dailyXP || {};
        xpData.dailyXP[today] = (xpData.dailyXP[today] || 0) + amount;
        sessionXP += amount;

        // Check levels
        const oldLevel = xpData.level || 1;
        checkLevelUp(oldLevel);

        saveXPData();
        updateUI();
        showXPGain(amount, mult > 1 ? mult : null);
        return amount;
    }

    function getLevelFromXP(total) {
        let lvl = LEVELS[0];
        for (const l of LEVELS) {
            if (total >= l.xpRequired) lvl = l;
            else break;
        }
        return lvl;
    }

    function checkLevelUp(oldLevel) {
        const newLvlObj = getLevelFromXP(xpData.total);
        xpData.level = newLvlObj.level;
        if (newLvlObj.level > oldLevel) {
            showLevelUpModal(oldLevel, newLvlObj);
            checkAchievements('level_up', { level: newLvlObj.level });
        }
    }

    function generateDailyQuests() {
        const today = new Date().toDateString();
        const volTemplates = QUEST_TEMPLATES.filter(q => q.category === 'volume');
        const mastTemplates = QUEST_TEMPLATES.filter(q => q.category === 'mastery');
        const expTemplates = QUEST_TEMPLATES.filter(q => q.category === 'exploration');

        const pick = arr => arr[Math.floor(Math.random() * arr.length)];

        dailyQuestsData = {
            date: today,
            quests: [
                { ...pick(volTemplates), current: 0, completed: false },
                { ...pick(mastTemplates), current: 0, completed: false },
                { ...pick(expTemplates), current: 0, completed: false },
            ]
        };
        saveDailyQuests();
    }

    function updateQuestProgress(field, increment) {
        if (!dailyQuestsData.quests) return;
        let anyCompleted = false;
        dailyQuestsData.quests.forEach(q => {
            if (q.field === field && !q.completed) {
                q.current = Math.min(q.target, q.current + increment);
                if (q.current >= q.target) {
                    q.completed = true;
                    anyCompleted = true;
                    awardXP(q.xpReward, 'quest');
                }
            }
        });

        if (anyCompleted) {
            const allDone = dailyQuestsData.quests.every(q => q.completed);
            if (allDone) awardXP(50, 'quest'); // daily bonus
            checkDedicatedQuestAchievement();
        }
        saveDailyQuests();
        renderQuestWidget();
    }

    function checkDedicatedQuestAchievement() {
        const today = new Date().toDateString();
        xpData.questCompleteDates = xpData.questCompleteDates || [];
        if (!xpData.questCompleteDates.includes(today)) {
            xpData.questCompleteDates.push(today);
            saveXPData();
        }
        if (xpData.questCompleteDates.length >= 7) {
            checkAchievements('dedicated_check', {});
        }
    }

    function updateStatsCounter(field, delta) {
        if (statsData[field] !== undefined) {
            statsData[field] += delta;
        } else {
            statsData[field] = delta;
        }
        saveStats();
        updateQuestProgress(field, delta);

        // Check associated achievements
        if (field === 'nomenclatureReviews') checkAchievements('first_nomen', {});
        if (field === 'correctLabReadings') checkAchievements('first_lab', {});
        if (field === 'molarMassCalculated') checkAchievements('first_molar', {});
        if (field === 'conversionsCompleted') checkAchievements('first_da', {});
        if (field === 'equationsBalanced') checkAchievements('first_stoich', {});
        if (field === 'sigFigsSolved') checkAchievements('first_sigfigs', {});
        if (field === 'videosWatched') checkAchievements('first_video', {});
        if (field === 'tutorMessages') checkAchievements('first_tutor', {});
        if (field === 'lessonsMastered') checkAchievements('lesson_mastered', {});
        if (field === 'assignmentsCompleted') checkAchievements('assignments_completed', {});
    }

    function checkAchievements(trigger, data) {
        const unlocked = achievementsData.unlocked || [];
        const has = id => unlocked.includes(id);

        switch (trigger) {
            case 'first_nomen':
                if (!has('first_nomen') && statsData.nomenclatureReviews >= 1) unlockAchievement('first_nomen');
                break;
            case 'first_lab':
                if (!has('first_lab') && statsData.correctLabReadings >= 1) unlockAchievement('first_lab');
                break;
            case 'first_molar':
                if (!has('first_molar') && statsData.molarMassCalculated >= 1) unlockAchievement('first_molar');
                break;
            case 'first_da':
                if (!has('first_da') && statsData.conversionsCompleted >= 1) unlockAchievement('first_da');
                break;
            case 'first_stoich':
                if (!has('first_stoich') && statsData.equationsBalanced >= 1) unlockAchievement('first_stoich');
                break;
            case 'first_sigfigs':
                if (!has('first_sigfigs') && statsData.sigFigsSolved >= 1) unlockAchievement('first_sigfigs');
                break;
            case 'first_video':
                if (!has('first_video') && statsData.videosWatched >= 1) unlockAchievement('first_video');
                break;
            case 'first_tutor':
                if (!has('first_tutor') && statsData.tutorMessages >= 1) unlockAchievement('first_tutor');
                break;
            case 'lesson_mastered':
                if (!has('lesson_mastered') && statsData.lessonsMastered >= 1) unlockAchievement('lesson_mastered');
                break;
            case 'perfect_assignment':
                if (!has('perfect_assignment')) unlockAchievement('perfect_assignment');
                break;
            case 'level_up':
                if (!has('rising_chemist') && data.level >= 5) unlockAchievement('rising_chemist');
                if (!has('lab_specialist') && data.level >= 6) unlockAchievement('lab_specialist');
                if (!has('quantum_master') && data.level >= 11) unlockAchievement('quantum_master');
                break;
            case 'comeback':
                if (!has('comeback')) unlockAchievement('comeback');
                break;
            case 'dedicated_check':
                if (!has('dedicated')) unlockAchievement('dedicated');
                break;
        }
    }

    function unlockAchievement(id) {
        if (achievementsData.unlocked.includes(id)) return;
        achievementsData.unlocked.push(id);
        achievementsData.unlockedDates[id] = new Date().toDateString();
        saveAchievements();

        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) {
            awardXP(ach.xp, 'achievement');
            showAchievementToast(ach);
        }
    }

    // ==========================================
    // UI ELEMENTS & INJECTION LOGIC
    // ==========================================
    function injectContainers() {
        if (!document.getElementById('xp-gain-container')) {
            const container = document.createElement('div');
            container.id = 'xp-gain-container';
            container.className = 'fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-[150]';
            document.body.appendChild(container);
        }

        if (!document.getElementById('achievement-toast-container')) {
            const container = document.createElement('div');
            container.id = 'achievement-toast-container';
            container.className = 'fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[150] flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }
    }

    function showXPGain(amount, multiplier) {
        const container = document.getElementById('xp-gain-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'xp-gain-anim';
        el.textContent = multiplier ? `+${amount} XP ×${multiplier}` : `+${amount} XP`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 1100);
    }

    function showAchievementToast(ach) {
        const container = document.getElementById('achievement-toast-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'achievement-toast pointer-events-auto bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-xs';
        el.innerHTML = `
            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background:${ach.color}22;border:2px solid ${ach.color}44">
                <i class="${ach.icon} text-lg" style="color:${ach.color}"></i>
            </div>
            <div class="min-w-0">
                <p class="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Achievement Unlocked!</p>
                <p class="text-sm font-extrabold text-gray-800 truncate">${ach.label}</p>
                <p class="text-[11px] text-gray-500 leading-snug">${ach.desc}</p>
            </div>`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4500);
    }

    function showLevelUpModal(oldLevel, newLvlObj) {
        // Remove existing modal if any
        const existing = document.getElementById('modal-levelup');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'modal-levelup';
        modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4';
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-fade-in">
                <!-- Level celebration badge -->
                <div class="w-20 h-20 bg-gradient-to-br from-amber-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-3xl font-black mx-auto mb-5 shadow-lg relative z-10 animate-bounce">
                    ${newLvlObj.level}
                </div>
                <h3 class="text-2xl font-black text-gray-800 dark:text-white leading-tight mb-1">Level Up!</h3>
                <p class="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">Rank Acquired</p>
                <p class="text-xl font-extrabold text-gray-800 dark:text-white mb-6">${newLvlObj.title}</p>
                <button id="levelup-close-btn" class="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-500/20">Excellent</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('levelup-close-btn').addEventListener('click', () => {
            modal.remove();
        });
    }

    function updateUI() {
        const lvlObj = getLevelFromXP(xpData.total);
        const nextLvl = LEVELS.find(l => l.level === lvlObj.level + 1);
        let pct = 100;
        if (nextLvl) {
            const range = nextLvl.xpRequired - lvlObj.xpRequired;
            const earned = xpData.total - lvlObj.xpRequired;
            pct = Math.min(100, Math.round((earned / range) * 100));
        }

        // Update elements in header (supports layout in multiple pages)
        const barEl = document.getElementById('xp-progress-bar-global');
        const textEl = document.getElementById('xp-header-text-global');
        const levelNum = document.getElementById('level-num-global');
        const levelTtl = document.getElementById('level-title-global');
        const streakEl = document.getElementById('streak-counter-global');
        const shieldEl = document.getElementById('shield-indicator-global');

        if (barEl) barEl.style.width = `${pct}%`;
        if (textEl) textEl.textContent = `${xpData.total.toLocaleString()} XP`;
        if (levelNum) levelNum.textContent = lvlObj.level;
        if (levelTtl) levelTtl.textContent = lvlObj.title.split(' ').slice(0, 2).join(' ');

        if (streakEl) streakEl.textContent = streakData.count;
        if (shieldEl) {
            if (xpData.streakShields > 0) {
                shieldEl.classList.remove('hidden');
                shieldEl.textContent = `🛡️${xpData.streakShields}`;
            } else {
                shieldEl.classList.add('hidden');
            }
        }

        // Update scoreboard values in Nomenclature SRS (if open)
        const nomenStreak = document.getElementById('nomen-streak-counter');
        const nomenXP = document.getElementById('nomen-xp-counter');

        if (nomenStreak) nomenStreak.innerHTML = `${streakData.count} <i class="fa-solid fa-fire text-base animate-pulse"></i>`;
        if (nomenXP) nomenXP.textContent = `${sessionXP} pts`;
    }

    function renderQuestWidget() {
        const listEl = document.getElementById('chem-quest-list');
        if (!listEl) return;

        if (!dailyQuestsData.quests || dailyQuestsData.quests.length === 0) {
            listEl.innerHTML = '<p class="text-xs text-gray-400">No quests today.</p>';
            return;
        }

        listEl.innerHTML = dailyQuestsData.quests.map(q => {
            const pct = Math.min(100, Math.round((q.current / q.target) * 100));
            const done = q.completed;
            return `<div class="flex items-center gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-0.5">
                        <span class="text-xs font-semibold ${done ? 'text-emerald-600 line-through dark:text-emerald-400' : 'text-gray-600 dark:text-slate-300'} truncate">${q.label}</span>
                        <span class="text-[10px] font-bold ${done ? 'text-emerald-500' : 'text-amber-500'} ml-2 shrink-0">${done ? '✓' : `${q.current}/${q.target}`} +${q.xpReward}XP</span>
                                 <div class="w-full h-1.5 bg-gray-100 dark:bg-gray-850 rounded-full overflow-hidden">
                        <div class="h-full ${done ? 'bg-emerald-400' : 'bg-amber-400'} rounded-full transition-all duration-500" style="width:${pct}%"></div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function injectHeaderElements() {
        // Headers look slightly different in dashboard, coursework, assignments, so we target selectors
        // We look for headers where we can safely insert the Level badge
        const headers = document.querySelectorAll('header div.max-w-7xl, header div.mx-auto, header');
        headers.forEach(header => {
            // Check if level badge is already injected
            if (header.querySelector('.global-level-badge')) return;

            // Find where to insert (usually next to the title or inside flex elements)
            const titleContainer = header.querySelector('[data-header-left]') || header.querySelector('.flex.items-center.gap-4, .flex.items-center.space-x-3');
            if (titleContainer) {
                const badge = document.createElement('div');
                badge.className = 'global-level-badge relative group cursor-pointer ml-1.5 xs:ml-3 shrink-0';
                badge.onclick = () => window.openStatsModal();
                badge.innerHTML = `
                    <div class="flex items-center gap-1.5 xs:gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full pl-1 pr-1 sm:pr-4 py-1 shadow-sm hover:border-amber-300 transition-colors">
                        <div class="w-7 h-7 xs:w-8 xs:h-8 rounded-full bg-gradient-to-br from-amber-400 to-emerald-600 flex items-center justify-center text-white text-xs xs:text-sm font-black shadow-inner shrink-0">
                            <span id="level-num-global">1</span>
                        </div>
                        <div class="hidden sm:flex flex-col">
                            <span id="level-title-global" class="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mt-0.5">Novice</span>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <div class="w-20 h-1.5 bg-gray-100 dark:bg-gray-850 rounded-full overflow-hidden">
                                    <div id="xp-progress-bar-global" class="h-full bg-amber-500 rounded-full transition-all duration-555" style="width: 0%"></div>
                                </div>
                                <span id="xp-header-text-global" class="text-[10px] font-bold text-amber-600 dark:text-amber-400">0 XP</span>
                            </div>
                        </div>
                    </div>
                `;
                titleContainer.appendChild(badge);
            }

            // Streak insertion
            const rightContainer = header.querySelector('[data-header-right]') || header.querySelector('.flex.items-center.gap-2, .flex.items-center.space-x-4');
            if (rightContainer && !rightContainer.querySelector('.global-streak-badge')) {
                // Insert streak badge
                const streakBadge = document.createElement('div');
                streakBadge.className = 'global-streak-badge flex items-center gap-1 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 text-orange-800 dark:text-orange-300 px-2 py-1.5 xs:px-3 xs:py-2 rounded-xl font-bold text-xs xs:text-sm shadow-sm border border-orange-200 dark:border-orange-900/30 whitespace-nowrap shrink-0';
                streakBadge.innerHTML = `
                    <i class="fa-solid fa-fire text-orange-500"></i>
                    <span id="streak-counter-global">0</span>
                    <span id="shield-indicator-global" class="hidden text-[10px] ml-0.5 opacity-90 font-mono"></span>
                `;

                rightContainer.insertBefore(streakBadge, rightContainer.firstChild);
            }
        });
    }

    function injectStatsModal() {
        const existing = document.getElementById('modal-stats');
        if (existing) return;

        const modal = document.createElement('div');
        modal.id = 'modal-stats';
        modal.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 hidden';
        modal.innerHTML = `
            <div class="bg-white dark:bg-[#1a1d27] border border-gray-200 dark:border-[#363a52] rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto custom-scroll shadow-2xl relative">
                <button onclick="window.closeStatsModal()" class="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                
                <h3 class="text-2xl font-black text-gray-800 dark:text-white mb-1">Your Lab Progress</h3>
                <p id="stats-level-text" class="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-6">Level 1 — Chemistry Novice</p>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-gray-50 dark:bg-[#13151e] border border-gray-100 dark:border-[#252836] rounded-2xl p-4">
                        <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Earned</span>
                        <p id="stats-total-xp" class="text-2xl font-black text-gray-800 dark:text-white mt-1">0 XP</p>
                    </div>
                    <div class="bg-gray-50 dark:bg-[#13151e] border border-gray-100 dark:border-[#252836] rounded-2xl p-4">
                        <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Current Streak</span>
                        <p class="text-2xl font-black text-orange-500 mt-1 flex items-center gap-1.5">
                            <span id="stats-streak-val">0</span> 🔥
                        </p>
                    </div>
                </div>

                <!-- Weekly XP Chart -->
                <div class="mb-6">
                    <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Weekly Activity (XP)</p>
                    <div id="stats-xp-chart" class="flex items-end justify-between h-20 gap-2 border-b border-gray-100 dark:border-slate-800 pb-1">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- Achievements Grid -->
                <div class="mb-6">
                    <div class="flex items-center gap-3 mb-3">
                        <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest shrink-0">Earned Badges</p>
                        <div class="flex-1 h-px bg-gray-100 dark:bg-slate-800"></div>
                    </div>
                    <div id="stats-badges" class="flex flex-wrap gap-2.5">
                        <!-- Badges are injected here -->
                    </div>
                </div>

                <!-- Stats details list -->
                <div>
                    <div class="flex items-center gap-3 mb-3">
                        <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest shrink-0">Detailed Statistics</p>
                        <div class="flex-1 h-px bg-gray-100 dark:bg-slate-800"></div>
                    </div>
                    <div id="stats-details-list" class="space-y-3.5 mt-2">
                        <!-- Statistics items are injected here -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function renderStatsModal() {
        const lvlObj = getLevelFromXP(xpData.total);
        document.getElementById('stats-level-text').textContent = `Level ${lvlObj.level} — ${lvlObj.title}`;
        document.getElementById('stats-total-xp').textContent = `${(xpData.total || 0).toLocaleString()} XP`;
        document.getElementById('stats-streak-val').textContent = streakData.count;

        // Weekly XP Chart
        const chart = document.getElementById('stats-xp-chart');
        if (chart) {
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days.push(d.toDateString());
            }
            const vals = days.map(d => (xpData.dailyXP && xpData.dailyXP[d]) || 0);
            const maxV = Math.max(...vals, 1);
            chart.innerHTML = days.map((d, i) => {
                const h = Math.max(4, Math.round((vals[i] / maxV) * 64));
                const today = new Date().toDateString();
                const isToday = d === today;
                return `<div class="flex-1 flex flex-col items-center gap-1">
                    <div class="w-full rounded-t-sm xp-chart-bar ${isToday ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-900/40'} transition-all" style="height:${h}px" title="${vals[i]} XP"></div>
                    <span class="text-[9px] text-gray-400">${['S','M','T','W','T','F','S'][new Date(d).getDay()]}</span>
                </div>`;
            }).join('');
        }

        // Achievements Badges Grid
        const badges = document.getElementById('stats-badges');
        if (badges) {
            badges.innerHTML = ACHIEVEMENTS.map(a => {
                const owned = achievementsData.unlocked.includes(a.id);
                return `<div title="${a.label}: ${a.desc} (${a.xp} XP)" class="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${owned ? 'badge-pulse opacity-100' : 'locked-badge'}" style="background:${a.color}22;border-color:${a.color}55">
                    <i class="${a.icon} text-sm" style="color:${owned ? a.color : '#9ca3af'}"></i>
                </div>`;
            }).join('');
        }

        // Detailed Stats Counters
        const detailsList = document.getElementById('stats-details-list');
        if (detailsList) {
            const rows = [
                { label: 'Nomenclature Card Reviews', value: statsData.nomenclatureReviews },
                { label: 'Correct Lab Readings', value: statsData.correctLabReadings },
                { label: 'Sig Figs Solved', value: statsData.sigFigsSolved },
                { label: 'Molar Mass Calculations', value: statsData.molarMassCalculated },
                { label: 'Stoichiometry Balanced', value: statsData.equationsBalanced },
                { label: 'Dimensional Conversions', value: statsData.conversionsCompleted },
                { label: 'Crash Course Videos Watched', value: statsData.videosWatched },
                { label: 'Lessons Mastered (Coursework)', value: statsData.lessonsMastered },
                { label: 'Assignments Completed (Binder)', value: statsData.assignmentsCompleted },
                { label: 'Prof. Beaker Chat Inquiries', value: statsData.tutorMessages },
            ];

            detailsList.innerHTML = rows.map(r => `
                <div class="flex justify-between items-center text-xs text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-slate-800 pb-1.5">
                    <span class="font-medium">${r.label}</span>
                    <span class="font-bold text-gray-800 dark:text-white font-mono">${r.value}</span>
                </div>
            `).join('');
        }
    }

    window.openStatsModal = function () {
        injectStatsModal();
        renderStatsModal();
        const modal = document.getElementById('modal-stats');
        if (modal) modal.classList.remove('hidden');
    };

    window.closeStatsModal = function () {
        const modal = document.getElementById('modal-stats');
        if (modal) modal.classList.add('hidden');
    };

    // ==========================================
    // INITIALIZATION ACTIONS
    // ==========================================
    function initialize() {
        loadGamificationData();
        checkStreakOnLoad();
        injectContainers();
        injectHeaderElements();
        updateUI();

        // Render quests panel if present
        const questListContainer = document.getElementById('chem-quest-list');
        if (!questListContainer) {
            // Find dashboard dashboard recommended card and append daily quests widget there!
            const dashboard = document.getElementById('view-dashboard');
            if (dashboard) {
                // Create a daily quests panel
                const questPanel = document.createElement('section');
                questPanel.className = 'bg-white dark:bg-[#1a1d27] rounded-3xl border border-gray-100 dark:border-[#363a52] p-6 sm:p-8 shadow-sm mb-6';
                questPanel.innerHTML = `
                    <div class="flex items-center gap-2.5 mb-4 border-b border-gray-100 dark:border-slate-800 pb-3">
                        <i class="fa-solid fa-clipboard-list text-amber-500 text-lg"></i>
                        <h3 class="text-lg font-bold text-gray-800 dark:text-white">Daily Lab Quests</h3>
                    </div>
                    <div id="chem-quest-list" class="space-y-4">
                        <!-- Injected -->
                    </div>
                `;
                
                // insert it right after the recommended next step card
                const recommendedCard = dashboard.querySelector('.recommended-next-step-card');
                if (recommendedCard) {
                    recommendedCard.after(questPanel);
                } else {
                    dashboard.appendChild(questPanel);
                }
            }
        }

        renderQuestWidget();

        // Listen for reset events and clear our data too
        window.addEventListener(window.CHEMISTRY_PROGRESS_RESET_EVENT || 'chemistryProgressReset', () => {
            localStorage.removeItem('chemistry_gamification_xp');
            localStorage.removeItem('chemistry_gamification_streak');
            localStorage.removeItem('chemistry_gamification_achievements');
            localStorage.removeItem('chemistry_gamification_quests');
            localStorage.removeItem('chemistry_gamification_stats');
        });
    }

    // Run setup
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose helpers globally
    window.awardXP = awardXP;
    window.updateQuestProgress = updateQuestProgress;
    window.updateStatsCounter = updateStatsCounter;
    window.checkAchievements = checkAchievements;
    window.unlockAchievement = unlockAchievement;

})();
