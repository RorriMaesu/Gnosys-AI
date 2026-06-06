/**
 * BI 232Z - AI Tutor Router & Prompt Interface
 * Handles Socratic and Feynman evaluations with strict Key Term Checklists.
 */

window.AnatomyTutor = (() => {
    function getAnatomyModel() {
        if (typeof window.getActiveModel === 'function') {
            return window.getActiveModel('anatomy2_llm');
        }
        return localStorage.getItem('anatomy2_llm') || localStorage.getItem('syngnosia_tutor_model') || 'gemma';
    }

    function cleanMathAndLaTeX(text) {
        if (typeof text !== 'string') return '';
        let cleaned = text.trim();
        if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
            cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
            cleaned = cleaned.replace(/\n?```$/, '');
            cleaned = cleaned.trim();
        }
        cleaned = cleaned.replace(/\\degree/g, '°');
        cleaned = cleaned.replace(/\\(quad|qquad|space)\b/g, ' ');
        cleaned = cleaned.replace(/\\(,|;|!)/g, '');
        cleaned = cleaned.replace(/\\left\(/g, '(');
        cleaned = cleaned.replace(/\\right\)/g, ')');
        cleaned = cleaned.replace(/\\left\[/g, '[');
        cleaned = cleaned.replace(/\\right\]/g, ']');
        cleaned = cleaned.replace(/\\+[\[\]()]/g, '');
        let prev;
        do {
            prev = cleaned;
            cleaned = cleaned.replace(/\\(text|mathrm|mathit|mathbf|ce|underline|bar|hat|tilde|vec|dot|ddot)\{([^{}]+)\}/g, '$2');
            cleaned = cleaned.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
            cleaned = cleaned.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
            cleaned = cleaned.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1 / $2');
            cleaned = cleaned.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
        } while (cleaned !== prev);
        cleaned = cleaned.replace(/([A-Za-z0-9)])_([0-9]+|[a-z]{1,2})/g, '$1<sub>$2</sub>');
        cleaned = cleaned.replace(/([A-Za-z0-9)])\^([0-9+\-]+)/g, '$1<sup>$2</sup>');
        cleaned = cleaned.replace(/\(\s+/g, '(');
        cleaned = cleaned.replace(/\s+\)/g, ')');
        cleaned = cleaned.replace(/\$\$\n?/g, '');
        cleaned = cleaned.replace(/\$/g, '');
        cleaned = cleaned.replace(/\\([#*_`[\]()])/g, '$1');
        return cleaned.trim();
    }

    const TUTOR_ERROR_RESPONSE = {
        passed: false,
        feedback: 'Error: Connection link interrupted. Please try again or click Regenerate.',
        nextStage: null
    };

    const TUTOR_OFFLINE_MOCK = {
        passed: false,
        feedback: '[MOCK OFFLINE MODE] That is incorrect. Please try again.',
        nextStage: null
    };

    // KEY TERM CHECKLISTS FOR EVERY LESSON IN A&P II
    const KEY_TERM_CHECKLISTS = {
        lesson_2_1: ['cerebrum', 'cerebellum', 'spinothalamic', 'corticospinal', 'ventricles', 'cerebrospinal', 'csf'],
        lesson_2_2: ['cranial', 'dermatome', 'sympathetic', 'parasympathetic', 'ganglionic', 'receptors', 'norepinephrine'],
        lesson_2_3: ['mechanoreceptors', 'Meissner', 'Pacinian', 'photoreception', 'rhodopsin', 'cochlea', 'proprioceptors'],
        lesson_2_4: ['hypophyseal', 'feedback', 'endocrine', 'second-messenger', 'camp', 'steroid', 'peptide'],
        lesson_2_5: ['plasma', 'erythropoiesis', 'erythropoietin', 'clotting', 'compatibility', 'transfusion', 'hemostasis'],
        lesson_2_6: ['conduction', 'wiggers', 'radius', 'hemodynamics', 'resistance', 'celiac', 'circle']
    };

    const STRICT_JSON_DIRECTIVE = [
        'Return ONLY a raw JSON object with this exact schema:',
        '{"passed": boolean, "feedback": "string", "nextStage": "string or null"}.',
        'Do not include markdown.',
        'Do not wrap with backticks.',
        'Do not include any text before or after the JSON object.'
    ].join(' ');

    function buildTutorPrompt(systemPrompt, messageHistory, userInput) {
        const safeHistory = Array.isArray(messageHistory) ? messageHistory : [];
        const historyBlock = safeHistory
            .map((msg, idx) => {
                const role = typeof msg?.role === 'string' ? msg.role.toUpperCase() : 'UNKNOWN';
                const content = typeof msg?.content === 'string' ? msg.content : '';
                return `${idx + 1}. [${role}] ${content}`;
            })
            .join('\n');
        return [
            'ANATOMY & PHYSIOLOGY TUTOR SYSTEM PROMPT:',
            systemPrompt || '',
            '',
            'CONVERSATION HISTORY (oldest to newest):',
            historyBlock || '[No previous messages]',
            '',
            'CURRENT LEARNER INPUT:',
            userInput || '',
            '',
            STRICT_JSON_DIRECTIVE
        ].join('\n');
    }

    const parseMD = (text) => {
        if (window.marked && window.marked.parse) {
            return window.marked.parse(text, { breaks: true });
        }
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.*?)\*/g, '<em>$1</em>')
                   .replace(/\n/g, '<br>');
    };

    function appendBubble(msgsEl, role, text) {
        const wrap = document.createElement("div");
        const bubble = document.createElement("div");
        
        if (role === "user") {
            wrap.className = "flex justify-end mt-2";
            bubble.className = "max-w-[80%] bg-rose-600 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-xs font-medium";
            bubble.innerHTML = parseMD(text);
        } else {
            wrap.className = "flex justify-start mt-2";
            bubble.className = "max-w-[85%] bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 rounded-2xl rounded-tl-sm text-xs font-medium";
            if (text) bubble.innerHTML = parseMD(text);
        }
        wrap.appendChild(bubble);
        msgsEl.appendChild(wrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return bubble;
    }

    function parseModelJson(rawText) {
        const text = typeof rawText === 'string' ? rawText.trim() : '';
        if (!text) throw new Error('Empty model response');
        try {
            return JSON.parse(text);
        } catch (_err) {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                return JSON.parse(text.slice(start, end + 1));
            }
            throw new Error('Failed to parse JSON response');
        }
    }

    // Comprehensive offline mock database for BI 232Z lessons
    const mockDatabase = {
        lesson_2_1: {
            lecture: `### 1. Real-World Case Study
A patient is rushed to the hospital exhibiting loss of coordination, unsteady gait, and dynamic tremor during voluntary reaching tasks. These localized deficits suggest direct injury to the cerebellum, which acts as the comparator for motor control. Meanwhile, a different patient shows loss of pain and temperature sensitivity below the waist after a motor accident. This is linked to a lesion of the spinothalamic tract, the ascending spinal pathway that transmits sensory input. cerebrospinal fluid (CSF) analysis indicates normal pressure, confirming that the ventricles remain unobstructed.

### 2. Core Physiological Principles
The Central Nervous System (CNS) coordinates sensory and motor loops:
- **Cerebrum Functional Areas**: Separated into sensory cortex (postcentral gyrus) and motor cortex (precentral gyrus) mapping body coordinates.
- **Cerebellum**: Controls coordination and posture by adjusting descending motor commands.
- **Spinal Tracts**: The ascending **spinothalamic** tract carries pain/temperature, while the descending **corticospinal** tract controls voluntary skeletal movement.
- **CSF flow path**: Produced in the choroid plexuses, CSF flows through the lateral ventricles ➔ interventricular foramen ➔ third ventricle ➔ cerebral aqueduct ➔ fourth ventricle ➔ subarachnoid space to cushion the brain.

### 3. Empirical & Methodological Frameworks
Physiologists map neural pathways using tract-tracing dye techniques. Lumbar puncture allows sampling of CSF from the subarachnoid space to diagnostic ends.

### 4. Clinical & Practical Application
When diagnosing stroke or CSF blocks, MRI scans verify that the ventricles are not enlarged (hydrocephalus), tracing spinal pathway deficits to target therapeutic interventions.`,
            socraticInit: "Welcome to A&P II! Let's explore Lesson 2.1: The CNS. If a patient experiences loss of coordination and tremors, which brain area is likely affected, and how does CSF circulate?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if (text.includes('cerebell') && (text.includes('ventricle') || text.includes('fluid') || text.includes('csf'))) {
                    return { passed: true, feedback: "Excellent! You correctly identified that the cerebellum manages coordination, and noted CSF fluid circulation. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Remember to state the coordinator of balance (cerebellum) and how CSF flows through the cerebral ventricles." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_2_1'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (cerebrum, cerebellum, spinothalamic, corticospinal, ventricles, cerebrospinal, csf) to detail the central nervous system." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_2_2: {
            lecture: `### 1. Real-World Case Study
A patient presents to the emergency room with severe bradycardia (slow heart rate) and hypotension after an accidental overdose of beta-blockers, which block sympathetic norepinephrine binding to cardiac receptors. Conversely, a patient experiencing autonomic dysreflexia exhibits a massive, uncontrolled sympathetic discharge below a spinal cord lesion, triggering extreme hypertension, while parasympathetic reflexes cranial nerves attempt to compensate by slowing the heart.

### 2. Core Physiological Principles
The Peripheral Nervous System (PNS) and Autonomic Nervous System (ANS) govern unconscious body coordination:
- **PNS Organization**: Includes 12 pairs of cranial nerves and 31 pairs of spinal nerves. Dermatomes map specific cutaneous regions to spinal cord levels.
- **Autonomic Divisions**:
  - **Sympathetic Division**: Flight-or-fight response. Preganglionic neurons release acetylcholine (ACh); postganglionic release norepinephrine (NE) to bind adrenergic alpha/beta receptors.
  - **Parasympathetic Division**: Rest-and-digest. Both preganglionic and postganglionic neurons release acetylcholine to bind nicotinic and muscarinic receptors.
- **Ganglionic Pathway Architecture**: Sympathetic has short preganglionic and long postganglionic axons; parasympathetic has long preganglionic and short postganglionic axons.

### 3. Empirical & Methodological Frameworks
Autonomic activity is evaluated by measuring sweat gland output, heart rate variability, or testing dermatomal sensation mapping.

### 4. Clinical & Practical Application
Beta-adrenergic antagonists (beta-blockers) decrease heart rate and contractility to manage hypertension, while anticholinergic drugs block parasympathetic vagal input to treat bradycardia.`,
            socraticInit: "Let's explore Lesson 2.2: The Peripheral & Autonomic Nervous System. How do sympathetic and parasympathetic pathway structures differ in terms of their pre- and post-ganglionic neurotransmitters?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const sympatheticCheck = text.includes('sympathetic') && (text.includes('norepinephrine') || text.includes('ne') || text.includes('adrenergic'));
                const parasympatheticCheck = text.includes('parasympathetic') && (text.includes('acetylcholine') || text.includes('ach') || text.includes('cholinergic'));
                const preganglionicCheck = text.includes('preganglionic') || text.includes('both release acetylcholine');
                if ((sympatheticCheck && parasympatheticCheck) || preganglionicCheck) {
                    return { passed: true, feedback: "Splendid! You correctly noted that preganglionic fibers in both systems release acetylcholine, whereas sympathetic postganglionic fibers release norepinephrine and parasympathetic postganglionic release acetylcholine. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Recall that preganglionic neurons in both divisions release acetylcholine (ACh). Contrast this with the postganglionic neurotransmitters: norepinephrine (NE) for sympathetic vs. ACh for parasympathetic." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_2_2'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (cranial, dermatome, sympathetic, parasympathetic, ganglionic, receptors, norepinephrine) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_2_3: {
            lecture: `### 1. Real-World Case Study
A patient experiences numbness and tingling in the hand, especially in the thumb and index finger. A nerve conduction study confirms compression of the median nerve within the carpal tunnel, impairing sensory transduction in cutaneous mechanoreceptors (such as Meissner and Pacinian corpuscles). Under a different diagnostic evaluation, a patient with visual deficits is diagnosed with a pituitary tumor compressing the optic chiasm, blocking light transduction pathways driven by rhodopsin bleaching in photoreceptors.

### 2. Core Physiological Principles
Sensory systems convert physical stimuli into neural signals:
- **Cutaneous Mechanoreceptors**: Meissner corpuscles detect light touch; Pacinian corpuscles detect deep pressure and vibration. Proprioceptors monitor joint position and muscle stretch.
- **Sensory Pathway**: Sensory signals travel via three-neuron chains from peripheral receptors, through the spinal cord (e.g., dorsal columns), to the primary sensory cortex.
- **Photoreception Transduction**: Light strikes rhodopsin in rod outer segments, causing **rhodopsin bleaching** (retinal dissociates from opsin), closing Na+ channels and hyperpolarizing the photoreceptor.
- **Audition mechanics**: Sound waves enter the ear canal, vibrating the tympanic membrane, ossicles, and the fluid inside the cochlea. This bends hair cells on the basilar membrane, opening potassium channels to depolarize the sensory neuron.

### 3. Empirical & Methodological Frameworks
Two-point discrimination tests assess mechanoreceptive density. Pure-tone audiometry evaluates auditory threshold mechanics.

### 4. Clinical & Practical Application
Nerve compression syndromes (e.g., carpal tunnel) are managed by surgical decompression to restore sensory pathways. Visual field maps localize visual path lesions.`,
            socraticInit: "Welcome to Lesson 2.3: Special & Somatic Senses. How do mechanical stimuli become electrical signals in the somatic senses, and what is rhodopsin bleaching in photoreception?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const mechanoCheck = text.includes('mechanoreceptor') || text.includes('meissner') || text.includes('pacinian') || text.includes('transduction') || text.includes('pressure') || text.includes('touch');
                const photoCheck = text.includes('bleaching') || text.includes('rhodopsin') || text.includes('light') || text.includes('retinal') || text.includes('opsin');
                if (mechanoCheck && photoCheck) {
                    return { passed: true, feedback: "Outstanding! You explained that cutaneous mechanoreceptors transduce physical pressure into electrical signals, and you detailed how rhodopsin bleaching shifts light signals in photoreceptors. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Make sure to cover both somatic mechanoreceptive transduction (e.g. pressure/vibration converting to graded potentials) and photoreceptive rhodopsin bleaching (dissociation of retinal and opsin under light)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_2_3'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (mechanoreceptors, Meissner, Pacinian, photoreception, rhodopsin, cochlea, proprioceptors) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_2_4: {
            lecture: `### 1. Real-World Case Study
A patient presents with weight loss, heat intolerance, and bulging eyes (exophthalmos). Blood tests reveal high thyroxine levels but very low thyroid-stimulating hormone (TSH), indicating hyperthyroidism (Graves' disease). The thyroid gland has escaped normal homeostatic feedback control due to thyroid-stimulating antibodies binding to TSH receptors. In contrast, a patient with Type 1 diabetes experiences insulin deficiency due to autoimmune destruction of pancreatic beta cells, impairing cellular glucose uptake.

### 2. Core Physiological Principles
The endocrine system regulates cellular metabolism via chemical messengers:
- **Hypothalamic-Hypophyseal System**: The hypothalamus regulates the anterior pituitary via the hypophyseal portal system (vascular) and the posterior pituitary via the hypophyseal tract (neural).
- **Hormone Classifications**:
  - **Water-Soluble (Peptides/Amines)**: Bind extracellular receptors, activating G-proteins and second-messenger cascades (e.g., cAMP, IP3/DAG) to alter protein activity.
  - **Lipid-Soluble (Steroids/Thyroid Hormones)**: Cross the membrane, bind intracellular receptors, and act as transcription factors to directly alter gene activation.
- **Feedback Loops**: Endocrine axes (like the HPT or HPA axes) use negative feedback where target gland hormones inhibit hypothalamic and pituitary secretion to maintain homeostasis.

### 3. Empirical & Methodological Frameworks
Endocrine function is assessed via enzyme-linked immunosorbent assays (ELISA) measuring circulating hormone concentrations.

### 4. Clinical & Practical Application
TSH levels serve as the primary screening tool for thyroid dysfunction. Guided insulin therapy replaces pancreatic output in patients with Type 1 diabetes.`,
            socraticInit: "Let's discuss Lesson 2.4: The Endocrine System. How do water-soluble and lipid-soluble hormones differ in their receptor locations and mechanisms of action?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const waterCheck = (text.includes('water') || text.includes('peptide')) && (text.includes('surface') || text.includes('extracellular') || text.includes('second messenger') || text.includes('camp'));
                const lipidCheck = (text.includes('lipid') || text.includes('steroid') || text.includes('intracellular') || text.includes('gene') || text.includes('nucleus'));
                if (waterCheck && lipidCheck) {
                    return { passed: true, feedback: "Superb! You correctly identified that water-soluble hormones bind membrane-surface receptors and trigger second-messenger systems like cAMP, whereas lipid-soluble/steroid hormones bind intracellular receptors to alter gene transcription directly. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Contrast where their receptors are: membrane-surface for water-soluble (using second-messenger systems like cAMP) vs. intracellular/nuclear for lipid-soluble/steroids (regulating gene expression directly)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_2_4'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (hypophyseal, feedback, endocrine, second-messenger, camp, steroid, peptide) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_2_5: {
            lecture: `### 1. Real-World Case Study
A patient receives a blood transfusion of Type A blood but is later found to have Type B blood. The mismatch triggers an acute hemolytic transfusion reaction, where antibodies in the patient's plasma bind to Type A antigens on the donor erythrocytes, causing complement-mediated hemolysis. In the hematology unit, another patient with deep vein thrombosis is treated with heparin to inhibit the coagulation cascade, preventing further clot growth and ensuring vascular hemostasis.

### 2. Core Physiological Principles
Blood transports nutrients and provides immediate clotting protection:
- **Plasma Composition**: 92% water, containing proteins (albumin, globulins, fibrinogen) and electrolytes.
- **Erythropoiesis**: The generation of red blood cells in red bone marrow, stimulated by erythropoietin (EPO) in response to tissue hypoxia.
- **Blood Typing**: Based on A, B, and Rh (D) antigens on erythrocyte membranes. Compatibility requires that donor antigens do not match recipient antibodies.
- **Hemostasis**:
  1. *Vascular Spasm*: Immediate vasoconstriction.
  2. *Platelet Plug*: Adhesion and aggregation of platelets at the injury site.
  3. *Coagulation Cascade*: Intrinsic (activated by tissue damage) and extrinsic (activated by blood vessel damage) pathways converge to the common pathway, converting soluble fibrinogen into insoluble fibrin threads.

### 3. Empirical & Methodological Frameworks
Blood compatibility is tested via agglutination typing and cross-matching. Hemostasis is monitored via prothrombin time (PT) assays.

### 4. Clinical & Practical Application
Anticoagulants (heparin, warfarin) block clotting cascade enzymes to treat thrombosis. Erythropoietin injections treat anemia in chronic kidney disease.`,
            socraticInit: "Welcome to Lesson 2.5: Cardiovascular Blood. Why does a blood transfusion mismatch lead to hemolysis, and what is the role of erythropoietin (EPO) in blood regulation?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const transfusionCheck = text.includes('antigen') || text.includes('antibody') || text.includes('immun') || text.includes('react') || text.includes('mismatch') || text.includes('hemolysis');
                const epoCheck = text.includes('epo') || text.includes('erythropoietin') || text.includes('red blood cell') || text.includes('oxygen') || text.includes('hypoxia') || text.includes('erythropoiesis');
                if (transfusionCheck && epoCheck) {
                    return { passed: true, feedback: "Excellent explanation! You described how antibodies bind to mismatched antigens to trigger hemolysis, and you detailed EPO's role in regulating red blood cell production (erythropoiesis). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Explain how mismatched blood antigens react with the recipient's plasma antibodies to cause hemolysis. Also, state how EPO stimulates red blood cell production (erythropoiesis)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_2_5'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (plasma, erythropoiesis, erythropoietin, clotting, compatibility, transfusion, hemostasis) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_2_6: {
            lecture: `### 1. Real-World Case Study
A patient presents with dyspnea on exertion. Echocardiography reveals mitotic fusion of the mitral valve (mitral stenosis), altering pressure-volume lines on a Wiggers diagram. The stenosis blocks left ventricular filling, lowering cardiac output. Additionally, to manage the patient's blood pressure, the clinician calculates total peripheral resistance. According to Poiseuille's law, a minor drop in arteriole vessel radius significantly elevates resistance and blood pressure, requiring vaso-dilator interventions.

### 2. Core Physiological Principles
The heart acts as a dual-pump coordinating systemic and pulmonary circulation:
- **Cardiac Conduction System**: Electrical signals originate at the SA node, travel to the AV node (introducing a delay), down the AV bundle and Purkinje fibers to depolarize the ventricles.
- **Cardiac Cycle & ECG**: ECG waves correlate with electrical events: P wave (atrial depolarization), QRS complex (ventricular depolarization), and T wave (ventricular repolarization). These trigger mechanical contraction and relaxation phases.
- **Hemodynamics**: Guided by Poiseuille's law:
  $$\\text{Resistance} = \\frac{8\\eta L}{\\pi r^4}$$
  Resistance is highly sensitive to vessel radius ($r$), blood viscosity ($\\eta$), and vessel length ($L$).
- **Systemic Vessels**: Includes the celiac trunk (supplying upper GI organs) and the Circle of Willis (cerebral collateral circulation).

### 3. Empirical & Methodological Frameworks
ECGs map electrical vectors. The Wiggers diagram synthesizes pressure, volume, ECG, and heart sounds during a single heartbeat.

### 4. Clinical & Practical Application
Managing arterial diameter (vessel radius) with drugs like ACE inhibitors decreases total peripheral resistance to treat hypertension. Mitral valve defects are treated with surgical repair.`,
            socraticInit: "Let's study Lesson 2.6: The Heart & Hemodynamics. How do ECG waves correspond to the electrical and mechanical phases of the cardiac cycle, and what factor has the greatest influence on hemodynamics resistance?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const ecgCheck = (text.includes('p wave') || text.includes('qrs') || text.includes('t wave')) && (text.includes('depolariz') || text.includes('repolariz'));
                const radiusCheck = text.includes('radius') || text.includes('diameter') || text.includes('radius fourth power') || text.includes('poiseuille');
                if (ecgCheck && radiusCheck) {
                    return { passed: true, feedback: "Magnificent! You mapped the ECG waves to cardiac depolarization/repolarization and identified vessel radius (via Poiseuille's law) as the primary determinant of hemodynamic resistance. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Describe how ECG waves correlate with electrical events (P: atrial depolarization, QRS: ventricular depolarization, T: ventricular repolarization). Then identify the single most powerful factor affecting resistance according to Poiseuille's law (vessel radius)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_2_6'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (conduction, wiggers, radius, hemodynamics, resistance, celiac, circle) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        }
    };

    function getMockFallback(lessonId, lessonTitle, concept, hook, feynmanPrompt) {
        if (mockDatabase[lessonId]) return mockDatabase[lessonId];
        
        const numStr = lessonId.replace('lesson_', '').replace('_', '.');
        return {
            lecture: `### 1. Real-World Case Study
For **Lesson ${numStr}: ${lessonTitle}**, we study how this physiological pathway functions. Hook: *${hook}*. Disruptions to this system cause clinical imbalances (such as sensory deficits, hemodynamic changes, or endocrine dysfunction) that require targeted therapeutic intervention.

### 2. Core Physiological Principles
This lesson introduces: **${concept}**. 
We focus on how these neural fibers, endocrine organs, or cardiovascular loops operate. A clear understanding of these physiological frameworks is essential for calculating clinical metrics, analyzing Wiggers diagrams, or mapping vessel paths.

### 3. Empirical & Methodological Frameworks
Physiologists investigate these systems using laboratory models, sensory testing tools, blood compatibility screens, and digital diagnostics. We learn to trace pathway boundaries and analyze quantitative variables (like heart rate, resistance, or hormone levels).

### 4. Clinical & Practical Application
Clinical practices translate these frameworks directly to patient care. We examine diagnostic scans, monitor receptor blocks, or analyze hemodynamics to restore homeostatic balance.`,
            socraticInit: `Let's discuss Lesson ${numStr}: ${lessonTitle}. The concept is "${concept}". Based on the hook (*${hook}*), how does this biological pathway respond?`,
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if (text.length > 20) {
                    return { passed: true, feedback: `Great response! You've shown that you understand the core aspects of "${concept}". CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3.` };
                }
                return { passed: false, feedback: "Could you expand your explanation? Try to connect it back to the core concept of this lesson. What is your understanding?" };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS[lessonId] || [];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Excellent explanation. You have successfully summarized the concept in simple, accessible terms using all key terms." };
                }
                return { passed: false, feedback: `Your explanation is good, but is missing key scientific terminology. Please make sure to explain using these terms: **${missing.join(', ')}**.` };
            }
        };
    }

    return {
        invoke: (initialPrompt, anchorEl, systemContext = "", options = {}) => {
            const opts = options || {};

            const startSession = (msgsEl, inputEl, sendEl, closeEl, onClose) => {
                if (!msgsEl || !inputEl || !sendEl) return;

                msgsEl.innerHTML = "";
                let localHistory = [];

                const appendLocalBubble = (role, text) => {
                    const wrap = document.createElement("div");
                    const bubble = document.createElement("div");
                    if (role === "user") {
                        wrap.className = "flex justify-end mt-2";
                        bubble.className = "max-w-[80%] bg-rose-600 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-xs font-medium";
                        bubble.innerHTML = parseMD(text);
                    } else {
                        wrap.className = "flex justify-start mt-2";
                        bubble.className = "max-w-[85%] bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 rounded-2xl rounded-tl-sm text-xs font-medium";
                        if (text) bubble.innerHTML = parseMD(text);
                    }
                    wrap.appendChild(bubble);
                    msgsEl.appendChild(wrap);
                    msgsEl.scrollTop = msgsEl.scrollHeight;
                };

                const runTutorTurn = async (text, withHistory = true) => {
                    const typingWrap = document.createElement("div");
                    typingWrap.className = "flex justify-start inline-typing mt-2";
                    typingWrap.innerHTML = `<div class="bg-slate-900 px-3 py-2 rounded-2xl flex items-center space-x-1 border border-slate-800"><div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style="animation-delay: 0.15s"></div><div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></div></div>`;
                    msgsEl.appendChild(typingWrap);
                    msgsEl.scrollTop = msgsEl.scrollHeight;

                    const model = getAnatomyModel();
                    const systemPrompt = "You are an expert anatomy and physiology college professor. Be encouraging, precise, and concise. Explain step by step. " + (systemContext ? "\n\nContext:\n" + systemContext : "");

                    try {
                        const result = await window.GnosysLLM.generateResponse(
                            systemPrompt,
                            text,
                            {
                                moduleKey: 'anatomy2_llm',
                                model: model,
                                history: withHistory ? localHistory.slice(0, -1) : undefined,
                                stream: false
                            }
                        );
                        typingWrap.remove();
                        const responseText = typeof result === 'string' ? result : (result && typeof result.text === 'string' ? result.text : '');
                        appendLocalBubble("assistant", cleanMathAndLaTeX(responseText));
                        localHistory.push({ role: "assistant", content: responseText });
                    } catch (e) {
                        typingWrap.remove();
                        appendLocalBubble("assistant", "[Offline Mode] Connecting link offline. Check if Ollama is running local models.");
                    }
                };

                const handleLocalSend = async () => {
                    const text = inputEl.value.trim();
                    if (!text) return;
                    appendLocalBubble("user", text);
                    localHistory.push({ role: "user", content: text });
                    inputEl.value = "";
                    await runTutorTurn(text, true);
                };

                appendLocalBubble("assistant", "Hello! I am your Anatomy & Physiology II tutor. Let's analyze these anatomical systems together. What questions do you have?");
                if (initialPrompt) {
                    appendLocalBubble("user", initialPrompt);
                    localHistory.push({ role: "user", content: initialPrompt });
                    runTutorTurn(initialPrompt, false);
                }

                const newSendBtn = sendEl.cloneNode(true);
                sendEl.parentNode.replaceChild(newSendBtn, sendEl);
                newSendBtn.addEventListener('click', handleLocalSend);

                const newInput = inputEl.cloneNode(true);
                inputEl.parentNode.replaceChild(newInput, inputEl);
                newInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLocalSend();
                    }
                });
                newInput.focus();

                if (closeEl) {
                    if (opts.showInnerClose === false) {
                        closeEl.classList.add('hidden');
                    } else {
                        closeEl.classList.remove('hidden');
                    }
                    closeEl.onclick = () => {
                        if (typeof onClose === 'function') onClose();
                    };
                }
            };

            let popupEl = document.getElementById('tutor-popup-modal');
            if (!popupEl) {
                popupEl = document.createElement('div');
                popupEl.id = 'tutor-popup-modal';
                popupEl.className = 'fixed inset-0 z-[200] hidden flex items-center justify-center font-sans p-4';
                popupEl.innerHTML = `
                    <div class="tutor-popup-backdrop absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"></div>
                    <div class="tutor-popup-card bg-slate-900 border border-rose-900/40 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 rounded-3xl w-[440px] h-[550px] relative z-10">
                        <div class="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-rose-900/20 shrink-0">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center">
                                    <i class="fa-solid fa-child-body text-xs text-white"></i>
                                </div>
                                <div>
                                    <span class="text-sm font-extrabold text-slate-200 block">AnatomyTutor AI</span>
                                    <span class="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Online</span>
                                </div>
                            </div>
                            <button class="tutor-popup-close w-8 h-8 rounded-full flex items-center justify-center text-slate-455 hover:text-slate-200 transition-colors">
                                <i class="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>
                        <div class="tutor-popup-messages flex-grow overflow-y-auto p-4 space-y-4 bg-slate-950/40"></div>
                        <div class="border-t border-rose-900/20 p-3 bg-slate-950 flex gap-2 shrink-0">
                            <input type="text" placeholder="Ask AnatomyTutor..." class="tutor-popup-input flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-250 focus:outline-none focus:border-rose-600" />
                            <button class="tutor-popup-send px-4 bg-rose-600 hover:bg-rose-500 text-white rounded transition"><i class="fa-solid fa-paper-plane text-xs"></i></button>
                        </div>
                    </div>
                `;
                document.body.appendChild(popupEl);
                popupEl.querySelector('.tutor-popup-close').addEventListener('click', () => popupEl.classList.add('hidden'));
                popupEl.querySelector('.tutor-popup-backdrop').addEventListener('click', () => popupEl.classList.add('hidden'));
            }

            popupEl.classList.remove('hidden');
            startSession(
                popupEl.querySelector('.tutor-popup-messages'),
                popupEl.querySelector('.tutor-popup-input'),
                popupEl.querySelector('.tutor-popup-send'),
                popupEl.querySelector('.tutor-popup-close'),
                () => popupEl.classList.add('hidden')
            );
        },

        getLecture: async (lessonId, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return "Error: Lesson not found.";

            const model = getAnatomyModel();
            const systemPrompt = "You are an expert anatomy and physiology college professor. Generate a comprehensive college-level lecture of 600-800 words based on the provided concept and hook. Structure the lecture strictly into four sections: (1) Real-World Case Study, (2) Core Physiological Principles, (3) Empirical & Methodological Frameworks, and (4) Clinical & Practical Application. Use markdown formatting and comparison tables to organize key differences where appropriate.";
            const prompt = `Generate a lecture for Lesson ${lesson.numStr}: ${lesson.title}.\nConcept: ${lesson.concept}\nReal-World Hook: ${lesson.clinical_tie_in}`;

            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                
                const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'anatomy2_llm',
                    model: model,
                    stream: false
                });
                if (result) return result;
                throw new Error("No response");
            } catch (e) {
                console.warn("LLM offline, using mock lecture fallback for:", lessonId);
                const mock = getMockFallback(lessonId, lesson.title, lesson.concept, lesson.clinical_tie_in, lesson.feynman_prompt);
                return mock.lecture;
            }
        },

        fetchGeneratedLesson: async (lesson, onProgress, variationIndex = 0) => {
            const model = getAnatomyModel();
            const systemPrompt = "You are an expert anatomy and physiology college professor. Generate a comprehensive college-level lecture of 600-800 words based on the provided concept and hook. Structure the lecture strictly into four sections: (1) Real-World Case Study, (2) Core Physiological Principles, (3) Empirical & Methodological Frameworks, and (4) Clinical & Practical Application. Use markdown formatting and comparison tables to organize key differences where appropriate.";
            
            const variationInstruction = variationIndex > 0
                ? `This is Lecture Variation #${variationIndex + 1} for this topic. You MUST create a completely different clinical scenario/context and use different real-world applications/case studies compared to previous variations to ensure variety.`
                : '';
            const prompt = `Write a comprehensive, college-level introductory anatomy and physiology lecture (approximately 600-800 words).
${variationInstruction}
You MUST use the exact concept and clinical hook details below:
- Concept: ${lesson.concept}
- Real-World Hook: ${lesson.clinical_tie_in}
- Feynman Prompt: ${lesson.feynman_prompt}

Structure the lecture strictly into these four markdown headers (###):
1. ### Real-World Case Study
2. ### Core Physiological Principles
3. ### Empirical & Methodological Frameworks
4. ### Clinical & Practical Application

Do NOT use LaTeX math formatting. Return ONLY markdown content.`;

            onProgress('connect', 'running', 'Checking local AI provider...');
            try {
                if (window.GnosysLLM && typeof window.GnosysLLM.init === 'function') {
                    await window.GnosysLLM.init();
                }
                onProgress('connect', 'success', 'Successfully connected to local provider.');
            } catch (err) {
                onProgress('connect', 'warning', `Provider warning: ${err.message}. Proceeding...`);
            }

            onProgress('model', 'running', `Verifying model '${model}' status...`);
            try {
                onProgress('model', 'success', `Model '${model}' is ready.`);
            } catch (err) {
                onProgress('model', 'warning', `Model check warning. Proceeding...`);
            }

            onProgress('generate', 'running', `Submitting prompt for '${lesson.title}'...`);
            let responseText = '';
            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                const resp = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'anatomy2_llm',
                    model: model,
                    stream: false
                });
                responseText = typeof resp === 'string' ? resp.trim() : (typeof resp?.text === 'string' ? resp.text.trim() : '');
                
                if (!responseText) {
                    throw new Error('Received empty response from local provider');
                }
                onProgress('generate', 'success', 'Lecture generated.');
            } catch (err) {
                console.warn("LLM offline during generate:", err);
                onProgress('generate', 'warning', 'LLM offline. Using mock fallback...');
                const mock = getMockFallback(lesson.id, lesson.title, lesson.concept, lesson.clinical_tie_in, lesson.feynman_prompt);
                responseText = mock.lecture;
            }

            onProgress('render', 'running', 'Parsing content...');
            const cleanedText = cleanMathAndLaTeX(responseText);
            onProgress('render', 'success', 'Done.');
            return cleanedText;
        },

        cleanMathAndLaTeX,
        getMockFallback,

        fetchGeneratedQuestion: async (lesson, mode) => {
            const model = getAnatomyModel();
            await window.GnosysLLM?.init?.();

            let systemPrompt = `You are an Expert Professor of Anatomy and Physiology.`;
            let prompt = '';

            if (mode === 'socratic') {
                prompt = [
                    `Generate a single, unique, challenging, scenario-based question to test a student's understanding of the concept: "${lesson.concept}".`,
                    `The context must relate to the real-world/clinical hook: "${lesson.clinical_tie_in}".`,
                    `The question must require the student to explain physiological structures and pathways.`,
                    `Do NOT use LaTeX math formatting. Write all math and symbols in simple plain text.`,
                    `Return ONLY the question text itself. Do not include any introductory greetings, markdown headers, markdown code blocks, JSON wrapper, or conversational filler.`
                ].join('\n');
            } else if (mode === 'feynman') {
                prompt = [
                    `Generate a challenging prompt to test the student's ability to explain the concept "${lesson.concept}" using the Feynman technique (explaining a complex topic to a non-scientist or 10-year-old child in simple, everyday terms).`,
                    `The prompt should be based on the real-world/clinical hook: "${lesson.clinical_tie_in}".`,
                    `Return ONLY the prompt text itself. Do not include any introductory greetings, markdown headers, markdown code blocks, JSON wrapper, or conversational filler.`
                ].join('\n');
            }

            try {
                const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'anatomy2_llm',
                    model: model,
                    stream: false,
                });
                const question = typeof result === 'string' ? result : (result && typeof result.text === 'string' ? result.text : '');
                if (!question) {
                    throw new Error('Empty response received from local provider');
                }
                return cleanMathAndLaTeX(question.trim());
            } catch (err) {
                throw err;
            }
        },

        fetchLocalTutor: async (systemPrompt, messageHistory, userInput) => {
            const model = getAnatomyModel();
            const prompt = buildTutorPrompt(systemPrompt, messageHistory, userInput);

            if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                return { ...TUTOR_OFFLINE_MOCK };
            }

            try {
                const result = await window.GnosysLLM.generateResponse('', prompt, {
                    moduleKey: 'anatomy2_llm',
                    model: model,
                    stream: false,
                });
                const responseText = typeof result === 'string' ? result : (result && typeof result.text === 'string' ? result.text : '');
                const parsed = parseModelJson(responseText);
                
                let feedback = typeof parsed.feedback === 'string' ? parsed.feedback : 'No feedback provided.';
                feedback = cleanMathAndLaTeX(feedback);

                return {
                    passed: Boolean(parsed.passed),
                    feedback: feedback,
                    nextStage: typeof parsed.nextStage === 'string' || parsed.nextStage === null
                        ? parsed.nextStage
                        : null
                };
            } catch (routerErr) {
                console.warn('Anatomy tutor failed to respond via shared provider.', routerErr);
                return { ...TUTOR_ERROR_RESPONSE };
            }
        },

        getSocraticWelcome: async (lessonId, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return "Error: Lesson not found.";
            
            const mock = getMockFallback(lessonId, lesson.title, lesson.concept, lesson.clinical_tie_in, lesson.feynman_prompt);
            return mock.socraticInit;
        },

        evaluateSocraticAnswer: async (lessonId, messageHistory, userInput, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return { passed: false, feedback: "Error: Lesson not found." };

            const model = getAnatomyModel();
            const systemPrompt = `You are an expert Socratic tutor evaluating an Anatomy & Physiology student's response. The topic is "${lesson.title}" and the concept is "${lesson.concept}".
If the student demonstrates a correct, accurate understanding of the anatomical concepts, you MUST include the keyword "CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." in your feedback.
Return a JSON object with this exact schema: {"passed": boolean, "feedback": "string", "nextStage": null}`;

            const historyText = messageHistory.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join('\n');
            const prompt = `HISTORY:\n${historyText}\n\nSTUDENT'S ANSWER: ${userInput}\n\nReturn JSON.`;

            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'anatomy2_llm',
                    model: model,
                    stream: false
                });
                const responseText = typeof result === 'string' ? result : (result && typeof result.text === 'string' ? result.text : '');
                
                const data = parseModelJson(responseText);
                data.feedback = cleanMathAndLaTeX(data.feedback);
                if (data.feedback.includes("CONGRATULATIONS!")) {
                    data.passed = true;
                }
                return data;
            } catch (e) {
                console.warn("LLM offline, using mock socratic evaluator");
                const mock = getMockFallback(lessonId, lesson.title, lesson.concept, lesson.clinical_tie_in, lesson.feynman_prompt);
                return mock.socraticEval(userInput);
            }
        },

        evaluateFeynmanExplanation: async (lessonId, explanation, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return { passed: false, feedback: "Error: Lesson not found." };

            // client-side enforcement
            const checklist = KEY_TERM_CHECKLISTS[lessonId] || [];
            const textLower = explanation.toLowerCase();
            const missing = [];
            checklist.forEach(term => {
                if (!textLower.includes(term.toLowerCase())) {
                    missing.push(term);
                }
            });

            if (missing.length > 0) {
                return {
                    passed: false,
                    feedback: `Your explanation is good but is missing key scientific terminology. To verify complete mastery, please rewrite your explanation and make sure to integrate the following terms: **${missing.join(', ')}**.`
                };
            }

            const model = getAnatomyModel();
            const systemPrompt = `You are evaluating a student's explanation of an anatomy concept using the Feynman Technique. The prompt is: "${lesson.feynman_prompt}".
Assess if they explain it simply (as if to a 10-year-old) and capture the scientific core.
You MUST verify they correctly integrated the checklist terms: ${checklist.join(', ')}.
Return a JSON object with this exact schema: {"passed": boolean, "feedback": "string", "nextStage": null}`;

            const prompt = `EXPLANATION: ${explanation}\n\nReturn JSON.`;

            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'anatomy2_llm',
                    model: model,
                    stream: false
                });
                const responseText = typeof result === 'string' ? result : (result && typeof result.text === 'string' ? result.text : '');
                const data = parseModelJson(responseText);
                data.feedback = cleanMathAndLaTeX(data.feedback);
                return data;
            } catch (e) {
                console.warn("LLM offline, using mock feynman evaluator");
                const mock = getMockFallback(lessonId, lesson.title, lesson.concept, lesson.clinical_tie_in, lesson.feynman_prompt);
                return mock.feynmanEval(explanation);
            }
        },

        initMainChat: () => {
            const input = document.getElementById('chat-input');
            const sendBtn = document.getElementById('chat-btn-send');
            const clearBtn = document.getElementById('chat-btn-clear');
            const msgsEl = document.getElementById('chat-messages');
            const emptyState = document.getElementById('chat-empty-state');
            
            if (!input || !sendBtn || !msgsEl) return;
            
            let history = [];
            
            const handleSend = async () => {
                const text = input.value.trim();
                if (!text) return;
                
                if (emptyState) emptyState.style.display = 'none';
                if (window.AnatomyGamification) {
                    window.AnatomyGamification.incrementStat('companionChats');
                }

                appendBubble(msgsEl, "user", text);
                history.push({ role: "user", content: text });
                input.value = "";
                
                const typingWrap = document.createElement("div");
                typingWrap.className = "flex justify-start inline-typing mt-2";
                typingWrap.innerHTML = `<div class="bg-slate-900 px-3 py-2 rounded-2xl flex items-center space-x-1 border border-slate-800"><div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style="animation-delay: 0.15s"></div><div class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></div></div>`;
                msgsEl.appendChild(typingWrap);
                msgsEl.scrollTop = msgsEl.scrollHeight;

                const model = getAnatomyModel();
                const systemPrompt = "You are an expert anatomy and physiology study companion. Answer general anatomy and physiology questions accurately and concisely.";

                try {
                    const result = await window.GnosysLLM.generateResponse(
                        systemPrompt,
                        text,
                        {
                            moduleKey: 'anatomy2_llm',
                            model: model,
                            history: history.slice(0, -1),
                            stream: false
                        }
                    );
                    const fullText = typeof result === 'string' ? result : (result && typeof result.text === 'string' ? result.text : '');
                    
                    typingWrap.remove();
                    appendBubble(msgsEl, "assistant", cleanMathAndLaTeX(fullText));
                    history.push({ role: "assistant", content: fullText });
                } catch (e) {
                    typingWrap.remove();
                    appendBubble(msgsEl, "assistant", "[Offline Mode] I received your question about anatomy. Connect Ollama/Gnosys to talk online!");
                }
            };
            
            sendBtn.addEventListener('click', handleSend);
            input.addEventListener('keypress', (e) => { 
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(); 
                }
            });
            
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    history = [];
                    msgsEl.innerHTML = '';
                    if (emptyState) emptyState.style.display = 'block';
                });
            }
        }
    };
})();
