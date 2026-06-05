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
        lesson_2_1: () => [
            {
                question: "Which of the following descending tracts is responsible for primary voluntary motor control of skeletal muscles?",
                options: ["Spinothalamic Tract", "Dorsal Column-Medial Lemnical System", "Corticospinal Tract", "Vestibulospinal Tract"],
                correctAnswer: 2,
                explanation: "The corticospinal (pyramidal) tract is the major descending pathway carrying voluntary motor commands from the precentral gyrus to spinal motor neurons."
            },
            {
                question: "A patient presenting with an inability to coordinate voluntary movements (ataxia) and tremors likely has damage in which brain region?",
                options: ["Cerebrum sensory cortex", "Cerebellum", "Thalamus", "Hypothalamus"],
                correctAnswer: 1,
                explanation: "The cerebellum regulates motor coordination, posture, and motor learning. Damage causes tremors, unsteady gait, and ataxia."
            },
            {
                question: "Trace the sequential flow of Cerebrospinal Fluid (CSF) through the ventricles starting from the lateral ventricles:",
                options: [
                    "Lateral ventricles ➔ Third ventricle ➔ Cerebral aqueduct ➔ Fourth ventricle ➔ Subarachnoid space",
                    "Lateral ventricles ➔ Fourth ventricle ➔ Cerebral aqueduct ➔ Third ventricle ➔ Dural sinuses",
                    "Lateral ventricles ➔ Subarachnoid space ➔ Third ventricle ➔ Fourth ventricle ➔ Choroid plexus",
                    "Lateral ventricles ➔ Dural sinuses ➔ Fourth ventricle ➔ Interventricular foramen ➔ Third ventricle"
                ],
                correctAnswer: 0,
                explanation: "CSF flows from Lateral Ventricles ➔ Interventricular Foramen ➔ Third Ventricle ➔ Cerebral Aqueduct ➔ Fourth Ventricle ➔ Lateral/Median Apertures ➔ Subarachnoid Space."
            },
            {
                question: "Which spinal tract carries sensory information for pain and temperature to the brain?",
                options: ["Corticospinal Tract", "Spinothalamic Tract", "Dorsal Column-Medial Lemnical Tract", "Tectospinal Tract"],
                correctAnswer: 1,
                explanation: "The spinothalamic tract is an ascending pathway that transmits pain, temperature, itch, and crude touch sensations."
            },
            {
                question: "A patient suffers a spinal cord injury resulting in total loss of fine touch and proprioception on the right side of the body, but pain and temperature are preserved. Which ascending pathway is damaged?",
                options: ["Spinothalamic Tract", "Dorsal Column-Medial Lemnical System", "Corticospinal Tract", "Reticulospinal Tract"],
                correctAnswer: 1,
                explanation: "The dorsal column-medial lemniscal system carries fine touch, vibration, and conscious proprioception. It decussates in the medulla, so ipsilateral spinal injury blocks touch, while pain (spinothalamic) decussates immediately and ascends contralateral, preserving pain."
            }
        ],
        lesson_2_2: () => [
            {
                question: "What neurotransmitter is released by all pre-ganglionic fibers of both the sympathetic and parasympathetic divisions of the ANS?",
                options: ["Norepinephrine (NE)", "Epinephrine (Epi)", "Acetylcholine (ACh)", "Dopamine"],
                correctAnswer: 2,
                explanation: "All autonomic pre-ganglionic fibers (both sympathetic and parasympathetic) release acetylcholine (ACh) onto nicotinic receptors."
            },
            {
                question: "Which receptors are found on post-ganglionic effector organs in the parasympathetic division?",
                options: ["Nicotinic Receptors", "Muscarinic Receptors", "Alpha-1 Adrenergic Receptors", "Beta-1 Adrenergic Receptors"],
                correctAnswer: 1,
                explanation: "Parasympathetic post-ganglionic fibers release ACh onto muscarinic cholinergic receptors located on cardiac muscle, smooth muscle, and glands."
            },
            {
                question: "A patient is prescribed a selective beta-1 blocker (adrenergic antagonist) to treat hypertension. What is the physiological mechanism of this drug on the heart?",
                options: [
                    "Blocks parasympathetic signals, increasing heart rate.",
                    "Blocks norepinephrine binding on the sinoatrial node and myocardium, decreasing heart rate and contractility.",
                    "Stimulates alpha receptors to cause vasoconstriction.",
                    "Increases acetylcholine levels in the cardiac pacemaker cells."
                ],
                correctAnswer: 1,
                explanation: "Beta-1 adrenergic receptors are located primarily on the heart. Blocking them prevents sympathetic norepinephrine binding, reducing heart rate and contractile force."
            },
            {
                question: "In autonomic physiology, what are the post-ganglionic neurotransmitters for the sympathetic and parasympathetic divisions respectively (for most target organs)?",
                options: [
                    "Acetylcholine; Norepinephrine",
                    "Norepinephrine; Acetylcholine",
                    "Epinephrine; Norepinephrine",
                    "Acetylcholine; Acetylcholine"
                ],
                correctAnswer: 1,
                explanation: "Sympathetic post-ganglionic fibers release norepinephrine (NE) (except sweat glands), whereas parasympathetic post-ganglionic fibers release acetylcholine (ACh)."
            },
            {
                question: "Autonomic Hyperreflexia is a life-threatening clinical emergency in spinal cord injury patients. What is the primary hemodynamic finding during an episode?",
                options: [
                    "Severe, uncontrolled hypotension and bradycardia.",
                    "Uncontrolled sympathetic hyperactivity below the injury, causing severe hypertension, paired with baroreceptor-mediated parasympathetic bradycardia above the injury.",
                    "Sudden loss of all autonomic signals, leading to flaccid paralysis.",
                    "Excessive parasympathetic motility, causing hyperactive digestion."
                ],
                correctAnswer: 1,
                explanation: "Autonomic hyperreflexia features hyper-sympathetic vasoconstriction below the spinal lesion (hypertension), while the brain attempts to compensate via the vagus nerve above the lesion (bradycardia, flushing)."
            }
        ],
        lesson_2_3: () => [
            {
                question: "Which cutaneous mechanoreceptors are located deep in the dermis/subcutaneous layers and are optimized to detect deep pressure and high-frequency vibration?",
                options: ["Meissner's corpuscles", "Pacinian (lamellated) corpuscles", "Merkel discs", "Ruffini endings"],
                correctAnswer: 1,
                explanation: "Pacinian corpuscles have concentric capsule rings that filter out slow pressure, optimizing them for rapid vibration and deep pressure."
            },
            {
                question: "Which receptor is responsible for detecting light, fluttery touch and is concentrated in hairless skin areas (like fingertips)?",
                options: ["Meissner's corpuscles", "Pacinian corpuscles", "Nociceptors", "Proprioceptors"],
                correctAnswer: 0,
                explanation: "Meissner's corpuscles are encapsulated nerve endings located in dermal papillae of glabrous skin, specialized for light touch and low-frequency vibration."
            },
            {
                question: "What biochemical event occurs during photoreception transduction when light strikes rhodopsin?",
                options: [
                    "11-cis-retinal is converted to all-trans-retinal (bleaching), leading to hyperpolarization of the photoreceptor membrane.",
                    "All-trans-retinal converts to 11-cis-retinal, depolarizing the cell.",
                    "Rhodopsin channels open to allow calcium influx, firing action potentials directly.",
                    "GMP is phosphorylated to cyclic GMP, opening sodium leakage gates."
                ],
                correctAnswer: 0,
                explanation: "Light absorption isomerizes 11-cis-retinal into all-trans-retinal. This activates transducin and phosphodiesterase, breaking down cGMP, closing sodium channels, and hyperpolarizing the photoreceptor."
            },
            {
                question: "How do the auditory hair cells in the organ of Corti transduce mechanical sound waves into neural potentials?",
                options: [
                    "Sound vibrations bend stereocilia, opening mechanically-gated potassium channels and causing K+ influx from the endolymph.",
                    "Bending stereocilia activates second-messengers to close sodium gates.",
                    "Sound waves trigger release of acetylcholine at the tectorial membrane.",
                    "Vibrations generate heat that activates thermal nociceptors."
                ],
                correctAnswer: 0,
                explanation: "Sound waves flex the basilar membrane, bending stereocilia. This pulls open mechanically-gated tip links, allowing potassium to enter from the K+-rich endolymph, depolarizing the cell."
            },
            {
                question: "A patient with carpal tunnel syndrome suffers compression of the median nerve. Which sensory modality is impaired in their index finger, and where does it map to?",
                options: [
                    "Nociception; maps to the precentral gyrus.",
                    "Cutaneous mechanoreception; maps to the postcentral gyrus (primary somatosensory cortex).",
                    "Proprioception; maps to the lateral ventricles.",
                    "Olfaction; maps to the olfactory tract."
                ],
                correctAnswer: 1,
                explanation: "Median nerve compression blocks tactile sensations from cutaneous mechanoreceptors, which travel up the dorsal column to map to the postcentral gyrus."
            }
        ],
        lesson_2_4: () => [
            {
                question: "Which of the following hormone classes is lipid-soluble, passes directly through the plasma membrane, and binds to intracellular receptors to act as a transcription factor?",
                options: ["Peptide Hormones", "Steroid Hormones (e.g., Cortisol, Estrogen)", "Amine Hormones (e.g., Epinephrine)", "Glycoprotein Hormones"],
                correctAnswer: 1,
                explanation: "Steroid hormones are derived from cholesterol (lipophilic) and diffuse through membranes to bind intracellular/nuclear receptors and alter gene expression."
            },
            {
                question: "How do water-soluble hormones (like Epinephrine or Glucagon) transmit signals inside target cells?",
                options: [
                    "They bind to intracellular receptors inside the nucleus.",
                    "They bind to membrane receptors, activating G-proteins and generating second-messengers (like cAMP or IP3/DAG).",
                    "They pass through aquaporin channels to phosphorylate ribosomes.",
                    "They undergo endocytosis to be degraded by lysosomes."
                ],
                correctAnswer: 1,
                explanation: "Peptide/amine hormones cannot cross the cell membrane. They bind to cell-surface G-protein coupled receptors, generating cAMP or calcium second-messenger cascades."
            },
            {
                question: "A patient presents with weight loss, heat intolerance, rapid heart rate, and high levels of free T4. TSH levels are suppressed below detection limits. What is the most likely diagnosis?",
                options: ["Hashimoto's Thyroiditis", "Diabetes Mellitus Type 1", "Graves' Disease (Hyperthyroidism)", "Pituitary Gigantism"],
                correctAnswer: 2,
                explanation: "Graves' disease features auto-antibodies that stimulate the thyroid gland to release excess T3/T4. Elevated thyroid hormone levels feed back negatively on the pituitary, suppressing TSH."
            },
            {
                question: "The hypothalamic-hypophyseal portal system is physiologically crucial because it:",
                options: [
                    "Allows cerebrospinal fluid to drain directly into the thyroid gland.",
                    "Carries releasing and inhibiting hormones from the hypothalamus directly to the anterior pituitary without systemic dilution.",
                    "Transports action potentials from the hypothalamus to the posterior pituitary.",
                    "Pumps arterial blood to the circle of Willis."
                ],
                correctAnswer: 1,
                explanation: "The portal venous system connects capillaries of the hypothalamus to capillaries of the anterior pituitary, ensuring hypothalamic hormones reach targets rapidly."
            },
            {
                question: "A patient with pituitary gigantism is found to have a hormone-secreting tumor. Which hormone is elevated, and what is its primary physiological feedback controller?",
                options: [
                    "ACTH; controlled by aldosterone feedback.",
                    "Growth Hormone (GH); regulated by hypothalamic Growth Hormone-Releasing Hormone (GHRH) and Somatostatin (GHIH).",
                    "Prolactin; regulated by thyroid hormone feedback.",
                    "Vasopressin; regulated by serum sodium concentrations."
                ],
                correctAnswer: 1,
                explanation: "Gigantism is caused by excess GH during childhood. GH secretion is regulated by hypothalamic GHRH (stimulatory) and Somatostatin (GHIH, inhibitory)."
            }
        ],
        lesson_2_5: () => [
            {
                question: "Which glycoprotein hormone secreted by the kidneys stimulates the red bone marrow to increase erythropoiesis (red blood cell production)?",
                options: ["Thrombopoietin", "Erythropoietin (EPO)", "Aldosterone", "Epinephrine"],
                correctAnswer: 1,
                explanation: "In response to hypoxia (low oxygen), the kidneys release erythropoietin (EPO), which travels to the bone marrow to accelerate erythropoiesis."
            },
            {
                question: "A patient with blood type B Negative (B-) requires an emergency blood transfusion. Which blood type can this patient safely receive?",
                options: ["B Positive (B+)", "AB Negative (AB-)", "O Negative (O-)", "O Positive (O+)"],
                correctAnswer: 2,
                explanation: "Type B- blood has anti-A antibodies and lacks the Rh antigen (Rh-). Safe donors are B- and O- (universal donor)."
            },
            {
                question: "During hemostasis, what event initiates the extrinsic pathway of the coagulation cascade?",
                options: [
                    "Exposure of blood to negative charges on collagen fibers inside the vessel walls.",
                    "Release of Tissue Factor (Factor III) from damaged extravascular tissues.",
                    "Activation of Factor XII by circulating platelets.",
                    "Conversion of prothrombin to thrombin."
                ],
                correctAnswer: 1,
                explanation: "The extrinsic pathway is triggered by trauma to tissue exposing blood to Tissue Factor (Factor III), activating Factor VII to form the TF-VIIa complex."
            },
            {
                question: "What are the three stages of hemostasis in chronological order?",
                options: [
                    "Platelet plug formation ➔ Vascular spasm ➔ Coagulation cascade",
                    "Vascular spasm ➔ Platelet plug formation ➔ Coagulation cascade (clotting)",
                    "Coagulation cascade ➔ Vascular spasm ➔ Remodeling",
                    "Clot retraction ➔ Fibrinolysis ➔ Vasoconstriction"
                ],
                correctAnswer: 1,
                explanation: "Hemostasis stages: 1. Vascular spasm (constricts vessel), 2. Platelet plug (primary seal), 3. Coagulation (fibrin mesh seals the injury)."
            },
            {
                question: "A patient is treated with heparin. What is heparin's biochemical effect on the clotting cascade?",
                options: [
                    "It blocks vitamin K synthesis, preventing factor production.",
                    "It binds to and activates antithrombin III, which inactivates thrombin and factor Xa.",
                    "It stimulates platelet aggregation to seal wounds.",
                    "It converts plasminogen to plasmin to dissolve clots."
                ],
                correctAnswer: 1,
                explanation: "Heparin accelerates antithrombin III activity, neutralizing thrombin and Factor Xa, halting clot formation."
            }
        ],
        lesson_2_6: () => [
            {
                question: "According to Poiseuille's Law, if the radius of a blood vessel is decreased to half of its original size, how does blood flow resistance change?",
                options: [
                    "Resistance decreases by half.",
                    "Resistance increases by 2 times.",
                    "Resistance increases by 16 times.",
                    "Resistance remains unaffected."
                ],
                correctAnswer: 2,
                explanation: "Resistance is inversely proportional to the fourth power of radius (R ∝ 1/r^4). Halving the radius increases resistance by 2^4 = 16 times."
            },
            {
                question: "On a Wiggers Diagram, what mechanical event corresponds to the opening of the aortic valve?",
                options: [
                    "Isovolumetric contraction ends, and left ventricular pressure exceeds aortic pressure.",
                    "Mitral valve closes and ventricular pressure drops.",
                    "Isovolumetric relaxation begins as the ventricles empty.",
                    "Atrial systole forces blood into the ventricles."
                ],
                correctAnswer: 0,
                explanation: "The aortic valve opens when ventricular pressure rises above diastolic aortic pressure (end of isovolumetric contraction), allowing ventricular ejection."
            },
            {
                question: "Which of the following electrical events corresponds to the QRS complex on an electrocardiogram (ECG)?",
                options: ["Atrial depolarization", "Ventricular depolarization", "Ventricular repolarization", "SA node firing"],
                correctAnswer: 1,
                explanation: "The QRS complex represents ventricular depolarization (conduction passing from AV bundle to Purkinje fibers, initiating ventricular contraction)."
            },
            {
                question: "Which artery branches directly off the abdominal aorta to supply the spleen, stomach, and liver?",
                options: ["Renal Artery", "Celiac Trunk", "Superior Mesenteric Artery", "Common Iliac Artery"],
                correctAnswer: 1,
                explanation: "The celiac trunk is the first major branch of the abdominal aorta, dividing into splenic, left gastric, and common hepatic arteries."
            },
            {
                question: "A physician diagnoses a patient with mitral valve stenosis. Where on the Wiggers Diagram would this pathology show abnormal pressure dynamics?",
                options: [
                    "During ventricular ejection, showing high aortic pressure.",
                    "During ventricular filling, showing elevated left atrial pressure relative to left ventricular pressure.",
                    "During isovolumetric relaxation, showing delayed aortic valve closure.",
                    "During the QRS peak, showing a loss of ventricular electrical signal."
                ],
                correctAnswer: 1,
                explanation: "Mitral stenosis blocks blood flow from atrium to ventricle. During diastole (filling), the atrium must contract harder against resistance, leading to abnormally high atrial pressures."
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
            return JSON.parse(localStorage.getItem('anatomy2_masteryMatrix') || '{}');
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

        const scoreKey = `anatomy2_homework_score_${lesson.id}`;
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
                        label.classList.add('border-rose-500/35', 'bg-rose-950/15');
                    }
                }
            }
        });

        const score = Math.round((correctCount / appState.currentQuestions.length) * 100);
        localStorage.setItem(`anatomy2_homework_score_${appState.selectedLessonId}`, String(score));
        return score;
    }

    function isCurriculumBypassEnabledLocal() {
        return localStorage.getItem('anatomy2_curriculum_bypass') === 'true';
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
