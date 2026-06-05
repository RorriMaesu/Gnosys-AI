(function () {
    const PASS_PERCENT = 80;

    const STATE_LOCKED = 0;
    const STATE_ACTIVE = 1;
    const STATE_HW_PENDING = 2;
    const STATE_MASTERED = 3;
    const STATE_RUSTED = 4;

    const appState = {
        syllabus: null,
        matrix: {},
        selectedLessonId: null,
        selectedLesson: null,
        currentQuestions: []
    };

    const els = {};

    const ASSIGNMENT_DB = {
        lesson_3_1: () => [
            {
                question: "Which of the following describes the primary functional difference between innate and adaptive immunity?",
                options: [
                    "Innate immunity has memory and targets specific pathogens; adaptive immunity is general and rapid.",
                    "Innate immunity is non-specific, rapid, and lacks memory; adaptive immunity is antigen-specific, slower to develop, and has memory.",
                    "Innate immunity uses T-cells and B-cells; adaptive immunity relies solely on skin and physical barriers.",
                    "Innate immunity only targets viruses; adaptive immunity only targets bacteria."
                ],
                correctAnswer: 1,
                explanation: "Innate immunity represents immediate, non-specific defenses (barriers, phagocytes, NK cells) lacking memory. Adaptive immunity is antigen-specific, takes days to activate, and creates long-lived memory cells."
            },
            {
                question: "Which MHC class presents intracellular viral antigens to CD8+ Cytotoxic T-cells, and where is it expressed?",
                options: [
                    "MHC-I; expressed on all nucleated cells",
                    "MHC-II; expressed only on professional antigen-presenting cells",
                    "MHC-I; expressed only on erythrocytes",
                    "MHC-II; expressed on all body cells"
                ],
                correctAnswer: 0,
                explanation: "MHC-I molecules present endogenous (intracellular) antigens, such as viral proteins, on all nucleated body cells to CD8+ Cytotoxic T-cells to initiate host cell destruction."
            },
            {
                question: "A patient presents with non-painful swollen lymph nodes in the groin. Which lymphoid organ acts as the primary filter for lymph, and where does lymph drainage return to the circulatory system?",
                options: [
                    "Spleen; returns via hepatic portal vein",
                    "Thymus; returns via carotid artery",
                    "Lymph nodes; returns via the subclavian veins",
                    "Tonsils; returns via the jugular veins"
                ],
                correctAnswer: 2,
                explanation: "Lymph nodes filter foreign materials from lymphatic fluid (lymph). The lymph drainage is returned to the cardiovascular circulation via the thoracic duct and right lymphatic duct into the subclavian veins."
            },
            {
                question: "Upon activation and clonal selection, which cell type differentiates into plasma cells to synthesize and secrete massive amounts of antibodies?",
                options: [
                    "Helper CD4+ T-cell",
                    "Cytotoxic CD8+ T-cell",
                    "B-lymphocyte",
                    "Natural Killer (NK) cell"
                ],
                correctAnswer: 2,
                explanation: "B-lymphocytes (B-cells) recognize native antigens, receive CD4+ T-cell help, and undergo clonal selection to differentiate into antibody-secreting plasma cells."
            },
            {
                question: "Which immune cell serves as the primary controller of both cell-mediated and humoral adaptive immunity, and is targeted and destroyed by HIV?",
                options: [
                    "CD8+ Cytotoxic T-cell",
                    "CD4+ Helper T-cell",
                    "Macrophage",
                    "Dendritic cell"
                ],
                correctAnswer: 1,
                explanation: "CD4+ Helper T-cells coordinate both humoral and cellular immunity by releasing cytokines that activate B-cells and cytotoxic T-cells. HIV binds specifically to CD4, destroying these helper cells."
            }
        ],
        lesson_3_2: () => [
            {
                question: "Based on Boyle's Law ($P \\propto 1/V$), how does muscle contraction lead to air inhalation during ventilation?",
                options: [
                    "Diaphragm contraction decreases thoracic volume, increasing pressure to push air out.",
                    "Diaphragm contraction increases thoracic volume, dropping alveolar pressure below atmospheric pressure to draw air in.",
                    "Intercostal relaxation increases thoracic pressure to pull air in.",
                    "Alveolar recoil increases lung volume to pull air in."
                ],
                correctAnswer: 1,
                explanation: "Boyle's law dictates that pressure and volume are inversely related. Contraction of the diaphragm and external intercostals expands thoracic volume, decreasing intra-alveolar pressure below atmospheric pressure ($760 \\text{ mmHg}$), drawing air into the lungs."
            },
            {
                question: "According to the Bohr effect, which tissue environment shifts the oxygen-hemoglobin dissociation curve to the right, reducing oxygen affinity?",
                options: [
                    "Decreased temperature, elevated pH, and low PCO2",
                    "Elevated temperature, decreased pH (acidosis), and high PCO2",
                    "High altitude, hyperventilation, and low 2,3-BPG",
                    "High pH, hypothermia, and low metabolic activity"
                ],
                correctAnswer: 1,
                explanation: "The Bohr effect shifts the curve to the right in metabolically active tissues. High temperature, high hydrogen ion concentration (low pH/acidosis), and high PCO2 decrease hemoglobin's affinity for oxygen, promoting unloading."
            },
            {
                question: "Dalton's Law states that the total pressure of a gas mixture is the sum of partial pressures. If atmospheric pressure is 760 mmHg and oxygen makes up 21% of the atmosphere, what is the PO2?",
                options: [
                    "100 mmHg",
                    "159.6 mmHg",
                    "760 mmHg",
                    "40 mmHg"
                ],
                correctAnswer: 1,
                explanation: "Partial pressure is calculated by multiplying fractional concentration by total pressure: $760 \\text{ mmHg} \\times 0.21 = 159.6 \\text{ mmHg}$."
            },
            {
                question: "An anxious patient is hyperventilating rapidly. How does this hyperventilation affect blood carbon dioxide and pH levels?",
                options: [
                    "It retains CO2, causing respiratory acidosis.",
                    "It blows off CO2, reducing hydrogen ion concentration and causing respiratory alkalosis.",
                    "It increases oxygen levels to trigger metabolic acidosis.",
                    "It has no effect on bicarbonate concentration or blood pH."
                ],
                correctAnswer: 1,
                explanation: "Hyperventilation expels carbon dioxide ($CO_2$) rapidly. According to the carbonic acid equation, this shifts the equilibrium to reduce $H^+$, elevating blood pH and causing respiratory alkalosis."
            },
            {
                question: "Which structures of the respiratory zone provide the primary surface area for gas exchange, and what tissue composes them?",
                options: [
                    "Bronchioles; pseudostratified columnar epithelium",
                    "Alveoli; simple squamous epithelium",
                    "Trachea; hyaline cartilage",
                    "Terminal bronchioles; simple cuboidal epithelium"
                ],
                correctAnswer: 1,
                explanation: "Gas exchange occurs across the respiratory membrane of the alveoli, which are composed of Type I alveolar cells (simple squamous epithelium) to minimize diffusion distance."
            }
        ],
        lesson_3_3: () => [
            {
                question: "Trace the histological layering of the alimentary canal from the inner lumen out to the abdominal cavity:",
                options: [
                    "Mucosa ➔ Submucosa ➔ Muscularis Externa ➔ Serosa",
                    "Serosa ➔ Muscularis Externa ➔ Submucosa ➔ Mucosa",
                    "Submucosa ➔ Mucosa ➔ Serosa ➔ Muscularis Externa",
                    "Mucosa ➔ Muscularis Externa ➔ Submucosa ➔ Adventitia"
                ],
                correctAnswer: 0,
                explanation: "The GI tract walls have four core layers from lumen out: 1. Mucosa (epithelium, lamina propria, muscularis mucosae), 2. Submucosa (connective tissue, plexus), 3. Muscularis Externa (smooth muscle layers), 4. Serosa/Adventitia (visceral peritoneum)."
            },
            {
                question: "Which histological layer contains the circular and longitudinal smooth muscle sheets that coordinate mechanical digestion and peristalsis?",
                options: [
                    "Mucosa",
                    "Submucosa",
                    "Muscularis Externa",
                    "Serosa"
                ],
                correctAnswer: 2,
                explanation: "The Muscularis Externa contains an inner circular and outer longitudinal layer of smooth muscle. Their coordinated contraction drives peristalsis and segmentation."
            },
            {
                question: "During cellular respiration, what is the net yield of ATP generated directly from a single mole of glucose during anaerobic glycolysis in the cytoplasm?",
                options: [
                    "0 ATP",
                    "2 ATP",
                    "4 ATP",
                    "32 to 38 ATP"
                ],
                correctAnswer: 1,
                explanation: "Glycolysis consumes 2 ATP and produces 4 ATP, resulting in a net yield of 2 ATP molecules per glucose molecule under anaerobic conditions."
            },
            {
                question: "Where in the cell are the proteins of the Electron Transport Chain (ETC) located, and what is the final electron acceptor?",
                options: [
                    "Cytoplasm; Pyruvate",
                    "Inner mitochondrial membrane (cristae); Oxygen ($O_2$)",
                    "Mitochondrial matrix; Carbon Dioxide ($CO_2$)",
                    "Outer mitochondrial membrane; Water ($H_2O$)"
                ],
                correctAnswer: 1,
                explanation: "The ETC is embedded in the inner mitochondrial membrane. It transfers electrons from NADH and FADH2 to pump protons, with oxygen serving as the terminal electron acceptor to form water."
            },
            {
                question: "A patient with pancreatitis has deficient pancreatic secretions. Which digestive enzyme is responsible for emulsified lipid breakdown in the duodenum?",
                options: [
                    "Pepsin",
                    "Salivary Amylase",
                    "Pancreatic Lipase",
                    "Trypsin"
                ],
                correctAnswer: 2,
                explanation: "Pancreatic lipase is the primary enzyme responsible for digesting lipids (triglycerides) into fatty acids and monoglycerides after bile emulsifies them."
            }
        ],
        lesson_3_4: () => [
            {
                question: "Trace the sequential flow of filtrate through the nephron starting from the glomerulus:",
                options: [
                    "Glomerulus ➔ Bowman's Capsule ➔ Proximal Convoluted Tubule ➔ Loop of Henle ➔ Distal Convoluted Tubule ➔ Collecting Duct",
                    "Glomerulus ➔ Loop of Henle ➔ Proximal Tubule ➔ Distal Tubule ➔ Bowman's Capsule",
                    "Glomerulus ➔ Bowman's Capsule ➔ Distal Tubule ➔ Loop of Henle ➔ Proximal Tubule",
                    "Glomerulus ➔ Collecting Duct ➔ Bowman's Capsule ➔ Loop of Henle ➔ Renal Pelvis"
                ],
                correctAnswer: 0,
                explanation: "Filtrate flows in order: Glomerulus ➔ Bowman's Capsule ➔ Proximal Convoluted Tubule (PCT) ➔ Descending and Ascending Loop of Henle ➔ Distal Convoluted Tubule (DCT) ➔ Collecting Duct."
            },
            {
                question: "Calculate Net Filtration Pressure (NFP) at the glomerulus given the following hydrostatic and oncotic values: Glomerular Hydrostatic Pressure ($HP_g$) = 55 mmHg, Bowman's Capsule Hydrostatic Pressure ($HP_c$) = 15 mmHg, Glomerular Oncotic Pressure ($OP_g$) = 30 mmHg.",
                options: [
                    "70 mmHg",
                    "10 mmHg",
                    "40 mmHg",
                    "25 mmHg"
                ],
                correctAnswer: 1,
                explanation: "NFP is calculated as: $NFP = HP_g - (HP_c + OP_g)$. Placing the values: $55 - (15 + 30) = 10 \\text{ mmHg}$."
            },
            {
                question: "What hormone/enzyme cascade is initiated by juxtaglomerular cells in response to low blood pressure or low NaCl load?",
                options: [
                    "Erythropoietin release to expand plasma volume",
                    "Renin release, triggering the Renin-Angiotensin-Aldosterone System (RAAS)",
                    "Atrial Natriuretic Peptide (ANP) release to excrete sodium",
                    "Antidiuretic Hormone release from the anterior pituitary"
                ],
                correctAnswer: 1,
                explanation: "Low blood pressure or low sodium triggers juxtaglomerular cells to release renin, an enzyme converting angiotensinogen to angiotensin I. This begins the RAAS cascade to restore pressure and volume."
            },
            {
                question: "Which segment of the loop of Henle is highly permeable to water but impermeable to solutes, helping concentrate urine?",
                options: [
                    "Ascending thick limb",
                    "Descending limb",
                    "Distal convoluted tubule",
                    "Glomerulus capsule"
                ],
                correctAnswer: 1,
                explanation: "The descending limb of the loop of Henle is permeable to water (contains aquaporins) but impermeable to NaCl, allowing water to exit into the hypertonic medullary interstitium."
            },
            {
                question: "During GFR regulation, what is the role of Angiotensin-Converting Enzyme (ACE) in the RAAS pathway?",
                options: [
                    "Converts Angiotensin I to the active vasoconstrictor Angiotensin II",
                    "Converts Angiotensinogen to Angiotensin I",
                    "Stimulates the direct release of renin from the kidney",
                    "Excretes aldosterone from the adrenal cortex"
                ],
                correctAnswer: 0,
                explanation: "ACE (primarily in pulmonary capillaries) cleaves Angiotensin I into Angiotensin II, which drives vasoconstriction and aldosterone release."
            }
        ],
        lesson_3_5: () => [
            {
                question: "Which of the following is the primary chemical buffer system working in the extracellular fluid (ECF) to resist blood pH shifts?",
                options: [
                    "Phosphate buffer system",
                    "Protein buffer system (hemoglobin)",
                    "Carbonic acid-bicarbonate buffer system",
                    "Ammonium buffer system"
                ],
                correctAnswer: 2,
                explanation: "The carbonic acid-bicarbonate system ($CO_2 + H_2O \\rightleftharpoons H_2CO_3 \\rightleftharpoons H^+ + HCO_3^-$) is the principal buffer system managing extracellular fluid pH."
            },
            {
                question: "An arterial blood gas (ABG) panel displays: pH = 7.28, PaCO2 = 52 mmHg, HCO3- = 29 mEq/L. What is the clinical diagnosis?",
                options: [
                    "Metabolic acidosis, fully compensated",
                    "Respiratory acidosis, partially compensated by renal retention of bicarbonate",
                    "Respiratory alkalosis, uncompensated",
                    "Metabolic alkalosis, compensated by hypoventilation"
                ],
                correctAnswer: 1,
                explanation: "The pH (7.28) indicates acidosis ($< 7.35$). The PaCO2 (52) is high ($> 45$), confirming a respiratory origin. Bicarbonate (29) is elevated ($> 26$), indicating the kidneys are compensating by retaining $HCO_3^-$."
            },
            {
                question: "In the kidneys, what is the direct physiological effect of Aldosterone (activated by the RAAS cascade) on electrolyte handling?",
                options: [
                    "Promotes potassium retention and sodium excretion in the PCT.",
                    "Promotes sodium reabsorption and potassium/hydrogen ion excretion in the distal tubules and collecting ducts.",
                    "Blocks water reabsorption by closing aquaporin gates.",
                    "Excretes calcium to stimulate parathyroid hormone."
                ],
                correctAnswer: 1,
                explanation: "Aldosterone stimulates principal cells in the DCT and collecting duct to upregulate $Na^+/K^+$ ATPases, retaining sodium (and water) and excreting potassium and hydrogen ions."
            },
            {
                question: "Which hormone is released by the heart atrium in response to high blood volume (stretch) to decrease blood pressure by promoting sodium and water excretion?",
                options: [
                    "Aldosterone",
                    "Atrial Natriuretic Peptide (ANP)",
                    "Antidiuretic Hormone (ADH)",
                    "Angiotensin II"
                ],
                correctAnswer: 1,
                explanation: "ANP is released during high blood volume to inhibit renin, aldosterone, and ADH secretion, encouraging natriuresis (sodium excretion) and diuresis to lower blood pressure."
            },
            {
                question: "A patient suffering from severe, prolonged diarrhea presents with a blood pH of 7.31. What is the metabolic cause of this acidosis?",
                options: [
                    "Hyperventilation retaining carbon dioxide",
                    "Loss of bicarbonate ($HCO_3^-$) rich secretions in pancreatic/intestinal juices",
                    "Lactic acid accumulation in the stomach",
                    "Over-secretion of aldosterone retaining hydrogen ions"
                ],
                correctAnswer: 1,
                explanation: "Intestinal and pancreatic juices contain high concentrations of bicarbonate. Severe diarrhea causes bicarbonate loss, reducing buffer capacity and leading to metabolic acidosis."
            }
        ],
        lesson_3_6: () => [
            {
                question: "What endocrine hormone spike directly triggers follicle rupture and ovulation at Day 14 of the ovarian cycle?",
                options: [
                    "Progesterone surge",
                    "Estrogen baseline suppression",
                    "Luteinizing Hormone (LH) surge",
                    "GnRH pulse frequency slowdown"
                ],
                correctAnswer: 2,
                explanation: "High estrogen levels from the dominant follicle exert positive feedback on the pituitary, triggering a massive surge of Luteinizing Hormone (LH), which induces ovulation."
            },
            {
                question: "Which uterine/menstrual cycle phase corresponds directly to the ovarian Luteal Phase (Days 15-28), driven by high Progesterone from the corpus luteum?",
                options: [
                    "Menstrual Phase",
                    "Proliferative Phase",
                    "Secretory Phase",
                    "Follicular Phase"
                ],
                correctAnswer: 2,
                explanation: "During the ovarian luteal phase, the corpus luteum secretes progesterone. This drives the uterine secretory phase, preparing the endometrium for embryo implantation."
            },
            {
                question: "What is the primary difference in cellular yield between male spermatogenesis and female oogenesis?",
                options: [
                    "Spermatogenesis yields 1 functional sperm; oogenesis yields 4 ova.",
                    "Spermatogenesis yields 4 functional haploid sperm; oogenesis yields 1 functional haploid ovum and 2-3 non-functional polar bodies.",
                    "Both spermatogenesis and oogenesis yield 4 diploid gametes.",
                    "Spermatogenesis is completed before birth; oogenesis continues throughout life."
                ],
                correctAnswer: 1,
                explanation: "Spermatogenesis divides equally to produce 4 mature haploid sperm. Oogenesis undergoes unequal cytokinesis, yielding 1 large ovum with cytoplasm and small polar bodies."
            },
            {
                question: "After ovulation, the ruptured follicle collapses and transforms into which temporary endocrine structure that secretes high progesterone?",
                options: [
                    "Corpus Albicans",
                    "Corpus Luteum",
                    "Graafian Follicle",
                    "Endometrium layer"
                ],
                correctAnswer: 1,
                explanation: "LH converts the ruptured follicle into the corpus luteum (yellow body), which acts as a temporary gland secreting progesterone and estrogen to sustain early pregnancy."
            },
            {
                question: "Which hypothalamic hormone regulates the pulse frequency release of LH and FSH from the anterior pituitary to coordinate gametogenesis?",
                options: [
                    "Gonadotropin-Releasing Hormone (GnRH)",
                    "Prolactin-Releasing Hormone (PRH)",
                    "Somatostatin",
                    "Oxytocin"
                ],
                correctAnswer: 0,
                explanation: "GnRH is released in pulses by the hypothalamus. It stimulates the anterior pituitary gonadotropes to release LH and FSH, driving ovarian and testicular activity."
            }
        ]
    };

    function cacheDom() {
        els.assignmentList = document.getElementById('assignment-list');
        els.assignmentLessonId = document.getElementById('assignment-lesson-id');
        els.assignmentTitle = document.getElementById('assignment-title');
        els.assignmentDesc = document.getElementById('assignment-desc');
        els.assignmentType = document.getElementById('assignment-type');
        els.masteryGrade = document.getElementById('mastery-grade');
        els.masteryStatus = document.getElementById('mastery-status');
        els.workspace = document.getElementById('assignment-workspace');
        els.lockedScreen = document.getElementById('assignment-locked-screen');
        els.questionsGrid = document.getElementById('questions-grid');
        els.homeworkForm = document.getElementById('homework-form');
        els.queueStatus = document.getElementById('queue-status');
    }

    function readMatrix() {
        try {
            return JSON.parse(localStorage.getItem('anatomy3_masteryMatrix') || '{}');
        } catch (_err) {
            return {};
        }
    }

    function getLessonState(lessonId) {
        const item = appState.matrix[lessonId];
        return item ? item.state : STATE_LOCKED;
    }

    function findLessonById(lessonId) {
        if (!appState.syllabus) return null;
        for (let i = 0; i < appState.syllabus.modules.length; i++) {
            const mod = appState.syllabus.modules[i];
            const lessons = appState.syllabus.lessonsByModule[mod.id];
            for (let j = 0; j < lessons.length; j++) {
                if (lessons[j].id === lessonId) return lessons[j];
            }
        }
        return null;
    }

    function getAllLessonsFlat() {
        const all = [];
        if (appState.syllabus) {
            appState.syllabus.modules.forEach((mod) => {
                appState.syllabus.lessonsByModule[mod.id].forEach((lesson) => all.push(lesson));
            });
        }
        return all;
    }

    function resolveInitialLessonId() {
        const session = typeof window.getSessionState === 'function' ? window.getSessionState() : null;
        if (session && session.lessonId && findLessonById(session.lessonId)) {
            return session.lessonId;
        }

        if (typeof window.getHighestUnlockedLesson === 'function') {
            try {
                const maybe = window.getHighestUnlockedLesson(appState.matrix, appState.syllabus);
                if (maybe) return maybe;
            } catch (_err) {}
        }

        const first = getAllLessonsFlat()[0];
        return first ? first.id : null;
    }

    function setWorkspaceLocked(isLocked) {
        if (isLocked) {
            els.workspace.classList.add('hidden');
            els.lockedScreen.classList.remove('hidden');
            els.queueStatus.textContent = 'LOCKED';
        } else {
            els.workspace.classList.remove('hidden');
            els.lockedScreen.classList.add('hidden');
            els.queueStatus.textContent = 'ACTIVE';
        }
    }

    function updateHeaderForLesson(lesson, state) {
        els.assignmentLessonId.textContent = `Lesson ${lesson.numStr}`;
        els.assignmentTitle.textContent = lesson.title;
        els.assignmentDesc.textContent = `Concept: ${lesson.concept}`;

        const scoreKey = `anatomy3_homework_score_${lesson.id}`;
        const savedScore = localStorage.getItem(scoreKey);
        if (savedScore !== null) {
            const scoreNum = parseInt(savedScore);
            setGradeDisplay(scoreNum, scoreNum >= PASS_PERCENT ? 'PASSED' : 'FAILED', scoreNum >= PASS_PERCENT ? 'emerald' : 'red');
        } else {
            resetGradeDisplayForState(state);
        }
    }

    function resetGradeDisplayForState(state) {
        if (state === STATE_MASTERED) {
            setGradeDisplay(100, 'MASTERED', 'emerald');
        } else if (state === STATE_RUSTED) {
            setGradeDisplay(100, 'RUSTED', 'amber');
        } else {
            els.masteryGrade.textContent = '--%';
            els.masteryStatus.textContent = 'No Grade';
            els.masteryStatus.className = 'text-[9px] uppercase font-bold text-slate-500 font-mono mt-0.5';
        }
    }

    function setGradeDisplay(score, statusText, color) {
        els.masteryGrade.textContent = `${score}%`;
        els.masteryStatus.textContent = statusText;
        if (color === 'emerald') {
            els.masteryGrade.className = 'text-2xl font-bold font-mono text-emerald-400';
            els.masteryStatus.className = 'text-[9px] uppercase font-bold text-emerald-455 font-mono mt-0.5';
        } else if (color === 'amber') {
            els.masteryGrade.className = 'text-2xl font-bold font-mono text-amber-400';
            els.masteryStatus.className = 'text-[9px] uppercase font-bold text-amber-500 font-mono mt-0.5';
        } else {
            els.masteryGrade.className = 'text-2xl font-bold font-mono text-rose-500';
            els.masteryStatus.className = 'text-[9px] uppercase font-bold text-rose-500 font-mono mt-0.5';
        }
    }

    function generateProblemSet() {
        const generator = ASSIGNMENT_DB[appState.selectedLessonId];
        if (!generator) {
            els.questionsGrid.innerHTML = '<div class="text-center p-4 text-slate-500 text-xs">No questions loaded for this lesson.</div>';
            appState.currentQuestions = [];
            return;
        }

        const list = generator();
        appState.currentQuestions = list;

        els.questionsGrid.innerHTML = list.map((q, qIdx) => `
            <div class="py-5 first:pt-0 last:pb-0 space-y-3">
                <div class="flex items-start space-x-3 text-xs">
                    <span class="font-bold text-rose-455 font-mono">${qIdx + 1}.</span>
                    <p class="text-slate-200 font-medium leading-relaxed">${escapeHtml(q.question)}</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6">
                    ${q.options.map((opt, oIdx) => `
                        <label class="flex items-center space-x-3 p-3 rounded-xl bg-slate-950/60 border border-slate-850 hover:border-rose-900/20 cursor-pointer transition select-none">
                            <input type="radio" name="question_${qIdx}" value="${oIdx}" class="accent-rose-500 w-4 h-4 shrink-0">
                            <span class="text-xs text-slate-350">${escapeHtml(opt)}</span>
                        </label>
                    `).join('')}
                </div>
                <div id="explanation_${qIdx}" class="hidden pl-6 py-2.5 text-[11px] text-slate-455 bg-slate-950 border-l border-rose-600/40 rounded-r-md leading-relaxed font-mono"></div>
            </div>
        `).join('');
    }

    function gradeSubmission() {
        let correctCount = 0;
        appState.currentQuestions.forEach((q, qIdx) => {
            const rads = document.getElementsByName(`question_${qIdx}`);
            let selected = -1;
            for (let i = 0; i < rads.length; i++) {
                if (rads[i].checked) {
                    selected = parseInt(rads[i].value);
                    break;
                }
            }

            const expEl = document.getElementById(`explanation_${qIdx}`);
            if (expEl) {
                expEl.classList.remove('hidden');
                expEl.innerHTML = `<span class="font-bold text-slate-450">Explanation:</span> ${escapeHtml(q.explanation)}`;
            }

            const isCorrect = (selected === q.correctAnswer);
            if (isCorrect) {
                correctCount++;
            }

            for (let i = 0; i < rads.length; i++) {
                const label = rads[i].closest('label');
                if (label) {
                    label.classList.remove('border-rose-900/20', 'border-slate-855');
                    if (i === q.correctAnswer) {
                        label.classList.add('border-emerald-500/35', 'bg-emerald-950/15');
                    } else if (i === selected) {
                        label.classList.add('border-rose-500/35', 'bg-rose-955/15');
                    }
                }
            }
        });

        const score = Math.round((correctCount / appState.currentQuestions.length) * 100);
        localStorage.setItem(`anatomy3_homework_score_${appState.selectedLessonId}`, String(score));
        return score;
    }

    function isCurriculumBypassEnabledLocal() {
        return localStorage.getItem('anatomy3_curriculum_bypass') === 'true';
    }

    function updateForLessonSelection(lessonId) {
        const lesson = findLessonById(lessonId);
        if (!lesson) return;

        appState.selectedLessonId = lessonId;
        appState.selectedLesson = lesson;
        appState.matrix = readMatrix();

        const state = getLessonState(lessonId);
        updateHeaderForLesson(lesson, state);
        resetGradeDisplayForState(state);

        if (typeof window.saveSessionState === 'function') {
            window.saveSessionState(lessonId, 0, []);
        }

        const bypassEnabled = isCurriculumBypassEnabledLocal();
        const isLocked = !bypassEnabled && state < STATE_HW_PENDING;
        setWorkspaceLocked(isLocked);

        if (!isLocked) {
            generateProblemSet();
        }

        document.querySelectorAll('#assignment-list button').forEach(btn => {
            btn.classList.remove('ring-1', 'ring-blue-500', 'bg-slate-800/80');
        });
        const activeItem = document.getElementById(`assignment-item-${lessonId}`);
        if (activeItem) {
            activeItem.classList.add('ring-1', 'ring-blue-500', 'bg-slate-800/80');
        }
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        const score = gradeSubmission();
        const passed = score >= PASS_PERCENT;

        if (passed) {
            setGradeDisplay(score, 'PASSED', 'emerald');
            window.updateLessonState(appState.selectedLessonId, STATE_MASTERED);
            
            if (window.AnatomyGamification) {
                let xpReward = 50;
                let isPerfect = score === 100;
                if (isPerfect) {
                    xpReward += 50;
                }
                window.AnatomyGamification.awardXP(xpReward, 'homework');
                window.AnatomyGamification.incrementStat('quizzesSolved');
                if (isPerfect) {
                    window.AnatomyGamification.incrementStat('perfectQuizzes');
                }
            }

            appState.matrix = readMatrix();
            window.renderSidebar(appState.syllabus, appState.matrix);
            window.updateGlobalProgress(appState.matrix, appState.syllabus);
        } else {
            setGradeDisplay(score, 'FAILED', 'red');
        }
    }

    function initListeners() {
        els.homeworkForm.addEventListener('submit', handleFormSubmit);

        window.selectAssignment = (lessonId) => {
            updateForLessonSelection(lessonId);
        };

        const bypassBtn = document.getElementById('btn-curriculum-bypass');
        if (bypassBtn) {
            const updateBypassBtn = () => {
                const enabled = isCurriculumBypassEnabledLocal();
                bypassBtn.textContent = enabled ? "Explore Mode" : "Locked Mode";
                bypassBtn.className = enabled 
                    ? "px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-rose-500 bg-rose-500/20 text-rose-200 transition-colors"
                    : "px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors";
            };
            bypassBtn.addEventListener('click', () => {
                window.toggleCurriculumBypass();
                updateBypassBtn();
                appState.matrix = readMatrix();
                window.renderSidebar(appState.syllabus, appState.matrix);
                updateForLessonSelection(appState.selectedLessonId);
            });
            updateBypassBtn();
        }
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    window.addEventListener('syllabusLoaded', (e) => {
        appState.syllabus = e.detail.syllabus;
        appState.matrix = e.detail.matrix;

        initListeners();

        const activeId = resolveInitialLessonId();
        if (activeId) {
            updateForLessonSelection(activeId);
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        cacheDom();
    });

})();
