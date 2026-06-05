/**
 * Gnosys Anatomy & Physiology III (BI 233Z) - Gamification Engine
 * Manages XP progression, study streaks, achievements, daily quests, and stats.
 */

window.AnatomyGamification = (() => {
    // ==========================================
    // GAMIFICATION CONSTANTS
    // ==========================================
    const LEVELS = [
        { level: 1,  title: 'Lymphatic Recruit',                 xpRequired: 0     },
        { level: 2,  title: 'Innate Defender',                  xpRequired: 100   },
        { level: 3,  title: 'Adaptive Tactician',               xpRequired: 250   },
        { level: 4,  title: 'Alveolar Ventilator',              xpRequired: 500   },
        { level: 5,  title: 'Metabolic Respirator',             xpRequired: 850   },
        { level: 6,  title: 'Glomerular Filterer',              xpRequired: 1300  },
        { level: 7,  title: 'Acid-Base Buffer',                 xpRequired: 1850  },
        { level: 8,  title: 'Endocrine Cycle Sync',             xpRequired: 2500  },
        { level: 9,  title: 'Distinguished Clinical Scholar',   xpRequired: 3500  }
    ];

    const ACHIEVEMENTS = [
        { id: 'first_socratic',    label: 'Immunology Dialogue', desc: 'Clear your first Socratic coursework session',      icon: 'fa-solid fa-comments',         xp: 30,  color: '#fb7185' },
        { id: 'first_sandbox',     label: 'Clinical Simulator',   desc: 'Resolve your first interactive sandbox simulation',  icon: 'fa-solid fa-cube',             xp: 30,  color: '#60a5fa' },
        { id: 'first_feynman',     label: 'Feynman Explanation',  desc: 'Submit a passing Feynman Technique explanation',    icon: 'fa-solid fa-graduation-cap',    xp: 40,  color: '#34d399' },
        { id: 'first_mastery',     label: 'Lab Practical Passed',  desc: 'Achieve Mastery (>=80%) on a Homework Quiz sheet',   icon: 'fa-solid fa-file-signature',   xp: 50,  color: '#f59e0b' },
        { id: 'perfect_quiz',      label: 'Summa Cum Laude',      desc: 'Score a perfect 100% on any Homework Quiz sheet',    icon: 'fa-solid fa-award',            xp: 50,  color: '#f43f5e' },
        { id: 'habit_3',           label: 'Mitotic Habit',        desc: 'Maintain a 3-day active study streak',              icon: 'fa-solid fa-fire',             xp: 30,  color: '#f97316' },
        { id: 'week_warrior',      label: 'Circadian Mastery',    desc: 'Maintain a 7-day active study streak',              icon: 'fa-solid fa-fire-flame-curved', xp: 60,  color: '#ef4444' },
        { id: 'halfway_there',     label: 'Clinical Associate',   desc: 'Master 3/6 total curriculum lessons',            icon: 'fa-solid fa-user-graduate',    xp: 100, color: '#06b6d4' },
        { id: 'completionist',     label: 'Reproductive Scholar', desc: 'Master all 6 A&P III curriculum lessons',            icon: 'fa-solid fa-crown',            xp: 300, color: '#fbbf24' }
    ];

    const QUESTS = [
        { id: 'quest_tutor',      label: 'Ask study companion 2 questions',      target: 2, xp: 20, field: 'companionChats' },
        { id: 'quest_socratic',   label: 'Pass 1 Socratic coursework dialogue',  target: 1, xp: 25, field: 'socraticCleared' },
        { id: 'quest_sandbox',    label: 'Complete 1 sandbox mapping simulation', target: 1, xp: 25, field: 'sandboxesCleared' },
        { id: 'quest_homework',   label: 'Solve 1 homework quiz sheet',          target: 1, xp: 30, field: 'quizzesSolved' }
    ];

    // ==========================================
    // ENGINE STATE & LOCAL STORAGE KEYS
    // ==========================================
    const XP_KEY = 'anatomy3_gamification_xp';
    const STREAK_KEY = 'anatomy3_gamification_streak';
    const ACHIEVEMENTS_KEY = 'anatomy3_gamification_achievements';
    const QUESTS_KEY = 'anatomy3_gamification_quests';
    const STATS_KEY = 'anatomy3_gamification_stats';

    let xpData = { total: 0, level: 1 };
    let streakData = { count: 0, lastDate: '' };
    let achievementsData = { unlocked: [] };
    let questsData = { date: '', active: [] };
    let statsData = {
        socraticCleared: 0,
        sandboxesCleared: 0,
        feynmanCleared: 0,
        quizzesSolved: 0,
        companionChats: 0,
        perfectQuizzes: 0
    };

    // ==========================================
    // PERSISTENCE STORAGE CONTROLLERS
    // ==========================================
    function saveAll() {
        localStorage.setItem(XP_KEY, JSON.stringify(xpData));
        localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievementsData));
        localStorage.setItem(QUESTS_KEY, JSON.stringify(questsData));
        localStorage.setItem(STATS_KEY, JSON.stringify(statsData));
    }

    function loadAll() {
        try {
            xpData = JSON.parse(localStorage.getItem(XP_KEY)) || { total: 0, level: 1 };
            streakData = JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDate: '' };
            achievementsData = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY)) || { unlocked: [] };
            questsData = JSON.parse(localStorage.getItem(QUESTS_KEY)) || { date: '', active: [] };
            statsData = JSON.parse(localStorage.getItem(STATS_KEY)) || {
                socraticCleared: 0,
                sandboxesCleared: 0,
                feynmanCleared: 0,
                quizzesSolved: 0,
                companionChats: 0,
                perfectQuizzes: 0
            };
        } catch (e) {
            console.error('Error loading gamification database:', e);
        }

        verifyDailyQuests();
    }

    // ==========================================
    // STREAK & QUEST VALIDATIONS
    // ==========================================
    function verifyStreak() {
        const todayStr = new Date().toDateString();
        if (streakData.lastDate === todayStr) return;

        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (streakData.lastDate === yesterdayStr) {
            streakData.count++;
        } else if (streakData.lastDate !== '') {
            streakData.count = 1; // broken
        } else {
            streakData.count = 1; // fresh start
        }

        streakData.lastDate = todayStr;
        localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));

        // Evaluate achievements
        if (streakData.count >= 3) unlockAchievement('habit_3');
        if (streakData.count >= 7) unlockAchievement('week_warrior');
    }

    function verifyDailyQuests() {
        const todayStr = new Date().toDateString();
        if (questsData.date !== todayStr) {
            questsData.date = todayStr;
            questsData.active = QUESTS.map(q => ({
                id: q.id,
                label: q.label,
                target: q.target,
                current: 0,
                xp: q.xp,
                completed: false,
                field: q.field
            }));
            localStorage.setItem(QUESTS_KEY, JSON.stringify(questsData));
        }
    }

    // ==========================================
    // ACTION TRIGGERS & REWARDS
    // ==========================================
    function awardXP(amount, source, elementOrCoords) {
        xpData.total += amount;
        
        let levelChanged = false;
        let activeLevel = 1;
        for (let i = 0; i < LEVELS.length; i++) {
            if (xpData.total >= LEVELS[i].xpRequired) {
                activeLevel = LEVELS[i].level;
            } else {
                break;
            }
        }

        if (activeLevel > xpData.level) {
            xpData.level = activeLevel;
            levelChanged = true;
            setTimeout(() => {
                showToastNotification(`🎉 Level Up! You reached Level ${activeLevel}: ${LEVELS[activeLevel-1].title}`, '#fb7185');
            }, 800);
        }

        localStorage.setItem(XP_KEY, JSON.stringify(xpData));
        triggerXPFloatAnimation(amount, elementOrCoords);
        syncHeaderUI();

        window.dispatchEvent(new CustomEvent('anatomy3XPAwarded', {
            detail: { total: xpData.total, level: xpData.level, levelChanged }
        }));
    }

    function incrementStat(field, amount = 1) {
        if (statsData[field] !== undefined) {
            statsData[field] += amount;
            localStorage.setItem(STATS_KEY, JSON.stringify(statsData));
        }

        let questUpdated = false;
        questsData.active.forEach(q => {
            if (q.field === field && !q.completed) {
                q.current = Math.min(q.target, q.current + amount);
                if (q.current >= q.target) {
                    q.completed = true;
                    questUpdated = true;
                    setTimeout(() => {
                        awardXP(q.xp, 'quest');
                        showToastNotification(`🎯 Daily Quest Completed: ${q.label} (+${q.xp} XP)`, '#10b981');
                    }, 500);
                }
            }
        });

        if (questUpdated) {
            localStorage.setItem(QUESTS_KEY, JSON.stringify(questsData));
        }

        checkStatsAchievements();
    }

    function checkStatsAchievements() {
        if (statsData.socraticCleared >= 1) unlockAchievement('first_socratic');
        if (statsData.sandboxesCleared >= 1) unlockAchievement('first_sandbox');
        if (statsData.feynmanCleared >= 1) unlockAchievement('first_feynman');
        if (statsData.quizzesSolved >= 1) unlockAchievement('first_mastery');
        if (statsData.perfectQuizzes >= 1) unlockAchievement('perfect_quiz');

        try {
            const matrix = JSON.parse(localStorage.getItem('anatomy3_masteryMatrix') || '{}');
            let masteredCount = 0;
            Object.values(matrix).forEach(item => {
                if (item.state === 3) masteredCount++; // STATE_MASTERED
            });

            if (masteredCount >= 3) unlockAchievement('halfway_there');
            if (masteredCount >= 6) unlockAchievement('completionist');
        } catch (_err) {}
    }

    function unlockAchievement(id) {
        if (achievementsData.unlocked.includes(id)) return;

        const achObj = ACHIEVEMENTS.find(a => a.id === id);
        if (!achObj) return;

        achievementsData.unlocked.push(id);
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievementsData));

        awardXP(achObj.xp, 'achievement');
        showToastNotification(`🏆 Achievement Unlocked: ${achObj.label} (+${achObj.xp} XP)`, achObj.color);

        window.dispatchEvent(new CustomEvent('anatomy3AchievementUnlocked', { detail: achObj }));
    }

    // ==========================================
    // UI EFFECTS AND RENDER ANIMATIONS
    // ==========================================
    function triggerXPFloatAnimation(amount, elementOrCoords) {
        const float = document.createElement('div');
        float.className = 'xp-gain-anim';
        float.textContent = `+${amount} XP`;

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2 - 100;

        if (elementOrCoords instanceof HTMLElement) {
            const rect = elementOrCoords.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top;
        } else if (elementOrCoords && typeof elementOrCoords.x === 'number') {
            x = elementOrCoords.x;
            y = elementOrCoords.y;
        }

        float.style.left = `${x}px`;
        float.style.top = `${y}px`;
        document.body.appendChild(float);

        setTimeout(() => float.remove(), 1200);
    }

    function showToastNotification(message, colorCode) {
        const containerId = 'anatomy3-gamification-toast-container';
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col space-y-2 pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'achievement-toast max-w-sm rounded-lg border bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-100 shadow-2xl flex items-center space-x-3 pointer-events-auto transition-transform duration-300';
        toast.style.borderColor = colorCode || '#fb7185';
        toast.innerHTML = `
            <div class="p-1.5 rounded-full shrink-0 text-slate-900" style="background-color: ${colorCode || '#fb7185'}">
                <i class="fa-solid fa-star"></i>
            </div>
            <div class="leading-relaxed">${message}</div>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3200);
    }

    function syncHeaderUI() {
        const levelBadge = document.getElementById('header-level-badge');
        const levelTitle = document.getElementById('header-level-title');
        const streakCount = document.getElementById('header-streak-count');
        const xpProgressVal = document.getElementById('header-xp-val');
        const xpProgressBar = document.getElementById('header-xp-bar');

        const activeLevel = LEVELS[xpData.level - 1];
        const nextLevel = LEVELS[xpData.level] || activeLevel;

        const currentLvlXP = xpData.total - activeLevel.xpRequired;
        const totalNeeded = nextLevel.xpRequired - activeLevel.xpRequired;
        const percent = totalNeeded > 0 ? Math.min(100, Math.round((currentLvlXP / totalNeeded) * 100)) : 100;

        if (levelBadge) levelBadge.textContent = `Lvl ${xpData.level}`;
        if (levelTitle) levelTitle.textContent = activeLevel.title;
        if (streakCount) {
            streakCount.textContent = streakData.count;
            const container = streakCount.closest('.streak-indicator-container');
            if (container) {
                if (streakData.count > 0) {
                    container.classList.remove('opacity-30');
                } else {
                    container.classList.add('opacity-30');
                }
            }
        }
        if (xpProgressVal) xpProgressVal.textContent = `${xpData.total} / ${nextLevel.xpRequired} XP`;
        if (xpProgressBar) xpProgressBar.style.width = `${percent}%`;
    }

    loadAll();
    verifyStreak();
    setTimeout(syncHeaderUI, 100);

    return {
        awardXP,
        incrementStat,
        unlockAchievement,
        syncHeaderUI,
        getXPData: () => xpData,
        getStreakData: () => streakData,
        getAchievementsData: () => achievementsData,
        getQuestsData: () => questsData,
        getStatsData: () => statsData,
        getLevels: () => LEVELS,
        getAchievementsList: () => ACHIEVEMENTS
    };
})();
