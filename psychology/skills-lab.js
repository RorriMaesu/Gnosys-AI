/**
 * PSY 201Z - Psychology Skills Lab Engine
 * Contains database resources, interactive sliders, conditioning choice matrices,
 * amnesia case studies, biopsychosocial formulation boards, and gamification links.
 */

window.PsychSkillsLab = (() => {

    // --- Scenario Databases ---
    // --- Scenario Databases ---
    const researchScenarios = [
        {
            id: 'res_1',
            hypothesis: "A researcher hypothesizes that daily mindfulness meditation reduces stress levels in college students during final exams week.",
            ivs: ["Daily mindfulness meditation practice (20 mins)", "Exam stress scores", "Student GPA", "Saliva cortisol testing kits"],
            dvs: ["Physiological stress levels", "Minutes spent meditating", "Exam grades", "Number of meditation sessions"],
            operational: ["Salivary cortisol concentration (ng/mL) measured post-session", "Self-reported feelings of calm", "The concept of mental tranquility", "Number of exams taken"],
            correctIV: "Daily mindfulness meditation practice (20 mins)",
            correctDV: "Physiological stress levels",
            correctOperational: "Salivary cortisol concentration (ng/mL) measured post-session",
            type: "experimental", // uses random assignment
            sampling: "random-selection",
            causal: "allowed"
        },
        {
            id: 'res_2',
            hypothesis: "A developmental psychologist studies whether children who attend pre-K have higher social cooperation scores in elementary school.",
            ivs: ["Pre-school attendance status (Attended vs. Stayed home)", "Elementary school social behavior", "Teacher ratings", "Age of the child"],
            dvs: ["Social cooperation ratings in first grade", "Pre-school tuition costs", "Number of playdates", "Parent satisfaction score"],
            operational: ["Frequency of sharing/helping actions observed during a 30-minute recess", "Being a nice classmate", "Number of years in school", "Having high empathy"],
            correctIV: "Pre-school attendance status (Attended vs. Stayed home)",
            correctDV: "Social cooperation ratings in first grade",
            correctOperational: "Frequency of sharing/helping actions observed during a 30-minute recess",
            type: "correlational", // observational, no random assignment
            sampling: "convenience-selection",
            causal: "error"
        },
        {
            id: 'res_3',
            hypothesis: "A cognitive neuroscientist tests if taking a specific herbal extract improves memory consolidation in senior citizens.",
            ivs: ["Herbal extract supplement dosage (100mg daily vs. placebo)", "Memory consolidation rate", "Seniors' age group", "Word list recalling speed"],
            dvs: ["Performance on a delayed recall word-retention test", "Daily vitamin habits", "Amount of supplement bottle leftover", "Brain scan resolutions"],
            operational: ["Number of items recalled from a 30-word list after a 24-hour delay", "Feeling that memory is clearer", "Mental sharp feeling", "IQ score scale"],
            correctIV: "Herbal extract supplement dosage (100mg daily vs. placebo)",
            correctDV: "Performance on a delayed recall word-retention test",
            correctOperational: "Number of items recalled from a 30-word list after a 24-hour delay",
            type: "experimental",
            sampling: "convenience-selection",
            causal: "allowed"
        }
    ];

    const neuroPathologies = [
        { id: 'path_1', nt: 'Dopamine Excess', disorder: 'Schizophrenia (hallucinations, delusions)', correctOption: 'schizophrenia' },
        { id: 'path_2', nt: 'Dopamine Deficit', disorder: 'Parkinson\'s Disease (tremors, motor rigidity)', correctOption: 'parkinsons' },
        { id: 'path_3', nt: 'Acetylcholine Deficit', disorder: 'Alzheimer\'s Disease (severe memory loss)', correctOption: 'alzheimers' },
        { id: 'path_4', nt: 'Serotonin Deficit', disorder: 'Major Depressive Disorder (low mood, lethargy)', correctOption: 'depression' }
    ];

    const neuroDrugs = [
        { id: 'drug_1', name: 'L-Dopa', correctOption: 'agonist_dopamine', desc: 'Dopamine Agonist' },
        { id: 'drug_2', name: 'Curare', correctOption: 'antagonist_acetylcholine', desc: 'Acetylcholine Antagonist' },
        { id: 'drug_3', name: 'SSRIs (Prozac)', correctOption: 'agonist_serotonin', desc: 'Serotonin Agonist' },
        { id: 'drug_4', name: 'Botox', correctOption: 'antagonist_acetylcholine', desc: 'Acetylcholine Antagonist' }
    ];

    const conditioningScenarios = [
        {
            type: 'operant',
            text: "To avoid the annoying and loud warning buzz of a seatbelt alert, a driver buckles their seatbelt immediately upon sitting in the car.",
            behaviorEffect: 'reinforce', // buckles seatbelt more frequently
            stimulusAction: 'negative',  // removes the loud alert sound
            explanation: " Buckling the seatbelt increases in frequency (Reinforcement) because it removes an unpleasant stimulus (Negative). This is Negative Reinforcement."
        },
        {
            type: 'operant',
            text: "A dog jumps up on the kitchen counter to steal food. The owner immediately sprays the dog with a cold water bottle, which causes the dog to stop jumping on the counter.",
            behaviorEffect: 'punish', // counter jumping decreases
            stimulusAction: 'positive',  // introduces cold water spray
            explanation: " Jumping on the counter decreases in frequency (Punishment) because an unpleasant stimulus (water spray) is introduced (Positive). This is Positive Punishment."
        },
        {
            type: 'classical',
            text: "A child goes to the doctor to receive a painful vaccine injection (which causes crying). The next time the child enters the clinic and sees the doctor's white lab coat, the child bursts into tears immediately.",
            ucs: "Painful vaccine injection",
            ucr: "Crying/fear from injection pain",
            cs: "Doctor's white lab coat",
            cr: "Crying/fear upon seeing the lab coat",
            options: ["Painful vaccine injection", "Doctor's white lab coat", "Doctor's voice", "Crying/fear from injection pain", "Crying/fear upon seeing the lab coat", "Entering the waiting room"]
        },
        {
            type: 'schedule',
            text: "A slot machine pays out a jackpot on average once every 50 pulls, but the exact number of pulls required is completely unpredictable.",
            correctSchedule: 'VR',
            explanation: "Since reinforcement is delivered after an unpredictable number of behavioral responses (pulls), this is a Variable-Ratio (VR) schedule."
        },
        {
            type: 'schedule',
            text: "An office worker receives a paycheck every two weeks on Friday afternoon, regardless of how many emails they send or tasks they perform.",
            correctSchedule: 'FI',
            explanation: "Since reinforcement occurs after a fixed amount of time has elapsed (two weeks), this is a Fixed-Interval (FI) schedule."
        },
        {
            type: 'schedule',
            text: "A coffee shop rewards card gives you a free latte after you purchase exactly 10 beverages.",
            correctSchedule: 'FR',
            explanation: "Since reinforcement is delivered after a fixed, constant number of responses (10 purchases), this is a Fixed-Ratio (FR) schedule."
        }
    ];

    const memoryScenarios = [
        {
            id: 'mem_1',
            text: "A college student memorizes their new locker combination, but now they cannot remember their old bicycle padlock combination that they used for three years.",
            correct: 'retroactive', // new blocks old
            explanation: "Retroactive interference occurs when newly learned information (new locker combination) disrupts the retrieval of older information (padlock combination)."
        },
        {
            id: 'mem_2',
            text: "A patient suffers a traumatic brain injury in an accident. They can recall their childhood memories perfectly, but they are completely unable to form any new memories of events occurring after the accident.",
            correct: 'anterograde', // cannot make new memories
            explanation: "Anterograde amnesia is the inability to transfer new information from short-term memory to long-term memory after the onset of amnesia."
        },
        {
            id: 'mem_3',
            text: "A high school student takes French classes for two years. They switch to Spanish, but during Spanish vocabulary tests, they keep accidentally writing French words instead.",
            correct: 'proactive', // old blocks new
            explanation: "Proactive interference occurs when older information (French vocabulary) blocks the retrieval of newly learned information (Spanish vocabulary)."
        }
    ];

    const clinicalCases = [
        {
            id: 'clin_1',
            history: "Patient is a 24-year-old male reporting continuous sadness, lack of interest in his hobbies, and fatigue for 3 weeks. Clinician notes: Patient's mother has a history of clinical depression (Biological). Patient exhibits a highly pessimistic cognitive attribution style, believing all failures are entirely his fault and permanent (Psychological). He was recently laid off from his job and reports feeling isolated due to a lack of close friends (Sociocultural).",
            factors: {
                bio: ["Mother has a history of clinical depression"],
                psych: ["Highly pessimistic cognitive attribution style", "Believing all failures are his fault"],
                social: ["Recently laid off from job", "Feeling isolated due to lack of close friends"]
            },
            allOptions: [
                "Mother has a history of clinical depression",
                "Highly pessimistic cognitive attribution style",
                "Believing all failures are his fault",
                "Recently laid off from job",
                "Feeling isolated due to lack of close friends",
                "High thyroid hormone levels",
                "Enjoys playing tennis on weekends"
            ],
            diagnosis: 'mdd', // Major Depressive Disorder
            treatment: 'cbt_ssri', // CBT + Pharmacotherapy (SSRI)
            diathesisWeight: 45, // Genetic vulnerability percentage (mother with MDD)
            stressWeight: 40     // Environmental stress percentage (laid off, isolated)
        },
        {
            id: 'clin_2',
            history: "Patient is a 30-year-old female reporting intense, uncontrollable anxiety about everyday events (work, health, chores) lasting over 8 months. Clinician notes: Physiological hyperarousal, racing heart, and muscle tension (Biological). Catastrophic thinking patterns and cognitive avoidance (Psychological). High stress load from a demanding corporate work environment and marital conflict (Sociocultural).",
            factors: {
                bio: ["Physiological hyperarousal", "muscle tension"],
                psych: ["Catastrophic thinking patterns", "cognitive avoidance"],
                social: ["Demanding corporate work environment", "marital conflict"]
            },
            allOptions: [
                "Physiological hyperarousal",
                "muscle tension",
                "Catastrophic thinking patterns",
                "cognitive avoidance",
                "Demanding corporate work environment",
                "marital conflict",
                "History of manic episodes",
                "Social phobia during public speaking"
            ],
            diagnosis: 'gad', // Generalized Anxiety Disorder
            treatment: 'cbt_mindfulness', // CBT + Mindfulness training
            diathesisWeight: 30, // Muscle tension / physiological hyperarousal baseline
            stressWeight: 55     // Corporate stress and marital conflict
        }
    ];

    // --- State Variables ---
    let researchIndex = 0;
    let conditioningIndex = 0;
    let memoryIndex = 0;
    let clinicalIndex = 0;
    let activeConditioningMode = 'classical'; // 'classical' vs 'operant'
    let activeMemoryMode = 'diag'; // 'diag' vs 'chunk'
    let selectedClinicalBio = [];
    let selectedClinicalPsych = [];
    let selectedClinicalSocial = [];

    // --- UI Init Controllers ---
    
    function initResearchDesign() {
        const scenario = researchScenarios[researchIndex];
        const studyText = document.getElementById('research-study-text');
        const selectIV = document.getElementById('select-research-iv');
        const selectDV = document.getElementById('select-research-dv');
        const selectOp = document.getElementById('select-research-operational');
        const selectType = document.getElementById('select-research-type');
        const selectSampling = document.getElementById('select-research-sampling');
        const selectCausal = document.getElementById('select-research-causal');
        const feedback = document.getElementById('research-feedback');

        if (!studyText || !selectIV || !selectDV || !selectOp) return;

        studyText.textContent = scenario.hypothesis;
        feedback.textContent = "";
        feedback.className = "text-xs font-semibold mr-auto";

        // Populate selects
        populateSelect(selectIV, scenario.ivs);
        populateSelect(selectDV, scenario.dvs);
        populateSelect(selectOp, scenario.operational);
        selectType.value = "experimental";
        if (selectSampling) selectSampling.value = "random-selection";
        selectCausal.value = "allowed";
    }

    function checkResearchDesign() {
        const scenario = researchScenarios[researchIndex];
        const selectIV = document.getElementById('select-research-iv');
        const selectDV = document.getElementById('select-research-dv');
        const selectOp = document.getElementById('select-research-operational');
        const selectType = document.getElementById('select-research-type');
        const selectSampling = document.getElementById('select-research-sampling');
        const selectCausal = document.getElementById('select-research-causal');
        const feedback = document.getElementById('research-feedback');

        const ivCorrect = (selectIV.value === scenario.correctIV);
        const dvCorrect = (selectDV.value === scenario.correctDV);
        const opCorrect = (selectOp.value === scenario.correctOperational);
        const typeCorrect = (selectType.value === scenario.type);
        const samplingCorrect = selectSampling ? (selectSampling.value === scenario.sampling) : true;
        const causalCorrect = (selectCausal.value === scenario.causal);

        if (ivCorrect && dvCorrect && opCorrect && typeCorrect && samplingCorrect && causalCorrect) {
            feedback.textContent = "Correct! You successfully mapped variables, sampling validity (selection vs assignment), and causation limits. +20 XP";
            feedback.className = "text-xs font-semibold mr-auto text-emerald-400";
            awardXP(20, 'research');
        } else {
            let errors = [];
            if (!ivCorrect) errors.push("IV is incorrect");
            if (!dvCorrect) errors.push("DV is incorrect");
            if (!opCorrect) errors.push("Operational definition is incorrect");
            if (!samplingCorrect) errors.push("Sampling selection method is incorrect");
            if (!typeCorrect || !causalCorrect) errors.push("Causal claim logic is incorrect");
            feedback.textContent = "Incorrect. Errors: " + errors.join(', ') + ". Review variables/sampling and try again.";
            feedback.className = "text-xs font-semibold mr-auto text-rose-400";
        }
    }

    function initNeuroanatomy() {
        // Render pathology matching items
        const container = document.getElementById('neuro-matching-grid');
        const feedback = document.getElementById('neuro-feedback');
        if (!container) return;

        feedback.textContent = "";
        container.innerHTML = "";

        neuroPathologies.forEach((p, idx) => {
            const row = document.createElement('div');
            row.className = "flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-850 text-xs gap-3";
            row.innerHTML = `
                <span class="font-bold text-slate-350 shrink-0">${p.nt}</span>
                <select data-pathology-id="${p.id}" class="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-650 max-w-[200px]">
                    <option value="">-- Match Disorder --</option>
                    <option value="schizophrenia">Schizophrenia (Excess)</option>
                    <option value="parkinsons">Parkinson's (Deficit)</option>
                    <option value="alzheimers">Alzheimer's (Deficit)</option>
                    <option value="depression">Depression (Deficit)</option>
                </select>
            `;
            container.appendChild(row);
        });

        // Render agonist/antagonist drug matching items
        const drugContainer = document.getElementById('neuro-drug-grid');
        if (drugContainer) {
            drugContainer.innerHTML = "";
            neuroDrugs.forEach((d) => {
                const row = document.createElement('div');
                row.className = "flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-850 text-xs gap-3";
                row.innerHTML = `
                    <span class="font-bold text-slate-350 shrink-0">${d.name}</span>
                    <select data-drug-id="${d.id}" class="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-650 max-w-[200px]">
                        <option value="">-- Match Mechanism --</option>
                        <option value="agonist_dopamine">Dopamine Agonist</option>
                        <option value="antagonist_dopamine">Dopamine Antagonist</option>
                        <option value="agonist_serotonin">Serotonin Agonist</option>
                        <option value="antagonist_serotonin">Serotonin Antagonist</option>
                        <option value="agonist_acetylcholine">Acetylcholine Agonist</option>
                        <option value="antagonist_acetylcholine">Acetylcholine Antagonist</option>
                    </select>
                `;
                drugContainer.appendChild(row);
            });
        }

        // Axon slider initial state
        const slider = document.getElementById('slider-membrane');
        const lblMv = document.getElementById('lbl-membrane-mv');
        const glow = document.getElementById('axon-status-glow');
        const lblStatus = document.getElementById('lbl-axon-status');
        const lblExplain = document.getElementById('lbl-axon-explain');
        const spikeFreq = document.getElementById('lbl-axon-firing-rate');

        if (slider) {
            slider.value = -70;
            lblMv.textContent = "-70 mV";
            glow.className = "w-4 h-4 rounded-full bg-slate-800 shadow-md mx-auto transition-all duration-300";
            lblStatus.textContent = "Axon Inactive (Resting)";
            lblExplain.textContent = "Stimulate the cell by sliding to depolarize toward threshold (-55 mV).";
            spikeFreq.textContent = "Spike Frequency: 0 Hz";
        }
    }

    function checkNeuroPathology() {
        const selects = document.querySelectorAll('#neuro-matching-grid select');
        const drugSelects = document.querySelectorAll('#neuro-drug-grid select');
        const feedback = document.getElementById('neuro-feedback');
        let allCorrect = true;

        selects.forEach(sel => {
            const pathId = sel.getAttribute('data-pathology-id');
            const path = neuroPathologies.find(p => p.id === pathId);
            if (!path || sel.value !== path.correctOption) {
                allCorrect = false;
            }
        });

        let drugsCorrect = true;
        drugSelects.forEach(sel => {
            const drugId = sel.getAttribute('data-drug-id');
            const drug = neuroDrugs.find(d => d.id === drugId);
            if (!drug || sel.value !== drug.correctOption) {
                drugsCorrect = false;
            }
        });

        if (allCorrect && drugsCorrect) {
            feedback.textContent = "All Pathologies & Drug Mechanism Classifications Correct! +15 XP";
            feedback.className = "text-xs font-semibold text-emerald-400";
            awardXP(15, 'neuro');
        } else {
            let errorDetails = [];
            if (!allCorrect) errorDetails.push("imbalance matching error");
            if (!drugsCorrect) errorDetails.push("drug mechanisms classification error");
            feedback.textContent = "Incorrect matches: " + errorDetails.join(', ') + ". Review agonist/antagonist mechanics and path links.";
            feedback.className = "text-xs font-semibold text-rose-400";
        }
    }

    function initConditioning() {
        const scenario = conditioningScenarios[conditioningIndex];
        const scenarioText = document.getElementById('cond-scenario-text');
        const feedback = document.getElementById('cond-feedback');

        if (!scenarioText) return;

        scenarioText.textContent = scenario.text;
        feedback.textContent = "";
        feedback.className = "text-xs font-semibold mr-auto";

        // classical panel setup
        const selectUCS = document.getElementById('select-cond-ucs');
        const selectUCR = document.getElementById('select-cond-ucr');
        const selectCS = document.getElementById('select-cond-cs');
        const selectCR = document.getElementById('select-cond-cr');

        if (scenario.type === 'classical') {
            toggleConditioningView('classical');
            populateSelect(selectUCS, scenario.options);
            populateSelect(selectUCR, scenario.options);
            populateSelect(selectCS, scenario.options);
            populateSelect(selectCR, scenario.options);
        } else if (scenario.type === 'operant') {
            toggleConditioningView('operant');
            // reset radio buttons
            document.querySelectorAll('input[name="operant-behavior"]').forEach(r => r.checked = false);
            document.querySelectorAll('input[name="operant-stimulus"]').forEach(r => r.checked = false);
        } else if (scenario.type === 'schedule') {
            toggleConditioningView('schedules');
            document.querySelectorAll('input[name="schedule-type"]').forEach(r => r.checked = false);
        }
    }

    function checkConditioning() {
        const scenario = conditioningScenarios[conditioningIndex];
        const feedback = document.getElementById('cond-feedback');

        if (scenario.type === 'classical') {
            const ucsVal = document.getElementById('select-cond-ucs').value;
            const ucrVal = document.getElementById('select-cond-ucr').value;
            const csVal = document.getElementById('select-cond-cs').value;
            const crVal = document.getElementById('select-cond-cr').value;

            if (ucsVal === scenario.ucs && ucrVal === scenario.ucr && csVal === scenario.cs && crVal === scenario.cr) {
                feedback.textContent = "Correct Classical Conditioning Mapping! +15 XP";
                feedback.className = "text-xs font-semibold mr-auto text-emerald-400";
                awardXP(15, 'conditioning');
            } else {
                feedback.textContent = "Incorrect. Try mapping: UCS triggers reflex, CS is the learned trigger, and CR is the learned behavior.";
                feedback.className = "text-xs font-semibold mr-auto text-rose-400";
            }
        } else if (scenario.type === 'operant') {
            const behaviorRadio = document.querySelector('input[name="operant-behavior"]:checked');
            const stimulusRadio = document.querySelector('input[name="operant-stimulus"]:checked');

            if (!behaviorRadio || !stimulusRadio) {
                feedback.textContent = "Please select choices for both steps.";
                feedback.className = "text-xs font-semibold mr-auto text-amber-400";
                return;
            }

            const behaviorCorrect = (behaviorRadio.value === scenario.behaviorEffect);
            const stimulusCorrect = (stimulusRadio.value === scenario.stimulusAction);

            if (behaviorCorrect && stimulusCorrect) {
                feedback.textContent = "Correct!" + scenario.explanation + " +20 XP";
                feedback.className = "text-xs font-semibold mr-auto text-emerald-400";
                awardXP(20, 'conditioning');
            } else {
                feedback.textContent = "Incorrect. Tip: Determine if behavior increases (Reinforcement) and if a stimulus was removed (Negative).";
                feedback.className = "text-xs font-semibold mr-auto text-rose-400";
            }
        } else if (scenario.type === 'schedule') {
            const scheduleRadio = document.querySelector('input[name="schedule-type"]:checked');
            if (!scheduleRadio) {
                feedback.textContent = "Please select a reinforcement schedule.";
                feedback.className = "text-xs font-semibold mr-auto text-amber-400";
                return;
            }

            if (scheduleRadio.value === scenario.correctSchedule) {
                feedback.textContent = "Correct! " + scenario.explanation + " +20 XP";
                feedback.className = "text-xs font-semibold mr-auto text-emerald-400";
                awardXP(20, 'conditioning');
            } else {
                feedback.textContent = "Incorrect schedule. Tip: Check if trigger is based on number of actions (Ratio) or time elapsed (Interval), and if it is predictable (Fixed) or unpredictable (Variable).";
                feedback.className = "text-xs font-semibold mr-auto text-rose-400";
            }
        }
    }

    function initMemory() {
        const scenario = memoryScenarios[memoryIndex];
        const scenarioText = document.getElementById('mem-scenario-text');
        const feedback = document.getElementById('mem-feedback');

        if (!scenarioText) return;

        scenarioText.textContent = scenario.text;
        feedback.textContent = "";
        feedback.className = "text-xs font-semibold mr-auto";
        document.getElementById('select-mem-diag').value = "proactive";
    }

    function checkMemory() {
        if (activeMemoryMode === 'diag') {
            const scenario = memoryScenarios[memoryIndex];
            const val = document.getElementById('select-mem-diag').value;
            const feedback = document.getElementById('mem-feedback');

            if (val === scenario.correct) {
                feedback.textContent = "Correct Diagnosis! " + scenario.explanation + " +15 XP";
                feedback.className = "text-xs font-semibold mr-auto text-emerald-400";
                awardXP(15, 'memory');
            } else {
                feedback.textContent = "Incorrect retrieval pathology diagnosis. Read the direction of interference or amnesia carefully.";
                feedback.className = "text-xs font-semibold mr-auto text-rose-400";
            }
        }
    }

    function initClinical() {
        const scenario = clinicalCases[clinicalIndex];
        const studyText = document.getElementById('clinical-study-text');
        const feedback = document.getElementById('clinical-feedback');
        const selectDiag = document.getElementById('select-clinical-diagnosis');
        const selectTreat = document.getElementById('select-clinical-treatment');

        if (!studyText || !selectDiag || !selectTreat) return;

        studyText.textContent = scenario.history;
        feedback.textContent = "";
        feedback.className = "text-xs font-semibold mr-auto";

        // Reset columns state
        selectedClinicalBio = [];
        selectedClinicalPsych = [];
        selectedClinicalSocial = [];
        renderClinicalFactorLists();

        // Populate lists for Diagnostic options
        populateSelect(selectDiag, [
            { text: "Major Depressive Disorder (DSM-5 MDD)", value: "mdd" },
            { text: "Generalized Anxiety Disorder (DSM-5 GAD)", value: "gad" }
        ]);
        populateSelect(selectTreat, [
            { text: "Cognitive Behavioral Therapy (CBT) + SSRIs", value: "cbt_ssri" },
            { text: "Cognitive Behavioral Therapy + Mindfulness", value: "cbt_mindfulness" }
        ]);
    }

    function checkClinical() {
        const scenario = clinicalCases[clinicalIndex];
        const feedback = document.getElementById('clinical-feedback');
        const diagVal = document.getElementById('select-clinical-diagnosis').value;
        const treatVal = document.getElementById('select-clinical-treatment').value;

        // Verify factors mapping
        const bioCorrect = compareArrays(selectedClinicalBio, scenario.factors.bio);
        const psychCorrect = compareArrays(selectedClinicalPsych, scenario.factors.psych);
        const socialCorrect = compareArrays(selectedClinicalSocial, scenario.factors.social);

        const diagCorrect = (diagVal === scenario.diagnosis);
        const treatCorrect = (treatVal === scenario.treatment);

        if (bioCorrect && psychCorrect && socialCorrect && diagCorrect && treatCorrect) {
            feedback.textContent = "Complete Biopsychosocial Formulation Cleared! Correct treatment and diagnosis match. +25 XP";
            feedback.className = "text-xs font-semibold mr-auto text-emerald-400";
            awardXP(25, 'clinical');
        } else {
            let errorMsg = [];
            if (!bioCorrect || !psychCorrect || !socialCorrect) errorMsg.push("Factor columns mapping error");
            if (!diagCorrect) errorMsg.push("Incorrect DSM Diagnosis");
            if (!treatCorrect) errorMsg.push("Incorrect treatment plan match");
            feedback.textContent = "Failed. Errors: " + errorMsg.join(', ') + ". Review case files and check categories.";
            feedback.className = "text-xs font-semibold mr-auto text-rose-400";
        }
    }

    // --- Helpers ---
    function populateSelect(selectEl, optionList) {
        selectEl.innerHTML = "";
        optionList.forEach(opt => {
            const optEl = document.createElement('option');
            if (typeof opt === 'string') {
                optEl.value = opt;
                optEl.textContent = opt;
            } else {
                optEl.value = opt.value;
                optEl.textContent = opt.text;
            }
            selectEl.appendChild(optEl);
        });
    }

    function toggleConditioningView(mode) {
        activeConditioningMode = mode;
        const classicalBtn = document.getElementById('btn-cond-classical-mode');
        const operantBtn = document.getElementById('btn-cond-operant-mode');
        const schedulesBtn = document.getElementById('btn-cond-schedules-mode');
        const classicalPanel = document.getElementById('panel-cond-classical');
        const operantPanel = document.getElementById('panel-cond-operant');
        const schedulesPanel = document.getElementById('panel-cond-schedules');

        // Reset buttons classes
        [classicalBtn, operantBtn, schedulesBtn].forEach(btn => {
            if (btn) btn.className = "px-3 py-1 text-xs font-bold rounded text-slate-400 hover:text-slate-200 transition";
        });
        // Hide panels
        [classicalPanel, operantPanel, schedulesPanel].forEach(panel => {
            if (panel) panel.classList.add('hidden');
        });

        if (mode === 'classical') {
            if (classicalBtn) classicalBtn.className = "px-3 py-1 text-xs font-bold rounded bg-purple-600 text-white transition";
            if (classicalPanel) classicalPanel.classList.remove('hidden');
        } else if (mode === 'operant') {
            if (operantBtn) operantBtn.className = "px-3 py-1 text-xs font-bold rounded bg-purple-600 text-white transition";
            if (operantPanel) operantPanel.classList.remove('hidden');
        } else if (mode === 'schedules') {
            if (schedulesBtn) schedulesBtn.className = "px-3 py-1 text-xs font-bold rounded bg-purple-600 text-white transition";
            if (schedulesPanel) schedulesPanel.classList.remove('hidden');
        }
    }

    function toggleMemoryView(mode) {
        activeMemoryMode = mode;
        const diagBtn = document.getElementById('btn-mem-diag-mode');
        const chunkBtn = document.getElementById('btn-mem-chunk-mode');
        const diagPanel = document.getElementById('panel-mem-diag');
        const chunkPanel = document.getElementById('panel-mem-chunk');
        const actionBar = document.getElementById('container-mem-action-bar');

        if (mode === 'diag') {
            diagBtn.className = "px-3 py-1 text-xs font-bold rounded bg-purple-600 text-white transition";
            chunkBtn.className = "px-3 py-1 text-xs font-bold rounded text-slate-400 hover:text-slate-200 transition";
            diagPanel.classList.remove('hidden');
            chunkPanel.classList.add('hidden');
            actionBar.classList.remove('hidden');
        } else {
            chunkBtn.className = "px-3 py-1 text-xs font-bold rounded bg-purple-600 text-white transition";
            diagBtn.className = "px-3 py-1 text-xs font-bold rounded text-slate-400 hover:text-slate-200 transition";
            diagPanel.classList.add('hidden');
            chunkPanel.classList.remove('hidden');
            actionBar.classList.add('hidden');
            initChunkingSandbox();
        }
    }

    // -- Chunking active test game logic --
    let activeFlashedString = "";
    function initChunkingSandbox() {
        const display = document.getElementById('lbl-chunk-display');
        const verifyBtn = document.getElementById('btn-chunk-verify');
        const verifyInput = document.getElementById('input-chunk-verify');
        const feedback = document.getElementById('mem-feedback');

        display.textContent = "READY TO FLASH";
        verifyBtn.disabled = true;
        verifyInput.disabled = true;
        verifyInput.value = "";
        feedback.textContent = "";
    }

    function runChunkingFlash(chunked) {
        const display = document.getElementById('lbl-chunk-display');
        const verifyBtn = document.getElementById('btn-chunk-verify');
        const verifyInput = document.getElementById('input-chunk-verify');
        const feedback = document.getElementById('mem-feedback');

        const letterPool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let wordList = ["CAT", "DOG", "MAP", "RUN", "SIT", "ZIP"];
        
        let targetText = "";
        if (chunked) {
            // Pick 4 words (12 letters)
            let chosenWords = [];
            for (let i = 0; i < 4; i++) {
                chosenWords.push(wordList[Math.floor(Math.random() * wordList.length)]);
            }
            targetText = chosenWords.join(" ");
        } else {
            // Pick 12 random letters
            let letters = [];
            for (let i = 0; i < 12; i++) {
                letters.push(letterPool[Math.floor(Math.random() * letterPool.length)]);
            }
            targetText = letters.join(" ");
        }

        activeFlashedString = targetText.replace(/\s/g, "").toUpperCase();
        display.textContent = targetText;
        verifyInput.disabled = true;
        verifyBtn.disabled = true;
        feedback.textContent = "Memorize now...";

        setTimeout(() => {
            display.textContent = "•••• •••• ••••";
            verifyInput.disabled = false;
            verifyInput.focus();
            verifyBtn.disabled = false;
            feedback.textContent = "Type the sequence!";
        }, 3000);
    }

    function verifyChunkedRecall() {
        const inputVal = document.getElementById('input-chunk-verify').value.replace(/\s/g, "").toUpperCase();
        const feedback = document.getElementById('mem-feedback');

        if (inputVal === activeFlashedString) {
            feedback.textContent = "Recall Perfect! Chunking creates semantic pathways to retain items. +15 XP";
            feedback.className = "text-xs font-semibold mr-auto text-emerald-400";
            awardXP(15, 'memory');
        } else {
            feedback.textContent = `Incorrect recall. You typed: ${inputVal || '[empty]'}. Expected: ${activeFlashedString}. Practice with chunked words to see improvement.`;
            feedback.className = "text-xs font-semibold mr-auto text-rose-400";
        }
    }

    // -- Biopsychosocial dragging list builder helper --
    function renderClinicalFactorLists() {
        const scenario = clinicalCases[clinicalIndex];
        const bioCol = document.getElementById('container-clinical-bio');
        const psychCol = document.getElementById('container-clinical-psych');
        const socialCol = document.getElementById('container-clinical-social');

        if (!bioCol || !psychCol || !socialCol) return;

        bioCol.innerHTML = "";
        psychCol.innerHTML = "";
        socialCol.innerHTML = "";

        // Add factors currently in lists
        selectedClinicalBio.forEach((f, idx) => bioCol.appendChild(createFactorChip(f, 'bio', idx)));
        selectedClinicalPsych.forEach((f, idx) => psychCol.appendChild(createFactorChip(f, 'psych', idx)));
        selectedClinicalSocial.forEach((f, idx) => socialCol.appendChild(createFactorChip(f, 'social', idx)));

        // Show remaining options to match in study card
        const intakeWrapper = document.getElementById('clinical-study-text');
        const selectBox = document.createElement('div');
        selectBox.className = "mt-4 pt-3 border-t border-slate-900 space-y-2";
        selectBox.innerHTML = `<span class="block text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Unassigned Factors (Click to assign)</span>`;
        
        scenario.allOptions.forEach(opt => {
            const bioAssigned = selectedClinicalBio.includes(opt);
            const psychAssigned = selectedClinicalPsych.includes(opt);
            const socialAssigned = selectedClinicalSocial.includes(opt);

            if (!bioAssigned && !psychAssigned && !socialAssigned) {
                const btn = document.createElement('button');
                btn.className = "w-full text-left p-2 rounded bg-slate-900 border border-slate-850 hover:bg-slate-800 text-[10px] text-slate-300 block truncate transition";
                btn.textContent = opt;
                btn.addEventListener('click', () => {
                    promptAssignFactor(opt);
                });
                selectBox.appendChild(btn);
            }
        });
        
        const oldBox = intakeWrapper.querySelector('.clinical-selector-box');
        if (oldBox) oldBox.remove();
        selectBox.classList.add('clinical-selector-box');
        intakeWrapper.appendChild(selectBox);

        // Update meter
        updateDiathesisStressMeter();
    }

    function updateDiathesisStressMeter() {
        const scenario = clinicalCases[clinicalIndex];
        const diathesisBar = document.getElementById('diathesis-bar');
        const stressBar = document.getElementById('stress-bar');
        const statusLbl = document.getElementById('lbl-diathesis-stress-status');

        if (!diathesisBar || !stressBar || !statusLbl) return;

        // Calculate correct mapped items count
        let correctBioCount = selectedClinicalBio.filter(f => scenario.factors.bio.includes(f)).length;
        let correctPsychCount = selectedClinicalPsych.filter(f => scenario.factors.psych.includes(f)).length;
        let correctSocialCount = selectedClinicalSocial.filter(f => scenario.factors.social.includes(f)).length;

        let totalCorrect = correctBioCount + correctPsychCount + correctSocialCount;
        let totalTarget = scenario.factors.bio.length + scenario.factors.psych.length + scenario.factors.social.length;

        // Diathesis contribution is based on bio/genetic factors correctly mapped
        let diathesisPct = totalTarget > 0 ? Math.round((correctBioCount / totalTarget) * scenario.diathesisWeight) : 0;
        // Stress contribution is based on psych + social correctly mapped
        let stressPct = totalTarget > 0 ? Math.round(((correctPsychCount + correctSocialCount) / totalTarget) * scenario.stressWeight) : 0;

        diathesisBar.style.width = `${diathesisPct}%`;
        stressBar.style.width = `${stressPct}%`;

        let cumulative = diathesisPct + stressPct;
        if (cumulative >= 70) {
            statusLbl.textContent = `THRESHOLD BREACHED (${cumulative}%) -> Disorder Onset`;
            statusLbl.className = "font-mono text-[9px] text-red-400 font-bold uppercase tracking-wider bg-red-950/40 border border-red-900/30 px-1.5 py-0.5 rounded animate-pulse";
        } else if (cumulative > 30) {
            statusLbl.textContent = `Vulnerable (${cumulative}%)`;
            statusLbl.className = "font-mono text-[9px] text-amber-400 font-bold uppercase tracking-wider bg-amber-950/40 border border-amber-900/30 px-1.5 py-0.5 rounded";
        } else {
            statusLbl.textContent = `Safe Range (${cumulative}%)`;
            statusLbl.className = "font-mono text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded";
        }
    }

    function promptAssignFactor(factorText) {
        // Simple assignment cycle on click
        const choice = prompt(`Assign factor:\n"${factorText}"\n\nEnter 1 for Biological, 2 for Psychological, 3 for Social:`);
        if (choice === '1') {
            selectedClinicalBio.push(factorText);
        } else if (choice === '2') {
            selectedClinicalPsych.push(factorText);
        } else if (choice === '3') {
            selectedClinicalSocial.push(factorText);
        }
        renderClinicalFactorLists();
    }

    function createFactorChip(text, colType, index) {
        const chip = document.createElement('div');
        chip.className = "p-1.5 rounded bg-slate-950 border border-slate-850 flex items-center justify-between text-[10px] text-slate-350";
        chip.innerHTML = `
            <span class="truncate pr-1">${text}</span>
            <button class="text-rose-500 hover:text-rose-350 transition shrink-0"><i class="fa-solid fa-xmark"></i></button>
        `;
        chip.querySelector('button').addEventListener('click', () => {
            if (colType === 'bio') selectedClinicalBio.splice(index, 1);
            if (colType === 'psych') selectedClinicalPsych.splice(index, 1);
            if (colType === 'social') selectedClinicalSocial.splice(index, 1);
            renderClinicalFactorLists();
        });
        return chip;
    }

    function compareArrays(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();
        return sorted1.every((val, index) => val === sorted2[index]);
    }

    function awardXP(amount, taskType) {
        if (window.PsychGamification && typeof window.PsychGamification.awardXP === 'function') {
            window.PsychGamification.awardXP(amount, taskType);
        } else {
            console.log(`[Psychology Skills Lab] Awarded ${amount} XP for ${taskType}.`);
        }
    }

    // --- Axon membrane slider response logic ---
    function handleAxonDepolarization(mv) {
        const glow = document.getElementById('axon-status-glow');
        const lblStatus = document.getElementById('lbl-axon-status');
        const lblExplain = document.getElementById('lbl-axon-explain');
        const spikesContainer = document.getElementById('container-axon-spikes');
        const spikeFreq = document.getElementById('lbl-axon-firing-rate');

        if (!glow || !lblStatus || !lblExplain) return;

        if (mv < -55) {
            glow.className = "w-4 h-4 rounded-full bg-slate-800 shadow-md mx-auto transition-all duration-300";
            lblStatus.textContent = "Axon Inactive (Depolarizing)";
            lblExplain.textContent = `Potential: ${mv} mV. Stimulus below critical threshold (-55 mV). Pump maintaining sodium gradients.`;
            spikeFreq.textContent = "Spike Frequency: 0 Hz";
            spikesContainer.querySelectorAll('div').forEach(d => d.className = "w-1.5 bg-slate-800 h-6 rounded-full");
        } else if (mv >= -55 && mv < 30) {
            glow.className = "w-4 h-4 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50 mx-auto transition-all duration-300";
            lblStatus.textContent = "Impulse Triggered!";
            lblExplain.textContent = `Voltage exceeded threshold (-55 mV)! Na+ channels open. Ion cascade propagates action potential.`;
            spikeFreq.textContent = "Spike Frequency: 20 Hz";
            spikesContainer.querySelectorAll('div').forEach((d, idx) => {
                d.className = idx === 0 ? "w-1.5 bg-yellow-500 animate-pulse h-6 rounded-full" : "w-1.5 bg-slate-800 h-6 rounded-full";
            });
        } else {
            glow.className = "w-4 h-4 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50 mx-auto transition-all duration-300 animate-ping";
            lblStatus.textContent = "Peak Action Potential Fired!";
            lblExplain.textContent = `Axon Reached Peak (+40 mV). Refractory pump triggers to restore resting potential. Frequency modulation encodes signal!`;
            spikeFreq.textContent = "Spike Frequency: 80 Hz";
            spikesContainer.querySelectorAll('div').forEach(d => d.className = "w-1.5 bg-purple-500 animate-pulse h-6 rounded-full");
        }
    }

    // --- Tab Event Hook ---
    function attachSkillsLabListeners() {
        // Research Design Buttons
        document.getElementById('btn-research-next')?.addEventListener('click', () => {
            researchIndex = (researchIndex + 1) % researchScenarios.length;
            initResearchDesign();
        });
        document.getElementById('btn-research-check')?.addEventListener('click', checkResearchDesign);
        document.getElementById('btn-research-tutor')?.addEventListener('click', () => {
            const scenario = researchScenarios[researchIndex];
            if (window.PsychTutor && typeof window.PsychTutor.invoke === 'function') {
                window.PsychTutor.invoke(
                    `I am studying Research Design. The hypothesis is: "${scenario.hypothesis}". Independent variable options: ${scenario.ivs.join(', ')}. Dependent variable options: ${scenario.dvs.join(', ')}. Guide me socratically on identifying the correct IV and DV.`,
                    document.getElementById('btn-research-check').parentElement,
                    `Student is learning Research Methodology. Correct IV is "${scenario.correctIV}". Correct DV is "${scenario.correctDV}".`
                );
            }
        });

        // Axon Sandbox
        const slider = document.getElementById('slider-membrane');
        const lblMv = document.getElementById('lbl-membrane-mv');
        if (slider && lblMv) {
            slider.addEventListener('input', (e) => {
                const val = Number(e.target.value);
                lblMv.textContent = `${val} mV`;
                handleAxonDepolarization(val);
            });
        }
        document.getElementById('btn-neuro-reset')?.addEventListener('click', initNeuroanatomy);
        document.getElementById('btn-neuro-check')?.addEventListener('click', checkNeuroPathology);
        document.getElementById('btn-neuro-tutor')?.addEventListener('click', () => {
            if (window.PsychTutor && typeof window.PsychTutor.invoke === 'function') {
                window.PsychTutor.invoke(
                    `I am studying biological neuroanatomy and neurotransmitter deficits. I need to match Dopamine excess/deficits, Acetylcholine deficits, and Serotonin deficits to their clinical pathologies. Explain these neurotransmitters socratically.`,
                    document.getElementById('btn-neuro-check').parentElement,
                    `Student is learning neuroscience. Mappings are: Dopamine Deficit -> Parkinsons, Dopamine Excess -> Schizophrenia, Acetylcholine Deficit -> Alzheimers, Serotonin Deficit -> Depression.`
                );
            }
        });

        // Conditioning Buttons
        document.getElementById('btn-cond-classical-mode')?.addEventListener('click', () => {
            toggleConditioningView('classical');
        });
        document.getElementById('btn-cond-operant-mode')?.addEventListener('click', () => {
            toggleConditioningView('operant');
        });
        document.getElementById('btn-cond-schedules-mode')?.addEventListener('click', () => {
            toggleConditioningView('schedules');
        });
        document.getElementById('btn-cond-next')?.addEventListener('click', () => {
            conditioningIndex = (conditioningIndex + 1) % conditioningScenarios.length;
            initConditioning();
        });
        document.getElementById('btn-cond-check')?.addEventListener('click', checkConditioning);
        document.getElementById('btn-cond-tutor')?.addEventListener('click', () => {
            const scenario = conditioningScenarios[conditioningIndex];
            if (window.PsychTutor && typeof window.PsychTutor.invoke === 'function') {
                window.PsychTutor.invoke(
                    `I am classifying conditioning scenarios. Current scenario: "${scenario.text}". Guide me through explaining whether it uses reinforcement vs punishment and positive vs negative.`,
                    document.getElementById('btn-cond-check').parentElement,
                    `Scenario type is "${scenario.type}". Context details: ${JSON.stringify(scenario)}.`
                );
            }
        });

        // Memory Buttons
        document.getElementById('btn-mem-diag-mode')?.addEventListener('click', () => {
            toggleMemoryView('diag');
        });
        document.getElementById('btn-mem-chunk-mode')?.addEventListener('click', () => {
            toggleMemoryView('chunk');
        });
        document.getElementById('btn-mem-check')?.addEventListener('click', checkMemory);
        document.getElementById('btn-chunk-flash-raw')?.addEventListener('click', () => runChunkingFlash(false));
        document.getElementById('btn-chunk-flash-grouped')?.addEventListener('click', () => runChunkingFlash(true));
        document.getElementById('btn-chunk-verify')?.addEventListener('click', verifyChunkedRecall);
        document.getElementById('btn-memory-tutor')?.addEventListener('click', () => {
            const scenario = memoryScenarios[memoryIndex];
            if (window.PsychTutor && typeof window.PsychTutor.invoke === 'function') {
                window.PsychTutor.invoke(
                    `I am studying forgetting and interference. Current case study: "${scenario.text}". Explain the difference between proactive and retroactive interference socratically.`,
                    document.getElementById('btn-mem-check').parentElement,
                    `Target pathology is "${scenario.correct}". Explanation: ${scenario.explanation}.`
                );
            }
        });

        // Clinical Buttons
        document.getElementById('btn-clinical-next')?.addEventListener('click', () => {
            clinicalIndex = (clinicalIndex + 1) % clinicalCases.length;
            initClinical();
        });
        document.getElementById('btn-clinical-check')?.addEventListener('click', checkClinical);
        document.getElementById('btn-clinical-tutor')?.addEventListener('click', () => {
            const scenario = clinicalCases[clinicalIndex];
            if (window.PsychTutor && typeof window.PsychTutor.invoke === 'function') {
                window.PsychTutor.invoke(
                    `I am formulating a clinical diagnosis based on clinician intake notes. The client case history details biological, psychological, and social factors. Help me identify the biopsychosocial etiology for this case.`,
                    document.getElementById('btn-clinical-check').parentElement,
                    `Clinical Case: ${scenario.history}. Correct Diagnosis: ${scenario.diagnosis}. Biological Factors: ${scenario.factors.bio.join(', ')}.`
                );
            }
        });
    }

    // Global Load hook
    return {
        init: () => {
            initResearchDesign();
            initNeuroanatomy();
            initConditioning();
            initMemory();
            initClinical();
            attachSkillsLabListeners();
            console.log('[Psychology Skills Lab] All engines active.');
        }
    };
})();

// Auto-init on script load or DOM ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.PsychSkillsLab) {
        window.PsychSkillsLab.init();
    }
});
