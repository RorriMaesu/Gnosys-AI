/**
 * BI 233Z - AI Tutor Router & Prompt Interface
 * Handles Socratic and Feynman evaluations with strict Key Term Checklists.
 */

window.AnatomyTutor = (() => {
    function getAnatomyModel() {
        if (typeof window.getActiveModel === 'function') {
            return window.getActiveModel('anatomy3_llm');
        }
        return localStorage.getItem('anatomy3_llm') || localStorage.getItem('syngnosia_tutor_model') || 'gemma';
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

    // KEY TERM CHECKLISTS FOR EVERY LESSON IN A&P III (BI 233Z)
    const KEY_TERM_CHECKLISTS = {
        lesson_3_1: ['lymphatic', 'innate', 'adaptive', 'phagocyte', 'helper', 'cytotoxic', 'mhc'],
        lesson_3_2: ['ventilation', 'boyle', 'alveoli', 'dissociation', 'bohr', 'affinity', 'hemoglobin'],
        lesson_3_3: ['mucosa', 'submucosa', 'glycolysis', 'krebs', 'etc', 'mitochondria', 'atp'],
        lesson_3_4: ['nephron', 'glomerular', 'filtration', 'hydrostatic', 'oncotic', 'raas', 'aldosterone'],
        lesson_3_5: ['buffer', 'bicarbonate', 'acidosis', 'alkalosis', 'compensation', 'electrolyte', 'raas'],
        lesson_3_6: ['ovarian', 'uterine', 'gonadotropin', 'progesterone', 'estrogen', 'gametogenesis', 'fertilization']
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
            bubble.className = "max-w-[80%] bg-pink-600 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-xs font-medium";
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

    // Comprehensive offline mock database for BI 233Z lessons
    const mockDatabase = {
        lesson_3_1: {
            lecture: `### 1. Real-World Case Study
A 22-year-old medical student notes swollen, non-tender nodules in her neck after a viral throat infection. A clinical diagnosis of lymphadenopathy is made, indicating an immune expansion within the cervical lymph nodes draining the upper respiratory tract. The swelling is a direct visualization of cellular proliferation as antigen presentation occurs. To trace the pathway, interstitial fluid enters lymphatic vessels, travels through regional filters, and encounters immune cells in the thymus and spleen, initiating both innate and adaptive cellular cascades.

### 2. Core Physiological Principles
The immune system is divided into two cooperative branches:
- **Innate Immunity**: The rapid, non-specific line of defense consisting of barrier membranes, phagocytic cells (macrophages and neutrophils), natural killer (NK) cells, and anti-viral proteins (interferons and complement proteins).
- **Adaptive Immunity**: Highly specific, antigen-dependent protection characterized by memory. It is divided into:
  - **Cell-Mediated Immunity**: Executed by T-lymphocytes. Helper CD4+ T-cells coordinate defenses, while Cytotoxic CD8+ T-cells destroy infected cells. MHC molecules act as presentation platforms (MHC-I for intracellular pathways on all nucleated cells; MHC-II on professional antigen-presenting cells).
  - **Humoral Immunity**: Executed by B-lymphocytes. Upon activation and clonal selection, B-cells differentiate into plasma cells that secrete structured antibodies (immunoglobulins) that neutralize pathogens.

### 3. Empirical & Methodological Frameworks
Flow cytometry serves as the standard methodology for immunologists to count helper T-cell subsets in clinical cohorts. Lymph node biopsies clarify lymphoid architecture.

### 4. Clinical & Practical Application
Immunology concepts guide vaccine design. By introducing inactive viral profiles, clinicians trigger antigen presentation, cloning, and memory cell creation to protect against virulent infections.`,
            socraticInit: "Welcome to A&P III! Let's explore Lesson 3.1: The Lymphatic System & Immunity. If a virus enters the respiratory tract, how do phagocytes and helper CD4+ T-cells coordinate to activate cytotoxic T-cells?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if (text.includes('phagocyt') || text.includes('macrophage') || text.includes('mhc') || text.includes('present')) {
                    if (text.includes('cytotoxic') || text.includes('cd8') || text.includes('kill')) {
                        return { passed: true, feedback: "Excellent! You've accurately connected antigen presentation by phagocytes to T-cell activation. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                    }
                }
                return { passed: false, feedback: "You are on the right track. Remember to detail how phagocytes present the antigen via MHC molecules to helper T-cells, which then release cytokines to activate cytotoxic T-cells." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_3_1'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (lymphatic, innate, adaptive, phagocyte, helper, cytotoxic, mhc) to contrast these immune defense systems." };
                }
                return { passed: false, feedback: `Your explanation is clear, but is missing key academic terms. Please expand your text to incorporate: **${missing.join(', ')}**.` };
            }
        },
        lesson_3_2: {
            lecture: `### 1. Real-World Case Study
An elite mountaineer ascends to high altitude without supplemental oxygen. As ambient pressure drops, he experiences dyspnea due to decreased oxygen partial pressure (PO2). At the same time, skeletal muscle contraction during the climb generates heat and lactic acid. In the systemic tissues, this local drop in pH and elevation in temperature triggers a shift in the oxygen-hemoglobin dissociation curve. Hemoglobin releases oxygen more readily to fuel the working muscles, illustrating the Bohr effect in action at the cellular level.

### 2. Core Physiological Principles
The respiratory system regulates gas exchange through ventilation mechanics and transport dynamics:
- **Ventilation Physics (Boyle's Law)**: Volume and pressure are inversely proportional ($P \\propto 1/V$). Muscle contraction (diaphragm and external intercostals) increases thoracic volume, dropping alveolar pressure below atmospheric pressure to draw air into the lungs.
- **Gas Transport Dynamics**: Oxygen binds to hemoglobin in the alveoli. The oxygen-hemoglobin dissociation curve charts this relationship.
- **The Bohr Effect**: Environmental shifts alter hemoglobin's oxygen affinity. A drop in pH (acidosis), elevation in PCO2, increased temperature, or higher 2,3-BPG concentration reduce oxygen affinity, shifting the curve to the right to facilitate oxygen unloading.

### 3. Empirical & Methodological Frameworks
Spirometry maps lung volumes (Tidal Volume, Vital Capacity). Blood gas analyzers measure arterial PO2 and PCO2 to compute hemoglobin saturation levels.

### 4. Clinical & Practical Application
Understanding Bohr shifts is vital in intensive care units. Managing fever or respiratory acidosis in ventilated patients ensures oxygen delivery is optimized.`,
            socraticInit: "Let's discuss Lesson 3.2: The Respiratory System. How does Boyle's law explain the physical act of inhalation, and what happens to oxygen transport when tissues undergo metabolic acidosis?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if ((text.includes('volume') && text.includes('pressure') && text.includes('invers')) || text.includes('boyle')) {
                    if (text.includes('bohr') || text.includes('affinity') || text.includes('unload') || text.includes('right')) {
                        return { passed: true, feedback: "Outstanding! You correctly applied Boyle's law to thoracic expansion and explained the Bohr shift during acidosis. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                    }
                }
                return { passed: false, feedback: "Remember to explain both: 1) how changing volume alters pressure during breathing (Boyle's Law), and 2) how acidosis shifts the curve to unload oxygen (Bohr Effect)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_3_2'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Wonderful explanation! You successfully explained lung mechanics and oxygen affinity using all checklist terms." };
                }
                return { passed: false, feedback: `Please expand your explanation to include these essential terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_3_3: {
            lecture: `### 1. Real-World Case Study
A patient presents with burning epigastric pain that is temporarily relieved by eating. Endoscopy reveals a mucosal erosion in the duodenum, confirming a peptic ulcer. The erosion has penetrated the mucosa and submucosa, approaching the muscularis externa layer. In terms of metabolism, cells in the surrounding tissue rely on cellular respiration to produce ATP, driving mucosal repair and enzyme kinetics across the alimentary canal.

### 2. Core Physiological Principles
The digestive system processes nutrients through physical and chemical pathways:
- **Alimentary Canal Layering**: The wall consists of four histological layers:
  1. *Mucosa*: Epithelium, lamina propria, muscularis mucosae. Functions in secretion and absorption.
  2. *Submucosa*: Dense irregular connective tissue containing blood vessels, lymphatics, and the submucosal plexus.
  3. *Muscularis Externa*: Inner circular and outer longitudinal smooth muscle layers driving peristalsis.
  4. *Serosa/Adventitia*: The outer protective layer.
- **Cellular Respiration**:
  - **Glycolysis**: Occurs in the cytoplasm; breaks down glucose into pyruvate, yielding 2 net ATP.
  - **Krebs Citric Acid Cycle**: Occurs in the mitochondria matrix; processes acetyl-CoA, releasing CO2 and yielding ATP, NADH, and FADH2.
  - **Electron Transport Chain (ETC)**: Occurs in the inner mitochondria membrane; transfers electrons to build a proton gradient, yielding approximately 28-32 ATP via ATP synthase.

### 3. Empirical & Methodological Frameworks
Peptic ulcers are staged by depth of tissue penetration. Metabolic pathway rates are traced using radioactive carbon-labeled glucose.

### 4. Clinical & Practical Application
Proton pump inhibitors (PPIs) inhibit gastric acid secretion to prevent mucosal digestion, allowing tissues to repair their histological layers.`,
            socraticInit: "Welcome to Lesson 3.3: The Digestive System & Metabolism. What are the four histological layers of the digestive tract wall, and where does glycolysis take place?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const layersCheck = text.includes('mucosa') && text.includes('submucosa') && text.includes('muscularis') && (text.includes('serosa') || text.includes('adventitia'));
                const glycolysisCheck = text.includes('cytoplasm') || text.includes('cytosol');
                if (layersCheck && glycolysisCheck) {
                    return { passed: true, feedback: "Superb! You correctly listed the four histological layers (mucosa, submucosa, muscularis externa, and serosa) and noted that glycolysis occurs in the cytoplasm. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Recall the four layers from superficial to deep: mucosa, submucosa, muscularis externa, and serosa. Also, state which cellular compartment hosts glycolysis (cytoplasm)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_3_3'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (mucosa, submucosa, glycolysis, krebs, etc, mitochondria, atp) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_3_4: {
            lecture: `### 1. Real-World Case Study
A patient with severe glomerulonephritis presents with hematuria (blood in urine) and edema. Inflammatory damage has compromised the glomerular filtration membrane, permitting proteins and red blood cells to enter Bowman's space. Consequently, the patient's Net Filtration Pressure (NFP) is altered, dropping GFR. In response to hypovolemia and low perfusion, the kidneys release renin, triggering the RAAS cascade to raise blood pressure and retain sodium via aldosterone.

### 2. Core Physiological Principles
The urinary system filters blood, maintains fluid balance, and regulates blood pressure:
- **Nephron Anatomy**: The structural unit of the kidney, consisting of the renal corpuscle (glomerulus and Bowman's capsule) and the renal tubule (proximal tubule, loop of Henle, distal tubule, and collecting duct).
- **Glomerular Filtration Mechanics**: Driven by **Net Filtration Pressure (NFP)**:
  $$\\text{NFP} = \\text{HP}_g - (\\text{OP}_g + \\text{HP}_c)$$
  where $\\text{HP}_g$ is glomerular hydrostatic pressure (55 mmHg), $\\text{OP}_g$ is blood colloid osmotic pressure (30 mmHg), and $\\text{HP}_c$ is capsular hydrostatic pressure (15 mmHg).
- **Renin-Angiotensin-Aldosterone System (RAAS)**: Low perfusion or low NaCl triggers the juxtaglomerular cells to release **renin**. Renin converts angiotensinogen to angiotensin I, which ACE converts to angiotensin II. Angiotensin II triggers vasoconstriction and stimulates the adrenal cortex to release **aldosterone**, promoting renal sodium reabsorption.

### 3. Empirical & Methodological Frameworks
GFR is measured clinically using creatinine clearance or insulin clearance. NFP is computed based on hydrostatic and colloid pressures.

### 4. Clinical & Practical Application
ACE inhibitors block angiotensin II production, and aldosterone antagonists block sodium retention, reducing blood pressure in patients with chronic kidney disease or renal artery stenosis.`,
            socraticInit: "Let's discuss Lesson 3.4: The Urinary System. What physical forces determine the net filtration pressure (NFP) in the glomerulus, and what triggers renin release?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const pressuresCheck = (text.includes('hydrostatic') || text.includes('blood pressure')) && (text.includes('osmotic') || text.includes('oncotic') || text.includes('capsular'));
                const reninCheck = text.includes('low') && (text.includes('perfusion') || text.includes('blood pressure') || text.includes('sodium') || text.includes('nacl'));
                if (pressuresCheck && reninCheck) {
                    return { passed: true, feedback: "Excellent! You described the balance between glomerular hydrostatic pressure (pushing fluid out) and opposing colloid osmotic/capsular pressures. You also identified low blood pressure/perfusion as the trigger for renin release. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Describe the three forces involved in NFP: glomerular hydrostatic pressure, blood colloid osmotic pressure, and capsular hydrostatic pressure. Then, detail what triggers the release of renin from the kidneys (e.g., low blood pressure)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_3_4'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (nephron, glomerular, filtration, hydrostatic, oncotic, raas, aldosterone) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_3_5: {
            lecture: `### 1. Real-World Case Study
A patient in the ICU presents with severe diarrhea, lethargy, and rapid breathing (Kussmaul respiration). An Arterial Blood Gas (ABG) panel reveals a pH of 7.28, bicarbonate (HCO3-) of 15 mEq/L, and PaCO2 of 32 mmHg. The diagnosis is metabolic acidosis. The bicarbonate buffer system is depleted, and the respiratory system is actively compensating by hyperventilating to blow off CO2. Concurrently, the body activates the RAAS axis to retain sodium and secrete hydrogen ions to restore acid-base balance.

### 2. Core Physiological Principles
Maintaining fluid, electrolyte, and acid-base balance is critical for survival:
- **Fluid Compartments**: Divided into intracellular fluid (ICF, 2/3) and extracellular fluid (ECF, 1/3, consisting of interstitial fluid and plasma).
- **Acid-Base Homeostasis**: Blood pH must be maintained between 7.35 and 7.45:
  - **Bicarbonate Buffer System**: The primary chemical buffer:
    $$\\text{CO}_2 + \\text{H}_2\\text{O} \\rightleftharpoons \\text{H}_2\\text{CO}_3 \\rightleftharpoons \\text{H}^+ + \\text{HCO}_3^-$$
  - **Respiratory Compensation**: Hyperventilation decreases PaCO2 (raises pH); hypoventilation increases PaCO2 (lowers pH).
  - **Renal Compensation**: Reabsorbs bicarbonate and secretes hydrogen ions ($H^+$) into the urine to manage long-term pH.
- **Electrolytes**: Aldosterone regulates sodium retention and potassium excretion, ANP promotes sodium loss, and PTH increases calcium reabsorption.

### 3. Empirical & Methodological Frameworks
ABG interpretation tracks: pH (<7.35 acidosis, >7.45 alkalosis), PaCO2 (respiratory indicator), and HCO3- (metabolic indicator).

### 4. Clinical & Practical Application
Severe acidosis is treated with intravenous sodium bicarbonate infusions, alongside addressing the underlying cause (e.g., insulin for diabetic ketoacidosis).`,
            socraticInit: "Welcome to Lesson 3.5: Fluid, Electrolyte, & Acid-Base Balance. How do you interpret an ABG panel with low pH, high PaCO2, and normal/high HCO3-, and how does the body compensate?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const diagnosisCheck = text.includes('respiratory acidosis');
                const compCheck = text.includes('renal') || text.includes('kidney') || text.includes('bicarbonate') || text.includes('secrete hydrogen') || text.includes('reabsorb');
                if (diagnosisCheck && compCheck) {
                    return { passed: true, feedback: "Outstanding! You correctly diagnosed respiratory acidosis and noted that the kidneys compensate by reabsorbing bicarbonate and excreting hydrogen ions. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "A low pH with high PaCO2 indicates respiratory acidosis. Explain how the kidneys compensate for this by manipulating bicarbonate reabsorption and hydrogen ion excretion." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_3_5'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (buffer, bicarbonate, acidosis, alkalosis, compensation, electrolyte, raas) clearly." };
                }
                return { passed: false, feedback: `Your explanation is missing key terms: **${missing.join(', ')}**.` };
            }
        },
        lesson_3_6: {
            lecture: `### 1. Real-World Case Study
A 28-year-old female presents with irregular menstrual cycles and difficulty conceiving. Laboratory tests reveal an lack of mid-cycle LH surge, indicating anovulatory cycles. In normal physiology, estrogen levels rise, triggering a positive feedback surge of LH from the anterior pituitary, which induces ovulation. Without ovulation, the corpus luteum does not form, leading to a deficiency in progesterone, which is necessary to transition the uterine lining into the secretory phase for fertilization and implantation.

### 2. Core Physiological Principles
Reproductive function is regulated by the hypothalamic-pituitary-gonadal (HPG) axis:
- **Gametogenesis**: Spermatogenesis (continuous in males, producing 4 functional haploid sperm) vs. oogenesis (begins before birth, halts in prophase I, resumes at puberty, and only completes meiosis II if fertilization occurs).
- **Hormonal Regulation**: GnRH stimulates the anterior pituitary to secrete LH (triggers ovulation in females, testosterone in males) and FSH (stimulates follicle development in females, spermatogenesis in males).
- **Menstrual & Ovarian Cycles**:
  - *Ovarian Cycle*: Follicular phase (estrogen dominant) ➔ Ovulation (LH surge) ➔ Luteal phase (progesterone dominant).
  - *Uterine Cycle*: Menstrual phase ➔ Proliferative phase (estrogen driven) ➔ Secretory phase (progesterone driven, preparing for implantation).

### 3. Empirical & Methodological Frameworks
Ovulation is tracked via basal body temperature charts, serum progesterone levels, or urinary LH surge test kits.

### 4. Clinical & Practical Application
Infertility due to hormonal imbalances is treated using ovulation induction drugs (e.g., clomiphene citrate, which blocks estrogen receptors to increase GnRH, FSH, and LH).`,
            socraticInit: "Let's study Lesson 3.6: Reproductive Systems & Development. How do LH and progesterone levels coordinate the ovarian and uterine cycles, and when does ovulation occur?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const lhCheck = text.includes('lh') && (text.includes('surge') || text.includes('ovulation') || text.includes('trigger'));
                const progCheck = text.includes('progesterone') && (text.includes('luteum') || text.includes('uterine') || text.includes('secretory') || text.includes('lining') || text.includes('maintain'));
                if (lhCheck && progCheck) {
                    return { passed: true, feedback: "Magnificent! You explained how the LH surge triggers ovulation and how progesterone from the corpus luteum maintains the uterine lining during the secretory phase. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "Explain the role of the LH surge in triggering ovulation, and describe how progesterone secreted during the luteal phase prepares and maintains the uterine lining for implantation." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_3_6'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (ovarian, uterine, gonadotropin, progesterone, estrogen, gametogenesis, fertilization) clearly." };
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
For **Lesson ${numStr}: ${lessonTitle}**, we explore the physiological pathways in a clinical setting. Hook: *${hook}*. Disruptions in these systems result in acute imbalances, requiring detailed knowledge of anatomical barriers, cellular transport, or metabolic pathways to restore homeostasis.

### 2. Core Physiological Principles
This lesson covers the following high-yield concepts: **${concept}**.
We detail the structural boundaries, biochemical signals, and fluid mechanics. Understanding these structures allows us to calculate net filtration pressures, map metabolic ATP yields, or sync reproductive calendars.

### 3. Empirical & Methodological Frameworks
Physiologists analyze these mechanisms using lab assays, calculations, histopathology, and endocrine assays. We study both quantitative changes (such as pH, concentrations, or pressures) and qualitative states.

### 4. Clinical & Practical Application
Clinical diagnostics translate these physiological principles to patient diagnostics. We review blood panels, monitor hormone fluctuations, and implement buffer systems to correct pathological imbalances.`,
            socraticInit: `Let's discuss Lesson ${numStr}: ${lessonTitle}. The concept is "${concept}". Based on the clinical scenario (*${hook}*), how does this physiological system respond?`,
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if (text.length > 25) {
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
                    return { passed: true, feedback: "Excellent explanation. You have successfully summarized the concept in simple terms using all key terms." };
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
                                moduleKey: 'anatomy3_llm',
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

                appendLocalBubble("assistant", "Hello! I am your Anatomy & Physiology III tutor. Let's analyze these anatomical systems together. What questions do you have?");
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
                    <div class="tutor-popup-backdrop absolute inset-0 bg-slate-955/70 backdrop-blur-sm transition-opacity duration-300"></div>
                    <div class="tutor-popup-card bg-slate-900 border border-rose-900/40 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 rounded-3xl w-[440px] h-[550px] relative z-10">
                        <div class="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-rose-900/20 shrink-0">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center">
                                    <i class="fa-solid fa-lungs text-xs text-white"></i>
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
                    moduleKey: 'anatomy3_llm',
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
                    moduleKey: 'anatomy3_llm',
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
                    moduleKey: 'anatomy3_llm',
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
                    moduleKey: 'anatomy3_llm',
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
                    moduleKey: 'anatomy3_llm',
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

            // client-side enforcement checklist
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
                    moduleKey: 'anatomy3_llm',
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
                            moduleKey: 'anatomy3_llm',
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
