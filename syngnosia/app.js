// ==========================================
// DATA STRUCTURE: The Medical Dictionary
// ==========================================
// The dictionary array is now loaded from data.js

// ==========================================
// CONTENT ARRAYS
// ==========================================
let currentWbChallenge = null;
let wbRecentAnswers     = [];   // deduplication ring-buffer (last 10 answers)
const DAILY_NEW_LIMIT = 20;

// ==========================================
// LOOKUP TABLES
// ==========================================
const EXAMPLES = {
    // Cardiovascular
    'cardi/o': ['cardiology', 'cardiomegaly', 'tachycardia'],
    'angi/o': ['angioplasty', 'angiogram', 'angiectomy'],
    'arteri/o': ['arteriosclerosis', 'arteriotomy'],
    'ather/o': ['atherosclerosis', 'atherectomy'],
    'phleb/o': ['phlebotomy', 'phlebitis'],
    'ven/o': ['venogram', 'venectomy'],
    'hem/o': ['hematology', 'hemorrhage', 'hematoma'],
    'hemat/o': ['hematology', 'hematuria', 'hematoma'],
    'thromb/o': ['thrombosis', 'thrombectomy', 'thrombolysis'],
    'aort/o': ['aortogram', 'aortic stenosis'],
    // Respiratory
    'bronch/o': ['bronchitis', 'bronchoscopy', 'bronchospasm'],
    'pneum/o': ['pneumonia', 'pneumothorax'],
    'pneumon/o': ['pneumonitis', 'pneumonectomy'],
    'pulmon/o': ['pulmonology', 'pulmonary embolism'],
    'trache/o': ['tracheotomy', 'tracheitis'],
    'rhin/o': ['rhinitis', 'rhinoplasty', 'rhinorrhea'],
    'laryng/o': ['laryngitis', 'laryngoscopy'],
    'pharyng/o': ['pharyngitis', 'pharyngoscopy'],
    'pleur/o': ['pleuritis', 'pleurectomy'],
    // Digestive
    'hepat/o': ['hepatitis', 'hepatomegaly', 'hepatectomy'],
    'gastr/o': ['gastritis', 'gastroscopy', 'gastropathy'],
    'enter/o': ['enteritis', 'enteroscopy'],
    'col/o': ['colitis', 'colonoscopy', 'colectomy'],
    'cholecyst/o': ['cholecystitis', 'cholecystectomy'],
    'esophag/o': ['esophagitis', 'esophagoscopy'],
    'pancreat/o': ['pancreatitis', 'pancreatectomy'],
    'stomat/o': ['stomatitis', 'stomatology'],
    'proct/o': ['proctoscopy', 'proctitis'],
    // Nervous
    'neur/o': ['neurology', 'neuritis', 'neuropathy'],
    'encephal/o': ['encephalitis', 'encephalopathy'],
    'myel/o': ['myelitis', 'myelopathy', 'myelocyte'],
    'cerebell/o': ['cerebellar atrophy', 'cerebellitis'],
    'cerebr/o': ['cerebrovascular accident', 'cerebral cortex'],
    'psych/o': ['psychiatry', 'psychology', 'psychosis'],
    // Musculoskeletal
    'arthr/o': ['arthritis', 'arthroscopy', 'arthroplasty'],
    'oste/o': ['osteoporosis', 'osteomyelitis', 'ostectomy'],
    'my/o': ['myalgia', 'myopathy', 'myositis'],
    'tendin/o': ['tendinitis', 'tendinopathy'],
    'chondr/o': ['chondritis', 'chondroplasty'],
    'cost/o': ['intercostal', 'costalgia'],
    'vertebr/o': ['vertebroplasty', 'vertebral'],
    // Urinary
    'nephr/o': ['nephritis', 'nephrectomy', 'nephrology'],
    'ren/o': ['renal', 'renovascular'],
    'ur/o': ['urology', 'urogram'],
    'urethr/o': ['urethritis', 'urethroplasty'],
    'cyst/o': ['cystitis', 'cystoscopy', 'cystectomy'],
    // Reproductive
    'gyn/o': ['gynecology', 'gynecologist'],
    'hyster/o': ['hysterectomy', 'hysteroscopy'],
    'oophor/o': ['oophoritis', 'oophorectomy'],
    'orchid/o': ['orchiditis', 'orchidectomy'],
    'salping/o': ['salpingitis', 'salpingectomy'],
    // Blood/Immune
    'leuk/o': ['leukemia', 'leukocyte', 'leukopenia'],
    'erythr/o': ['erythrocyte', 'erythropenia'],
    'splen/o': ['splenomegaly', 'splenectomy'],
    'lymph/o': ['lymphoma', 'lymphocyte', 'lymphedema'],
    // Endocrine
    'thyr/o': ['thyroiditis', 'thyrotoxicosis'],
    'thyroid/o': ['thyroidectomy', 'thyroiditis'],
    'adren/o': ['adrenalitis', 'adrenomegaly'],
    // Integumentary
    'derm/o': ['dermatitis', 'dermoscopy'],
    'dermat/o': ['dermatitis', 'dermatology', 'dermoscopy'],
    'onych/o': ['onychomycosis', 'onychectomy'],
    // Special Senses
    'ophthalm/o': ['ophthalmology', 'ophthalmoscopy'],
    'ocul/o': ['ocular', 'oculomotor'],
    'ot/o': ['otitis', 'otoscopy', 'otolaryngology'],
    'audi/o': ['audiology', 'audiogram'],
    // Common Prefixes
    'brady-': ['bradycardia', 'bradypnea', 'bradykinesia'],
    'tachy-': ['tachycardia', 'tachypnea'],
    'poly-': ['polyuria', 'polyneuritis', 'polycythemia'],
    'hyper-': ['hypertension', 'hyperglycemia', 'hyperthyroidism'],
    'hypo-': ['hypotension', 'hypoglycemia', 'hypothyroidism'],
    'intra-': ['intravenous', 'intramuscular', 'intraocular'],
    'peri-': ['pericarditis', 'periosteum', 'peripheral'],
    'sub-': ['subcutaneous', 'sublingual', 'subacute'],
    'trans-': ['transdermal', 'transfusion'],
    'bi-': ['bilateral', 'bifurcation'],
    'hemi-': ['hemiplegia', 'hemiparesis'],
    'micro-': ['microscopy', 'microcyte', 'microorganism'],
    'macro-': ['macrocyte', 'macroscopic'],
    'neo-': ['neoplasm', 'neonatal'],
    'anti-': ['antibiotics', 'antiviral'],
    'dys-': ['dyspnea', 'dysphagia', 'dysuria'],
    // Common Suffixes
    '-itis': ['hepatitis', 'bronchitis', 'arthritis'],
    '-ectomy': ['appendectomy', 'hysterectomy', 'cholecystectomy'],
    '-oscopy': ['endoscopy', 'colonoscopy', 'arthroscopy'],
    '-plasty': ['rhinoplasty', 'arthroplasty', 'angioplasty'],
    '-logy': ['cardiology', 'neurology', 'dermatology'],
    '-ology': ['cardiology', 'hematology', 'oncology'],
    '-oma': ['carcinoma', 'lymphoma', 'hematoma'],
    '-osis': ['fibrosis', 'thrombosis', 'cirrhosis'],
    '-algia': ['neuralgia', 'myalgia', 'arthralgia'],
    '-pathy': ['neuropathy', 'cardiomyopathy', 'hepatopathy'],
    '-rrhea': ['diarrhea', 'rhinorrhea', 'amenorrhea'],
    '-rrhage': ['hemorrhage', 'menorrhagia'],
    '-stomy': ['colostomy', 'tracheostomy', 'ileostomy'],
    '-tomy': ['craniotomy', 'phlebotomy', 'laparotomy'],
    '-gram': ['electrocardiogram', 'mammogram', 'angiogram'],
    '-graph': ['electrocardiograph', 'mammograph'],
    '-meter': ['spirometer', 'thermometer'],
    '-megaly': ['hepatomegaly', 'splenomegaly', 'cardiomegaly'],
    '-penia': ['leukopenia', 'thrombocytopenia'],
    '-trophy': ['hypertrophy', 'atrophy'],
    '-plegia': ['hemiplegia', 'quadriplegia'],
    '-paresis': ['hemiparesis', 'paraparesis'],
    '-uria': ['hematuria', 'polyuria', 'glucosuria'],
    '-emia': ['anemia', 'septicemia', 'leukemia'],
};

const SYSTEM_COLORS = {
    'Cardiovascular':  '#ef4444',
    'Nervous':         '#8b5cf6',
    'Digestive':       '#f59e0b',
    'Respiratory':     '#0ea5e9',
    'Musculoskeletal': '#f97316',
    'Urinary':         '#eab308',
    'Reproductive':    '#ec4899',
    'Blood/Immune':    '#f43f5e',
    'Endocrine':       '#84cc16',
    'Integumentary':   '#14b8a6',
    'Special Senses':  '#6366f1',
    'Foundations':     '#64748b',
    'Prefixes':        '#06b6d4',
    'Suffixes':        '#a855f7',
};

// ==========================================
// GAMIFICATION CONSTANTS
// ==========================================
const LEVELS = [
    { level: 1,  title: 'Pre-Med Student',        xpRequired: 0      },
    { level: 2,  title: 'First-Year Student',      xpRequired: 200    },
    { level: 3,  title: 'Second-Year Student',     xpRequired: 500    },
    { level: 4,  title: 'Third-Year Student',      xpRequired: 1000   },
    { level: 5,  title: 'Fourth-Year Student',     xpRequired: 1800   },
    { level: 6,  title: 'Medical Intern',          xpRequired: 3000   },
    { level: 7,  title: 'Junior Resident',         xpRequired: 4800   },
    { level: 8,  title: 'Senior Resident',         xpRequired: 7200   },
    { level: 9,  title: 'Chief Resident',          xpRequired: 10500  },
    { level: 10, title: 'Clinical Fellow',         xpRequired: 15000  },
    { level: 11, title: 'Attending Physician',     xpRequired: 21000  },
    { level: 12, title: 'Senior Attending',        xpRequired: 29000  },
    { level: 13, title: 'Department Director',     xpRequired: 40000  },
    { level: 14, title: 'Clinical Professor',      xpRequired: 56000  },
    { level: 15, title: 'Medical School Dean',     xpRequired: 78000  },
    { level: 16, title: 'Distinguished Professor', xpRequired: 108000 },
    { level: 17, title: 'Legacy Master',           xpRequired: 150000 },
];

const ACHIEVEMENTS = [
    { id: 'first_steps',      label: 'First Steps',          desc: 'Complete your first flashcard review',             icon: 'fa-solid fa-shoe-prints',       xp: 10,   color: '#14b8a6' },
    { id: 'word_weaver',      label: 'Word Weaver',          desc: 'Build your first correct word',                    icon: 'fa-solid fa-puzzle-piece',      xp: 10,   color: '#0ea5e9' },
    { id: 'chart_reader',     label: 'Chart Reader',         desc: 'Complete your first Chart Decrypter answer',       icon: 'fa-solid fa-file-medical',      xp: 10,   color: '#6366f1' },
    { id: 'speed_speller',    label: 'Speed Speller',        desc: 'Get your first Pluralization answer correct',      icon: 'fa-solid fa-spell-check',       xp: 10,   color: '#a855f7' },
    { id: 'code_cracker',     label: 'Code Cracker',         desc: 'Decode your first abbreviation',                   icon: 'fa-solid fa-bolt',              xp: 10,   color: '#f59e0b' },
    { id: 'hundred_club',     label: 'Hundred Club',         desc: 'Master 100 terms (interval ≥ 7)',                  icon: 'fa-solid fa-ranking-star',      xp: 50,   color: '#f97316' },
    { id: 'half_mastered',    label: 'Halfway There',        desc: 'Master 500 terms',                                 icon: 'fa-solid fa-trophy',            xp: 150,  color: '#eab308' },
    { id: 'full_mastery',     label: 'Complete Mastery',     desc: 'Master all terms in the dictionary',               icon: 'fa-solid fa-crown',             xp: 500,  color: '#ef4444' },
    { id: 'habit_3',          label: 'Three-Day Habit',      desc: '3-day study streak',                               icon: 'fa-solid fa-fire',              xp: 30,   color: '#f97316' },
    { id: 'week_warrior',     label: 'Week Warrior',         desc: '7-day study streak',                               icon: 'fa-solid fa-fire-flame-curved', xp: 50,   color: '#ef4444' },
    { id: 'fortnight_focus',  label: 'Fortnight Focus',      desc: '14-day study streak',                              icon: 'fa-solid fa-calendar-check',    xp: 75,   color: '#8b5cf6' },
    { id: 'monthly_devotion', label: 'Monthly Devotion',     desc: '30-day study streak',                              icon: 'fa-solid fa-medal',             xp: 150,  color: '#06b6d4' },
    { id: 'sixty_strong',     label: 'Sixty Days Strong',    desc: '60-day study streak',                              icon: 'fa-solid fa-shield-halved',     xp: 200,  color: '#0ea5e9' },
    { id: 'quarterly',        label: 'Quarterly Commitment', desc: '90-day study streak',                              icon: 'fa-solid fa-star',              xp: 300,  color: '#eab308' },
    { id: 'year_medicine',    label: 'Year of Medicine',     desc: '365-day study streak',                             icon: 'fa-solid fa-graduation-cap',    xp: 1000, color: '#14b8a6' },
    { id: 'perfectionist',    label: 'Perfectionist',        desc: '100% accuracy in a flashcard session (10+ cards)', icon: 'fa-solid fa-bullseye',          xp: 50,   color: '#10b981' },
    { id: 'on_a_roll',        label: 'On a Roll',            desc: '10 consecutive correct flashcard reviews',         icon: 'fa-solid fa-bolt-lightning',    xp: 30,   color: '#eab308' },
    { id: 'clinical_clarity', label: 'Clinical Clarity',     desc: '90%+ accuracy in a Chart Decrypter session',      icon: 'fa-solid fa-stethoscope',       xp: 50,   color: '#6366f1' },
    { id: 'rising_star',      label: 'Rising Star',          desc: 'Reach Level 5 — Fourth-Year Student',             icon: 'fa-solid fa-star-half-stroke',  xp: 50,   color: '#a855f7' },
    { id: 'intern_life',      label: 'Intern Life',          desc: 'Reach Level 6 — Medical Intern',                  icon: 'fa-solid fa-user-doctor',       xp: 75,   color: '#06b6d4' },
    { id: 'doctor_is_in',     label: 'The Doctor Is In',     desc: 'Reach Level 11 — Attending Physician',            icon: 'fa-solid fa-stethoscope',       xp: 200,  color: '#14b8a6' },
    { id: 'early_bird',       label: 'Early Bird',           desc: 'Complete a study session before 7 AM',             icon: 'fa-solid fa-sun',               xp: 25,   color: '#f59e0b' },
    { id: 'night_owl',        label: 'Night Owl',            desc: 'Complete a study session after 11 PM',             icon: 'fa-solid fa-moon',              xp: 25,   color: '#6366f1' },
    { id: 'comeback_kid',     label: 'Comeback Kid',         desc: 'Return after a 3+ day absence',                    icon: 'fa-solid fa-rotate-right',      xp: 20,   color: '#14b8a6' },
    { id: 'dedicated',        label: 'Dedicated',            desc: 'Complete all daily quests 7 days running',         icon: 'fa-solid fa-calendar-days',     xp: 100,  color: '#8b5cf6' },
];

const QUEST_TEMPLATES = [
    { id: 'review_10',      category: 'volume',      label: 'Review 10 flashcards',                 target: 10, xpReward: 20, field: 'fcReviewed'      },
    { id: 'review_25',      category: 'volume',      label: 'Review 25 flashcards',                 target: 25, xpReward: 40, field: 'fcReviewed'      },
    { id: 'wb_5',           category: 'volume',      label: 'Complete 5 Word Builder challenges',   target: 5,  xpReward: 30, field: 'wbCompleted'     },
    { id: 'ad_10',          category: 'volume',      label: 'Decode 10 abbreviations',              target: 10, xpReward: 25, field: 'adCompleted'     },
    { id: 'pl_8',           category: 'volume',      label: 'Complete 8 Pluralization terms',       target: 8,  xpReward: 20, field: 'plCompleted'     },
    { id: 'new_3',          category: 'mastery',     label: 'Learn 3 new terms today',              target: 3,  xpReward: 40, field: 'newLearned'      },
    { id: 'review_overdue', category: 'mastery',     label: 'Review 5 overdue flashcards',          target: 5,  xpReward: 35, field: 'overdueReviewed' },
    { id: 'use_tutor_2',    category: 'exploration', label: 'Ask the AI Tutor 2 questions',         target: 2,  xpReward: 20, field: 'tutorMessages'   },
    { id: 'use_tutor_5',    category: 'exploration', label: 'Ask the AI Tutor 5 questions',         target: 5,  xpReward: 35, field: 'tutorMessages'   },
    { id: 'chart_5',        category: 'exploration', label: 'Answer 5 Chart Decrypter questions',   target: 5,  xpReward: 30, field: 'cdAnswered'      },
];

const chartSentences = [
    { system: 'Digestive',       text: "The patient presented with severe <strong>hepatomegaly</strong> upon physical examination.", answer: "enlarged liver", fallback: "liver enlargement" },
    { system: 'Digestive',       text: "Due to chronic gallstones, the surgeon recommended a <strong>cholecystectomy</strong>.", answer: "surgical removal of the gallbladder", fallback: "gallbladder removal" },
    { system: 'Cardiovascular',  text: "ECG results indicate the presence of <strong>bradycardia</strong>.", answer: "slow heart", fallback: "slow heart rate" },

    // New Advanced Scenarios (SOAP Notes)
    { system: 'Respiratory',     text: "<strong>SUBJECTIVE:</strong> Patient reports severe SOB. <br><strong>OBJECTIVE:</strong> Patient displays obvious <strong>tachypnea</strong> at rest.", answer: "fast breathing", fallback: "rapid breathing" },
    { system: 'Nervous',         text: "<strong>ASSESSMENT:</strong> MRI confirms a diagnosis of <strong>encephalopathy</strong>.", answer: "disease of the brain", fallback: "brain disease" },
    { system: 'Musculoskeletal', text: "<strong>PLAN:</strong> Schedule physical therapy for severe <strong>osteomalacia</strong>.", answer: "softening of the bone", fallback: "bone softening" },
    { system: 'Musculoskeletal', text: "<strong>OBJECTIVE:</strong> Observation reveals acute <strong>arthritis</strong> in the left knee.", answer: "inflammation of the joint", fallback: "joint inflammation" },
    { system: 'Nervous',         text: "<strong>SUBJECTIVE:</strong> Patient complains of intense <strong>neuralgia</strong> radiating down the leg.", answer: "nerve pain", fallback: "pain in the nerve" },
    { system: 'Respiratory',     text: "<strong>ASSESSMENT:</strong> Symptoms are consistent with acute <strong>bronchitis</strong>.", answer: "inflammation of the bronchus", fallback: "bronchus inflammation" },
    { system: 'Respiratory',     text: "<strong>PLAN:</strong> Prescribe broad-spectrum antibiotics to treat the <strong>pneumonitis</strong>.", answer: "inflammation of the lung", fallback: "lung inflammation" },

    // Additional clinical scenarios
    { system: 'Blood/Immune',    text: "Imaging reveals significant <strong>splenomegaly</strong> consistent with portal hypertension.", answer: "enlargement of the spleen", fallback: "enlarged spleen" },
    { system: 'Urinary',         text: "The nephrologist diagnosed the patient with acute <strong>nephritis</strong>.", answer: "inflammation of the kidney", fallback: "kidney inflammation" },
    { system: 'Integumentary',   text: "The dermatologist noted patches of <strong>dermatitis</strong> on both forearms.", answer: "inflammation of the skin", fallback: "skin inflammation" },
    { system: 'Musculoskeletal', text: "<strong>PLAN:</strong> Patient will undergo <strong>arthroscopy</strong> of the left knee next week.", answer: "visual examination of a joint", fallback: "joint examination" },
    { system: 'Musculoskeletal', text: "The patient reports chronic <strong>myalgia</strong> in the lower extremities.", answer: "muscle pain", fallback: "pain in the muscle" },
    { system: 'Foundations',     text: "Biopsy results confirm a diagnosis of <strong>carcinoma</strong> in situ.", answer: "cancerous tumor", fallback: "cancer" },
    { system: 'Urinary',         text: "Lab results show elevated creatinine, consistent with <strong>nephropathy</strong>.", answer: "disease of the kidney", fallback: "kidney disease" },
    { system: 'Respiratory',     text: "<strong>SUBJECTIVE:</strong> Patient complains of persistent <strong>rhinorrhea</strong> and sneezing.", answer: "discharge from the nose", fallback: "runny nose" },
    { system: 'Nervous',         text: "<strong>ASSESSMENT:</strong> EEG findings suggest temporal lobe <strong>encephalitis</strong>.", answer: "inflammation of the brain", fallback: "brain inflammation" },
    { system: 'Digestive',       text: "Post-op note: <strong>cholecystitis</strong> confirmed intraoperatively.", answer: "inflammation of the gallbladder", fallback: "gallbladder inflammation" },
    { system: 'Endocrine',       text: "The patient was started on insulin therapy for <strong>hyperglycemia</strong>.", answer: "excessive sugar in the blood", fallback: "high blood sugar" },
    { system: 'Digestive',       text: "<strong>PLAN:</strong> Schedule follow-up four weeks after <strong>appendectomy</strong>.", answer: "surgical removal of the appendix", fallback: "appendix removal" },
    { system: 'Cardiovascular',  text: "Imaging shows moderate <strong>cardiomegaly</strong> with preserved ejection fraction.", answer: "enlargement of the heart", fallback: "enlarged heart" },
    { system: 'Musculoskeletal', text: "The patient has a long-standing diagnosis of <strong>osteoporosis</strong>.", answer: "decreased bone density", fallback: "porous bones" },
    { system: 'Nervous',         text: "Neurological exam reveals <strong>hemiplegia</strong> on the left side.", answer: "paralysis of one side of the body", fallback: "one-sided paralysis" },
    { system: 'Urinary',         text: "Urine dipstick is positive for <strong>hematuria</strong>.", answer: "blood in the urine", fallback: "blood in urine" },
    { system: 'Cardiovascular',  text: "<strong>OBJECTIVE:</strong> Patient presents with signs of <strong>thrombosis</strong> in the left femoral vein.", answer: "formation of a blood clot", fallback: "blood clot" },
    { system: 'Special Senses',  text: "Patient referred to <strong>ophthalmology</strong> for progressive vision loss.", answer: "study of the eye", fallback: "eye specialist" },
    { system: 'Respiratory',     text: "<strong>ASSESSMENT:</strong> Pulmonary function tests confirm significant <strong>dyspnea</strong> on exertion.", answer: "difficulty breathing", fallback: "difficult breathing" },
    { system: 'Blood/Immune',    text: "The CBC shows severe <strong>leukopenia</strong> requiring immediate intervention.", answer: "deficiency of white blood cells", fallback: "low white blood cells" }
];

// ==========================================
// APP STATE
// ==========================================
let state = {
    activeSystem: 'All',
    streak: 0,
    intervals: {}, // ID -> interval mappings
    
    // Feature A
    flashcards: [],
    fcIndex: 0,
    fcFlipped: false,
    newCardsLearnedToday: 0,

    // Feature B
    wbChallengeIndex: 0,
    wbSlots: { prefix: null, root1: null, root2: null, suffix: null },
    
    // Feature C
    cdIndex: 0,
    cdOrder: [],      // shuffled index array into chartSentences
    cdCorrect: 0,     // first-attempt correct count for this session
    cdAttempts: 0,    // wrong attempts on the current card
    
    // Feature D
    adIndex: 0,

    // Feature E (Pluralization)
    plIndex: 0,

    // Flashcard enhancements
    reverseMode: false,
    dueDates: {},
    easeFactors: {}, // SM-2 per-card difficulty multiplier (default 2.5)
    lapses: {},      // id -> cumulative error count
    sessionCorrect: 0,
    sessionTotal: 0,
    sessionScoredIds: new Set(), // tracks which card IDs have already been counted toward persistent stats this session

    // Feature G: AI Tutor
    chatHistory: [],

    // Mini card chat (per-card after grading)
    miniChatHistory: [],
    miniChatIsEnd: false,
    miniChatAbortCtrl: null,

    // Feature H: Theme
    darkMode: true,

    // Gamification state
    wbAttempts: 0,
    adAttempts: 0,
    plConsecutiveCorrect: 0,
    sessionXP: 0,
    sessionConsecutiveCorrect: 0,
};

// ==========================================
// GAMIFICATION MODULE VARS
// ==========================================
let xpData           = { total: 0, level: 1, dailyXP: {}, dailyFcXP: {}, dailyActivities: {} };
let achievementsData = { unlocked: [], unlockedDates: {} };
let dailyQuestsData  = { date: '', quests: [] };
let statsData        = { totalReviews: 0, totalCorrect: 0, fcAgain: 0, fcHard: 0, fcGood: 0, fcEasy: 0, fcAgainTotal: 0, fcHardTotal: 0, fcGoodTotal: 0, fcEasyTotal: 0, fcGradeMap: {}, wbChallenges: 0, wbCorrect: 0, cdAnswered: 0, cdCorrect: 0, adAnswered: 0, adCorrect: 0, plAnswered: 0, plCorrect: 0 };
// (extra closing brace removed — state obj now ends above)

const SYSTEMS = ['All', 'Prefixes', 'Suffixes (Surgical)', 'Suffixes (Diagnostic)', 'Suffixes (Pathological)', 'Cardiovascular', 'Digestive', 'Respiratory', 'Nervous', 'Musculoskeletal', 'Integumentary', 'Endocrine', 'Urinary', 'Reproductive', 'Blood/Immune', 'Special Senses', 'Foundations', 'Abbreviations'];

function renderSystemMenu() {
    const pillMenu = document.getElementById('system-pill-menu');
    const mobileMenu = document.getElementById('system-filter-mobile');
    const sidebarList = document.getElementById('system-sidebar-list');

    if (pillMenu) pillMenu.innerHTML = '';
    if (mobileMenu) mobileMenu.innerHTML = '';
    if (sidebarList) sidebarList.innerHTML = '';

    SYSTEMS.forEach(sys => {
        // Pill (kept for compatibility, element no longer in DOM)
        if (pillMenu) {
            const btn = document.createElement('button');
            btn.className = `px-4 py-2 text-sm font-bold rounded-full whitespace-nowrap transition-colors ${sys === state.activeSystem ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`;
            btn.textContent = sys;
            btn.onclick = () => setActiveSystem(sys);
            pillMenu.appendChild(btn);
        }
        // Mobile dropdown
        if (mobileMenu) {
            const opt = document.createElement('option');
            opt.value = sys;
            opt.textContent = sys;
            if (sys === state.activeSystem) opt.selected = true;
            mobileMenu.appendChild(opt);
        }
        // Desktop sidebar list
        if (sidebarList) {
            const btn = document.createElement('button');
            const isActive = sys === state.activeSystem;
            btn.className = `w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${isActive ? 'bg-teal-50 text-teal-700 font-bold' : 'text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900'}`;
            btn.textContent = sys;
            btn.onclick = () => setActiveSystem(sys);
            sidebarList.appendChild(btn);
        }
    });
}

function setActiveSystem(sys) {
    state.activeSystem = sys;
    renderSystemMenu();
    renderFlashcards();
}

// ==========================================
// INITIALIZATION & DATA MIGRATION
// ==========================================
(function migrateLocalStorage() {
    const keys = ['progress', 'lapses', 'duedates', 'ease', 'streak', 'darkmode', 'xp', 'achievements', 'daily_quests', 'stats'];
    keys.forEach(k => {
        const oldVal = localStorage.getItem('medterm_' + k);
        if (oldVal !== null && localStorage.getItem('syngnosia_' + k) === null) {
            localStorage.setItem('syngnosia_' + k, oldVal);
        }
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    checkLegalConsent();
    loadState();
    applyDarkMode(state.darkMode);
    renderSystemMenu();
    setupEventListeners();
    switchTab('flashcards');
    renderFlashcards();
    renderWordBuilder();
    restartCd();
    renderAbbrevDecoder();
    renderPluralization();
    checkOllamaStatus();
    renderChatSuggestions();
});

function loadState() {
    // Spaced Repetition Data
    const savedIntervals = localStorage.getItem('syngnosia_progress');
    if (savedIntervals) state.intervals = JSON.parse(savedIntervals);
    
    // Lapse/Error Data
    const savedLapses = localStorage.getItem('syngnosia_lapses');
    if (savedLapses) state.lapses = JSON.parse(savedLapses);
    else state.lapses = {};

    // Due Date Data (time-based SRS scheduling)
    const savedDueDates = localStorage.getItem('syngnosia_duedates');
    if (savedDueDates) state.dueDates = JSON.parse(savedDueDates);
    else state.dueDates = {};

    // Ease Factor Data (SM-2 per-card difficulty multiplier, default 2.5)
    const savedEase = localStorage.getItem('syngnosia_ease');
    if (savedEase) state.easeFactors = JSON.parse(savedEase);
    else state.easeFactors = {};
    
    // Seeded Shuffle: stable per-day order using a proper Fisher-Yates + seeded PRNG.
    // Math.sin-based LCG gives a reproducible sequence; Fisher-Yates guarantees
    // a uniform distribution (unlike the biased .sort(random) anti-pattern).
    const today = new Date().toDateString();
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i);
    const seededRandom = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
    for (let i = dictionary.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [dictionary[i], dictionary[j]] = [dictionary[j], dictionary[i]];
    }
    
    dictionary.forEach(term => {
        term.interval = state.intervals[term.id] || 0;
        term.errorCount = state.lapses[term.id] || 0;
    });

    // Daily Streak & Limits Logic
    const streakDataStr = localStorage.getItem('syngnosia_streak');
    
    if (streakDataStr) {
        const streakData = JSON.parse(streakDataStr);
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (streakData.lastDate === today) {
            state.streak = streakData.count; // Already visited today
            state.newCardsLearnedToday = streakData.newLearned || 0;
        } else if (streakData.lastDate === yesterday.toDateString()) {
            state.streak = streakData.count + 1; // Consecutive day
            state.newCardsLearnedToday = 0;
            saveStreak(today, state.streak, 0);
        } else {
            // Check for streak shield before breaking
            loadGamificationData(); // ensure xpData loaded before checking shields
            if ((xpData.streakShields || 0) > 0) {
                xpData.streakShields--;
                saveXPData();
                state.streak = streakData.count; // Preserve streak via shield
                state.newCardsLearnedToday = 0;
                saveStreak(today, state.streak, 0);
            } else {
                // Check if this is a comeback (3+ day absence)
                const lastDate = new Date(streakData.lastDate);
                const diffDays = Math.floor((new Date(today) - lastDate) / 86400000);
                if (diffDays >= 3) {
                    setTimeout(() => checkAchievements('comeback', {}), 500);
                }
                state.streak = 1; // Streak broken
                state.newCardsLearnedToday = 0;
                saveStreak(today, state.streak, 0);
            }
        }
    } else {
        state.streak = 1; // First visit
        state.newCardsLearnedToday = 0;
        saveStreak(today, state.streak, 0);
    }
    
    document.getElementById('streak-counter').textContent = state.streak;
    updateMasteryProgress();
    loadGamificationData();
    updateXPBar();
    updateShieldIndicator(xpData.streakShields || 0);
    renderQuestWidget();
    checkStreakMilestone(state.streak);

    // Theme preference (default: dark)
    const savedDark = localStorage.getItem('syngnosia_darkmode');
    state.darkMode = savedDark !== null ? savedDark === 'true' : true;
}

function updateMasteryProgress() {
    const totalTerms = dictionary.length;
    // Mastery = seen over multiple weeks (interval >= 7 ≈ 2+ weeks of spaced review)
    const masteredTerms = dictionary.filter(t => t.interval >= 7).length;
    const percentage = Math.round((masteredTerms / totalTerms) * 100);
    
    const textEl = document.getElementById('mastery-text');
    const barEl = document.getElementById('mastery-progress');
    
    if (textEl && barEl) {
        textEl.textContent = `${percentage}%`;
        barEl.style.width = `${percentage}%`;
    }
    checkAchievements('mastery_update', { mastered: masteredTerms });
}

function saveStreak(date, count, newLearned) {
    if (newLearned === undefined) newLearned = state.newCardsLearnedToday;
    localStorage.setItem('syngnosia_streak', JSON.stringify({
        lastDate: date,
        count: count,
        newLearned: newLearned,
        shields: xpData.streakShields || 0,
    }));
}

function saveIntervals() {
    localStorage.setItem('syngnosia_progress', JSON.stringify(state.intervals));
}

function saveLapses() {
    localStorage.setItem('syngnosia_lapses', JSON.stringify(state.lapses));
}

function saveDueDates() {
    localStorage.setItem('syngnosia_duedates', JSON.stringify(state.dueDates));
}

function saveDarkMode() {
    localStorage.setItem('syngnosia_darkmode', state.darkMode);
}

function applyDarkMode(isDark) {
    state.darkMode = isDark;
    document.documentElement.classList.toggle('dark', isDark);
    const checkEl = document.getElementById('modal-dark-toggle');
    if (checkEl) checkEl.checked = isDark;
}

function toggleDarkMode() {
    applyDarkMode(!state.darkMode);
    saveDarkMode();
}

function saveEaseFactors() {
    localStorage.setItem('syngnosia_ease', JSON.stringify(state.easeFactors));
}

// ==========================================
// GAMIFICATION ENGINE
// ==========================================
function saveXPData()      { localStorage.setItem('syngnosia_xp', JSON.stringify(xpData)); }
function saveAchievements(){ localStorage.setItem('syngnosia_achievements', JSON.stringify(achievementsData)); }
function saveDailyQuests() { localStorage.setItem('syngnosia_daily_quests', JSON.stringify(dailyQuestsData)); }
function saveStats()       { localStorage.setItem('syngnosia_stats', JSON.stringify(statsData)); }

function loadGamificationData() {
    const savedXP   = localStorage.getItem('syngnosia_xp');
    if (savedXP) xpData = JSON.parse(savedXP);

    const savedAch  = localStorage.getItem('syngnosia_achievements');
    if (savedAch) achievementsData = JSON.parse(savedAch);

    const savedQ    = localStorage.getItem('syngnosia_daily_quests');
    if (savedQ) dailyQuestsData = JSON.parse(savedQ);

    const savedStat = localStorage.getItem('syngnosia_stats');
    if (savedStat) statsData = JSON.parse(savedStat);

    // Refresh daily quests if it's a new day
    const today = new Date().toDateString();
    if (dailyQuestsData.date !== today) generateDailyQuests();
}

function getStreakMultiplier() {
    const s = state.streak;
    if (s >= 100) return 2.0;
    if (s >= 30)  return 1.5;
    if (s >= 7)   return 1.25;
    return 1.0;
}

function getDailyFcXP() {
    const today = new Date().toDateString();
    return (xpData.dailyFcXP && xpData.dailyFcXP[today]) || 0;
}

function awardXP(baseAmount, source) {
    if (baseAmount <= 0) return 0;
    const today = new Date().toDateString();

    // Daily soft-cap for flashcard XP
    let amount = baseAmount;
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

    // Interleaving bonus: +15% per additional activity type used today beyond 1
    xpData.dailyActivities = xpData.dailyActivities || {};
    const todayActs = xpData.dailyActivities[today] || [];
    if (!todayActs.includes(source)) todayActs.push(source);
    xpData.dailyActivities[today] = todayActs;
    const interleavingBonus = Math.max(0, todayActs.length - 1) * 0.15;
    if (interleavingBonus > 0) amount = Math.round(amount * (1 + interleavingBonus));

    xpData.total = (xpData.total || 0) + amount;
    xpData.dailyXP = xpData.dailyXP || {};
    xpData.dailyXP[today] = (xpData.dailyXP[today] || 0) + amount;
    state.sessionXP = (state.sessionXP || 0) + amount;

    const oldLevel = xpData.level || 1;
    checkLevelUp(oldLevel);
    saveXPData();
    updateXPBar();
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

function showLevelUpModal(oldLevel, newLvlObj) {
    const modal = document.getElementById('modal-levelup');
    if (!modal) return;
    document.getElementById('levelup-level').textContent = `Level ${newLvlObj.level}`;
    document.getElementById('levelup-title').textContent = newLvlObj.title;
    modal.classList.remove('hidden');
}

function closeLevelUpModal() {
    const modal = document.getElementById('modal-levelup');
    if (modal) modal.classList.add('hidden');
}

function updateXPBar() {
    const lvlObj  = getLevelFromXP(xpData.total);
    const nextLvl = LEVELS.find(l => l.level === lvlObj.level + 1);
    let pct = 100;
    if (nextLvl) {
        const range  = nextLvl.xpRequired - lvlObj.xpRequired;
        const earned = xpData.total - lvlObj.xpRequired;
        pct = Math.min(100, Math.round((earned / range) * 100));
    }

    const barEl    = document.getElementById('xp-progress');
    const textEl   = document.getElementById('xp-header-text');
    const levelNum = document.getElementById('level-num');
    const levelTtl = document.getElementById('level-title');

    if (barEl)    barEl.style.width = `${pct}%`;
    if (textEl)   textEl.textContent = `${xpData.total.toLocaleString()} XP`;
    if (levelNum) levelNum.textContent = lvlObj.level;
    if (levelTtl) levelTtl.textContent = lvlObj.title.split(' ').slice(0, 2).join(' ');
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

function generateDailyQuests() {
    const today = new Date().toDateString();
    const volTemplates  = QUEST_TEMPLATES.filter(q => q.category === 'volume');
    const mastTemplates = QUEST_TEMPLATES.filter(q => q.category === 'mastery');
    const expTemplates  = QUEST_TEMPLATES.filter(q => q.category === 'exploration');

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    dailyQuestsData = {
        date: today,
        quests: [
            { ...pick(volTemplates),  current: 0, completed: false },
            { ...pick(mastTemplates), current: 0, completed: false },
            { ...pick(expTemplates),  current: 0, completed: false },
        ]
    };
    saveDailyQuests();
    renderQuestWidget();
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
        if (allDone) awardXP(50, 'quest'); // Daily Master bonus
        checkDedicatedAchievement();
    }
    saveDailyQuests();
    renderQuestWidget();
}

function checkDedicatedAchievement() {
    // Check if user has completed all quests for 7 consecutive days (simplified: check last 7 days of quest data)
    // We store completion dates — for simplicity, track in xpData
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

function renderQuestWidget() {
    const listEl = document.getElementById('quest-list');
    if (!listEl) return;
    if (!dailyQuestsData.quests || dailyQuestsData.quests.length === 0) {
        listEl.innerHTML = '<p class="text-xs text-gray-400">No quests today.</p>';
        return;
    }
    listEl.innerHTML = dailyQuestsData.quests.map(q => {
        const pct  = Math.min(100, Math.round((q.current / q.target) * 100));
        const done = q.completed;
        return `<div class="flex items-center gap-2">
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-0.5">
                    <span class="text-xs font-semibold ${done ? 'text-teal-600 line-through' : 'text-gray-600'} truncate">${q.label}</span>
                    <span class="text-[10px] font-bold ${done ? 'text-teal-500' : 'text-violet-500'} ml-2 shrink-0">${done ? '✓' : `${q.current}/${q.target}`} +${q.xpReward}XP</span>
                </div>
                <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full ${done ? 'bg-teal-400' : 'bg-violet-400'} rounded-full transition-all duration-500" style="width:${pct}%"></div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function checkAchievements(trigger, data) {
    const unlocked = achievementsData.unlocked || [];
    const has = id => unlocked.includes(id);

    switch (trigger) {
        case 'flashcard_reviewed':
            if (!has('first_steps') && statsData.totalReviews >= 1) unlockAchievement('first_steps');
            if (!has('on_a_roll') && state.sessionConsecutiveCorrect >= 10) unlockAchievement('on_a_roll');
            if (!has('perfectionist') && state.sessionTotal >= 10 && state.sessionCorrect === state.sessionTotal) unlockAchievement('perfectionist');
            // Time-based
            const h = new Date().getHours();
            if (!has('early_bird') && h < 7) unlockAchievement('early_bird');
            if (!has('night_owl') && h >= 23) unlockAchievement('night_owl');
            break;
        case 'word_builder_correct':
            if (!has('word_weaver')) unlockAchievement('word_weaver');
            break;
        case 'chart_correct':
            if (!has('chart_reader') && statsData.cdAnswered >= 1) unlockAchievement('chart_reader');
            break;
        case 'abbrev_correct':
            if (!has('code_cracker') && statsData.adAnswered >= 1) unlockAchievement('code_cracker');
            break;
        case 'plural_correct':
            if (!has('speed_speller') && statsData.plAnswered >= 1) unlockAchievement('speed_speller');
            break;
        case 'mastery_update':
            if (!has('hundred_club')  && data.mastered >= 100)  unlockAchievement('hundred_club');
            if (!has('half_mastered') && data.mastered >= 500)  unlockAchievement('half_mastered');
            if (!has('full_mastery')  && data.mastered >= dictionary.length) unlockAchievement('full_mastery');
            break;
        case 'cd_session_complete':
            if (!has('clinical_clarity') && data.pct >= 90) unlockAchievement('clinical_clarity');
            break;
        case 'level_up':
            if (!has('rising_star')  && data.level >= 5)  unlockAchievement('rising_star');
            if (!has('intern_life')  && data.level >= 6)  unlockAchievement('intern_life');
            if (!has('doctor_is_in') && data.level >= 11) unlockAchievement('doctor_is_in');
            break;
        case 'comeback':
            if (!has('comeback_kid')) unlockAchievement('comeback_kid');
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

function checkStreakMilestone(count) {
    // Award streak achievements
    const milestones = [
        { days: 3,   id: 'habit_3'          },
        { days: 7,   id: 'week_warrior'      },
        { days: 14,  id: 'fortnight_focus'   },
        { days: 30,  id: 'monthly_devotion'  },
        { days: 60,  id: 'sixty_strong'      },
        { days: 90,  id: 'quarterly'         },
        { days: 365, id: 'year_medicine'     },
    ];
    milestones.forEach(m => {
        if (count >= m.days) checkAchievements('streak_milestone', { id: m.id });
    });
    // Grant streak shield at 7/30/60 days
    const shieldMilestones = [7, 30, 60];
    if (shieldMilestones.includes(count)) {
        xpData.streakShields = Math.min(3, (xpData.streakShields || 0) + 1);
        saveXPData();
        updateShieldIndicator(xpData.streakShields);
    }
    // Unlock streak achievements directly
    milestones.forEach(m => {
        if (count === m.days) unlockAchievement(m.id);
    });
}

function updateShieldIndicator(count) {
    const el = document.getElementById('shield-indicator');
    if (!el) return;
    if (count > 0) {
        el.classList.remove('hidden');
        el.textContent = '🛡️'.repeat(count);
    } else {
        el.classList.add('hidden');
    }
}

function updateStats(field, delta) {
    if (statsData[field] !== undefined) {
        statsData[field] += delta;
    } else {
        statsData[field] = delta;
    }
    saveStats();
}

function openStatsModal() {
    renderStatsModal();
    document.getElementById('modal-stats').classList.remove('hidden');
}

function closeStatsModal() {
    document.getElementById('modal-stats').classList.add('hidden');
}

function renderStatsModal() {
    const lvlObj = getLevelFromXP(xpData.total);
    const el = id => document.getElementById(id);
    if (el('stats-level-text')) el('stats-level-text').textContent = `Level ${lvlObj.level} — ${lvlObj.title}`;
    if (el('stats-total-xp'))   el('stats-total-xp').textContent   = `${(xpData.total || 0).toLocaleString()} XP`;

    // Weekly XP chart (last 7 days)
    const chart = el('stats-xp-chart');
    if (chart) {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            days.push(d.toDateString());
        }
        const vals = days.map(d => (xpData.dailyXP && xpData.dailyXP[d]) || 0);
        const maxV = Math.max(...vals, 1);
        chart.innerHTML = days.map((d, i) => {
            const h = Math.max(4, Math.round((vals[i] / maxV) * 64));
            const today = new Date().toDateString();
            const isToday = d === today;
            return `<div class="flex-1 flex flex-col items-center gap-1">
                <div class="w-full rounded-t-sm ${isToday ? 'bg-violet-500' : 'bg-violet-200'} transition-all" style="height:${h}px"></div>
                <span class="text-[9px] text-gray-400">${['S','M','T','W','T','F','S'][new Date(d).getDay()]}</span>
            </div>`;
        }).join('');
    }

    // Activity accuracy
    const acts = el('stats-activities');
    if (acts) {
        const rows = [
            { label: 'Flashcards',        correct: statsData.totalCorrect, total: statsData.totalReviews },
            { label: 'Word Builder',       correct: statsData.wbCorrect,    total: statsData.wbChallenges },
            { label: 'Chart Decrypter',    correct: statsData.cdCorrect,    total: statsData.cdAnswered   },
            { label: 'Abbreviations',      correct: statsData.adCorrect,    total: statsData.adAnswered   },
            { label: 'Pluralization',      correct: statsData.plCorrect,    total: statsData.plAnswered   },
        ];
        acts.innerHTML = rows.map(r => {
            const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
            return `<div>
                <div class="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                    <span>${r.label}</span>
                    <span>${pct}% <span class="text-gray-400 font-normal">(${r.correct}/${r.total})</span></span>
                </div>
                <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full bg-teal-400 rounded-full" style="width:${pct}%"></div>
                </div>
            </div>`;
        }).join('');
    }

    // Flashcard grade breakdown
    const fcBreakdown = el('stats-fc-breakdown');
    if (fcBreakdown) {
        // First-encounter counts (each card counted once per session)
        const again    = statsData.fcAgain || 0;
        const hard     = statsData.fcHard  || 0;
        const good     = statsData.fcGood  || 0;
        const easy     = statsData.fcEasy  || 0;
        // All-time button press totals (every single press)
        const againT   = statsData.fcAgainTotal || 0;
        const hardT    = statsData.fcHardTotal  || 0;
        const goodT    = statsData.fcGoodTotal  || 0;
        const easyT    = statsData.fcEasyTotal  || 0;
        const pressTotal = againT + hardT + goodT + easyT;

        if (pressTotal === 0) {
            fcBreakdown.innerHTML = '<p class="text-sm text-gray-400 font-medium text-center py-3">No flashcard reviews yet — start a session to see your breakdown.</p>';
        } else {
            const pct = (n, t) => t > 0 ? Math.round((n / t) * 100) : 0;

            const pressSegs = [
                { label: 'Again', count: againT, p: pct(againT, pressTotal), bar: 'bg-rose-400',    chip: 'bg-rose-50 border-rose-100',       txt: 'text-rose-600'    },
                { label: 'Hard',  count: hardT,  p: pct(hardT,  pressTotal), bar: 'bg-amber-400',   chip: 'bg-amber-50 border-amber-100',     txt: 'text-amber-600'   },
                { label: 'Good',  count: goodT,  p: pct(goodT,  pressTotal), bar: 'bg-teal-400',    chip: 'bg-teal-50 border-teal-100',       txt: 'text-teal-600'    },
                { label: 'Easy',  count: easyT,  p: pct(easyT,  pressTotal), bar: 'bg-emerald-400', chip: 'bg-emerald-50 border-emerald-100', txt: 'text-emerald-600' },
            ];

            const uniqueSegs = [
                { label: 'Again', count: again, bg: 'bg-rose-100 text-rose-700'       },
                { label: 'Hard',  count: hard,  bg: 'bg-amber-100 text-amber-700'     },
                { label: 'Good',  count: good,  bg: 'bg-teal-100 text-teal-700'       },
                { label: 'Easy',  count: easy,  bg: 'bg-emerald-100 text-emerald-700' },
            ];

            // Build sorted card lists from the most-recent-grade map
            const gradeMap  = statsData.fcGradeMap || {};
            const hardCards = [], goodCards = [], easyCards = [];
            Object.entries(gradeMap).forEach(([id, g]) => {
                const c = dictionary.find(d => d.id === id);
                if (!c) return;
                if (g === 1) hardCards.push(c);
                else if (g === 2) goodCards.push(c);
                else if (g === 3) easyCards.push(c);
            });
            hardCards.sort((a, b) => a.term.localeCompare(b.term));
            goodCards.sort((a, b) => a.term.localeCompare(b.term));
            easyCards.sort((a, b) => a.term.localeCompare(b.term));

            const renderCardList = (cards, btnCls) => cards.length === 0
                ? '<p class="text-xs text-gray-400 italic">None yet</p>'
                : `<div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">${cards.map(c =>
                    `<button onclick="openFcPracticePopup('${c.id}')" class="text-xs font-semibold px-2.5 py-1 rounded-full border ${btnCls} hover:opacity-75 transition-opacity">${c.term}</button>`
                  ).join('')}</div>`;

            fcBreakdown.innerHTML =
                `<p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">All-Time Button Presses · ${pressTotal} total</p>
                <div class="flex h-4 rounded-full overflow-hidden gap-px mb-3">
                    ${pressSegs.map(s => s.count > 0 ? `<div class="${s.bar}" style="width:${s.p}%" title="${s.label}: ${s.count} (${s.p}%)"></div>` : '').join('')}
                </div>
                <div class="grid grid-cols-4 gap-2 mb-5">
                    ${pressSegs.map(s => `<div class="flex flex-col items-center ${s.chip} border rounded-2xl py-3 px-1">
                        <span class="text-lg font-extrabold ${s.txt}">${s.count}</span>
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-0.5">${s.label}</span>
                        <span class="text-[10px] text-gray-400 font-medium">${s.p}%</span>
                    </div>`).join('')}
                </div>
                <div class="flex items-center gap-3 mb-5">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">Unique Cards</p>
                    <div class="flex-1 h-px bg-gray-100"></div>
                    <div class="flex gap-1.5">
                        ${uniqueSegs.map(s => `<span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${s.bg}">${s.label}&nbsp;${s.count}</span>`).join('')}
                    </div>
                </div>
                <div class="space-y-4">
                    <div>
                        <p class="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-2"><i class="fa-solid fa-circle-exclamation mr-1"></i>Hard (${hardCards.length})</p>
                        ${renderCardList(hardCards, 'bg-amber-50 border-amber-200 text-amber-700')}
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-teal-600 uppercase tracking-widest mb-2"><i class="fa-solid fa-check mr-1"></i>Good (${goodCards.length})</p>
                        ${renderCardList(goodCards, 'bg-teal-50 border-teal-200 text-teal-700')}
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-2"><i class="fa-solid fa-star mr-1"></i>Easy (${easyCards.length})</p>
                        ${renderCardList(easyCards, 'bg-emerald-50 border-emerald-200 text-emerald-700')}
                    </div>
                </div>`;
        }
    }

    // Badge gallery
    const badges = el('stats-badges');
    if (badges) {
        badges.innerHTML = ACHIEVEMENTS.map(a => {
            const owned = achievementsData.unlocked.includes(a.id);
            return `<div title="${a.label}: ${a.desc}" class="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${owned ? 'opacity-100' : 'opacity-20 grayscale'}" style="background:${a.color}22;border-color:${a.color}55">
                <i class="${a.icon} text-sm" style="color:${owned ? a.color : '#9ca3af'}"></i>
            </div>`;
        }).join('');
    }
}

// ==========================================
// FLASHCARD PRACTICE POPUP (from stats modal)
// ==========================================
let _statsScrollPos = 0; // saved scroll position of the stats modal body

function openFcPracticePopup(cardId) {
    const card = dictionary.find(c => c.id === cardId);
    if (!card) return;
    document.getElementById('fc-practice-type').textContent    = card.type;
    document.getElementById('fc-practice-term').textContent    = card.term;
    document.getElementById('fc-practice-meaning').textContent = card.meaning;
    document.getElementById('fc-practice-system').textContent  = card.system;
    document.getElementById('fc-practice-card').classList.remove('flipped');
    // Save scroll position before hiding the stats modal
    const statsBody = document.querySelector('#modal-stats .overflow-y-auto');
    _statsScrollPos = statsBody ? statsBody.scrollTop : 0;
    document.getElementById('modal-stats').classList.add('hidden');
    document.getElementById('modal-fc-practice').classList.remove('hidden');
}

function closeFcPracticePopup() {
    document.getElementById('modal-fc-practice').classList.add('hidden');
    document.getElementById('modal-stats').classList.remove('hidden');
    // Restore scroll position after the modal is visible
    requestAnimationFrame(() => {
        const statsBody = document.querySelector('#modal-stats .overflow-y-auto');
        if (statsBody) statsBody.scrollTop = _statsScrollPos;
    });
}

// ==========================================
// EVENT LISTENERS & NAVIGATION
// ==========================================
function setupEventListeners() {
    // Navigation Tabs
    document.getElementById('nav-flashcards').addEventListener('click', () => switchTab('flashcards'));
    document.getElementById('nav-word-builder').addEventListener('click', () => switchTab('word-builder'));
    document.getElementById('nav-chart-decrypter').addEventListener('click', () => switchTab('chart-decrypter'));
    document.getElementById('nav-abbrev-decoder').addEventListener('click', () => switchTab('abbrev-decoder'));
    document.getElementById('nav-pluralization').addEventListener('click', () => switchTab('pluralization'));
    document.getElementById('nav-tutor').addEventListener('click', () => { switchTab('tutor'); checkOllamaStatus(); });
    document.getElementById('nav-dictionary').addEventListener('click', () => switchTab('dictionary'));

    // Top Filter (Mobile)
    const mobileFilter = document.getElementById('system-filter-mobile');
    if (mobileFilter) {
        mobileFilter.addEventListener('change', (e) => {
            setActiveSystem(e.target.value);
        });
    }

    // Feature A: Flashcards
    document.getElementById('flashcard').addEventListener('click', flipFlashcard);
    document.getElementById('btn-again').addEventListener('click', () => handleReview(0));
    document.getElementById('btn-hard').addEventListener('click', () => handleReview(1));
    document.getElementById('btn-good').addEventListener('click', () => handleReview(2));
    document.getElementById('btn-easy').addEventListener('click', () => handleReview(3));
    document.getElementById('fc-btn-continue').addEventListener('click', renderFlashcards);
    document.getElementById('fc-reverse-toggle').addEventListener('click', toggleReverseMode);

    // Feature A: Reset Modal
    document.getElementById('btn-settings').addEventListener('click', openResetModal);
    const btnStats = document.getElementById('btn-stats');
    if (btnStats) btnStats.addEventListener('click', openStatsModal);
    document.getElementById('modal-btn-cancel').addEventListener('click', closeResetModal);
    document.getElementById('modal-reset-overlay').addEventListener('click', closeResetModal);
    document.getElementById('modal-btn-reset-all').addEventListener('click', resetAllProgress);
    document.getElementById('modal-btn-reset-system').addEventListener('click', () => resetSystemProgress(state.activeSystem));
    document.getElementById('fc-btn-review-mastered').addEventListener('click', reviewMasteredCards);
    
    const modelSelect = document.getElementById('modal-model-select');
    if (modelSelect) {
        modelSelect.addEventListener('change', (e) => {
            if (e.target.value !== '__custom__') {
                setTutorModel(e.target.value);
            }
        });
    }

    // Feature A: Legal Consent and Reporting Errors
    const btnGeneralFeedback = document.getElementById('btn-general-feedback');
    if (btnGeneralFeedback) btnGeneralFeedback.addEventListener('click', openGeneralFeedbackModal);

    const btnReport = document.getElementById('btn-report-card');
    if (btnReport) btnReport.addEventListener('click', (e) => openReportModal(e, undefined, undefined, 'Flashcards'));

    const btnReportWb = document.getElementById('btn-report-wb');
    if (btnReportWb) {
        btnReportWb.addEventListener('click', (e) => {
            if (currentWbChallenge) {
                const previewEl = document.getElementById('wb-preview');
                const currentWord = previewEl ? previewEl.textContent.toLowerCase() : '';
                openReportModal(
                    e,
                    currentWbChallenge.target,
                    `Constructed Answer: "${currentWord}" (Target Answer: "${currentWbChallenge.answer}")`,
                    'Word Builder'
                );
            }
        });
    }

    const btnReportCd = document.getElementById('btn-report-cd');
    if (btnReportCd) {
        btnReportCd.addEventListener('click', (e) => {
            const challenge = chartSentences[state.cdOrder[state.cdIndex]];
            if (challenge) {
                const plainText = challenge.text.replace(/<[^>]*>?/gm, '');
                const feedbackVal = document.getElementById('cd-feedback').textContent;
                const inputVal = document.getElementById('cd-input').value.trim();
                openReportModal(
                    e,
                    `Clinical Note: "${plainText}" (Active Bold Term: "${challenge.answer}")`,
                    `User Translation: "${inputVal}" | Grading Feedback: "${feedbackVal}"`,
                    'Chart Decrypter'
                );
            }
        });
    }

    const btnReportAd = document.getElementById('btn-report-ad');
    if (btnReportAd) {
        btnReportAd.addEventListener('click', (e) => {
            const challenge = abbrevPool[state.adIndex];
            if (challenge) {
                const feedbackVal = document.getElementById('ad-feedback').textContent;
                const inputVal = document.getElementById('ad-input').value.trim();
                openReportModal(
                    e,
                    `Abbreviation: "${challenge.term}" (Expected Meaning: "${challenge.meaning}")`,
                    `User Decoder Guess: "${inputVal}" | Grading Feedback: "${feedbackVal}"`,
                    'Abbreviation Decoder'
                );
            }
        });
    }

    const btnReportPl = document.getElementById('btn-report-pl');
    if (btnReportPl) {
        btnReportPl.addEventListener('click', (e) => {
            const challenge = pluralChallengePool[state.plIndex];
            if (challenge) {
                const feedbackVal = document.getElementById('pl-feedback').textContent;
                const inputVal = document.getElementById('pl-input').value.trim();
                openReportModal(
                    e,
                    `Singular Suffix: "${challenge.sing}" (Rule: "${challenge.rule}" | Target Plural: "${challenge.pl}")`,
                    `User Plural Input: "${inputVal}" | Feedback: "${feedbackVal}"`,
                    'Pluralization Engine'
                );
            }
        });
    }

    const btnLegalAccept = document.getElementById('btn-legal-accept');
    if (btnLegalAccept) btnLegalAccept.addEventListener('click', acceptLegalConsent);
    const btnSubmitReport = document.getElementById('btn-submit-report');
    if (btnSubmitReport) btnSubmitReport.addEventListener('click', submitReport);

    // Feature A: Speech Recognition (Hold to Speak)
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) {
        micBtn.addEventListener('mousedown', startSpeechRecognition);
        micBtn.addEventListener('mouseup', stopSpeechRecognition);
        micBtn.addEventListener('touchstart', startSpeechRecognition, {passive: true});
        micBtn.addEventListener('touchend', stopSpeechRecognition, {passive: true});
    }

    // Feature B: Word Builder
    document.getElementById('wb-btn-clear').addEventListener('click', clearWbSlots);
    document.getElementById('wb-btn-check').addEventListener('click', checkWbAnswer);
    document.getElementById('wb-btn-next').addEventListener('click', nextWbChallenge);

    // Feature C: Chart Decrypter
    document.getElementById('cd-btn-check').addEventListener('click', checkCdAnswer);
    document.getElementById('cd-btn-reveal').addEventListener('click', revealCdAnswer);
    document.getElementById('cd-btn-next').addEventListener('click', nextCdChallenge);
    document.getElementById('cd-btn-restart').addEventListener('click', restartCd);
    document.getElementById('cd-input').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const checkBtn = document.getElementById('cd-btn-check');
        const nextBtn  = document.getElementById('cd-btn-next');
        if (!checkBtn.classList.contains('hidden')) checkCdAnswer();
        else if (!nextBtn.classList.contains('hidden')) nextCdChallenge();
    });

    // Feature D: Abbreviation Decoder
    document.getElementById('ad-btn-check').addEventListener('click', checkAdAnswer);
    document.getElementById('ad-btn-next').addEventListener('click', nextAdChallenge);
    document.getElementById('ad-input').addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const checkBtn = document.getElementById('ad-btn-check');
        const nextBtn  = document.getElementById('ad-btn-next');
        if (!checkBtn.classList.contains('hidden')) checkAdAnswer();
        else if (!nextBtn.classList.contains('hidden')) nextAdChallenge();
    });

    // Feature E: Pluralization
    document.getElementById('pl-btn-check').addEventListener('click', checkPluralAnswer);
    document.getElementById('pl-btn-next').addEventListener('click', nextPluralChallenge);

    // Feature G: AI Tutor Chat
    document.getElementById('chat-btn-send').addEventListener('click', sendChatMessage);
    document.getElementById('chat-btn-clear').addEventListener('click', clearChat);
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!document.getElementById('chat-btn-send').disabled) sendChatMessage();
        }
    });
    document.getElementById('chat-input').addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Feature H: Dark mode
    document.getElementById('modal-dark-toggle').addEventListener('change', toggleDarkMode);

    // Mini card chat
    document.getElementById('fc-mini-chat-skip').addEventListener('click', advanceFromMiniChat);
    document.getElementById('fc-mini-chat-send').addEventListener('click', sendMiniChatMessage);
    document.getElementById('fc-mini-chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') sendMiniChatMessage();
    });
    document.getElementById('btn-dr-lex').addEventListener('click', () => {
        const panel = document.getElementById('fc-mini-chat');
        if (!panel.classList.contains('hidden')) { advanceFromMiniChat(); return; }
        const card = state.flashcards[state.fcIndex];
        if (card) {
            openMiniChat(card);
            scrollMiniChatIntoView();
        }
    });

    // Flashcard practice popup
    document.getElementById('fc-practice-card').addEventListener('click', () => {
        document.getElementById('fc-practice-card').classList.toggle('flipped');
    });
    document.getElementById('btn-fc-practice-close').addEventListener('click', closeFcPracticePopup);
    document.getElementById('modal-fc-practice-overlay').addEventListener('click', closeFcPracticePopup);

    // Unselect slots via click
    ['prefix', 'root1', 'root2', 'suffix'].forEach(type => {
        const slotEl = document.getElementById(`slot-${type}`);
        if (slotEl) {
            slotEl.addEventListener('click', () => {
                if (state.wbSlots[type]) {
                    state.wbSlots[type] = null;
                    updateWbSlots();
                }
            });
        }
    });

    // Feature D: Text-to-Speech
    document.querySelectorAll('.btn-speak').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.flashcards.length > 0) {
                const cleanTerm = state.flashcards[state.fcIndex].term.replace(/[\/-]/g, '');
                speakText(cleanTerm);
            }
        });
    });
    document.querySelector('.btn-speak-wb').addEventListener('click', () => {
        const word = document.getElementById('wb-preview').textContent;
        if (word && word !== '-') speakText(word);
    });

    // Keyboard shortcuts: Space=flip, 1/←=Again, 2=Hard, 3/→=Good, 4=Easy
    document.addEventListener('keydown', (e) => {
        const flashView = document.getElementById('view-flashcards');
        if (!flashView || flashView.classList.contains('hidden-tab')) return;
        if (e.target.matches('input, textarea, select')) return;
        if (e.code === 'Space') {
            e.preventDefault();
            if (!state.fcFlipped) flipFlashcard();
        } else if (state.fcFlipped) {
            if (e.code === 'Digit1' || e.code === 'ArrowLeft') {
                e.preventDefault();
                handleReview(0);
            } else if (e.code === 'Digit2') {
                e.preventDefault();
                handleReview(1);
            } else if (e.code === 'Digit3' || e.code === 'ArrowRight') {
                e.preventDefault();
                handleReview(2);
            } else if (e.code === 'Digit4') {
                e.preventDefault();
                handleReview(3);
            }
        }
    });
}

function switchTab(tabId) {
    // Hide all panels and reset all nav buttons
    ['flashcards', 'word-builder', 'chart-decrypter', 'abbrev-decoder', 'pluralization', 'tutor', 'dictionary'].forEach(id => {
        const view = document.getElementById(`view-${id}`);
        if (view) view.classList.add('hidden-tab');
        
        // Reset top nav button
        const btn = document.getElementById(`nav-${id}`);
        if (btn) btn.className = "px-6 py-2.5 text-sm font-bold rounded-full transition-all duration-300 text-gray-500 hover:text-gray-800 hover:bg-gray-100/50";

        // Reset bottom nav button
        const bBtn = document.getElementById(`bnav-${id}`);
        if (bBtn) {
            const icon = bBtn.querySelector('.bnav-icon');
            const label = bBtn.querySelector('.bnav-label');
            if (icon)  { icon.classList.remove('text-teal-600');  icon.classList.add('text-gray-400'); }
            if (label) { label.classList.remove('text-teal-600'); label.classList.add('text-gray-400'); }
        }
    });

    // Show selected panel
    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.remove('hidden-tab');

    // Activate top nav button
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) activeBtn.className = "px-6 py-2.5 text-sm font-bold rounded-full transition-all duration-300 bg-white text-teal-700 shadow shadow-gray-300/50";

    // Activate bottom nav button
    const activeBBtn = document.getElementById(`bnav-${tabId}`);
    if (activeBBtn) {
        const icon = activeBBtn.querySelector('.bnav-icon');
        const label = activeBBtn.querySelector('.bnav-label');
        if (icon)  { icon.classList.add('text-teal-600');  icon.classList.remove('text-gray-400'); }
        if (label) { label.classList.add('text-teal-600'); label.classList.remove('text-gray-400'); }
    }

    // Feature G: Tutor Tab Auto-hydration
    if (tabId === 'tutor' && state.chatHistory.length === 0) {
        renderChatSuggestions();
    }
    // Feature H: Dictionary Tab Auto-init
    if (tabId === 'dictionary') {
        initDictionary();
    }
}

// ==========================================
// FEATURE D: TEXT-TO-SPEECH ENGINE
// ==========================================
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Text-to-speech is not supported in this browser.");
    }
}

// ==========================================
// FEATURE E: SPEECH RECOGNITION (Web Speech API)
// ==========================================
let recognition = null;
let isRecording = false;

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        const cleanTerm = state.flashcards[state.fcIndex].term.replace(/[\/-]/g, '').toLowerCase();
        
        const micBtn = document.getElementById('btn-mic');
        const cleanTranscript = transcript.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
        
        if (cleanTranscript === cleanTerm) {
            micBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            micBtn.classList.replace('text-gray-400', 'text-green-500');
            micBtn.classList.replace('bg-gray-50', 'bg-green-100');
        } else {
            micBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            micBtn.classList.replace('text-gray-400', 'text-rose-500');
            micBtn.classList.replace('bg-gray-50', 'bg-rose-100');
            console.log(`Expected: ${cleanTerm}, Heard: ${cleanTranscript}`);
        }
        
        setTimeout(() => {
            micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            micBtn.className = "w-10 h-10 rounded-full bg-gray-50 hover:bg-rose-100 text-gray-400 hover:text-rose-600 flex items-center justify-center transition-colors shadow-sm";
        }, 2000);
    };

    recognition.onerror = (event) => {
        console.warn('Speech recognition error', event.error);
    };
}

function startSpeechRecognition(e) {
    e.preventDefault();
    if (!recognition || isRecording) return;
    
    isRecording = true;
    const micBtn = document.getElementById('btn-mic');
    micBtn.classList.add('animate-pulse', 'ring-4', 'ring-rose-200');
    micBtn.classList.replace('text-gray-400', 'text-rose-600');
    
    try {
        recognition.start();
    } catch(err) {
        console.warn(err);
    }
}

function stopSpeechRecognition(e) {
    e.preventDefault();
    if (!recognition || !isRecording) return;
    
    isRecording = false;
    const micBtn = document.getElementById('btn-mic');
    micBtn.classList.remove('animate-pulse', 'ring-4', 'ring-rose-200');
    
    try {
        recognition.stop();
    } catch(err) {
        console.warn(err);
    }
}

// ==========================================
// FEATURE A: FLASHCARDS (Spaced Repetition)
// ==========================================
function updateFcStatsBar(due, actionableNew, totalUnseen, learning, mastered) {
    const total = totalUnseen + learning + mastered;
    
    const elDue = document.getElementById('fc-stat-due');
    if (elDue) elDue.textContent = `${due} Due`;
    
    const elNew = document.getElementById('fc-stat-new');
    if (elNew) elNew.textContent = `${actionableNew} New`;
    
    const elTotal = document.getElementById('fc-stat-total');
    if (elTotal) elTotal.textContent = `${total} Cards`;
    
    if (total > 0) {
        const pMastered = (mastered / total) * 100;
        const pLearning = (learning / total) * 100;
        const pUnseen = (totalUnseen / total) * 100;
        
        const elPMastered = document.getElementById('fc-prog-mastered');
        if (elPMastered) elPMastered.style.width = `${pMastered}%`;
        
        const elPLearning = document.getElementById('fc-prog-learning');
        if (elPLearning) elPLearning.style.width = `${pLearning}%`;
        
        const elPUnseen = document.getElementById('fc-prog-unseen');
        if (elPUnseen) elPUnseen.style.width = `${pUnseen}%`;
    }
}

function renderFlashcards() {
    const now = Date.now();
    // Clean up session-lapse counters from the previous session
    dictionary.forEach(t => delete t._sessionLapses);

    let pool = dictionary.filter(t => t.type !== 'abbreviation');
    if (state.activeSystem !== 'All') {
        pool = pool.filter(t => t.system === state.activeSystem);
    }

    const newCards      = pool.filter(t => t.interval === 0);
    const dueCards      = pool.filter(t => t.interval > 0 && (state.dueDates[t.id] || 0) <= now);
    const learningCards = pool.filter(t => t.interval >= 1 && t.interval < 7);
    const masteredCards = pool.filter(t => t.interval >= 7);

    // Apply strict daily limit to new cards
    const remainingNewQuota = Math.max(0, DAILY_NEW_LIMIT - (state.newCardsLearnedToday || 0));
    const selectedNew = newCards.slice(0, remainingNewQuota);

    // Build session deck: due cards first, then new cards.
    // No deterministic sort within groups — SM-2 ease factors already encode difficulty.
    let finalPool = [...dueCards, ...selectedNew];

    // Per-session Fisher-Yates shuffle — true randomness (Math.random, not seeded)
    // so each session start produces a different card order.
    for (let i = finalPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalPool[i], finalPool[j]] = [finalPool[j], finalPool[i]];
    }

    // Update stats bar with MECE logic (Mutually Exclusive, Collectively Exhaustive)
    updateFcStatsBar(dueCards.length, selectedNew.length, newCards.length, learningCards.length, masteredCards.length);

    // "All caught up" fallback: only fires when BOTH due AND new queues are truly empty
    if (finalPool.length === 0) {
        const notDue = pool.filter(t => t.interval > 0 && (state.dueDates[t.id] || 0) > now);
        notDue.sort((a, b) => (state.dueDates[a.id] || 0) - (state.dueDates[b.id] || 0));
        // Show the 10 soonest-due cards as a maintenance preview
        finalPool = notDue.slice(0, 10);
    }

    state.flashcards    = finalPool;
    state.fcIndex       = 0;
    state.sessionCorrect = 0;
    state.sessionTotal  = 0;
    state.sessionScoredIds = new Set();

    // Hide summary, show card container
    document.getElementById('fc-session-summary').classList.add('hidden');
    document.getElementById('fc-container').classList.remove('hidden');

    updateFlashcardUI();
}

function updateFlashcardUI() {
    const container = document.getElementById('fc-container');
    const emptyState = document.getElementById('fc-empty');
    const cardEl = document.getElementById('flashcard');
    const controls = document.getElementById('fc-controls');

    if (state.flashcards.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        document.getElementById('fc-current').textContent = '0';
        document.getElementById('fc-total').textContent = '0';

        // Dynamic next-due message
        const now = Date.now();
        const msgEl = document.getElementById('fc-empty-message');
        if (msgEl) {
            const pool = dictionary.filter(t =>
                t.type !== 'abbreviation' &&
                (state.activeSystem === 'All' || t.system === state.activeSystem)
            );
            const upcoming = pool
                .filter(t => t.interval > 0 && (state.dueDates[t.id] || 0) > now)
                .sort((a, b) => (state.dueDates[a.id] || 0) - (state.dueDates[b.id] || 0));
            if (upcoming.length > 0) {
                const msUntil    = (state.dueDates[upcoming[0].id] || 0) - now;
                const hoursUntil = Math.ceil(msUntil / 3600000);
                const timeStr    = hoursUntil < 24 ? `in about ${hoursUntil}h` : 'tomorrow';
                msgEl.textContent = `Next review due ${timeStr}. ${upcoming.length} card${upcoming.length !== 1 ? 's' : ''} scheduled.`;
            } else {
                msgEl.textContent = "All cards in this system reviewed. Switch systems or challenge your mastered cards below.";
            }
        }
        return;
    }

    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    resetMiniChat();

    const card = state.flashcards[state.fcIndex];
    const color = SYSTEM_COLORS[card.system] || '#64748b';

    document.getElementById('fc-current').textContent = state.fcIndex + 1;
    document.getElementById('fc-total').textContent = state.flashcards.length;

    // Snap card instantly back to front face before writing new content.
    // This prevents the incoming card's answer from being visible during the
    // CSS un-flip animation (back face is facing the user at rotation 0–90°).
    const cardInner = cardEl.querySelector('.flip-card-inner');
    cardInner.style.transition = 'none';        // suppress animation
    cardEl.classList.remove('flipped');          // instant snap to front
    state.fcFlipped = false;
    void cardInner.offsetWidth;                  // force synchronous reflow
    cardInner.style.transition = '';             // re-enable for next user flip

    // System color accent: left border on card front
    const frontEl = cardEl.querySelector('.flip-card-front');
    frontEl.style.borderLeft = `4px solid ${color}`;

    if (state.reverseMode) {
        // Reverse: front = meaning, back = term
        document.getElementById('fc-type').textContent = card.system;
        document.getElementById('fc-term').textContent = card.meaning;
        document.getElementById('fc-meaning').textContent = card.term;
        document.getElementById('fc-hint').innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Click to reveal term';
        document.getElementById('fc-back-label').textContent = 'Term';
    } else {
        // Normal: front = term, back = meaning
        document.getElementById('fc-type').textContent = card.type;
        document.getElementById('fc-term').textContent = card.term;
        document.getElementById('fc-meaning').textContent = card.meaning;
        document.getElementById('fc-hint').innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Click to reveal meaning';
        document.getElementById('fc-back-label').textContent = 'Meaning';
    }

    // System badge on card back
    const badge = document.getElementById('fc-system-badge');
    badge.textContent = card.system;
    badge.style.backgroundColor = color + '22';
    badge.style.color = color;
    badge.style.borderColor = color + '55';

    // Example words on card back
    const examplesEl = document.getElementById('fc-examples');
    const exList = EXAMPLES[card.term] || [];
    if (exList.length > 0) {
        examplesEl.innerHTML = `<span class="font-semibold" style="color:${color}">e.g.</span> <span class="italic">${exList.join(', ')}</span>`;
        examplesEl.classList.remove('hidden');
    } else {
        examplesEl.classList.add('hidden');
    }

    // Hide controls
    controls.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    controls.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
}

function formatInterval(days) {
    if (days === 0) return "< 1m";
    if (days < 30) return days + "d";
    if (days < 365) return (days / 30).toFixed(1).replace('.0', '') + "mo";
    return (days / 365).toFixed(1).replace('.0', '') + "y";
}

function fuzzInterval(interval) {
    if (interval < 4) return interval;
    const min = Math.max(2, Math.round(interval * 0.95));
    const max = Math.round(interval * 1.05);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateFutureInterval(card, grade) {
    const ease = state.easeFactors[card.id] !== undefined ? state.easeFactors[card.id] : 2.5;
    const wasNew = card.interval === 0;
    const wasMatured = card.interval >= 7;

    let newInterval = card.interval;

    if (grade === 0) {
        if (wasMatured) newInterval = Math.max(1, Math.round(card.interval * 0.5));
        else newInterval = 0;
    } else if (grade === 1) {
        if (wasNew || card.interval <= 1) newInterval = 1;
        else newInterval = Math.max(1, Math.round(card.interval * 1.2));
    } else if (grade === 2) {
        if (wasNew) newInterval = 1;
        else if (card.interval === 1) newInterval = 3;
        else newInterval = Math.max(card.interval + 1, Math.round(card.interval * ease));
    } else if (grade === 3) {
        if (wasNew) newInterval = 3;
        else if (card.interval === 1) newInterval = 5;
        else newInterval = Math.round(card.interval * ease * 1.3);
    }
    
    return grade > 0 ? fuzzInterval(newInterval) : newInterval;
}

function flipFlashcard() {
    if (state.fcFlipped) return;
    state.fcFlipped = true;

    document.getElementById('flashcard').classList.add('flipped');

    const controls = document.getElementById('fc-controls');
    controls.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
    controls.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');

    // Expert SRS UI: Calculate and display projected intervals
    const card = state.flashcards[state.fcIndex];
    for (let i = 0; i < 4; i++) {
        const lbl = document.getElementById(`lbl-int-${i}`);
        if (lbl) {
            const projected = calculateFutureInterval(card, i);
            lbl.textContent = formatInterval(projected);
        }
    }
}

function toggleReverseMode() {
    state.reverseMode = !state.reverseMode;
    const btn = document.getElementById('fc-reverse-toggle');
    if (state.reverseMode) {
        btn.classList.add('bg-teal-600', 'text-white', 'border-teal-600');
        btn.classList.remove('bg-white', 'text-gray-500', 'border-gray-200');
    } else {
        btn.classList.remove('bg-teal-600', 'text-white', 'border-teal-600');
        btn.classList.add('bg-white', 'text-gray-500', 'border-gray-200');
    }
    updateFlashcardUI();
}

function showMasteryToast(term) {
    const container = document.getElementById('achievement-toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'bg-teal-600 text-white px-5 py-3 rounded-2xl shadow-lg border border-teal-500 flex items-center gap-3 transform translate-y-10 opacity-0 transition-all duration-500 z-[200] mt-2';
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center border border-teal-400">
            <i class="fa-solid fa-graduation-cap text-teal-100"></i>
        </div>
        <div>
            <p class="font-bold text-sm">Card Mastered!</p>
            <p class="text-xs text-teal-100 opacity-90">${term}</p>
        </div>
    `;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function handleReview(grade) {
    // SM-2 spaced repetition with ease factor and session recirculation
    // grade: 0=Again, 1=Hard, 2=Good, 3=Easy
    const card    = state.flashcards[state.fcIndex];
    const wasNew  = card.interval === 0;
    const now     = Date.now();
    const ease    = state.easeFactors[card.id] !== undefined ? state.easeFactors[card.id] : 2.5;
    const wasOverdue = card.interval > 0 && (state.dueDates[card.id] || 0) <= now;
    const wasMature  = card.interval >= 14;

    state.sessionTotal++;
    // Only count each card once per session toward persistent stats (don't count re-queue retries)
    const isFirstEncounter = !state.sessionScoredIds.has(card.id);
    if (isFirstEncounter) {
        state.sessionScoredIds.add(card.id);
        updateStats('totalReviews', 1);
    }

    // Get the fuzzed new interval
    let newInterval = calculateFutureInterval(card, grade);
    let newEase     = ease;

    // Expert 4:00 AM Rollover Calculation
    const getNextDueDate = (days) => {
        if (days === 0) return now; // Due immediately in session
        const d = new Date(now);
        // If current time is before 4 AM, it counts as "yesterday"
        if (d.getHours() < 4) {
            d.setDate(d.getDate() - 1);
        }
        d.setDate(d.getDate() + days);
        d.setHours(4, 0, 0, 0); // Rollover is precisely at 4:00 AM
        return d.getTime();
    };

    if (grade === 0) {
        // Again — lapse
        if (newInterval === 0) {
            card._sessionLapses = (card._sessionLapses || 0) + 1;
            if (card._sessionLapses <= 3) {
                state.flashcards.push(card);
            }
        }
        state.dueDates[card.id] = getNextDueDate(newInterval);
        
        newEase = Math.max(1.3, ease - 0.2);
        card.errorCount = (card.errorCount || 0) + 1;
        state.lapses[card.id] = card.errorCount;
        saveLapses();
        state.sessionConsecutiveCorrect = 0;
        if (isFirstEncounter) updateStats('fcAgain', 1);
        updateStats('fcAgainTotal', 1);

    } else if (grade === 1) {
        state.dueDates[card.id] = getNextDueDate(newInterval);
        newEase = Math.max(1.3, ease - 0.15);
        
        state.sessionConsecutiveCorrect = 0;
        let xpBase = 8;
        if (wasMature) xpBase += 5;
        if (wasNew) xpBase += 3;
        awardXP(xpBase, 'flashcard');
        if (isFirstEncounter) { updateStats('fcHard', 1); }
        updateStats('fcHardTotal', 1);
        updateQuestProgress('fcReviewed', 1);
        if (wasOverdue) updateQuestProgress('overdueReviewed', 1);
        if (wasNew) updateQuestProgress('newLearned', 1);

    } else if (grade === 2) {
        state.dueDates[card.id] = getNextDueDate(newInterval);
        newEase = ease;
        // Ease Recovery Mechanic: if ease < 2.5, "Good" slowly heals it (+0.05)
        if (newEase < 2.5) {
            newEase = Math.min(2.5, newEase + 0.05);
        }

        state.sessionCorrect++;
        state.sessionConsecutiveCorrect++;
        let xpBase = 12;
        if (wasMature) xpBase += 5;
        if (wasNew) xpBase += 3;
        awardXP(xpBase, 'flashcard');
        if (isFirstEncounter) { updateStats('totalCorrect', 1); updateStats('fcGood', 1); }
        updateStats('fcGoodTotal', 1);
        updateQuestProgress('fcReviewed', 1);
        if (wasOverdue) updateQuestProgress('overdueReviewed', 1);
        if (wasNew) updateQuestProgress('newLearned', 1);

    } else if (grade === 3) {
        state.dueDates[card.id] = getNextDueDate(newInterval);
        newEase = Math.min(4.0, ease + 0.15);
        
        state.sessionCorrect++;
        state.sessionConsecutiveCorrect++;
        let xpBase = 10;
        if (wasMature) xpBase += 5;
        if (wasNew) xpBase += 3;
        awardXP(xpBase, 'flashcard');
        if (isFirstEncounter) { updateStats('totalCorrect', 1); updateStats('fcEasy', 1); }
        updateStats('fcEasyTotal', 1);
        updateQuestProgress('fcReviewed', 1);
        if (wasOverdue) updateQuestProgress('overdueReviewed', 1);
        if (wasNew) updateQuestProgress('newLearned', 1);
    }

    // Always record the most recent grade per card for the breakdown lists
    if (!statsData.fcGradeMap) statsData.fcGradeMap = {};
    statsData.fcGradeMap[card.id] = grade;
    saveStats();

    checkAchievements('flashcard_reviewed', {});

    // Mastery Celebration Toast
    const oldInterval = card.interval;
    if (oldInterval < 7 && newInterval >= 7) {
        showMasteryToast(card.term);
    }

    card.interval = newInterval;
    state.easeFactors[card.id] = newEase;

    if (wasNew && grade > 0) {
        state.newCardsLearnedToday += 1;
        saveStreak(new Date().toDateString(), state.streak, state.newCardsLearnedToday);
    }

    state.intervals[card.id] = card.interval;
    saveIntervals();
    saveEaseFactors();
    saveDueDates();
    updateMasteryProgress();

    state.fcIndex++;
    resetMiniChat();
    if (state.fcIndex >= state.flashcards.length) showSessionSummary();
    else updateFlashcardUI();
}

// ==========================================
// MINI CARD CHAT
// ==========================================
function resetMiniChat() {
    if (state.miniChatAbortCtrl) { state.miniChatAbortCtrl.abort(); state.miniChatAbortCtrl = null; }
    state.miniChatHistory = [];
    const panel  = document.getElementById('fc-mini-chat');
    const msgs   = document.getElementById('fc-mini-chat-messages');
    const input  = document.getElementById('fc-mini-chat-input');
    const sendBtn = document.getElementById('fc-mini-chat-send');
    if (panel)   panel.classList.add('hidden');
    if (msgs)    msgs.innerHTML = '';
    if (input)   { input.value = ''; input.disabled = false; }
    if (sendBtn) sendBtn.disabled = false;
}

function advanceFromMiniChat() {
    resetMiniChat();
}

function scrollMiniChatIntoView() {
    const panel = document.getElementById('fc-mini-chat');
    if (!panel || panel.classList.contains('hidden')) return;

    requestAnimationFrame(() => {
        const header = document.querySelector('header.glass-panel');
        const headerHeight = header ? header.offsetHeight : 0;
        const panelTop = window.scrollY + panel.getBoundingClientRect().top;
        const targetTop = Math.max(0, panelTop - headerHeight - 12);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
}

function appendMiniChatBubble(role, text) {
    const msgs   = document.getElementById('fc-mini-chat-messages');
    const wrap   = document.createElement('div');
    const bubble = document.createElement('div');
    if (role === 'typing') {
        wrap.className   = 'flex justify-start';
        bubble.className = 'text-sm text-gray-400 italic px-1 py-1';
        bubble.innerHTML = '<i class="fa-solid fa-ellipsis fa-fade text-violet-400 mr-1"></i> Dr. Lex is thinking…';
        wrap.appendChild(bubble);
        msgs.appendChild(wrap);
        msgs.scrollTop = msgs.scrollHeight;
        return wrap;
    } else if (role === 'user') {
        wrap.className   = 'flex justify-end';
        bubble.className = 'max-w-[85%] bg-violet-600 text-white px-3 py-2 rounded-2xl rounded-br-sm text-sm font-medium leading-relaxed';
    } else {
        wrap.className   = 'flex justify-start';
        bubble.className = 'max-w-[90%] bg-gray-50 border border-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm text-sm text-gray-800 font-medium leading-relaxed whitespace-pre-wrap';
    }
    bubble.textContent = text;
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return bubble;
}

async function openMiniChat(card, grade = null) {
    resetMiniChat();
    const panel  = document.getElementById('fc-mini-chat');
    const msgs   = document.getElementById('fc-mini-chat-messages');
    const status = document.getElementById('fc-mini-chat-status');
    panel.classList.remove('hidden');
    if (status) status.textContent = '· thinking…';

    const systemPrompt = `You are Dr. Lex, a sharp and encouraging medical terminology tutor. The student wants to learn more about a medical term from their flashcard:\n- Term: "${card.term}" (${card.type})\n- Meaning: "${card.meaning}"\n- Body system: ${card.system}\n\nGive ONE focused, memorable insight about this specific term: a mnemonic, an etymology breakdown, or a vivid clinical example. 2-3 sentences max, flowing prose. End with a one-line invitation to ask a follow-up.`;

    const typingBubble = appendMiniChatBubble('typing');
    const ctrl = new AbortController();
    state.miniChatAbortCtrl = ctrl;
    let assistantText = '', bubbleEl = null, firstToken = true;

    try {
        const { response: res } = await requestOllamaWithModelFallback('/api/chat', (model) => ({
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Go.' }],
            stream: true,
            options: { temperature: 1.0, top_p: 0.95, top_k: 64, num_ctx: 2048 }
        }));
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of decoder.decode(value, { stream: true }).split('\n').filter(Boolean)) {
                let data; try { data = JSON.parse(line); } catch { continue; }
                const token = data.message?.content;
                if (token) {
                    if (firstToken) { typingBubble.remove(); bubbleEl = appendMiniChatBubble('assistant', ''); if (status) status.textContent = ''; firstToken = false; }
                    assistantText += token;
                    bubbleEl.textContent = assistantText;
                    msgs.scrollTop = msgs.scrollHeight;
                }
                if (data.done) break;
            }
        }
        if (assistantText) state.miniChatHistory.push({ role: 'assistant', content: assistantText });
    } catch (err) {
        if (err.name !== 'AbortError') {
            if (typingBubble.isConnected) typingBubble.remove();
            appendMiniChatBubble('assistant', "Dr. Lex isn't available right now. Complete mobile setup or reconnect your local provider.");
            if (status) status.textContent = '· offline';
        }
    }
    state.miniChatAbortCtrl = null;
    const input = document.getElementById('fc-mini-chat-input');
    if (input) input.focus();
}

async function sendMiniChatMessage() {
    const input   = document.getElementById('fc-mini-chat-input');
    const sendBtn = document.getElementById('fc-mini-chat-send');
    const msgs    = document.getElementById('fc-mini-chat-messages');
    const userText = input.value.trim();
    if (!userText || sendBtn.disabled) return;
    appendMiniChatBubble('user', userText);
    state.miniChatHistory.push({ role: 'user', content: userText });
    input.value = ''; sendBtn.disabled = true; input.disabled = true;
    const typingBubble = appendMiniChatBubble('typing');
    const ctrl = new AbortController();
    state.miniChatAbortCtrl = ctrl;
    let assistantText = '', bubbleEl = null, firstToken = true;
    try {
        const { response: res } = await requestOllamaWithModelFallback('/api/chat', (model) => ({
            model,
            messages: [
                { role: 'system', content: 'You are Dr. Lex, a concise medical terminology tutor. Answer in 2-4 sentences.' },
                ...state.miniChatHistory
            ],
            stream: true,
            options: { temperature: 1.0, top_p: 0.95, top_k: 64, num_ctx: 2048 }
        }));
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const line of decoder.decode(value, { stream: true }).split('\n').filter(Boolean)) {
                let data; try { data = JSON.parse(line); } catch { continue; }
                const token = data.message?.content;
                if (token) {
                    if (firstToken) { typingBubble.remove(); bubbleEl = appendMiniChatBubble('assistant', ''); firstToken = false; }
                    assistantText += token;
                    bubbleEl.textContent = assistantText;
                    msgs.scrollTop = msgs.scrollHeight;
                }
                if (data.done) break;
            }
        }
        if (assistantText) state.miniChatHistory.push({ role: 'assistant', content: assistantText });
    } catch (err) {
        if (err.name !== 'AbortError') {
            if (typingBubble.isConnected) typingBubble.remove();
            appendMiniChatBubble('assistant', 'Connection lost. Check local provider readiness and try again.');
        }
    }
    state.miniChatAbortCtrl = null;
    sendBtn.disabled = false; input.disabled = false; input.focus();
}

function showSessionSummary() {
    const accuracy = state.sessionTotal > 0
        ? Math.round((state.sessionCorrect / state.sessionTotal) * 100)
        : 0; // 0% if nothing reviewed (shouldn't happen, but safe fallback)
    const againCount = state.sessionTotal - state.sessionCorrect;

    document.getElementById('fc-summary-accuracy').textContent = `${accuracy}%`;
    document.getElementById('fc-summary-reviewed').textContent = state.sessionTotal;
    document.getElementById('fc-summary-correct').textContent = state.sessionCorrect;
    document.getElementById('fc-summary-again').textContent = againCount;

    // Count cards due by tomorrow
    const tomorrow = Date.now() + 86400000;
    const dueTomorrow = dictionary.filter(t => t.interval > 0 && (state.dueDates[t.id] || 0) <= tomorrow).length;
    document.getElementById('fc-summary-due-tomorrow').textContent =
        `${dueTomorrow} card${dueTomorrow !== 1 ? 's' : ''} due by tomorrow`;

    // Icon based on accuracy
    const icon = document.getElementById('fc-summary-icon');
    if (accuracy >= 90) {
        icon.className = 'fa-solid fa-star text-4xl text-amber-500';
    } else if (accuracy >= 70) {
        icon.className = 'fa-solid fa-thumbs-up text-4xl text-teal-500';
    } else {
        icon.className = 'fa-solid fa-rotate text-4xl text-blue-500';
    }

    document.getElementById('fc-container').classList.add('hidden');

    // Show session XP row
    const xpRow = document.getElementById('fc-summary-xp-row');
    const xpEl  = document.getElementById('fc-summary-xp');
    if (xpRow && xpEl && state.sessionXP > 0) {
        xpEl.textContent = state.sessionXP;
        xpRow.classList.remove('hidden');
    }

    document.getElementById('fc-session-summary').classList.remove('hidden');
}

// ==========================================
// RESET & CHALLENGE FUNCTIONS
// ==========================================
function openResetModal() {
    const label = document.getElementById('modal-reset-system-label');
    if (label) {
        label.textContent = state.activeSystem === 'All'
            ? 'Reset All Systems'
            : `Reset "${state.activeSystem}"`;
    }

    const selectEl = document.getElementById('modal-model-select');
    const offlineMsg = document.getElementById('modal-model-offline-msg');
    if (selectEl) {
        const currentModel = getTutorModel();
        
        if (typeof window.populateModelSelector === 'function') {
            const endpoint = (localStorage.getItem('chemistry_ollama_endpoint') || '')
                .replace('/api/chat', '')
                .replace('/api/generate', '');
            window.populateModelSelector(selectEl, currentModel, endpoint).then(online => {
                if (!online && offlineMsg) {
                    offlineMsg.classList.remove('hidden');
                } else if (offlineMsg) {
                    offlineMsg.classList.add('hidden');
                }
            });
        } else {
            getAvailableOllamaModels()
                .then(models => {
                    if (Array.isArray(models) && models.length > 0) {
                        selectEl.innerHTML = '';
                        if (offlineMsg) offlineMsg.classList.add('hidden');
                        
                        models.forEach(model => {
                            const opt = document.createElement('option');
                            opt.value = model;
                            opt.textContent = model;
                            if (model === currentModel) opt.selected = true;
                            selectEl.appendChild(opt);
                        });

                        if (!models.includes(currentModel)) {
                            const opt = document.createElement('option');
                            opt.value = currentModel;
                            opt.textContent = `${currentModel} (unlisted)`;
                            opt.selected = true;
                            selectEl.appendChild(opt);
                        }
                    } else {
                        selectEl.innerHTML = `<option value="${currentModel}" selected>${currentModel}</option>`;
                        if (offlineMsg) offlineMsg.classList.remove('hidden');
                    }
                })
                .catch(() => {
                    selectEl.innerHTML = `<option value="${currentModel}" selected>${currentModel}</option>`;
                    if (offlineMsg) offlineMsg.classList.remove('hidden');
                });
        }
    }

    document.getElementById('modal-reset').classList.remove('hidden');
}

function closeResetModal() {
    document.getElementById('modal-reset').classList.add('hidden');
}

function resetAllProgress() {
    ['syngnosia_progress', 'syngnosia_lapses', 'syngnosia_streak', 'syngnosia_duedates', 'syngnosia_ease',
     'syngnosia_xp', 'syngnosia_achievements', 'syngnosia_daily_quests', 'syngnosia_stats']
        .forEach(k => localStorage.removeItem(k));
    state.intervals      = {};
    state.lapses         = {};
    state.dueDates       = {};
    state.easeFactors    = {};
    state.streak         = 1;
    state.newCardsLearnedToday = 0;
    xpData           = { total: 0, level: 1, dailyXP: {}, dailyFcXP: {}, dailyActivities: {} };
    achievementsData = { unlocked: [], unlockedDates: {} };
    statsData        = { totalReviews: 0, totalCorrect: 0, wbChallenges: 0, wbCorrect: 0, cdAnswered: 0, cdCorrect: 0, adAnswered: 0, adCorrect: 0, plAnswered: 0, plCorrect: 0 };
    saveStreak(new Date().toDateString(), 1, 0);
    document.getElementById('streak-counter').textContent = '1';
    dictionary.forEach(t => { t.interval = 0; t.errorCount = 0; delete t._sessionLapses; });
    updateMasteryProgress();
    updateXPBar();
    generateDailyQuests();
    closeResetModal();
    renderFlashcards();
}

function resetSystemProgress(system) {
    const targets = system === 'All'
        ? dictionary
        : dictionary.filter(t => t.system === system);
    targets.forEach(t => {
        t.interval   = 0;
        t.errorCount = 0;
        delete t._sessionLapses;
        delete state.intervals[t.id];
        delete state.lapses[t.id];
        delete state.dueDates[t.id];
        delete state.easeFactors[t.id];
    });
    saveIntervals();
    saveLapses();
    saveDueDates();
    saveEaseFactors();
    updateMasteryProgress();
    closeResetModal();
    renderFlashcards();
}

function reviewMasteredCards() {
    let pool = dictionary.filter(t => t.type !== 'abbreviation' && t.interval >= 7);
    if (state.activeSystem !== 'All') {
        pool = pool.filter(t => t.system === state.activeSystem);
    }
    if (pool.length === 0) {
        const msgEl = document.getElementById('fc-empty-message');
        if (msgEl) msgEl.textContent = 'No mastered cards yet in this system. Keep studying!';
        return;
    }
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    state.flashcards     = pool.slice(0, 20);
    state.fcIndex        = 0;
    state.sessionCorrect = 0;
    state.sessionTotal   = 0;
    document.getElementById('fc-session-summary').classList.add('hidden');
    document.getElementById('fc-empty').classList.add('hidden');
    document.getElementById('fc-container').classList.remove('hidden');
    updateFlashcardUI();
}

// ==========================================
// FEATURE B: WORD BUILDER
// ==========================================

/** Fisher-Yates shuffle — O(n), uniform distribution. Mutates and returns arr. */
function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Builds a grammatically correct target sentence from the chosen morphemes.
 * Selects one of three templates based on suffix meaning:
 *   - adjective-type  ("-ic", "-al", "-oid") → "Relating to the [root]"
 *   - resembling-type ("-oid")                → "Resembling the [root]"
 *   - specialist-type ("-ist", "-ician")      → "Specialist of the [root]"
 *   - default noun-type                        → "[Suffix meaning] of the [root]"
 * Prefix meaning is integrated as an adjectival prepend (quantitative prefixes)
 * or a parenthetical append (positional/directional prefixes).
 */
function buildTargetSentence(prefix, root1, root2, suffix) {
    const sm       = suffix.meaning.toLowerCase();
    const rootPart = root2
        ? `${root1.meaning} / ${root2.meaning}`
        : root1.meaning;

    let core;

    if (/resembling/.test(sm)) {
        core = `Resembling the ${rootPart}`;
    } else if (/pertaining|relating|characterized|\blike\b|of or/.test(sm)) {
        core = `Relating to the ${rootPart}`;
    } else if (/one who|specialist|physician|practitioner/.test(sm)) {
        core = `Specialist of the ${rootPart}`;
    } else {
        // Default noun-type: "Inflammation of the heart"
        const sm0 = suffix.meaning.charAt(0).toUpperCase() + suffix.meaning.slice(1);
        core = `${sm0} of the ${rootPart}`;
    }

    if (prefix) {
        core += ` (${prefix.meaning})`;
    }

    return core.charAt(0).toUpperCase() + core.slice(1);
}

function generateDynamicChallenge(retryCount = 0) {
    let pool = dictionary.filter(t => t.type !== 'abbreviation');
    if (state.activeSystem !== 'All' && !state.activeSystem.startsWith('Suffixes') && state.activeSystem !== 'Prefixes') {
        pool = pool.filter(t => t.system === state.activeSystem || t.system.startsWith('Suffixes') || t.system === 'Prefixes');
    }

    const roots    = pool.filter(t => t.type === 'root');
    const prefixes = pool.filter(t => t.type === 'prefix');
    const suffixes = pool.filter(t => t.type === 'suffix');

    if (roots.length === 0 || suffixes.length === 0) {
        return generateFallbackChallenge();
    }

    const isCompound = roots.length >= 2 && Math.random() < 0.3;
    const root1 = roots[Math.floor(Math.random() * roots.length)];
    let root2 = null;

    if (isCompound) {
        const root2Candidates = roots.filter(r => r.id !== root1.id);
        if (root2Candidates.length > 0) {
            root2 = root2Candidates[Math.floor(Math.random() * root2Candidates.length)];
        }
    }

    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

    let prefix = null;
    if (prefixes.length > 0 && Math.random() < 0.3) {
        prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    }

    // Build answer string
    let answer = '';
    if (prefix) answer += prefix.clean;

    answer += root1.rootBase;
    if (root2) {
        // Always add combining vowel between roots
        answer += root1.vowel;
        answer += root2.rootBase;
        if (!/^[aeiou]/i.test(suffix.clean)) answer += root2.vowel;
    } else {
        if (!/^[aeiou]/i.test(suffix.clean)) answer += root1.vowel;
    }
    answer += suffix.clean;
    answer = answer.toLowerCase();

    // Deduplicate: retry up to 3 times if this word was built recently
    if (retryCount < 3 && wbRecentAnswers.includes(answer)) {
        return generateDynamicChallenge(retryCount + 1);
    }
    wbRecentAnswers.push(answer);
    if (wbRecentAnswers.length > 10) wbRecentAnswers.shift();

    // validIds in logical order: prefix, root1, root2, suffix
    const validIds = [];
    if (prefix) validIds.push(prefix.id);
    validIds.push(root1.id);
    if (root2) validIds.push(root2.id);
    validIds.push(suffix.id);

    const target = buildTargetSentence(prefix, root1, root2, suffix);

    return { target, validIds, answer };
}

function generateFallbackChallenge() {
    const allRoots    = dictionary.filter(t => t.type === 'root');
    const allSuffixes = dictionary.filter(t => t.type === 'suffix');
    const root   = allRoots[Math.floor(Math.random() * allRoots.length)];
    const suffix = allSuffixes[Math.floor(Math.random() * allSuffixes.length)];
    let answer = root.rootBase;
    if (!/^[aeiou]/i.test(suffix.clean)) answer += root.vowel;
    answer += suffix.clean;
    const target = buildTargetSentence(null, root, null, suffix);
    return { target, validIds: [root.id, suffix.id], answer: answer.toLowerCase() };
}

function renderWordBuilder() {
    state.wbAttempts = 0;
    currentWbChallenge = generateDynamicChallenge();
    document.getElementById('wb-target').textContent = currentWbChallenge.target;
    
    clearWbSlots();
    
    const bankEl = document.getElementById('wb-parts-bank');
    bankEl.innerHTML = '';
    
    // Required correct parts
    let parts = dictionary.filter(t => currentWbChallenge.validIds.includes(t.id));
    const distractorPool = dictionary.filter(t => !currentWbChallenge.validIds.includes(t.id) && t.type !== 'abbreviation');

    // Type-balanced distractors: add same-type items as each correct part so the
    // user cannot identify the answer simply by eliminating unique-type entries.
    const correctTypes = {};
    parts.forEach(p => { correctTypes[p.type] = (correctTypes[p.type] || 0) + 1; });
    const usedIds  = new Set(currentWbChallenge.validIds);
    const distractors = [];
    ['prefix', 'root', 'suffix'].forEach(type => {
        if (!correctTypes[type]) return;
        const sameType = fisherYatesShuffle(distractorPool.filter(t => t.type === type && !usedIds.has(t.id)));
        const take = Math.min(correctTypes[type] + 1, sameType.length);
        sameType.slice(0, take).forEach(t => { distractors.push(t); usedIds.add(t.id); });
    });

    // Fill remaining slots up to 8 with uniformly-random items
    const remaining   = fisherYatesShuffle(distractorPool.filter(t => !usedIds.has(t.id)));
    const extraNeeded = Math.max(0, 8 - parts.length - distractors.length);
    const allParts    = fisherYatesShuffle([...parts, ...distractors, ...remaining.slice(0, extraNeeded)]);

    allParts.forEach(part => {
        const btn = document.createElement('button');
        btn.className = "px-5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-sky-400 hover:bg-sky-50 font-bold text-gray-700 transition-colors";
        btn.textContent = part.term;
        btn.onclick = () => selectWbPart(part);
        bankEl.appendChild(btn);
    });

    document.getElementById('wb-btn-check').classList.remove('hidden');
    document.getElementById('wb-btn-next').classList.add('hidden');
    
    const reportBtn = document.getElementById('btn-report-wb');
    if (reportBtn) reportBtn.classList.add('hidden');
    
    // Reset preview styles
    document.getElementById('wb-preview').className = "text-4xl font-extrabold text-sky-700 tracking-tight h-12 flex items-center justify-center transition-all duration-300";
}

function selectWbPart(part) {
    let slotType = part.type;
    if (part.type === 'root') {
        if (!state.wbSlots.root1) slotType = 'root1';
        else if (!state.wbSlots.root2) slotType = 'root2';
        else slotType = null; // Both full
    }

    if (slotType && state.wbSlots[slotType] === null) {
        state.wbSlots[slotType] = part;
        updateWbSlots();
    } else {
        // Reject visual feedback if slot is full
        const typePrefix = part.type === 'root' ? 'root1' : part.type; // Best effort bounce
        const slotEl = document.getElementById(`slot-${typePrefix}`);
        if (slotEl) {
            slotEl.classList.add('ring-4', 'ring-rose-200');
            setTimeout(() => slotEl.classList.remove('ring-4', 'ring-rose-200'), 300);
        }
    }
}

function clearWbSlots() {
    state.wbSlots = { prefix: null, root1: null, root2: null, suffix: null };
    updateWbSlots();
}

function updateWbSlots() {
    ['prefix', 'root1', 'root2', 'suffix'].forEach(type => {
        const slotEl = document.getElementById(`slot-${type}`);
        const part = state.wbSlots[type];
        
        if (part) {
            slotEl.innerHTML = `<span class="font-extrabold text-sky-800 text-lg">${part.term}</span>`;
            slotEl.classList.add('filled');
        } else {
            slotEl.innerHTML = `<span class="text-gray-400 text-sm group-hover:text-sky-400 transition-colors">Select...</span>`;
            slotEl.classList.remove('filled');
        }
    });

    updateWbPreview();
}

/**
 * CRITICAL LOGIC: Combining Vowel Engine for Compound Roots
 */
function updateWbPreview() {
    const previewEl = document.getElementById('wb-preview');
    const { prefix, root1, root2, suffix } = state.wbSlots;
    
    if (!prefix && !root1 && !root2 && !suffix) {
        previewEl.textContent = '-';
        return;
    }

    let result = '';
    if (prefix) result += prefix.clean;
    
    if (root1) {
        result += root1.rootBase;
        
        if (root2) {
            // Always insert combining vowel between roots
            result += root1.vowel;
            result += root2.rootBase;
            
            if (suffix) {
                const startsWithVowel = /^[aeiou]/i.test(suffix.clean);
                if (!startsWithVowel) result += root2.vowel;
                result += suffix.clean;
            } else {
                result += `/${root2.vowel}-`;
            }
        } else {
            if (suffix) {
                const startsWithVowel = /^[aeiou]/i.test(suffix.clean);
                if (!startsWithVowel) result += root1.vowel;
                result += suffix.clean;
            } else {
                result += `/${root1.vowel}-`;
            }
        }
    } else if (root2) {
        result += root2.rootBase;
        if (suffix) {
            const startsWithVowel = /^[aeiou]/i.test(suffix.clean);
            if (!startsWithVowel) result += root2.vowel;
            result += suffix.clean;
        } else {
            result += `/${root2.vowel}-`;
        }
    } else if (suffix) {
        result += suffix.clean;
    }

    previewEl.textContent = result.replace(/[\/-]/g, '');
}

function checkWbAnswer() {
    const previewEl = document.getElementById('wb-preview');
    const currentWord = previewEl.textContent.toLowerCase();
    const challenge = currentWbChallenge;
    
    // Count this challenge the first time it is checked (right or wrong)
    if (state.wbAttempts === 0) updateStats('wbChallenges', 1);

    if (currentWord === challenge.answer.toLowerCase()) {
        // Success
        previewEl.className = "text-4xl font-extrabold text-green-600 tracking-tight h-12 flex items-center justify-center scale-110 transition-transform duration-300 drop-shadow-md";
        document.getElementById('wb-btn-check').classList.add('hidden');
        document.getElementById('wb-btn-next').classList.remove('hidden');
        // XP: first attempt = 25, second = 15, third+ = 8
        const attempts = state.wbAttempts;
        const xp = attempts === 0 ? 25 : attempts === 1 ? 15 : 8;
        awardXP(xp, 'word-builder');
        updateQuestProgress('wbCompleted', 1);
        // Only count as correct if solved on the first attempt
        if (attempts === 0) updateStats('wbCorrect', 1);
        checkAchievements('word_builder_correct', {});
    } else {
        state.wbAttempts++;
        previewEl.classList.add('text-rose-500', 'animate-shake');
        setTimeout(() => previewEl.classList.remove('text-rose-500', 'animate-shake'), 400);
    }

    const reportBtn = document.getElementById('btn-report-wb');
    if (reportBtn) reportBtn.classList.remove('hidden');
}

function nextWbChallenge() {
    state.wbAttempts = 0;
    renderWordBuilder();
}

// ==========================================
// FEATURE C: CHART DECRYPTER
// ==========================================
function renderChartDecrypter() {
    const challenge = chartSentences[state.cdOrder[state.cdIndex]];
    state.cdAttempts = 0;

    document.getElementById('cd-counter').textContent =
        `${state.cdIndex + 1}/${state.cdOrder.length}`;
    document.getElementById('cd-sentence').innerHTML = challenge.text;

    const input = document.getElementById('cd-input');
    input.value = '';
    input.disabled = false;

    // Reset styles
    input.classList.remove('border-green-500', 'bg-green-50', 'border-rose-500', 'bg-rose-50',
                           'text-green-800', 'text-rose-800', 'border-amber-400', 'bg-amber-50', 'text-amber-800');
    input.classList.add('border-gray-200', 'bg-white');

    document.getElementById('cd-feedback').classList.add('hidden');
    document.getElementById('cd-btn-check').classList.remove('hidden');
    document.getElementById('cd-btn-reveal').classList.add('hidden');
    document.getElementById('cd-btn-next').classList.add('hidden');
    
    const reportBtn = document.getElementById('btn-report-cd');
    if (reportBtn) reportBtn.classList.add('hidden');
    
    input.focus();
}

async function gradeWithModel(userVal, sentence, targetVal) {
    const prompt = `You are a strict medical assessor. The user translated a medical term from a clinical sentence.
Sentence: "${sentence}"
Target translation: "${targetVal}"
User's literal translation: "${userVal}"

Evaluate if the user's translation is semantically correct. It does not need to be an exact string match, just capture the correct medical meaning.
Return ONLY a valid JSON object in this exact format: {"isCorrect": true/false, "feedback": "Brief 1-sentence explanation"}`;

    try {
        const { response } = await requestOllamaWithModelFallback('/api/generate', (model) => ({
            model,
            prompt,
            stream: false,
            format: 'json',
            options: {
                num_ctx: 512,
                num_predict: 100
            }
        }));
        const data = await response.json();
        const jsonString = data.response.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn('Model grading failed, falling back to exact match.', e);
        return null;
    }
}

async function gradeAbbrevWithModel(userVal, abbrev, canonicalMeaning) {
    const prompt = `You are a medical education tutor grading a student's knowledge of medical abbreviations.
Abbreviation: "${abbrev}"
Canonical meaning: "${canonicalMeaning}"
Student's answer: "${userVal}"

Determine if the student's answer correctly captures the meaning of this abbreviation. Accept reasonable paraphrases, alternate spellings, synonyms, and correct-but-differently-worded answers. Be encouraging.
Return ONLY a valid JSON object: {"isCorrect": true/false, "feedback": "One encouraging sentence of feedback"}`;

    try {
        const { response } = await requestOllamaWithModelFallback('/api/generate', (model) => ({
            model,
            prompt,
            stream: false,
            format: 'json',
            options: { num_ctx: 512, num_predict: 100 }
        }));
        const data = await response.json();
        const jsonString = data.response.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn('Model abbreviation grading failed, falling back to exact match.', e);
        return null;
    }
}

async function checkCdAnswer() {
    const input     = document.getElementById('cd-input');
    const btn       = document.getElementById('cd-btn-check');
    const userVal   = input.value.trim().toLowerCase();
    const challenge = chartSentences[state.cdOrder[state.cdIndex]];
    const feedback  = document.getElementById('cd-feedback');

    // Set UI to loading state
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...';
    btn.disabled = true;
    input.disabled = true;

    let isCorrect = false;
    let feedbackMsg = "";

    // Strip HTML from sentence for the prompt
    const plainTextSentence = challenge.text.replace(/<[^>]*>?/gm, '');

    // Attempt semantic grading via active local model.
    const modelResult = await gradeWithModel(userVal, plainTextSentence, challenge.answer);

    if (modelResult !== null && typeof modelResult.isCorrect === 'boolean') {
        isCorrect   = modelResult.isCorrect;
        feedbackMsg = modelResult.feedback || (isCorrect ? "Correct translation!" : "Incorrect. Please try again.");
    } else {
        // Graceful Fallback: Exact String Match (ignoring punctuation)
        const cleanUserVal  = userVal.replace(/[^\w\s]/gi, '').trim();
        const cleanAnswer   = challenge.answer.toLowerCase().replace(/[^\w\s]/gi, '').trim();
        const cleanFallback = challenge.fallback.toLowerCase().replace(/[^\w\s]/gi, '').trim();

        isCorrect   = cleanUserVal === cleanAnswer || cleanUserVal === cleanFallback;
        feedbackMsg = isCorrect ? "Correct translation!" : "Incorrect. Please try again.";
    }

    // Restore UI State
    btn.innerHTML = originalBtnText;
    btn.disabled  = false;

    // Count this challenge the first time it is checked (right or wrong)
    if (state.cdAttempts === 0) updateStats('cdAnswered', 1);

    if (isCorrect) {
        // Count correct only if this is the first attempt
        if (state.cdAttempts === 0) state.cdCorrect++;

        const xp = state.cdAttempts === 0 ? 35 : state.cdAttempts === 1 ? 20 : 10;
        awardXP(xp, 'chart-decrypter');
        updateQuestProgress('cdAnswered', 1);
        // Only count as correct if solved on the first attempt
        if (state.cdAttempts === 0) updateStats('cdCorrect', 1);
        checkAchievements('chart_correct', {});

        input.classList.remove('border-gray-200', 'border-rose-500', 'bg-rose-50', 'text-rose-800');
        input.classList.add('border-green-500', 'bg-green-50', 'text-green-800');
        input.disabled = true;

        feedback.textContent = feedbackMsg;
        feedback.className   = 'mt-3 text-sm font-bold text-green-600 block';

        document.getElementById('cd-btn-check').classList.add('hidden');
        document.getElementById('cd-btn-reveal').classList.add('hidden');
        document.getElementById('cd-btn-next').classList.remove('hidden');
    } else {
        state.cdAttempts++;
        input.disabled = false; // Re-enable for retry
        input.classList.remove('border-gray-200');
        input.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-800', 'animate-shake');

        setTimeout(() => input.classList.remove('animate-shake'), 400);

        feedback.textContent = feedbackMsg;
        feedback.className   = 'mt-3 text-sm font-bold text-rose-500 block';

        // After 2 failed attempts, offer the escape hatch
        if (state.cdAttempts >= 2) {
            document.getElementById('cd-btn-reveal').classList.remove('hidden');
        }
    }

    const reportBtn = document.getElementById('btn-report-cd');
    if (reportBtn) reportBtn.classList.remove('hidden');
}

function revealCdAnswer() {
    const challenge = chartSentences[state.cdOrder[state.cdIndex]];
    const input     = document.getElementById('cd-input');
    const feedback  = document.getElementById('cd-feedback');

    input.value = challenge.answer;
    input.disabled = true;
    input.classList.remove('border-gray-200', 'border-rose-500', 'bg-rose-50', 'text-rose-800',
                           'border-green-500', 'bg-green-50', 'text-green-800');
    input.classList.add('border-amber-400', 'bg-amber-50', 'text-amber-800');

    feedback.textContent = `Answer: "${challenge.answer}"`;
    feedback.className   = 'mt-3 text-sm font-bold text-amber-600 block';

    document.getElementById('cd-btn-check').classList.add('hidden');
    document.getElementById('cd-btn-reveal').classList.add('hidden');
    document.getElementById('cd-btn-next').classList.remove('hidden');

    const reportBtn = document.getElementById('btn-report-cd');
    if (reportBtn) reportBtn.classList.remove('hidden');
}

function nextCdChallenge() {
    state.cdIndex++;
    if (state.cdIndex >= state.cdOrder.length) {
        // Populate completion screen with honest score
        const total   = state.cdOrder.length;
        const correct = state.cdCorrect;
        const pct     = Math.round((correct / total) * 100);

        document.getElementById('cd-completion-title').textContent =
            pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Well Done!' : 'Keep Practicing!';
        document.getElementById('cd-completion-score').textContent =
            `${correct} / ${total} correct  (${pct}%)`;
        document.getElementById('cd-completion-msg').textContent =
            pct >= 90
                ? "You've mastered these clinical translations."
                : pct >= 70
                    ? "Good effort — review the ones you missed and try again."
                    : "Review the bolded terms in your flashcards, then come back.";

        checkAchievements('cd_session_complete', { pct: pct });

        document.querySelector('#view-chart-decrypter > div:first-child').classList.add('hidden');
        document.getElementById('cd-completion').classList.remove('hidden');
    } else {
        renderChartDecrypter();
    }
}

function restartCd() {
    // Build pool: filter by active system when it's a body system, otherwise use all 30
    const bodySystems = ['Cardiovascular','Digestive','Respiratory','Nervous','Musculoskeletal',
                         'Integumentary','Endocrine','Urinary','Reproductive','Blood/Immune',
                         'Special Senses','Foundations'];
    let indices = chartSentences.map((_, i) => i);
    if (state.activeSystem !== 'All' && bodySystems.includes(state.activeSystem)) {
        const filtered = indices.filter(i => chartSentences[i].system === state.activeSystem);
        if (filtered.length > 0) indices = filtered; // fall back to all if none match
    }
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    state.cdOrder    = indices;
    state.cdIndex    = 0;
    state.cdCorrect  = 0;
    state.cdAttempts = 0;
    document.getElementById('cd-completion').classList.add('hidden');
    document.querySelector('#view-chart-decrypter > div:first-child').classList.remove('hidden');
    renderChartDecrypter();
}

// ==========================================
// FEATURE F: ABBREVIATION DECODER
// ==========================================
const ABBREV_DATA = [
    // Dosing / timing
    { term: 'PRN',   meaning: 'as needed' },
    { term: 'STAT',  meaning: 'immediately' },
    { term: 'BID',   meaning: 'twice a day' },
    { term: 'TID',   meaning: 'three times a day' },
    { term: 'QID',   meaning: 'four times a day' },
    { term: 'QD',    meaning: 'every day' },
    { term: 'QHS',   meaning: 'every bedtime' },
    { term: 'AC',    meaning: 'before meals' },
    { term: 'PC',    meaning: 'after meals' },
    { term: 'NPO',   meaning: 'nothing by mouth' },
    // Routes of administration
    { term: 'PO',    meaning: 'by mouth' },
    { term: 'IV',    meaning: 'intravenous' },
    { term: 'IM',    meaning: 'intramuscular' },
    { term: 'SQ',    meaning: 'subcutaneous' },
    { term: 'SL',    meaning: 'sublingual' },
    // Vital signs
    { term: 'BP',    meaning: 'blood pressure' },
    { term: 'HR',    meaning: 'heart rate' },
    { term: 'RR',    meaning: 'respiratory rate' },
    { term: 'SpO2',  meaning: 'oxygen saturation' },
    { term: 'Temp',  meaning: 'temperature' },
    // Diagnoses
    { term: 'HTN',   meaning: 'hypertension' },
    { term: 'DM',    meaning: 'diabetes mellitus' },
    { term: 'MI',    meaning: 'myocardial infarction' },
    { term: 'CHF',   meaning: 'congestive heart failure' },
    { term: 'COPD',  meaning: 'chronic obstructive pulmonary disease' },
    { term: 'GERD',  meaning: 'gastroesophageal reflux disease' },
    { term: 'UTI',   meaning: 'urinary tract infection' },
    { term: 'URI',   meaning: 'upper respiratory infection' },
    { term: 'DVT',   meaning: 'deep vein thrombosis' },
    { term: 'CAD',   meaning: 'coronary artery disease' },
    { term: 'CVA',   meaning: 'cerebrovascular accident' },
    { term: 'TIA',   meaning: 'transient ischemic attack' },
    { term: 'AFib',  meaning: 'atrial fibrillation' },
    { term: 'ACS',   meaning: 'acute coronary syndrome' },
    { term: 'SOB',   meaning: 'shortness of breath' },
    { term: 'LOC',   meaning: 'loss of consciousness' },
    // Labs & values
    { term: 'CBC',   meaning: 'complete blood count' },
    { term: 'BMP',   meaning: 'basic metabolic panel' },
    { term: 'CMP',   meaning: 'comprehensive metabolic panel' },
    { term: 'UA',    meaning: 'urinalysis' },
    { term: 'WBC',   meaning: 'white blood cell' },
    { term: 'RBC',   meaning: 'red blood cell' },
    { term: 'Hgb',   meaning: 'hemoglobin' },
    { term: 'Hct',   meaning: 'hematocrit' },
    { term: 'BUN',   meaning: 'blood urea nitrogen' },
    // Imaging
    { term: 'CT',    meaning: 'computed tomography' },
    { term: 'MRI',   meaning: 'magnetic resonance imaging' },
    { term: 'CXR',   meaning: 'chest x-ray' },
    { term: 'EKG',   meaning: 'electrocardiogram' },
    { term: 'US',    meaning: 'ultrasound' },
    // Chart / documentation
    { term: 'Dx',    meaning: 'diagnosis' },
    { term: 'Rx',    meaning: 'prescription' },
    { term: 'Hx',    meaning: 'history' },
    { term: 'Sx',    meaning: 'symptoms' },
    { term: 'Tx',    meaning: 'treatment' },
    { term: 'CC',    meaning: 'chief complaint' },
    { term: 'HPI',   meaning: 'history of present illness' },
    { term: 'PMH',   meaning: 'past medical history' },
    { term: 'FH',    meaning: 'family history' },
    { term: 'SH',    meaning: 'social history' },
    { term: 'ROS',   meaning: 'review of systems' },
    { term: 'VS',    meaning: 'vital signs' },
    { term: 'WNL',   meaning: 'within normal limits' },
    { term: 'NAD',   meaning: 'no acute distress' },
    { term: 'HEENT', meaning: 'head, eyes, ears, nose, throat' },
    // Settings & procedures
    { term: 'ICU',   meaning: 'intensive care unit' },
    { term: 'ER',    meaning: 'emergency room' },
    { term: 'OR',    meaning: 'operating room' },
    { term: 'CPR',   meaning: 'cardiopulmonary resuscitation' },
    { term: 'DNR',   meaning: 'do not resuscitate' },
    { term: 'CABG',  meaning: 'coronary artery bypass graft' },
    { term: 'NKDA',  meaning: 'no known drug allergies' },
];

let abbrevPool = [];

function renderAbbrevDecoder() {
    // Initialize pool from built-in data if empty (also triggers on loop reset)
    if (abbrevPool.length === 0) {
        abbrevPool = [...ABBREV_DATA];
        // Fisher-Yates shuffle
        for (let i = abbrevPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [abbrevPool[i], abbrevPool[j]] = [abbrevPool[j], abbrevPool[i]];
        }
        state.adIndex = 0;
    }
    
    state.adAttempts = 0;
    const challenge = abbrevPool[state.adIndex];
    document.getElementById('ad-target').textContent = challenge.term;
    
    const input = document.getElementById('ad-input');
    input.value = '';
    input.disabled = false;
    input.classList.remove('border-green-500', 'bg-green-50', 'border-rose-500', 'bg-rose-50', 'text-green-800', 'text-rose-800');
    input.classList.add('border-gray-200', 'bg-white');
    
    document.getElementById('ad-feedback').classList.add('hidden');
    document.getElementById('ad-btn-check').classList.remove('hidden');
    document.getElementById('ad-btn-next').classList.add('hidden');
    
    const reportBtn = document.getElementById('btn-report-ad');
    if (reportBtn) reportBtn.classList.add('hidden');
}

async function checkAdAnswer() {
    const input     = document.getElementById('ad-input');
    const btn       = document.getElementById('ad-btn-check');
    const userVal   = input.value.trim().toLowerCase();
    const challenge = abbrevPool[state.adIndex];
    const feedback  = document.getElementById('ad-feedback');

    // Loading state
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Grading...';
    btn.disabled  = true;
    input.disabled = true;

    let isCorrect  = false;
    let feedbackMsg = '';

    // Attempt semantic grading via active local model.
    const modelResult = await gradeAbbrevWithModel(userVal, challenge.term, challenge.meaning);

    if (modelResult !== null && typeof modelResult.isCorrect === 'boolean') {
        isCorrect   = modelResult.isCorrect;
        feedbackMsg = modelResult.feedback || (isCorrect ? 'Correct!' : `Incorrect. Expected: ${challenge.meaning}`);
    } else {
        // Graceful fallback: exact string match
        isCorrect   = userVal === challenge.meaning.toLowerCase();
        feedbackMsg = isCorrect ? 'Correct!' : `Incorrect. Expected: ${challenge.meaning}`;
    }

    // Restore button
    btn.innerHTML = originalBtnText;
    btn.disabled  = false;

    // Count this challenge the first time it is checked (right or wrong)
    if (state.adAttempts === 0) updateStats('adAnswered', 1);

    if (isCorrect) {
        const xp = state.adAttempts === 0 ? 20 : 10;
        awardXP(xp, 'abbrev-decoder');
        updateQuestProgress('adCompleted', 1);
        // Only count as correct if solved on the first attempt
        if (state.adAttempts === 0) updateStats('adCorrect', 1);
        checkAchievements('abbrev_correct', {});

        input.classList.remove('border-gray-200', 'bg-white', 'border-rose-500', 'bg-rose-50', 'text-rose-800');
        input.classList.add('border-green-500', 'bg-green-50', 'text-green-800');
        input.disabled = true;

        feedback.textContent = feedbackMsg;
        feedback.className   = 'mt-4 text-sm font-bold text-green-600 block';

        document.getElementById('ad-btn-check').classList.add('hidden');
        document.getElementById('ad-btn-next').classList.remove('hidden');
    } else {
        state.adAttempts++;
        input.classList.remove('border-gray-200', 'bg-white', 'border-green-500', 'bg-green-50', 'text-green-800');
        input.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-800', 'animate-shake');
        input.disabled = false;

        setTimeout(() => input.classList.remove('animate-shake'), 400);

        feedback.textContent = feedbackMsg;
        feedback.className   = 'mt-4 text-sm font-bold text-rose-500 block';
    }

    const reportBtn = document.getElementById('btn-report-ad');
    if (reportBtn) reportBtn.classList.remove('hidden');
}

function nextAdChallenge() {
    state.adIndex++;
    if (state.adIndex >= abbrevPool.length) {
        abbrevPool = []; // Clear so renderAbbrevDecoder reshuffles on next loop
        state.adIndex = 0;
    }
    renderAbbrevDecoder();
}

// ==========================================
// FEATURE E: PLURALIZATION ENGINE
// ==========================================
const pluralRules = [
    { endsWith: 'a', replaceWith: 'ae', rule: "If singular ends in -a, drop the -a and add -ae.", examples: [{sing: 'vertebra', pl: 'vertebrae'}, {sing: 'bursa', pl: 'bursae'}] },
    { endsWith: 'ax', replaceWith: 'aces', rule: "If singular ends in -ax, drop the -ax and add -aces.", examples: [{sing: 'thorax', pl: 'thoraces'}] },
    { endsWith: 'ex', replaceWith: 'ices', rule: "If singular ends in -ex, drop it and add -ices.", examples: [{sing: 'apex', pl: 'apices'}, {sing: 'cortex', pl: 'cortices'}] },
    { endsWith: 'ix', replaceWith: 'ices', rule: "If singular ends in -ix, drop it and add -ices.", examples: [{sing: 'appendix', pl: 'appendices'}, {sing: 'cervix', pl: 'cervices'}] },
    { endsWith: 'is', replaceWith: 'es', rule: "If singular ends in -is, drop the -is and add -es.", examples: [{sing: 'diagnosis', pl: 'diagnoses'}, {sing: 'testis', pl: 'testes'}] },
    { endsWith: 'ma', replaceWith: 'mata', rule: "If singular ends in -ma, drop the -ma and add -mata.", examples: [{sing: 'carcinoma', pl: 'carcinomata'}, {sing: 'stigma', pl: 'stigmata'}] },
    { endsWith: 'nx', replaceWith: 'nges', rule: "If singular ends in -nx, drop the -nx and add -nges.", examples: [{sing: 'phalanx', pl: 'phalanges'}, {sing: 'larynx', pl: 'larynges'}] },
    { endsWith: 'on', replaceWith: 'a', rule: "If singular ends in -on, drop the -on and add -a.", examples: [{sing: 'ganglion', pl: 'ganglia'}, {sing: 'spermatozoon', pl: 'spermatozoa'}] },
    { endsWith: 'um', replaceWith: 'a', rule: "If singular ends in -um, drop the -um and add -a.", examples: [{sing: 'bacterium', pl: 'bacteria'}, {sing: 'ovum', pl: 'ova'}] },
    { endsWith: 'us', replaceWith: 'i', rule: "If singular ends in -us, drop the -us and add -i.", examples: [{sing: 'bronchus', pl: 'bronchi'}, {sing: 'nucleus', pl: 'nuclei'}, {sing: 'alveolus', pl: 'alveoli'}] }
];

let pluralChallengePool = [];
function renderPluralization() {
    if (state.plIndex === 0 || pluralChallengePool.length === 0) {
        pluralChallengePool = [];
        pluralRules.forEach(ruleObj => {
            ruleObj.examples.forEach(ex => {
                pluralChallengePool.push({ ...ruleObj, ...ex });
            });
        });
        pluralChallengePool.sort(() => 0.5 - Math.random());
    }

    const challenge = pluralChallengePool[state.plIndex];
    document.getElementById('pl-target').textContent = challenge.sing;
    document.getElementById('pl-rule-text').textContent = challenge.rule;

    const input = document.getElementById('pl-input');
    input.value = '';
    input.disabled = false;
    input.classList.remove('border-green-500', 'bg-green-50', 'border-rose-500', 'bg-rose-50', 'text-green-800', 'text-rose-800');
    input.classList.add('border-gray-200', 'bg-white');

    document.getElementById('pl-feedback').classList.add('hidden');
    document.getElementById('pl-btn-check').classList.remove('hidden');
    document.getElementById('pl-btn-next').classList.add('hidden');
    
    const reportBtn = document.getElementById('btn-report-pl');
    if (reportBtn) reportBtn.classList.add('hidden');
}

function checkPluralAnswer() {
    const input = document.getElementById('pl-input');
    const userVal = input.value.trim().toLowerCase();
    const challenge = pluralChallengePool[state.plIndex];
    const feedback = document.getElementById('pl-feedback');

    // Pluralization has no attempt counter, use a flag on the challenge pool item
    if (!challenge._counted) {
        challenge._counted = true;
        updateStats('plAnswered', 1);
    }

    if (userVal === challenge.pl.toLowerCase()) {
        state.plConsecutiveCorrect++;
        let xp = 10;
        if (state.plConsecutiveCorrect % 5 === 0) xp += 20;
        awardXP(xp, 'pluralization');
        updateQuestProgress('plCompleted', 1);
        // Only count as correct on the first attempt (challenge not yet shown as wrong)
        if (!challenge._wasWrong) updateStats('plCorrect', 1);
        checkAchievements('plural_correct', {});

        input.classList.remove('border-gray-200', 'bg-white', 'border-rose-500', 'bg-rose-50', 'text-rose-800');
        input.classList.add('border-green-500', 'bg-green-50', 'text-green-800');
        
        feedback.textContent = "Perfect Spelling!";
        feedback.className = "mt-2 text-sm font-bold text-green-600 block";
        
        document.getElementById('pl-btn-check').classList.add('hidden');
        document.getElementById('pl-btn-next').classList.remove('hidden');
    } else {
        challenge._wasWrong = true;
        state.plConsecutiveCorrect = 0;
        input.classList.remove('border-gray-200', 'bg-white', 'border-green-500', 'bg-green-50', 'text-green-800');
        input.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-800', 'animate-shake');
        
        setTimeout(() => input.classList.remove('animate-shake'), 400);
        
        feedback.textContent = `Incorrect. The correct plural is: ${challenge.pl}`;
        feedback.className = "mt-2 text-sm font-bold text-rose-500 block";
    }

    const reportBtn = document.getElementById('btn-report-pl');
    if (reportBtn) reportBtn.classList.remove('hidden');
}

function nextPluralChallenge() {
    state.plIndex++;
    if (state.plIndex >= pluralChallengePool.length) {
        state.plIndex = 0; // Loop back
    }
    renderPluralization();
}

// ==========================================
// FEATURE G: AI TUTOR CHATBOT
// ==========================================
function getTutorModel() {
    if (typeof window.getActiveModel === 'function') {
        return window.getActiveModel('syngnosia_tutor_model');
    }
    if (typeof window.getGnosysModel === 'function') {
        return window.getGnosysModel('syngnosia_tutor_model');
    }
    return localStorage.getItem('gnosys_active_llm') || localStorage.getItem('syngnosia_tutor_model') || 'gemma4:e4b';
}

function setTutorModel(model) {
    if (!model || typeof model !== 'string') return;
    localStorage.setItem('gnosys_active_llm', model);
    localStorage.setItem('syngnosia_tutor_model', model);
}

async function getAvailableOllamaModels() {
    const requestedModel = getTutorModel();
    return requestedModel ? [requestedModel] : [];
}

function pickBestTutorModel(requestedModel, availableModels) {
    if (!Array.isArray(availableModels) || availableModels.length === 0) return requestedModel;
    if (availableModels.includes(requestedModel)) return requestedModel;

    const startsWith = availableModels.find((name) => name.startsWith(requestedModel));
    if (startsWith) return startsWith;

    return availableModels[0];
}

async function resolveTutorModel() {
    const requestedModel = getTutorModel();
    try {
        const availableModels = await getAvailableOllamaModels();
        const selectedModel = pickBestTutorModel(requestedModel, availableModels);
        if (selectedModel && selectedModel !== requestedModel) {
            setTutorModel(selectedModel);
        }
        return selectedModel;
    } catch {
        return requestedModel;
    }
}

async function requestOllamaWithModelFallback(path, buildBody) {
    let model = getTutorModel();
    if (!window.GnosysLLM?.generateResponse) {
        throw new Error('Shared LLM router is unavailable.');
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        const bodyObj = buildBody(model);
        if (model.toLowerCase().includes('gemma4')) {
            if (!bodyObj.options) bodyObj.options = {};
            if (bodyObj.options.draft_num_predict === undefined) {
                bodyObj.options.draft_num_predict = 4;
            }
        }
        try {
            const history = Array.isArray(bodyObj.messages) ? bodyObj.messages.slice() : [];
            const systemMessage = history.find((entry) => entry?.role === 'system');
            const nonSystem = history.filter((entry) => entry?.role !== 'system');
            const userEntry = nonSystem[nonSystem.length - 1];
            const priorHistory = nonSystem.slice(0, -1);

            const result = await window.GnosysLLM.generateResponse(
                systemMessage?.content || '',
                userEntry?.content || '',
                {
                    stream: Boolean(bodyObj.stream),
                    model,
                    moduleKey: 'syngnosia_tutor_model',
                    history: priorHistory,
                    onToken: bodyObj.stream ? (token) => {
                        if (!requestOllamaWithModelFallback._tokenBuffer) {
                            requestOllamaWithModelFallback._tokenBuffer = [];
                        }
                        requestOllamaWithModelFallback._tokenBuffer.push(token);
                    } : undefined,
                }
            );

            model = result?.model || model;
            setTutorModel(model);

            if (bodyObj.stream) {
                const tokenBuffer = Array.isArray(requestOllamaWithModelFallback._tokenBuffer)
                    ? requestOllamaWithModelFallback._tokenBuffer.slice()
                    : [result?.text || ''];
                requestOllamaWithModelFallback._tokenBuffer = [];
                const stream = new ReadableStream({
                    start(controller) {
                        const encoder = new TextEncoder();
                        for (const token of tokenBuffer) {
                            if (!token) continue;
                            controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: token }, done: false })}\n`));
                        }
                        controller.enqueue(encoder.encode(`${JSON.stringify({ done: true })}\n`));
                        controller.close();
                    }
                });
                const response = new Response(stream, {
                    status: 200,
                    headers: { 'Content-Type': 'application/x-ndjson' }
                });
                return { response, model };
            }

            const response = new Response(JSON.stringify({
                message: { content: result?.text || '' },
                response: result?.text || ''
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            return { response, model };
        } catch (fetchErr) {
            if (window.gnosysActiveModelsCache) {
                delete window.gnosysActiveModelsCache[model];
            }
            if (attempt === 0) {
                const fallbackModel = await resolveTutorModel();
                if (fallbackModel && fallbackModel !== model) {
                    model = fallbackModel;
                    continue;
                }
            }
            throw fetchErr;
        }
    }

    throw new Error('Unable to query local provider after fallback attempt.');
}

function buildTutorSystemPrompt() {
    const sys = state.activeSystem;
    let mastered = 0, learning = 0, newCards = 0;
    dictionary.forEach(t => {
        const iv = state.intervals[t.id] || 0;
        if      (iv >= 7) mastered++;
        else if (iv >= 1) learning++;
        else              newCards++;
    });
    return `You are Dr. Lex, an expert medical terminology tutor embedded in the Medical Terminology learning app. You are warm, encouraging, and precise.

STUDENT CONTEXT (live):
- Currently studying: ${sys === 'All' ? 'All body systems' : sys}
- Terms mastered (reviewed 7+ times): ${mastered}
- Terms in active learning: ${learning}
- New terms not yet studied: ${newCards}
- Total terms in deck: ${dictionary.length}

YOUR ROLE:
• Answer questions about any medical term — prefix/suffix/root meaning, etymology, clinical usage
• Break down complex terms into their components (e.g., "hepato" + "megaly" = liver + enlargement)
• Give mnemonics and memory tricks when asked or when useful
• Quiz the student on demand — ask 3–5 short questions when requested
• Keep answers concise (2–4 sentences) unless the student asks for more detail
• Use real clinical examples to make terms memorable
• Be encouraging — this is difficult material

HARD BOUNDARIES:
• Never provide medical diagnosis, treatment advice, or clinical recommendations
• You are an educational study tool only, not a medical professional
• If asked a non-medical question, politely redirect: "I'm specialized in medical terminology — want to explore some terms together?"`;
}

async function checkOllamaStatus() {
    const dot    = document.getElementById('chat-status-dot');
    const text   = document.getElementById('chat-status-text');
    const banner = document.getElementById('chat-offline-banner');
    if (!dot) return false; // tutor tab not in DOM yet
    try {
        await window.GnosysLLM?.init?.();
        const status = window.GnosysLLM?.getStatus?.();
        const display = window.GnosysLLM?.getTutorStatusDisplay?.(status);
        if (display) {
            dot.className = display.dotClass;
            text.textContent = display.text;
            if (display.connected) {
                banner.classList.add('hidden');
                return true;
            }
        }
    } catch {}
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    dot.className = 'inline-block w-2 h-2 rounded-full bg-amber-500';
    text.textContent = isMobile ? 'Mobile Setup Required' : 'Ollama Offline (Tap to Launch)';
    banner.classList.remove('hidden');
    return false;
}

function appendChatBubble(role, text) {
    const msgsEl  = document.getElementById('chat-messages');
    const emptyEl = document.getElementById('chat-empty-state');
    if (emptyEl) emptyEl.remove();

    const wrap   = document.createElement('div');
    const bubble = document.createElement('div');
    if (role === 'user') {
        wrap.className   = 'flex justify-end';
        bubble.className = 'max-w-[80%] bg-violet-600 text-white px-4 py-3 rounded-3xl rounded-br-lg text-sm font-medium leading-relaxed';
    } else {
        wrap.className   = 'flex justify-start relative group';
        bubble.className = 'max-w-[85%] bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-3xl rounded-bl-lg text-sm font-medium leading-relaxed text-gray-800 whitespace-pre-wrap';
        
        const flagBtn = document.createElement('button');
        flagBtn.className = 'absolute -right-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white border border-gray-150 text-gray-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center shadow-sm cursor-pointer z-10';
        flagBtn.title = 'Report AI Response Error';
        flagBtn.innerHTML = '<i class="fa-solid fa-flag text-[9px]"></i>';
        flagBtn.onclick = (e) => {
            const currentBubbleText = bubble.textContent;
            let prompt = "N/A";
            const index = state.chatHistory.findIndex(h => h.content === currentBubbleText);
            if (index > 0 && state.chatHistory[index-1].role === 'user') {
                prompt = state.chatHistory[index-1].content;
            }
            openReportModal(e, `Prompt: "${prompt}"`, currentBubbleText, 'AI Tutor Chat');
        };
        wrap.appendChild(flagBtn);
    }
    bubble.textContent = text;
    wrap.appendChild(bubble);
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return bubble; // returned so streaming can update it
}

function appendTypingIndicator() {
    const msgsEl  = document.getElementById('chat-messages');
    const emptyEl = document.getElementById('chat-empty-state');
    if (emptyEl) emptyEl.remove();

    const wrap = document.createElement('div');
    wrap.id = 'chat-typing-indicator';
    wrap.className = 'flex justify-start';
    wrap.innerHTML = `<div class="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-3xl rounded-bl-lg flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay:0ms"></span>
        <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay:150ms"></span>
        <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay:300ms"></span>
    </div>`;
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('chat-typing-indicator');
    if (el) el.remove();
}

async function sendChatMessage() {
    const input   = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-btn-send');
    const userText = input.value.trim();
    if (!userText) return;

    appendChatBubble('user', userText);
    updateQuestProgress('tutorMessages', 1);
    input.value = '';
    input.style.height = 'auto';

    // Lock UI
    sendBtn.disabled = true;
    input.disabled   = true;

    // Build payload: system + capped rolling history + new user turn
    const MAX_TURNS = 20; // 10 exchanges
    state.chatHistory.push({ role: 'user', content: userText });
    if (state.chatHistory.length > MAX_TURNS) state.chatHistory = state.chatHistory.slice(-MAX_TURNS);

    const messages = [
        { role: 'system', content: buildTutorSystemPrompt() },
        ...state.chatHistory
    ];

    appendTypingIndicator();

    let assistantText = '';
    let firstToken    = true;
    let bubbleEl      = null;

    try {
        const { response } = await requestOllamaWithModelFallback('/api/chat', (model) => ({
            model,
            messages,
            stream: true,
            options: { temperature: 1.0, top_p: 0.95, top_k: 64, num_ctx: 4096 }
        }));

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        const msgsEl  = document.getElementById('chat-messages');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
            for (const line of lines) {
                let data;
                try { data = JSON.parse(line); } catch { continue; }
                const token = data.message?.content;
                if (token) {
                    if (firstToken) {
                        removeTypingIndicator();
                        bubbleEl   = appendChatBubble('assistant', '');
                        firstToken = false;
                    }
                    assistantText += token;
                    bubbleEl.textContent = assistantText;
                    msgsEl.scrollTop = msgsEl.scrollHeight;
                }
                if (data.done) break;
            }
        }
    } catch (err) {
        removeTypingIndicator();
        const reason = err && err.message ? err.message : 'Unknown error';
        appendChatBubble('assistant', `Sorry, I had trouble connecting to the local AI provider. ${reason}`);
        checkOllamaStatus();
    }

    // Push assistant reply to history (content only, no thinking tokens)
    if (assistantText) {
        state.chatHistory.push({ role: 'assistant', content: assistantText });
        if (state.chatHistory.length > MAX_TURNS) state.chatHistory = state.chatHistory.slice(-MAX_TURNS);
    }

    sendBtn.disabled = false;
    input.disabled   = false;
    input.focus();
}

function clearChat() {
    state.chatHistory = [];
    const msgsEl = document.getElementById('chat-messages');
    msgsEl.innerHTML = `
        <div id="chat-empty-state" class="flex flex-col items-center justify-center text-center py-8">
            <div class="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mb-4 border border-violet-100">
                <i class="fa-solid fa-robot text-2xl text-violet-400"></i>
            </div>
            <p class="text-gray-500 font-medium mb-5 text-sm">Ask me anything about medical terminology!</p>
            <div class="flex flex-wrap justify-center gap-2" id="chat-suggestions"></div>
        </div>`;
    renderChatSuggestions();
}

function generateContextualSuggestions() {
    const pools = [];
    
    // Vector A: Lapses (Penalty Box)
    const lapseEntries = Object.entries(state.lapses).sort((a, b) => b[1] - a[1]);
    if (lapseEntries.length > 0) {
        // Find a random term from the top 5 lapses
        const top5 = lapseEntries.slice(0, 5);
        const randomLapse = top5[Math.floor(Math.random() * top5.length)];
        const termObj = dictionary.find(t => t.id === randomLapse[0]);
        if (termObj) {
            pools.push(`Break down my most missed term: "${termObj.term}"`);
            pools.push(`Give me a mnemonic to remember "${termObj.term}"`);
            pools.push(`What is a clinical example of "${termObj.term}"?`);
        }
    }
    
    // Vector B: Active Deck
    if (state.activeSystem && state.activeSystem !== 'All') {
        const deckTerms = dictionary.filter(t => t.system === state.activeSystem);
        if (deckTerms.length > 0) {
            const randomTerm = deckTerms[Math.floor(Math.random() * deckTerms.length)];
            pools.push(`What does "${randomTerm.term}" mean in a clinical context?`);
            pools.push(`Quiz me on 3 terms related to the ${state.activeSystem} system.`);
        }
    } else {
        const randomTerm = dictionary[Math.floor(Math.random() * dictionary.length)];
        pools.push(`Break down the term "${randomTerm.term}"`);
    }

    // Vector C: Gamification / Level
    if (xpData.level <= 3) {
        pools.push(`What is the best way to memorize medical prefixes?`);
    } else {
        pools.push(`Quiz me on advanced Level ${xpData.level} terminology.`);
    }

    // Vector D: Wildcards / Cross-Module
    const wildcards = [
        `Generate a short clinical SOAP note for me to decode.`,
        `What's the difference between -itis and -osis?`,
        `Tell me a medical joke about the cardiovascular system.`,
        `Give me a 5-question rapid fire quiz.`
    ];
    pools.push(...wildcards);

    // Shuffle and pick exactly 4 unique prompts
    const uniquePools = [...new Set(pools)];
    for (let i = uniquePools.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uniquePools[i], uniquePools[j]] = [uniquePools[j], uniquePools[i]];
    }
    return uniquePools.slice(0, 4);
}

function renderChatSuggestions() {
    const suggestionsEl = document.getElementById('chat-suggestions');
    if (!suggestionsEl) return;
    
    const prompts = generateContextualSuggestions();
    suggestionsEl.innerHTML = '';
    
    prompts.forEach(promptText => {
        const btn = document.createElement('button');
        btn.className = "chat-suggestion px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-full hover:border-violet-300 hover:text-violet-600 transition-colors shadow-sm";
        btn.textContent = promptText;
        btn.onclick = () => {
            document.getElementById('chat-input').value = promptText;
            sendChatMessage();
        };
        suggestionsEl.appendChild(btn);
    });
}

// ==========================================
// LEGAL CONSENT & ERROR REPORTING SYSTEMS
// ==========================================
function checkLegalConsent() {
    const accepted = localStorage.getItem('syngnosia_legal_consent');
    if (accepted !== 'true') {
        const modal = document.getElementById('modal-legal');
        if (modal) modal.classList.remove('hidden');
    }
}

function acceptLegalConsent() {
    localStorage.setItem('syngnosia_legal_consent', 'true');
    const modal = document.getElementById('modal-legal');
    if (modal) modal.classList.add('hidden');
}

function openReportModal(e, term, meaning, moduleName) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); // prevent card flip when clicking flag on flashcard back
    
    state.activeReportModule = moduleName || 'Flashcards';
    
    // Configure layout for Contextual Report
    const titleEl = document.getElementById('report-modal-title');
    const iconEl = document.getElementById('report-modal-icon');
    const contextFields = document.getElementById('report-context-fields');
    const typeDropdown = document.getElementById('report-type');
    
    if (titleEl) titleEl.textContent = "Report AI Error";
    if (iconEl) iconEl.innerHTML = `<i class="fa-solid fa-flag text-rose-500 text-sm"></i>`;
    if (contextFields) contextFields.classList.remove('hidden');
    if (typeDropdown) typeDropdown.value = "hallucination";
    
    // Auto-fill context
    const termInput = document.getElementById('report-term');
    const meaningInput = document.getElementById('report-meaning');
    
    if (termInput) {
        if (term !== undefined) termInput.value = term;
        else if (state.flashcards && state.flashcards.length > 0 && state.fcIndex < state.flashcards.length) {
            termInput.value = state.flashcards[state.fcIndex].term;
        } else {
            termInput.value = "N/A";
        }
    }
    
    if (meaningInput) {
        if (meaning !== undefined) meaningInput.value = meaning;
        else if (state.flashcards && state.flashcards.length > 0 && state.fcIndex < state.flashcards.length) {
            meaningInput.value = state.flashcards[state.fcIndex].meaning;
        } else {
            meaningInput.value = "N/A";
        }
    }
    
    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.remove('hidden');
}

function openGeneralFeedbackModal() {
    state.activeReportModule = 'General Feedback';
    
    // Configure layout for General Suggestion
    const titleEl = document.getElementById('report-modal-title');
    const iconEl = document.getElementById('report-modal-icon');
    const contextFields = document.getElementById('report-context-fields');
    const typeDropdown = document.getElementById('report-type');
    
    if (titleEl) titleEl.textContent = "Submit Suggestion";
    if (iconEl) iconEl.innerHTML = `<i class="fa-solid fa-lightbulb text-amber-500 text-sm"></i>`;
    if (contextFields) contextFields.classList.add('hidden');
    if (typeDropdown) typeDropdown.value = "suggestion";
    
    // Set fallback read-only inputs
    const termInput = document.getElementById('report-term');
    const meaningInput = document.getElementById('report-meaning');
    if (termInput) termInput.value = "General / Non-card specific";
    if (meaningInput) meaningInput.value = "N/A";
    
    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.remove('hidden');
}

function closeReportModal() {
    const modal = document.getElementById('modal-report');
    if (modal) modal.classList.add('hidden');
    // Clear details field
    const noteEl = document.getElementById('report-note');
    if (noteEl) noteEl.value = '';
}

async function submitReport() {
    const term = document.getElementById('report-term').value;
    const meaning = document.getElementById('report-meaning').value;
    const type = document.getElementById('report-type').value;
    const note = document.getElementById('report-note').value;
    const btn = document.getElementById('btn-submit-report');
    
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Submitting...`;
    
    try {
        const response = await fetch("https://formspree.io/f/xbdbjqrj", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                module: state.activeReportModule || 'Flashcards',
                term: term,
                aiMeaning: meaning,
                issueType: type,
                details: note
            })
        });
        
        if (response.ok) {
            const isGeneral = (state.activeReportModule === 'General Feedback');
            closeReportModal();
            triggerReportSuccessToast(isGeneral);
        } else {
            alert("Oops! There was a problem submitting your report. Please try again.");
        }
    } catch (err) {
        console.error("Error reporting issue:", err);
        alert("Unable to reach the submission server. Check your internet connection.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function triggerReportSuccessToast(isGeneral) {
    const container = document.getElementById('achievement-toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'achievement-toast pointer-events-auto bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-xs animate-slide-up';
    
    const titleText = isGeneral ? "Feedback Sent!" : "Report Sent!";
    const descText = isGeneral ? "Thank you for your valuable feedback!" : "Thank you for improving the app!";
    const iconHTML = isGeneral 
        ? `<div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background:#f59e0b22;border:2px solid #f59e0b44"><i class="fa-solid fa-lightbulb text-lg" style="color:#f59e0b"></i></div>`
        : `<div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background:#10b98122;border:2px solid #10b98144"><i class="fa-solid fa-circle-check text-lg" style="color:#10b981"></i></div>`;

    el.innerHTML = `
        ${iconHTML}
        <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-gray-800">${titleText}</p>
            <p class="text-[11px] text-gray-500 leading-snug">${descText}</p>
        </div>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4500);
}

// ==========================================
// FEATURE H: LEXICON DICTIONARY
// ==========================================
const dictEnrichCache     = {};
const dictSearchIndex     = [];     // pre-built: [{entry, norm, cleanNorm, rootNorm, phonetic, meaningWords[]}]
const dictCorrectionCache = {};     // query → corrected string (session cache)
let dictCurrentFilter  = 'all';
let dictCurrentQuery   = '';
let dictPageSize       = 50;
let dictCurrentPage    = 1;
let dictFilteredAll    = [];
let dictSearchDebounce = null;
let dictSpellDebounce  = null;
let dictSpellAbortCtrl = null;
let dictInitialized    = false;

// --- Lexicon search helpers ---

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchTerm(str) {
    return str.toLowerCase()
        .replace(/\/o\b/g, '')
        .replace(/[-\/]/g, '')
        .replace(/\s+/g, '')
        .trim();
}

function phoneticNormalize(str) {
    return str
        .replace(/ph/g,     'f')   // phlebitis → flebitis
        .replace(/ae|oe/g,  'e')   // haem → hem
        .replace(/rh/g,     'r')   // rhin → rin
        .replace(/c/g,      'k')   // cardi → kardi, cyte → kite
        .replace(/z/g,      's')   // hepatizis → hepatisis
        .replace(/y/g,      'i')   // myo → mio
        .replace(/(.)\1+/g, '$1'); // hepattitis → hepatitis
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({length: m + 1}, (_, i) =>
        Array.from({length: n + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
}

const DICT_SYNONYMS = {
    heart:        ['cardi'],
    cardiac:      ['cardi'],
    kidney:       ['nephr', 'ren'],
    renal:        ['nephr', 'ren'],
    liver:        ['hepat'],
    lung:         ['pneum', 'pulmon'],
    lungs:        ['pneum', 'pulmon'],
    blood:        ['hem', 'hemat', 'sangui'],
    pain:         ['alg'],
    skin:         ['derm'],
    nerve:        ['neur'],
    neural:       ['neur'],
    bone:         ['oste'],
    muscle:       ['my'],
    eye:          ['ophthalm', 'ocul'],
    ear:          ['ot'],
    nose:         ['rhin'],
    mouth:        ['stomat'],
    stomach:      ['gastr'],
    vein:         ['phleb', 'ven'],
    artery:       ['arteri'],
    tumor:        ['om'],
    water:        ['hydr'],
    sugar:        ['gluc', 'glyc'],
    fat:          ['lip', 'adip'],
    brain:        ['encephal', 'cerebr'],
    urine:        ['ur', 'urin'],
    bladder:      ['cyst'],
    cell:         ['cyt'],
    removal:      ['ectom'],
    inflammation: ['it', 'itis'],
    disease:      ['path'],
    study:        ['log'],
};

function buildDictSearchIndex() {
    dictSearchIndex.length = 0;
    dictionary.forEach(entry => {
        const norm      = normalizeSearchTerm(entry.term);
        const cleanNorm = normalizeSearchTerm(entry.clean    || '');
        const rootNorm  = normalizeSearchTerm(entry.rootBase || '');
        const phonetic  = phoneticNormalize(norm);
        const meaningWords = entry.meaning.toLowerCase().split(/\W+/).filter(Boolean);
        dictSearchIndex.push({ entry, norm, cleanNorm, rootNorm, phonetic, meaningWords });
    });
}

function fuzzyScoreEntry(idx, query, normQ, phoneticQ) {
    const { entry, norm, cleanNorm, rootNorm, phonetic, meaningWords } = idx;
    if (dictCurrentFilter !== 'all' && entry.type !== dictCurrentFilter) return 0;

    const termLower    = entry.term.toLowerCase();
    const meaningLower = entry.meaning.toLowerCase();

    // 100: exact match
    if (termLower === query || norm === normQ || cleanNorm === normQ || rootNorm === normQ) return 100;
    // 90: starts-with
    if (termLower.startsWith(query) || norm.startsWith(normQ) || cleanNorm.startsWith(normQ)) return 90;
    // 75: term/root substring contains query
    if (termLower.includes(query) || norm.includes(normQ) || cleanNorm.includes(normQ) || rootNorm.includes(normQ)) return 75;
    // 68: DICT_SYNONYMS hit
    const syns = DICT_SYNONYMS[query] || [];
    if (syns.length && syns.some(s => norm.includes(s) || cleanNorm.includes(s) || rootNorm.includes(s))) return 68;
    // 63: meaning contains query
    if (meaningLower.includes(query)) return 63;
    // Levenshtein — pre-filtered by ±3 length to avoid full O(m×n) for hopeless candidates
    if (normQ.length >= 4 && Math.abs(norm.length - normQ.length) <= 3) {
        const dist = levenshtein(norm, normQ);
        if (dist === 1) return 55;
        if (phonetic === phoneticQ) return 45;
        if (dist === 2 && normQ.length >= 8) return 35;
        if (dist === 2 && normQ.length >= 5) return 30;
    } else if (normQ.length >= 4 && phonetic === phoneticQ) {
        return 45;
    }
    return 0;
}

function initDictionary() {
    if (dictInitialized) return;
    dictInitialized = true;

    buildDictSearchIndex();

    // Mode toggle
    document.getElementById('dict-mode-browse').addEventListener('click', () => {
        document.getElementById('dict-browse').classList.remove('hidden');
        document.getElementById('dict-decompose').classList.add('hidden');
        document.getElementById('dict-mode-browse').className    = 'px-4 py-1.5 text-sm font-bold rounded-full bg-white text-teal-700 shadow shadow-gray-300/50 transition-all';
        document.getElementById('dict-mode-decompose').className = 'px-4 py-1.5 text-sm font-bold rounded-full text-gray-500 hover:text-gray-700 transition-all';
    });
    document.getElementById('dict-mode-decompose').addEventListener('click', () => {
        document.getElementById('dict-browse').classList.add('hidden');
        document.getElementById('dict-decompose').classList.remove('hidden');
        document.getElementById('dict-mode-decompose').className = 'px-4 py-1.5 text-sm font-bold rounded-full bg-white text-teal-700 shadow shadow-gray-300/50 transition-all';
        document.getElementById('dict-mode-browse').className    = 'px-4 py-1.5 text-sm font-bold rounded-full text-gray-500 hover:text-gray-700 transition-all';
    });

    // Search input — Tier 1: 220ms debounce | Tier 2: 400ms after Tier 1 on zero results
    document.getElementById('dict-search').addEventListener('input', (e) => {
        clearTimeout(dictSearchDebounce);
        clearTimeout(dictSpellDebounce);
        if (dictSpellAbortCtrl) { dictSpellAbortCtrl.abort(); dictSpellAbortCtrl = null; }
        clearSpellSuggestion();
        document.getElementById('dict-search-spinner').classList.add('hidden');
        dictSearchDebounce = setTimeout(() => {
            dictCurrentQuery = e.target.value.trim().toLowerCase();
            dictCurrentPage  = 1;
            renderDictionaryResults();
            // Tier 2: arm only on zero results with a substantial query
            if (dictFilteredAll.length === 0 && dictCurrentQuery.length >= 3) {
                document.getElementById('dict-results-grid').innerHTML =
                    `<div class="col-span-2 text-center py-10 text-gray-400 font-medium">` +
                    `No exact matches — <span class="text-teal-600 font-semibold">asking AI…</span></div>`;
                document.getElementById('dict-search-spinner').classList.remove('hidden');
                dictSpellAbortCtrl = new AbortController();
                dictSpellDebounce  = setTimeout(async () => {
                    const corrected = await correctDictSearchQuery(dictCurrentQuery);
                    document.getElementById('dict-search-spinner').classList.add('hidden');
                    if (corrected && corrected.toLowerCase() !== dictCurrentQuery) {
                        const original   = dictCurrentQuery;
                        dictCurrentQuery = corrected.toLowerCase();
                        dictCurrentPage  = 1;
                        renderDictionaryResults();
                        if (dictFilteredAll.length > 0) showSpellSuggestion(original, corrected);
                    } else {
                        // Restore genuine no-results message
                        renderDictionaryResults();
                    }
                    dictSpellAbortCtrl = null;
                }, 400);
            }
        }, 220);
    });

    // Type filter pills
    document.querySelectorAll('.dict-filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            dictCurrentFilter = btn.dataset.filter;
            dictCurrentPage   = 1;
            document.querySelectorAll('.dict-filter-pill').forEach(b => {
                b.className = 'dict-filter-pill px-4 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all';
            });
            btn.className = 'dict-filter-pill px-4 py-1.5 text-xs font-bold rounded-full bg-teal-600 text-white shadow-sm transition-all';
            renderDictionaryResults();
        });
    });

    // Show more
    document.getElementById('dict-show-more').addEventListener('click', () => {
        dictCurrentPage++;
        renderDictionaryResults(true);
    });

    // Decompose
    document.getElementById('dict-decompose-btn').addEventListener('click', () => {
        const word = document.getElementById('dict-decompose-input').value.trim();
        if (word) decomposeWord(word);
    });
    document.getElementById('dict-decompose-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const word = e.target.value.trim();
            if (word) decomposeWord(word);
        }
    });

    // Modal events
    document.getElementById('dict-modal-close').addEventListener('click', closeDictionaryModal);
    document.getElementById('dict-modal-backdrop').addEventListener('click', closeDictionaryModal);
    document.getElementById('dict-modal-enrich-btn').addEventListener('click', () => {
        const id = document.getElementById('dict-entry-modal').dataset.entryId;
        if (id) enrichDictionaryEntry(id);
    });
    document.getElementById('dict-modal-study-btn').addEventListener('click', () => {
        const id    = document.getElementById('dict-entry-modal').dataset.entryId;
        const entry = dictionary.find(t => t.id === id);
        closeDictionaryModal();
        if (entry) {
            setActiveSystem(entry.system);
            switchTab('flashcards');
        }
    });

    renderDictionaryResults();
}

function renderDictionaryResults(append = false) {
    if (!append) {
        if (!dictCurrentQuery) {
            // Empty query: type filter only, alphabetical order — no scoring
            dictFilteredAll = dictionary
                .filter(t => dictCurrentFilter === 'all' || t.type === dictCurrentFilter)
                .sort((a, b) => a.term.localeCompare(b.term));
        } else {
            // Active query: score every indexed entry, keep score > 0, sort descending
            const normQ     = normalizeSearchTerm(dictCurrentQuery);
            const phoneticQ = phoneticNormalize(normQ);
            const scored    = [];
            dictSearchIndex.forEach(idx => {
                const score = fuzzyScoreEntry(idx, dictCurrentQuery, normQ, phoneticQ);
                if (score > 0) scored.push({ entry: idx.entry, score });
            });
            scored.sort((a, b) => b.score - a.score);
            dictFilteredAll = scored.map(s => s.entry);
        }
    }

    const total    = dictFilteredAll.length;
    const start    = append ? (dictCurrentPage - 1) * dictPageSize : 0;
    const slice    = dictFilteredAll.slice(start, start + dictPageSize);
    const grid     = document.getElementById('dict-results-grid');
    const moreWrap = document.getElementById('dict-show-more-wrap');
    const countEl  = document.getElementById('dict-result-count');

    if (!append) grid.innerHTML = '';

    if (total === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-12 text-gray-400 font-medium">No results for &#8220;<span class="font-bold text-gray-600">${escapeHtml(dictCurrentQuery)}</span>&#8221;</div>`;
        moreWrap.classList.add('hidden');
        countEl.textContent = '0 results';
        return;
    }

    countEl.textContent = !dictCurrentQuery && total === dictionary.length
        ? `All ${total} entries`
        : `${total} result${total !== 1 ? 's' : ''}`;

    const typeClasses = {
        prefix: 'bg-sky-50 text-sky-700 border-sky-100',
        root:   'bg-emerald-50 text-emerald-700 border-emerald-100',
        suffix: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100'
    };

    slice.forEach(entry => {
        const iv       = state.intervals[entry.id] || 0;
        const dotColor = iv === 0 ? 'bg-gray-300' : iv <= 2 ? 'bg-amber-400' : iv <= 6 ? 'bg-blue-400' : 'bg-teal-500';
        const dotTitle = iv === 0 ? 'Not studied' : iv <= 2 ? 'Learning' : iv <= 6 ? 'Familiar' : 'Mastered';
        const typeCls  = typeClasses[entry.type] || 'bg-gray-50 text-gray-700 border-gray-100';

        // Safe HTML with query highlighting
        let termHtml    = escapeHtml(entry.term);
        let meaningHtml = escapeHtml(entry.meaning);
        if (dictCurrentQuery) {
            const re = new RegExp(`(${escapeRegex(dictCurrentQuery)})`, 'gi');
            termHtml    = termHtml.replace(re, '<mark class="bg-amber-100 text-amber-900 rounded px-0.5">$1</mark>');
            meaningHtml = meaningHtml.replace(re, '<mark class="bg-amber-100 text-amber-900 rounded px-0.5">$1</mark>');
        }

        const card = document.createElement('button');
        card.className = 'text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer';
        card.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-2">
                <span class="font-extrabold text-gray-800 text-base leading-tight">${termHtml}</span>
                <span class="w-2.5 h-2.5 rounded-full ${dotColor} shrink-0 mt-1" title="${dotTitle}"></span>
            </div>
            <div class="flex flex-wrap gap-1.5 mb-2">
                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${typeCls}">${escapeHtml(entry.type)}</span>
                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-100">${escapeHtml(entry.system)}</span>
            </div>
            <p class="text-sm text-gray-600 font-medium leading-snug">${meaningHtml}</p>`;
        card.addEventListener('click', () => openDictionaryEntry(entry.id));
        grid.appendChild(card);
    });

    moreWrap.classList.toggle('hidden', Math.min(dictCurrentPage * dictPageSize, total) >= total);
}

function openDictionaryEntry(id) {
    const entry = dictionary.find(t => t.id === id);
    if (!entry) return;

    const modal = document.getElementById('dict-entry-modal');
    modal.dataset.entryId = id;

    // Term
    document.getElementById('dict-modal-term').textContent = entry.term;

    // Type chip
    const typeClasses = {
        prefix: 'bg-sky-50 text-sky-700 border-sky-100',
        root:   'bg-emerald-50 text-emerald-700 border-emerald-100',
        suffix: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100'
    };
    const typeChip = document.getElementById('dict-modal-type-chip');
    typeChip.textContent = entry.type;
    typeChip.className = `text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${typeClasses[entry.type] || 'bg-gray-50 text-gray-500 border-gray-100'}`;

    // System chip with SYSTEM_COLORS
    const sysColor = SYSTEM_COLORS[entry.system] || '#6b7280';
    const sysChip  = document.getElementById('dict-modal-system-chip');
    sysChip.textContent   = entry.system;
    sysChip.style.cssText = `background:${sysColor}22;color:${sysColor};border:1px solid ${sysColor}44`;

    // Meaning
    document.getElementById('dict-modal-meaning').textContent = entry.meaning;

    // Mastery status
    const iv         = state.intervals[entry.id] || 0;
    const dotCls     = iv === 0 ? 'bg-gray-400' : iv <= 2 ? 'bg-amber-400' : iv <= 6 ? 'bg-blue-400' : 'bg-teal-500';
    const masteryTxt = iv === 0 ? 'Not studied' : iv <= 2 ? 'Learning' : iv <= 6 ? 'Familiar' : 'Mastered';
    document.getElementById('dict-modal-mastery').innerHTML =
        `<span class="w-2 h-2 rounded-full ${dotCls} inline-block mr-1.5"></span>${masteryTxt}`;

    // Static examples from EXAMPLES lookup table
    const exArr = EXAMPLES[entry.term] || EXAMPLES[entry.clean] || EXAMPLES[entry.rootBase] || [];
    const exSec = document.getElementById('dict-modal-examples-section');
    const exBox = document.getElementById('dict-modal-examples');
    if (exArr.length > 0) {
        exSec.classList.remove('hidden');
        exBox.innerHTML = exArr.map(ex =>
            `<span class="text-sm font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">${ex}</span>`
        ).join('');
    } else {
        exSec.classList.add('hidden');
    }

    // Enrich area — show cached or fresh button
    const enrichBtn    = document.getElementById('dict-modal-enrich-btn');
    const enrichResult = document.getElementById('dict-modal-enrich-result');
    if (dictEnrichCache[id]) {
        enrichBtn.classList.add('hidden');
        enrichResult.classList.remove('hidden');
        document.getElementById('dict-modal-ai-examples').innerHTML = (dictEnrichCache[id].examples || []).map(ex =>
            `<span class="text-sm font-semibold px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">${ex}</span>`
        ).join('');
        document.getElementById('dict-modal-mnemonic').textContent = dictEnrichCache[id].mnemonic || '\u2014';
    } else {
        enrichBtn.classList.remove('hidden');
        enrichBtn.disabled = false;
        enrichBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> AI Enrich \u2014 Get mnemonic &amp; more examples`;
        enrichResult.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

function closeDictionaryModal() {
    document.getElementById('dict-entry-modal').classList.add('hidden');
}

function findInDictionary(morpheme) {
    if (!morpheme) return null;
    const m = morpheme.toLowerCase().trim();
    // 1. Exact term match
    let hit = dictionary.find(t => t.term.toLowerCase() === m);
    if (hit) return hit;
    // 2. Normalised match — strip leading/trailing punctuation and combining vowel
    const norm = m.replace(/^[-\/]+|[-\/]+$/g, '').replace(/\/o$/, '');
    return dictionary.find(t => {
        const tNorm = t.term.toLowerCase().replace(/^[-\/]+|[-\/]+$/g, '').replace(/\/o$/, '');
        const clean = (t.clean    || '').toLowerCase();
        const root  = (t.rootBase || '').toLowerCase();
        return tNorm === norm || clean === norm || root === norm;
    }) || null;
}

async function decomposeWord(word) {
    const btn           = document.getElementById('dict-decompose-btn');
    const output        = document.getElementById('dict-decompose-output');
    const offlineBanner = document.getElementById('dict-offline-banner');

    btn.disabled  = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Analyzing\u2026</span>`;
    output.innerHTML = '';
    offlineBanner.classList.add('hidden');

    const prompt = `You are a medical terminology expert. Decompose this medical word into its morpheme components using standard combining form notation.
Word: "${word}"
Return ONLY valid JSON with no extra text: {"prefix": "string or null", "roots": ["array of combining forms"], "suffix": "string or null", "assembled_meaning": "plain English meaning built from the parts"}
Use notation like "cardi/o", "my/o", "hyper-", "-itis", "-megaly". Use null for absent prefix/suffix and [] for absent roots.`;

    try {
        const { response } = await requestOllamaWithModelFallback('/api/generate', (model) => ({
            model,
            prompt,
            stream: false,
            format: 'json',
            options: { num_ctx: 768, num_predict: 200 }
        }));
        const data    = await response.json();
        const jsonStr = data.response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed  = JSON.parse(jsonStr);
        renderDecompositionResult(word, parsed);
    } catch (err) {
        console.warn('Decomposition failed:', err);
        offlineBanner.classList.remove('hidden');
        output.innerHTML = `<div class="text-center py-8 text-gray-400 font-medium">Could not analyze "<span class="font-semibold text-gray-600">${word}</span>". Verify local provider readiness and try again.</div>`;
    } finally {
        btn.disabled  = false;
        btn.innerHTML = `<i class="fa-solid fa-magnifying-glass-plus"></i> <span>Analyze</span>`;
    }
}

function renderDecompositionResult(word, parsed) {
    const output = document.getElementById('dict-decompose-output');
    const typeClasses = {
        prefix: 'bg-sky-50 text-sky-700 border-sky-100',
        root:   'bg-emerald-50 text-emerald-700 border-emerald-100',
        suffix: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100'
    };

    const morphemes = [];
    if (parsed.prefix) morphemes.push({ label: 'Prefix', value: parsed.prefix, type: 'prefix' });
    (parsed.roots || []).forEach(r => morphemes.push({ label: 'Root', value: r, type: 'root' }));
    if (parsed.suffix) morphemes.push({ label: 'Suffix', value: parsed.suffix, type: 'suffix' });

    const morphemeHTML = morphemes.map(m => {
        const match = findInDictionary(m.value);
        const cls   = typeClasses[m.type] || 'bg-gray-50 text-gray-500 border-gray-100';
        if (match) {
            return `<button class="text-left w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-teal-300 transition-all" onclick="openDictionaryEntry('${match.id}')">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}">${m.label}</span>
                    <span class="text-xs font-bold text-teal-600 flex items-center gap-1"><i class="fa-solid fa-link text-[9px]"></i> in Lexicon</span>
                </div>
                <p class="font-extrabold text-gray-800 text-base">${m.value}</p>
                <p class="text-sm text-gray-500 font-medium">${match.meaning}</p>
            </button>`;
        }
        return `<div class="bg-white border border-dashed border-gray-200 rounded-2xl p-4 opacity-70">
            <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}">${m.label}</span>
                <span class="text-xs text-gray-400 font-medium">not in local dictionary</span>
            </div>
            <p class="font-extrabold text-gray-800 text-base">${m.value}</p>
        </div>`;
    }).join('');

    output.innerHTML = `
        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Analyzed Word</p>
            <p class="text-2xl font-extrabold text-gray-800 mb-3">${word}</p>
            <div class="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
                <p class="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">Assembled Meaning</p>
                <p class="text-base font-semibold text-teal-900">${parsed.assembled_meaning || '\u2014'}</p>
            </div>
        </div>
        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 mt-1 mb-1">Morpheme Breakdown</p>
        <div class="space-y-3">${morphemeHTML || '<p class="text-gray-400 text-sm text-center py-6">No morphemes identified.</p>'}</div>`;
}

async function enrichDictionaryEntry(id) {
    const entry = dictionary.find(t => t.id === id);
    if (!entry) return;

    const btn = document.getElementById('dict-modal-enrich-btn');
    const activeModel = getTutorModel();
    const modelLabel = typeof window.formatModelLabel === 'function'
        ? window.formatModelLabel(activeModel)
        : activeModel;
    btn.disabled  = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Enriching with ${modelLabel}\u2026`;

    const prompt = `Medical term: "${entry.term}" (${entry.type}, meaning: "${entry.meaning}")
Provide: 1) exactly two real clinical words that prominently use this morpheme, 2) one concise memory mnemonic for students.
Return ONLY valid JSON: {"examples": ["clinicalword1", "clinicalword2"], "mnemonic": "one concise memory tip"}`;

    try {
        const { response } = await requestOllamaWithModelFallback('/api/generate', (model) => ({
            model,
            prompt,
            stream: false,
            format: 'json',
            options: { num_ctx: 512, num_predict: 150 }
        }));
        const data    = await response.json();
        const jsonStr = data.response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed  = JSON.parse(jsonStr);

        dictEnrichCache[id] = parsed;
        document.getElementById('dict-modal-ai-examples').innerHTML = (parsed.examples || []).map(ex =>
            `<span class="text-sm font-semibold px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">${ex}</span>`
        ).join('');
        document.getElementById('dict-modal-mnemonic').textContent = parsed.mnemonic || '\u2014';

        btn.classList.add('hidden');
        document.getElementById('dict-modal-enrich-result').classList.remove('hidden');
    } catch (err) {
        console.warn('Enrichment failed:', err);
        btn.disabled  = false;
        btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i> Enrichment failed \u2014 verify local provider readiness`;
    }
}

async function correctDictSearchQuery(query) {
    if (Object.prototype.hasOwnProperty.call(dictCorrectionCache, query)) {
        return dictCorrectionCache[query];
    }
    const normQ = normalizeSearchTerm(query);
    // Top-5 near-miss candidates by Levenshtein (even if fuzzyScore = 0)
    const candidates = dictSearchIndex
        .map(idx => ({ term: idx.entry.term, dist: levenshtein(idx.norm, normQ) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5)
        .map(c => c.term);

    const prompt =
        `You are a medical terminology spell-checker. The user searched for: "${query}"\n` +
        `The closest terms in our dictionary are: ${candidates.join(', ')}\n` +
        `Which of these did the user most likely mean? Reply ONLY with valid JSON: ` +
        `{"corrected": "exact term from the list, or null if none is a close match"}`;

    async function attempt(signal) {
        const { response: r } = await requestOllamaWithModelFallback('/api/generate', (model) => ({
            model,
            prompt,
            stream: false,
            format: 'json',
            options: { num_ctx: 512, num_predict: 40 }
        }));
        const d = await r.json();
        const p = JSON.parse(d.response);
        return (p.corrected && String(p.corrected).trim()) || null;
    }

    try {
        const signal = dictSpellAbortCtrl ? dictSpellAbortCtrl.signal : undefined;
        const result = await attempt(signal);
        dictCorrectionCache[query] = result;
        return result;
    } catch (err) {
        if (err.name === 'AbortError') return null;
        // One silent retry without abort signal
        try {
            const result = await attempt(undefined);
            dictCorrectionCache[query] = result;
            return result;
        } catch {
            dictCorrectionCache[query] = null;
            return null;
        }
    }
}

function showSpellSuggestion(original, corrected) {
    const el      = document.getElementById('dict-spell-suggestion');
    const textEl  = document.getElementById('dict-spell-text');
    const undoBtn = document.getElementById('dict-spell-undo');
    const dismiss = document.getElementById('dict-spell-dismiss');

    textEl.innerHTML  = `Showing results for <strong class="font-extrabold text-amber-900">${escapeHtml(corrected)}</strong>`;
    undoBtn.textContent = `search \u201c${original}\u201d instead`;
    undoBtn.onclick = () => {
        clearSpellSuggestion();
        dictCurrentQuery = original;
        document.getElementById('dict-search').value = original;
        dictCurrentPage  = 1;
        renderDictionaryResults();
    };
    dismiss.onclick = clearSpellSuggestion;
    el.classList.remove('hidden');
}

function clearSpellSuggestion() {
    document.getElementById('dict-spell-suggestion').classList.add('hidden');
}
