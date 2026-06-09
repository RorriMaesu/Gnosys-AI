// Hub Application Logic - Redesigned UI
// Manages static course registry, category filtering, stats modals, and the floating Pomodoro timer.

const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const openWordUrl = isLocalDev ? 'http://localhost:5173/' : '../OpenWord/';

const COURSES = [
    {
        id: 'medical-terminology',
        title: 'Medical Terminology',
        description: 'Comprehensive clinical language mastery with Chart Decrypter and AI Tutor.',
        link: './syngnosia/index.html',
        category: 'Clinical Core',
        icon: 'fa-staff-snake',
        color: 'from-teal-500 to-emerald-600',
        iconWrapClass: 'bg-teal-500/15 border-teal-400/30',
        iconClass: 'text-teal-300',
        iconWrapStyle: 'background: rgba(20, 184, 166, 0.18); border-color: rgba(94, 234, 212, 0.45);',
        iconStyle: 'color: #5eead4;',
        accentGlow: 'bg-teal-500/10 group-hover:bg-teal-500/20',
        accentTitleHover: 'group-hover:text-teal-200',
        accentCta: 'text-teal-400',
        status: 'active'
    },
    {
        id: 'intro-to-chemistry',
        title: 'Intro to Chemistry',
        description: 'Atoms, bonding, reactions, and core chemistry concepts for healthcare foundations.',
        link: './chemistry/index.html',
        category: 'Sciences',
        icon: 'fa-flask-vial',
        color: 'from-amber-500 to-orange-600',
        iconWrapClass: 'bg-amber-500/15 border-amber-400/35',
        iconClass: 'text-amber-600',
        iconWrapStyle: 'background: rgba(245, 158, 11, 0.18); border-color: rgba(252, 211, 77, 0.45);',
        iconStyle: 'color: #d97706;',
        accentGlow: 'bg-amber-500/10 group-hover:bg-amber-500/20',
        accentTitleHover: 'group-hover:text-amber-200',
        accentCta: 'text-amber-400',
        status: 'active'
    },
    {
        id: 'chemistry-math-refresher',
        title: 'Chemistry Math Refresher',
        description: 'Standalone companion course for chemistry math: unit analysis, sig figs, scientific notation, and mole-focused problem setup.',
        link: './chemistry/math-refresher/index.html',
        category: 'Sciences',
        icon: 'fa-square-root-variable',
        color: 'from-cyan-500 to-blue-600',
        iconWrapClass: 'bg-amber-500/15 border-amber-400/35',
        iconClass: 'text-amber-300',
        iconWrapStyle: 'background: rgba(245, 158, 11, 0.18); border-color: rgba(252, 211, 77, 0.45);',
        iconStyle: 'color: #fde68a;',
        status: 'active'
    },
    {
        id: 'clinical-mathematics',
        title: 'Clinical Mathematics',
        description: 'Master clinical unit conversions, safety formatting, algebraic formulas, and scale-based logic.',
        link: './math/index.html',
        category: 'Sciences',
        icon: 'fa-square-root-variable',
        color: 'from-blue-500 to-indigo-600',
        status: 'active'
    },
    {
        id: 'psychology-care',
        title: 'Intro to Psychology',
        description: 'Patient interaction, behavioral sciences, and professional clinical ethics.',
        link: './psychology/index.html',
        category: 'Clinical Core',
        icon: 'fa-brain',
        color: 'from-purple-500 to-fuchsia-600',
        iconWrapClass: 'bg-purple-500/15 border-purple-400/30',
        iconClass: 'text-purple-300',
        iconWrapStyle: 'background: rgba(168, 85, 247, 0.18); border-color: rgba(192, 132, 252, 0.45);',
        iconStyle: 'color: #d8b4fe;',
        accentGlow: 'bg-purple-500/10 group-hover:bg-purple-500/20',
        accentTitleHover: 'group-hover:text-purple-200',
        accentCta: 'text-purple-400',
        status: 'active'
    },
    {
        id: 'openword',
        title: 'OpenWord Studio',
        description: 'A premium, offline-first AI document editor. Draft study guides, summarize notes, and export to DOCX.',
        link: openWordUrl,
        category: 'Workspace',
        icon: 'fa-file-signature',
        color: 'from-indigo-500 to-violet-600',
        iconWrapClass: 'bg-indigo-500/15 border-indigo-400/30',
        iconClass: 'text-indigo-300',
        iconWrapStyle: 'background: rgba(99, 102, 241, 0.18); border-color: rgba(129, 140, 248, 0.45);',
        iconStyle: 'color: #818cf8;',
        accentGlow: 'bg-indigo-500/10 group-hover:bg-indigo-500/20',
        accentTitleHover: 'group-hover:text-indigo-200',
        accentCta: 'text-indigo-400',
        status: 'active'
    },
    {
        id: 'quantime',
        title: 'Quantime',
        description: 'AI-driven task scheduler and calendar. Track objectives, optimize schedules, and manage time.',
        link: '#',
        category: 'Workspace',
        icon: 'fa-calendar-days',
        color: 'from-violet-500 to-fuchsia-600',
        iconWrapClass: 'bg-violet-500/15 border-violet-400/30',
        iconClass: 'text-violet-300',
        iconWrapStyle: 'background: rgba(139, 92, 246, 0.18); border-color: rgba(167, 139, 250, 0.45);',
        iconStyle: 'color: #a78bfa;',
        accentGlow: 'bg-violet-500/10 group-hover:bg-violet-500/20',
        accentTitleHover: 'group-hover:text-violet-200',
        accentCta: 'text-violet-400',
        status: 'active'
    },
    {
        id: 'general-sound-physics',
        title: 'General & Sound Physics',
        description: 'Acoustics, wave mechanics, electromagnetism, and SPI instrumentation foundations.',
        link: '#',
        category: 'Sciences',
        icon: 'fa-wave-square',
        color: 'from-sky-500 to-cyan-600',
        status: 'planned'
    },
    {
        id: 'anatomy-physiology-1',
        title: 'Anatomy & Physiology I',
        description: 'BI 231Z: Foundational frameworks, homeostasis, cellular biology, histology, integumentary, skeletal, and muscular systems.',
        link: './anatomy1/index.html',
        category: 'Sciences',
        icon: 'fa-person-half-dress',
        color: 'from-rose-500 to-red-600',
        iconWrapClass: 'bg-rose-500/15 border-rose-400/30',
        iconClass: 'text-rose-300',
        iconWrapStyle: 'background: rgba(244, 63, 94, 0.18); border-color: rgba(251, 113, 133, 0.45);',
        iconStyle: 'color: #fb7185;',
        accentGlow: 'bg-rose-500/10 group-hover:bg-rose-500/20',
        accentTitleHover: 'group-hover:text-rose-200',
        accentCta: 'text-rose-400',
        status: 'active'
    },
    {
        id: 'anatomy-physiology-2',
        title: 'Anatomy & Physiology II',
        description: 'BI 232Z: Control and integration: Central and peripheral nervous systems, special senses, endocrine glands, blood, heart, and hemodynamics.',
        link: './anatomy2/index.html',
        category: 'Sciences',
        icon: 'fa-brain',
        color: 'from-red-500 to-pink-600',
        iconWrapClass: 'bg-red-500/15 border-red-400/30',
        iconClass: 'text-red-300',
        iconWrapStyle: 'background: rgba(239, 68, 68, 0.18); border-color: rgba(248, 113, 113, 0.45);',
        iconStyle: 'color: #f87171;',
        accentGlow: 'bg-red-500/10 group-hover:bg-red-500/20',
        accentTitleHover: 'group-hover:text-red-200',
        accentCta: 'text-red-400',
        status: 'active'
    },
    {
        id: 'anatomy-physiology-3',
        title: 'Anatomy & Physiology III',
        description: 'BI 233Z: Maintenance and survival: Lymphatic defenses, immunity, respiration, digestion, urinary clearance, fluids/electrolytes, and reproduction.',
        link: './anatomy3/index.html',
        category: 'Sciences',
        icon: 'fa-lungs',
        color: 'from-pink-500 to-rose-600',
        iconWrapClass: 'bg-pink-500/15 border-pink-400/30',
        iconClass: 'text-pink-300',
        iconWrapStyle: 'background: rgba(236, 72, 153, 0.18); border-color: rgba(244, 114, 182, 0.45);',
        iconStyle: 'color: #f472b6;',
        accentGlow: 'bg-pink-500/10 group-hover:bg-pink-500/20',
        accentTitleHover: 'group-hover:text-pink-200',
        accentCta: 'text-pink-400',
        status: 'active'
    },
    {
        id: 'general-biology',
        title: 'General Biology',
        description: 'Cellular biology, genetics, metabolism, and molecular systems.',
        link: '#',
        category: 'Sciences',
        icon: 'fa-dna',
        color: 'from-emerald-500 to-teal-600',
        status: 'planned'
    },
    {
        id: 'english-composition',
        title: 'English Composition',
        description: 'Written and oral communication skills for healthcare professionals.',
        link: '#',
        category: 'Humanities',
        icon: 'fa-pen-nib',
        color: 'from-cyan-500 to-sky-600',
        status: 'planned'
    },
    {
        id: 'ultrasound-physics-spi',
        title: 'Ultrasound Physics (SPI)',
        description: 'Acoustic physics, transducers, Doppler principles, and scan parameters.',
        link: '#',
        category: 'Sonography',
        icon: 'fa-circle-nodes',
        color: 'from-indigo-500 to-violet-600',
        status: 'planned'
    },
    {
        id: 'sectional-anatomy-path',
        title: 'Sectional Anatomy & Path',
        description: 'Multi-planar visualization (transverse, sagittal, coronal) and tissue disease states.',
        link: '#',
        category: 'Sonography',
        icon: 'fa-border-all',
        color: 'from-fuchsia-500 to-pink-600',
        status: 'planned'
    },
    {
        id: 'abdominal-sonography',
        title: 'Abdominal Sonography',
        description: 'Anatomy, scan protocols, and pathologies of the liver, gallbladder, kidneys, and spleen.',
        link: '#',
        category: 'Sonography',
        icon: 'fa-stethoscope',
        color: 'from-amber-600 to-orange-500',
        status: 'planned'
    },
    {
        id: 'ob-gyn-sonography',
        title: 'OB/GYN Sonography',
        description: 'Female pelvic anatomy, fetal biometry, embryology, and obstetric pathologies.',
        link: '#',
        category: 'Sonography',
        icon: 'fa-baby',
        color: 'from-pink-500 to-rose-600',
        status: 'planned'
    },
    {
        id: 'vascular-sonography',
        title: 'Vascular Sonography',
        description: 'Hemodynamics, peripheral vascular systems, carotid evaluation, and Doppler analysis.',
        link: '#',
        category: 'Sonography',
        icon: 'fa-heart-pulse',
        color: 'from-red-500 to-rose-600',
        status: 'planned'
    }
];

let activeFilter = 'all';
let focusStats = {};

document.addEventListener('DOMContentLoaded', () => {
    loadFocusStats();
    renderFilters();
    renderCourseGrid();
});

function loadFocusStats() {
    try {
        const stored = localStorage.getItem('study_hub_focus_stats');
        focusStats = stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Failed to load focus stats:', e);
        focusStats = {};
    }
}

// Render Filters
function renderFilters() {
    const filterContainer = document.getElementById('filter-pills');
    if (!filterContainer) return;

    const filters = [
        { id: 'all', label: 'All Modules' },
        { id: 'active', label: 'Active Study' },
        { id: 'workspace', label: 'Workspace' },
        { id: 'sciences', label: 'Sciences' },
        { id: 'clinical', label: 'Clinical Core' },
        { id: 'humanities', label: 'Humanities' },
        { id: 'sonography', label: 'Sonography' }
    ];

    filterContainer.innerHTML = filters.map(f => `
        <button onclick="setFilter('${f.id}')" class="px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${activeFilter === f.id ? 'bg-indigo-600 text-white border border-indigo-500' : 'glass-card text-slate-400 hover:text-white hover:bg-white/5'}">
            ${f.label}
        </button>
    `).join('');
}

window.setFilter = function(filterId) {
    activeFilter = filterId;
    renderFilters();
    renderCourseGrid();
};

// Render Course Cards
function renderCourseGrid() {
    const grid = document.getElementById('course-grid');
    if (!grid) return;

    let filtered = COURSES;
    if (activeFilter === 'active') {
        filtered = COURSES.filter(c => c.status === 'active');
    } else if (activeFilter === 'workspace') {
        filtered = COURSES.filter(c => c.category === 'Workspace');
    } else if (activeFilter === 'sciences') {
        filtered = COURSES.filter(c => c.category === 'Sciences');
    } else if (activeFilter === 'clinical') {
        filtered = COURSES.filter(c => c.category === 'Clinical Core');
    } else if (activeFilter === 'humanities') {
        filtered = COURSES.filter(c => c.category === 'Humanities');
    } else if (activeFilter === 'sonography') {
        filtered = COURSES.filter(c => c.category === 'Sonography');
    }

    grid.innerHTML = filtered.map(c => {
        const isActive = c.status === 'active';
        const accentGlow = c.accentGlow || 'bg-indigo-500/10 group-hover:bg-indigo-500/20';
        const accentTitleHover = c.accentTitleHover || 'group-hover:text-indigo-200';
        const accentCta = c.accentCta || 'text-indigo-400';
        const iconWrapClass = c.iconWrapClass || `bg-gradient-to-br ${c.color} border-white/10`;
        const iconClass = c.iconClass || 'text-white';
        const iconWrapStyle = c.iconWrapStyle || '';
        const iconStyle = c.iconStyle || '';
        
        // Status pill
        const statusPill = isActive
            ? `<span class="px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 text-[10px] font-extrabold border border-teal-500/20 uppercase tracking-wider">Active</span>`
            : `<span class="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-extrabold border border-slate-700 uppercase tracking-wider">Planned</span>`;

        // Focus logged badge
        const loggedSeconds = focusStats[c.id] || 0;
        const focusBadge = loggedSeconds > 0
            ? `<span class="text-[10px] text-slate-500 font-bold ml-2 flex items-center gap-1" title="Study Focus Logged"><i class="fa-solid fa-clock"></i> ${(loggedSeconds / 3600).toFixed(1)} hrs</span>`
            : '';

        // Handle card click
        const clickAction = c.id === 'quantime'
            ? `href="#" onclick="handleQuantimeClick(event); return false;"`
            : (isActive
                ? `href="${c.link}"`
                : `href="#" onclick="showToast('${c.title}'); return false;"`);

        return `
            <a ${clickAction} class="block group relative ${isActive ? '' : 'opacity-70 hover:opacity-90'}">
                <div class="glass-card rounded-3xl p-8 h-full transition-all duration-300 module-active relative overflow-hidden flex flex-col min-h-[220px]">
                    
                    <div class="flex justify-between items-start mb-6">
                        <div class="w-14 h-14 rounded-2xl flex items-center justify-center border shadow-lg ${iconWrapClass}" style="${iconWrapStyle}">
                            <i class="fa-solid ${c.icon} text-2xl ${iconClass}" style="${iconStyle}"></i>
                        </div>
                        <div class="flex items-center gap-1">
                            ${statusPill}
                            ${focusBadge}
                        </div>
                    </div>

                    <h3 class="text-2xl font-bold text-white mb-2 leading-snug transition-colors ${accentTitleHover}">${c.title}</h3>
                    <p class="text-slate-400 text-sm mb-6 leading-relaxed flex-grow">${c.description}</p>
                    
                    <div class="mt-auto flex items-center ${accentCta} font-bold text-sm group-hover:translate-x-1 transition-transform">
                        ${isActive ? 'Launch Module' : 'In Development'} <i class="fa-solid fa-arrow-right ml-2 text-xs"></i>
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

// Listen to storage changes to update grid hours live
window.addEventListener('storage', (event) => {
    if (event.key === 'study_hub_focus_stats') {
        loadFocusStats();
        renderCourseGrid();
    }
});


// ----------------------------------------------------
// TOAST NOTIFICATION SYSTEM (For Planned Modules)
// ----------------------------------------------------
window.showToast = function(courseTitle) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'glass-card border border-indigo-500/20 px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm text-slate-200 fade-in select-none max-w-sm w-full';
    toast.style.background = 'rgba(15, 23, 42, 0.9)';
    toast.style.backdropFilter = 'blur(12px)';
    
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-satellite-dish animate-pulse"></i>
        </div>
        <div class="flex-grow">
            <p class="font-extrabold text-white">${courseTitle}</p>
            <p class="text-xs text-slate-400 mt-0.5">Currently in development. Core lessons coming soon!</p>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.5s ease-out';
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 4000);
};

// ----------------------------------------------------
// QUANTIME INTEGRATION LAUNCHER & INSTALLATION LOGIC
// ----------------------------------------------------
function getOrCreateToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full';
        document.body.appendChild(container);
    }
    return container;
}

let activeLaunchToast = null;

function showLaunchToast(message, iconClass) {
    removeLaunchToast();
    const container = getOrCreateToastContainer();
    if (!container) return;

    activeLaunchToast = document.createElement('div');
    activeLaunchToast.className = 'glass-card border border-indigo-500/20 px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm text-slate-200 fade-in select-none max-w-sm w-full';
    activeLaunchToast.style.background = 'rgba(15, 23, 42, 0.9)';
    activeLaunchToast.style.backdropFilter = 'blur(12px)';
    
    activeLaunchToast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="flex-grow">
            <p class="font-extrabold text-white">Quantime Launcher</p>
            <p class="text-xs text-slate-400 mt-0.5" id="launch-toast-text">${message}</p>
        </div>
    `;
    container.appendChild(activeLaunchToast);
}

function updateLaunchToast(message, iconClass, timeout = 0) {
    if (!activeLaunchToast) {
        showLaunchToast(message, iconClass);
    } else {
        const textEl = document.getElementById('launch-toast-text');
        if (textEl) textEl.textContent = message;
        const iconContainer = activeLaunchToast.querySelector('.w-8.h-8 i');
        if (iconContainer) {
            iconContainer.className = `fa-solid ${iconClass}`;
        }
    }
    
    if (timeout > 0) {
        setTimeout(removeLaunchToast, timeout);
    }
}

function removeLaunchToast() {
    if (activeLaunchToast) {
        const t = activeLaunchToast;
        activeLaunchToast = null;
        t.style.opacity = '0';
        t.style.transform = 'translateY(10px)';
        t.style.transition = 'all 0.5s ease-out';
        setTimeout(() => {
            t.remove();
        }, 500);
    }
}

function fetchStatusFromList(endpoints, index, resolve, reject) {
    if (index >= endpoints.length) {
        reject(new Error("All endpoints failed"));
        return;
    }
    fetch(endpoints[index], { signal: AbortSignal.timeout(1500) })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                data.apiBase = endpoints[index].substring(0, endpoints[index].indexOf('/api/'));
                resolve(data);
            } else {
                fetchStatusFromList(endpoints, index + 1, resolve, reject);
            }
        })
        .catch(() => {
            fetchStatusFromList(endpoints, index + 1, resolve, reject);
        });
}

function getQuantimeStatus() {
    const endpoints = [
        '/api/quantime-status',
        'http://localhost:8020/api/quantime-status',
        'http://localhost:8000/api/quantime-status'
    ];
    return new Promise((resolve, reject) => {
        fetchStatusFromList(endpoints, 0, resolve, reject);
    });
}

function triggerQuantimeProtocolLaunch() {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'gnosys-quantime://launch';
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 1000);
}

function pollQuantimeApp(successCallback, failureCallback) {
    let attempts = 0;
    const maxAttempts = 15;
    const interval = setInterval(() => {
        attempts++;
        // Check standard Quantime backend health (port 8000) or Vite (5173)
        Promise.any([
            fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(1000) }).then(res => res.ok ? 'http://localhost:8000' : Promise.reject()),
            fetch('http://localhost:5173/', { mode: 'no-cors', signal: AbortSignal.timeout(1000) }).then(() => 'http://localhost:5173')
        ])
        .then(url => {
            clearInterval(interval);
            successCallback(url);
        })
        .catch(() => {
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                failureCallback();
            }
        });
    }, 1000);
}

window.handleQuantimeClick = function(event) {
    if (event) event.preventDefault();
    
    showLaunchToast('Checking Quantime status...', 'fa-spinner fa-spin');
    
    getQuantimeStatus()
        .then(data => {
            if (data.installed) {
                if (data.running) {
                    removeLaunchToast();
                    window.open(data.dashboard_url, '_blank');
                } else {
                    updateLaunchToast('Booting Quantime Scheduler...', 'fa-rocket text-indigo-400 animate-bounce');
                    
                    // Try launching via backend server API first
                    const launchUrl = `${data.apiBase || ''}/api/launch-quantime`;
                    fetch(launchUrl, { method: 'POST' })
                        .then(res => res.json())
                        .then(launchData => {
                            if (launchData.status === 'success') {
                                pollQuantimeApp(
                                    (url) => {
                                        removeLaunchToast();
                                        window.open(url, '_blank');
                                    },
                                    () => {
                                        updateLaunchToast('Launch timed out. Make sure it is installed.', 'fa-circle-exclamation text-rose-500', 4000);
                                    }
                                );
                            } else {
                                // Fallback to URL protocol launch
                                triggerQuantimeProtocolLaunch();
                                pollQuantimeApp(
                                    (url) => {
                                        removeLaunchToast();
                                        window.open(url, '_blank');
                                    },
                                    () => {
                                        updateLaunchToast('Launch failed. Please start manually.', 'fa-circle-exclamation text-rose-500', 4000);
                                    }
                                );
                            }
                        })
                        .catch(() => {
                            // Fallback to URL protocol launch
                            triggerQuantimeProtocolLaunch();
                            pollQuantimeApp(
                                (url) => {
                                    removeLaunchToast();
                                    window.open(url, '_blank');
                                },
                                () => {
                                    updateLaunchToast('Launch failed. Please start manually.', 'fa-circle-exclamation text-rose-500', 4000);
                                }
                            );
                        });
                }
            } else {
                removeLaunchToast();
                showQuantimeInstallModal();
            }
        })
        .catch(err => {
            // Local server not running. Try directly launching via OS URL protocol handler
            updateLaunchToast('Attempting OS protocol launch...', 'fa-rocket text-indigo-400 animate-bounce');
            triggerQuantimeProtocolLaunch();
            
            pollQuantimeApp(
                (url) => {
                    removeLaunchToast();
                    window.open(url, '_blank');
                },
                () => {
                    // If polling fails, they likely don't have it installed
                    removeLaunchToast();
                    showQuantimeInstallModal();
                }
            );
        });
};

window.showQuantimeInstallModal = function() {
    const modal = document.getElementById('quantime-install-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeQuantimeInstallModal = function() {
    const modal = document.getElementById('quantime-install-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

