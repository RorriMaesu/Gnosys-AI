/**
 * BI 231Z - AI Tutor Router & Prompt Interface
 * Handles Socratic and Feynman evaluations with strict Key Term Checklists.
 */

window.AnatomyTutor = (() => {
    function getAnatomyModel() {
        if (typeof window.getActiveModel === 'function') {
            return window.getActiveModel('anatomy1_llm');
        }
        return localStorage.getItem('anatomy1_llm') || localStorage.getItem('syngnosia_tutor_model') || 'gemma';
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

    // KEY TERM CHECKLISTS FOR EVERY LESSON IN A&P I
    const KEY_TERM_CHECKLISTS = {
        lesson_1_1: ['homeostasis', 'feedback', 'negative', 'positive', 'sensor', 'effector', 'hyperthermia'],
        lesson_1_2: ['atom', 'ion', 'covalent', 'ionic', 'hydrogen bond', 'water', 'ph', 'buffer'],
        lesson_1_3: ['carbohydrate', 'lipid', 'protein', 'enzyme', 'activation energy', 'vmax', 'km', 'ph', 'buffer'],
        lesson_1_4: ['transport', 'passive', 'active', 'diffusion', 'atp', 'tonicity', 'desmosome', 'gap junction', 'mitosis', 'transcription', 'translation'],
        lesson_1_5: ['epithelial', 'connective', 'muscle', 'nervous', 'matrix', 'transitional', 'squamous', 'serous', 'holocrine'],
        lesson_1_6: ['epidermis', 'dermis', 'strata', 'wound', 'healing', 'nines', 'burn', 'abcde', 'melanocyte'],
        lesson_1_7: ['osteon', 'ossification', 'calcium', 'homeostasis', 'pth', 'calcitonin', 'osteoblast', 'osteoclast', 'fracture', 'remodeling'],
        lesson_1_8: ['axial', 'skull', 'vertebrae', 'sternum', 'ribs', 'foramen magnum', 'sella turcica'],
        lesson_1_9: ['appendicular', 'girdle', 'extremity', 'glenoid cavity', 'acetabulum', 'trochanter'],
        lesson_1_10: ['joint', 'synarthrosis', 'amphiarthrosis', 'diarthrosis', 'synovial', 'flexion', 'extension', 'abduction', 'adduction', 'rotation', 'pronation', 'supination'],
        lesson_1_11: ['sarcomere', 'neuromuscular', 'excitation', 'contraction', 'filaments', 'summation', 'tetanus', 'isometric', 'isotonic'],
        lesson_1_12: ['agonist', 'antagonist', 'synergist', 'fixator', 'lever', 'mechanical advantage', 'masseter', 'deltoid', 'gastrocnemius'],
        lesson_1_13: ['glia', 'astrocyte', 'oligodendrocyte', 'microglia', 'ependymal', 'schwann', 'myelin', 'dendrite', 'axon'],
        lesson_1_14: ['potential', 'threshold', 'depolarization', 'repolarization', 'channels', 'voltage', 'potassium', 'epsp', 'spatial summation', 'temporal summation']
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
            'STRICT_JSON_DIRECTIVE'
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

    // Comprehensive offline mock database for BI 231Z lessons
    const mockDatabase = {
        lesson_1_1: {
            lecture: `### 1. Real-World Case Study
A patient arrives at the emergency room displaying high core temperature (41°C), confusion, rapid breathing, and dry skin. The diagnosis is severe hyperthermia (heat stroke). Under normal conditions, negative feedback loops maintain core temperature at 37°C. However, extreme external conditions have overloaded the homeostatic feedback mechanism. As thermal stress exceeds the body's cooling limits, heat production spirals out of control, shifting from a negative to a positive feedback failure state, leading to cell breakdown and system malfunction.

### 2. Core Physiological Principles
Homeostasis is the maintenance of a stable internal environment despite external fluctuations:
- **Negative Feedback Loops**: The primary corrective action. Consists of a **Sensor** (thermoreceptors detecting shifts), a **Control Center** (hypothalamus analyzing coordinates), and an **Effector** (sweat glands secreting water, cutaneous vessels dilating to dump heat). The corrective action decreases the initial stimulus.
- **Positive Feedback Loops**: Actions that amplify shifts, pushing variables further from set-point (e.g. oxytocin contractions during labor, blood clotting cascade).
- **Feedback Failure States**: Occurs when negative mechanisms fail to arrest a deviation, leading to pathological conditions (e.g., hyperthermia organ damage, hypothermic cardiac failure).

### 3. Empirical & Methodological Frameworks
Physiologists map body compartments using cavities:
- **Dorsal Cavity**: Cranial (brain) and Spinal (vertebral column).
- **Ventral Cavity**: Thoracic (pleural, pericardial) and Abdominopelvic (subdivided into 4 quadrants and 9 regions).

### 4. Clinical & Practical Application
When diagnosing hyperthermia, clinical teams monitor vital parameters, administering chilled saline and cooling blankets to manually arrest the positive thermal drift, restoring physiological set-points.`,
            socraticInit: "Welcome to A&P I! Let's explore Lesson 1.1: Homeostasis. How does a negative feedback loop differ in function from a positive feedback loop?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if ((text.includes('neg') && (text.includes('oppose') || text.includes('reverse') || text.includes('reduce') || text.includes('correct'))) &&
                    (text.includes('pos') && (text.includes('amplify') || text.includes('increase') || text.includes('further') || text.includes('more')))) {
                    return { passed: true, feedback: "Excellent! You correctly identified that negative feedback loops oppose or reverse a stimulus to restore balance, whereas positive feedback loops amplify a change. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Contrast how negative feedback counteracts a deviation from the set point, while positive feedback accelerates or amplifies that deviation." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_1'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (homeostasis, feedback, negative/positive, sensor/effector, hyperthermia) to detail the system accurately." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_2: {
            lecture: `### 1. Real-World Case Study
A patient is admitted to the emergency clinic complaining of severe muscle cramps and hyperventilation after a period of intense anxiety. Arterial blood gas analysis indicates a blood pH of 7.55, which classifies as respiratory alkalosis. Under normal physiological conditions, the pH of blood is tightly regulated between 7.35 and 7.45. In alkalosis, the lower concentration of hydrogen ions (H+) disrupts weak hydrogen bonds within cells, causing structural distortions in proteins. The patient's symptoms are corrected by administering carbon dioxide breathing therapy, which drives the bicarbonate buffer system to produce carbonic acid, releasing free hydrogen ions to lower blood pH back to 7.4.

### 2. Core Physiological Principles
Biological structures are maintained by chemical interactions at the atomic level:
- **Atomic Structure**: Atoms consist of a nucleus containing protons (positive charge) and neutrons (neutral charge), surrounded by electrons (negative charge) in orbitals. Isotopes are variations of an element containing different numbers of neutrons.
- **Chemical Bonds**:
  - *Ionic Bonds*: Formed by the electrostatic attraction between oppositely charged ions (e.g., NaCl).
  - *Covalent Bonds*: Formed when atoms share electron pairs. Sharing can be equal (nonpolar covalent, e.g., O2) or unequal (polar covalent, e.g., H2O).
  - *Hydrogen Bonds*: Weak dipole attractions between a hydrogen atom bound to an electronegative atom (like oxygen in water) and another electronegative atom.
- **Properties of Water**: Due to polar covalent and hydrogen bonding, water exhibits high solvency, high heat capacity, cohesion, and density anomalies that are essential to support life.
- **pH and Buffers**: pH measures the hydrogen ion concentration. Chemical buffers, particularly the bicarbonate buffer system (CO2 + H2O <-> H2CO3 <-> HCO3- + H+), prevent rapid pH shifts by donating or absorbing H+.

### 3. Empirical & Methodological Frameworks
Physiologists measure fluid ions and pH using potentiometric glass electrodes. In the lab, buffer efficiency is mapped using titration curves, plotting pH response against increments of strong acids or bases.

### 4. Clinical & Practical Application
Clinical fluids must match physiological pH. Intravenous solutions are carefully buffered, and blood gas panels are monitored continuously in critical care units to detect metabolic/respiratory acid-base imbalances before cell injury occurs.`,
            socraticInit: "Welcome! Let's explore Lesson 1.2: General & Inorganic Chemistry. What is the difference between an ionic bond and a covalent bond, and how does the bicarbonate buffer system stabilize blood pH?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasBonds = (text.includes('ionic') && (text.includes('transfer') || text.includes('attract') || text.includes('electrostatic') || text.includes('give') || text.includes('take'))) &&
                                 (text.includes('covalent') && (text.includes('share') || text.includes('sharing')));
                const hasBuffer = (text.includes('buffer') || text.includes('ph') || text.includes('bicarbonate') || text.includes('hydrogen') || text.includes('h+'));
                if (hasBonds && hasBuffer) {
                    return { passed: true, feedback: "Splendid! You correctly identified that ionic bonds involve electron transfer and charge attraction, whereas covalent bonds involve electron sharing. You also accurately detailed how the bicarbonate buffer regulates pH. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to clearly state (1) how electrons behave in ionic vs covalent bonds, and (2) how the bicarbonate buffer system binds or releases hydrogen ions to stabilize pH." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_2'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (atom, ion, covalent, ionic, hydrogen bond, water, ph, buffer) to detail general chemistry and pH buffering processes accurately." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key chemical terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_3: {
            lecture: `### 1. Real-World Case Study
A patient is admitted to the intensive care unit in severe shock following diabetic ketoacidosis. Their arterial blood pH is 6.9, far below the normal physiological range of 7.35 to 7.45. This severe metabolic acidosis alters the charge distribution of weak hydrogen bonds within systemic proteins, leading to protein denaturation. Enzymes, which are highly specialized proteins, lose their three-dimensional conformation, halting metabolic pathways. This clinical emergency demonstrates the critical importance of pH homeostasis, chemical buffers, and enzyme kinetics.

### 2. Core Physiological Principles
The chemical level of organization supports cellular life:
- **Macromolecules**: Carbohydrates (energy source), lipids (membranes and hormones), proteins (structural and catalytic), and nucleic acids (genetic storage).
- **Enzyme Kinetics**: Enzymes speed up biochemical reactions by lowering activation energy. They bind substrates with high specificity. Kinetics are characterized by Vmax (maximal velocity) and Km (Michaelis constant, indicating substrate affinity).
- **pH and Buffers**: Chemical buffer systems (like the bicarbonate buffer system: CO2 + H2O <-> H2CO3 <-> HCO3- + H+) maintain pH by absorbing or releasing hydrogen ions.

### 3. Empirical & Methodological Frameworks
Biochemists measure enzyme reaction velocity at varying substrate concentrations to construct Michaelis-Menten plots, determining how factors like pH, temperature, and inhibitors affect Vmax and Km.

### 4. Clinical & Practical Application
Treatment of metabolic acidosis focuses on correcting the underlying cause while administering intravenous sodium bicarbonate (a buffer) if pH drops below 7.1, restoring enzyme function and cellular activity.`,
            socraticInit: "Welcome! Let's explore Lesson 1.3: Organic Biochemistry & Enzymes. How do enzymes affect a reaction's activation energy, and why does metabolic acidosis alter enzyme function?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasEnzyme = (text.includes('activation') && (text.includes('lower') || text.includes('decrease') || text.includes('speed') || text.includes('catalyz')));
                const hasAcidosis = (text.includes('acid') || text.includes('ph') || text.includes('denatur') || text.includes('shape') || text.includes('conformation') || text.includes('structure'));
                if (hasEnzyme && hasAcidosis) {
                    return { passed: true, feedback: "Excellent! You correctly identified that enzymes lower activation energy to speed up reactions, and that acidosis alters pH, which denatures enzymes by changing their three-dimensional shape. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to explain (1) how enzymes affect the activation energy barrier, and (2) how changes in pH during acidosis impact enzyme structure and function (denaturation)." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_3'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (carbohydrate, lipid, protein, enzyme, activation energy, vmax, km, ph, buffer) to detail biochemical processes accurately." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
                lesson_1_4: {
            lecture: `### 1. Real-World Case Study
A patient is mistakenly given an intravenous infusion of pure sterile water instead of normal saline (0.9% NaCl). Within minutes, the patient experiences severe hemolysis—the rupturing of red blood cells—leading to acute renal failure. This tragedy highlights the critical importance of tonicity. The sterile water creates a hypotonic environment, causing water to rush into the cells via osmosis until they burst. In patients with cystic fibrosis, a genetic mutation in the CFTR gene impairs active chloride transport across cell membranes. Without proper active transport, mucus in the lungs becomes thick and sticky, causing respiratory and digestive blockages.

### 2. Core Physiological Principles
Cells interact with their environment through specialized transport mechanisms, genetic replication, and cell-cell connection structures:
- **Passive Transport**: Movement of substances down a concentration gradient without energy expenditure (e.g., simple diffusion of gases, facilitated diffusion via glucose carriers, osmosis of water).
- **Active Transport**: Movement against a concentration gradient requiring cellular energy (ATP). Primary active transport directly uses ATP (e.g., Na+/K+ ATPase pump). Secondary active transport uses energy from ion gradients established by primary pumps.
- **Cellular Synthesis**: DNA transcription in the nucleus converts genetic code into messenger RNA (mRNA). Translation at the ribosome converts mRNA codons into amino acid polypeptides (proteins) using tRNA.
- **DNA Replication Mechanics**: Prior to division, DNA is replicated in the S phase. **Helicase** unwinds the double helix, and **DNA Polymerase** adds complementary nucleotides, building the leading strand continuously and the lagging strand discontinuously (Okazaki fragments).
- **Mitosis & Cell Cycle**: Replication proceeds from interphase (G1, S, G2) through mitosis (prophase, metaphase, anaphase, telophase) and cytokinesis. Cell cycle checkpoints (G1/S, G2/M, spindle checkpoints) ensure DNA integrity before division, preventing cancer.
- **Tonicity and Osmosis**: Solutions can be isotonic (no net water movement), hypertonic (cells crenate/shrink), or hypotonic (cells lyse/swell).
- **Cell Junctions**: Tight junctions prevent leakage (e.g., in intestines); desmosomes resist mechanical stress (e.g., in epidermis); gap junctions form communicative channels (e.g., in cardiac muscle).

### 3. Empirical & Methodological Frameworks
Cellular function is analyzed by studying membrane potentials and solute concentrations. In laboratory settings, spectrophotometers measure hemolysis rates in blood samples exposed to varying solute concentrations, demonstrating how tonicity shifts disrupt cellular membrane integrity.

### 4. Clinical & Practical Application
Clinical fluids are carefully balanced to maintain isotonicity. Normal saline (0.9% NaCl), Lactated Ringer's, and D5W (5% dextrose in water) are standard intravenous solutions engineered to protect blood cell structure and support homeostatic blood volume.`,
            socraticInit: "Welcome! Let's explore Lesson 1.4: Cell Membrane Transport & Cell Division. Why does infusing pure water intravenously cause red blood cells to lyse, and how do cell cycle checkpoints protect against uncontrolled cell division?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasTonicity = text.includes('hypo') || text.includes('burst') || text.includes('swell') || text.includes('osmosis') || text.includes('lyse') || text.includes('rupture');
                const hasCheckpoints = text.includes('checkpoint') || text.includes('arrest') || text.includes('regulate') || text.includes('dna') || text.includes('mutat') || text.includes('cancer');
                if (hasTonicity && hasCheckpoints) {
                    return { passed: true, feedback: "Superb! You correctly identified that pure water is hypotonic, causing cells to swell and burst due to osmosis. You also noted that cell cycle checkpoints regulate DNA integrity and division, protecting against cancer. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please ensure you explain both (1) the osmotic effect of a hypotonic solution on cells, and (2) how cell cycle checkpoints inspect DNA or regulate division to prevent cancer." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_4'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (transport, passive/active, diffusion, atp, tonicity, desmosome, gap junction, mitosis, transcription, translation) to detail cellular, transport, and cell division processes accurately." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
                lesson_1_5: {
            lecture: `### 1. Real-World Case Study
A pathologist examines a biopsy from a patient suspected of having transitional cell carcinoma of the urinary bladder. Under a digital microscope, they trace the margins of the tissue to distinguish it from surrounding stratified squamous epithelium. Transitional epithelium must stretch as the bladder fills, changing shape from plump, cuboidal-like cells to flattened, squamous-like cells. In another patient who suffered a myocardial infarction, damaged cardiac muscle cannot regenerate and is instead replaced by non-functional collagen scar tissue. This differences in tissue capacity to heal illustrates the physiological divide between regeneration and fibrosis.

### 2. Core Physiological Principles
Histology classifies the body's tissues, their barriers, secretion methods, and repair dynamics:
- **Four Primary Tissue Types**: Epithelial (covering/lining), Connective (support/binding), Muscle (contraction/movement), and Nervous (communication).
- **Body Membranes**: Serous membranes line closed cavities and reduce friction; mucous membranes line cavities open to the exterior; cutaneous membrane is the skin; synovial membranes line joint cavities.
- **Glandular Epithelium & Secretions**: Endocrine glands secrete hormones directly into the blood. Exocrine glands secrete into ducts via merocrine (exocytosis), apocrine (apical portion pinches off), or holocrine (cell ruptures to release product).
- **Tissue Repair & Aging**:
  - *Regeneration*: Damaged cells are replaced by the same type of cells, fully restoring function (e.g., in epithelial tissue, bone).
  - *Fibrosis*: Damaged cells are replaced by collagen fibers (scar tissue) deposited by fibroblasts, leading to loss of function (e.g., in cardiac muscle, brain).
  - *Tissue Aging*: Aging results in thinner epithelial layers, decreased collagen and elasticity in connective tissues, stiffening of membranes, and slower repair kinetics.

### 3. Empirical & Methodological Frameworks
Histologists use sectioning, staining (such as Hematoxylin and Eosin, or H&E), and microscopy to view the cellular structure of tissues. Identifying the cell shape (squamous, cuboidal, columnar) and arrangement (simple, stratified, pseudostratified) enables precise classification of normal vs. pathological tissue slices.

### 4. Clinical & Practical Application
Understanding secretion modes and tissue repair is vital. For example, acne vulgaris is a disease of the sebaceous glands, which utilize holocrine secretion. Blockage of these glands leads to sebum accumulation. Similarly, monitoring fibrosis in chronic liver disease (cirrhosis) or lung tissue (pulmonary fibrosis) helps track functional decline.`,
            socraticInit: "Welcome! Let's explore Lesson 1.5: Histology. How do serous membranes differ from mucous membranes, and what is the difference between tissue regeneration and fibrosis?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasMembranes = text.includes('serous') || text.includes('mucous') || text.includes('lubricat') || text.includes('friction') || text.includes('exterior') || text.includes('cavity');
                const hasRepair = text.includes('regeneration') && text.includes('fibrosis') && (text.includes('same') || text.includes('scar') || text.includes('collagen') || text.includes('function'));
                if (hasMembranes && hasRepair) {
                    return { passed: true, feedback: "Fantastic! You correctly contrasted serous and mucous membranes, and explained tissue repair (regeneration restores same cells/function, fibrosis deposits collagen scar/loses function). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to discuss both (1) how serous membranes line closed cavities and reduce friction while mucous membranes line cavities open to the exterior, and (2) how tissue regeneration differs from fibrosis in cell replacement and functional outcomes." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_5'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (epithelial, connective, muscle, nervous, matrix, transitional, squamous, serous, holocrine) to describe tissues, membranes, and secretions accurately." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_6: {
            lecture: `### 1. Real-World Case Study
A patient is rushed to the emergency department after sustaining second- and third-degree burns across their entire anterior torso and both anterior arms. The clinical team immediately initiates intravenous fluid resuscitation. To calculate the rate of fluid delivery, they apply the Rule of Nines. This severe burn destroys the epidermis and parts of the dermis, abolishing the skin's water barrier and exposing the patient to dehydration and infection. Understanding the stages of deep wound healing is crucial to managing the patient's recovery.

### 2. Core Physiological Principles
The integumentary system serves as the primary barrier and regulates body environment:
- **Epidermis Layers**: Strata include basale (mitotic), spinosum (spiny/strength), granulosum (keratinization), lucidum (thick skin only), and corneum (dead protective layer). Cells include keratinocytes, melanocytes (pigment), Langerhans (immune), and Merkel (touch).
- **Dermis Layers**: Papillary layer (areolar tissue, dermal papillae) and reticular layer (dense irregular connective tissue).
- **Deep Wound Healing**: Follows four chronological phases:
  1. *Hemostasis*: Blood vessels constrict, and platelets form a clot.
  2. *Inflammatory*: Vasodilation allows white blood cells (neutrophils, macrophages) to clear debris and pathogens.
  3. *Proliferative*: Fibroblasts deposit collagen, and angiogenesis restores blood supply, creating granulation tissue.
  4. *Remodeling*: Collagen fibers reorganize to increase tensile strength, forming a scar.
- **Burn Assessment**: The Rule of Nines estimates surface area involved (anterior torso = 18%, each anterior arm = 4.5%).

### 3. Empirical & Methodological Frameworks
Clinicians use the ABCDE criteria (Asymmetry, Border irregularity, Color variation, Diameter > 6mm, Evolving shape) to differentiate benign melanocytic nevi from malignant melanomas.

### 4. Clinical & Practical Application
Severe burns require immediate thermal barrier restoration. Because skin prevents insensible fluid loss, fluid replacement formulas (e.g., Parkland formula) are vital to prevent hypovolemic shock in burn patients.`,
            socraticInit: "Welcome! Let's discuss Lesson 1.6: The Integumentary System. How does deep wound healing progress through its physiological stages, and how are the Rule of Nines and ABCDE criteria used clinically?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasHealing = text.includes('hemostasis') || text.includes('inflam') || text.includes('prolifer') || text.includes('remodel') || text.includes('fibroblast') || text.includes('clot');
                const hasClinical = text.includes('nine') || text.includes('abcde') || text.includes('burn') || text.includes('cancer') || text.includes('mole');
                if (hasHealing && hasClinical) {
                    return { passed: true, feedback: "Outstanding! You correctly identified the stages of deep wound healing (hemostasis, inflammation, proliferation, remodeling) and explained how the Rule of Nines (burn surface area estimation) or ABCDE criteria (melanoma tracking) are applied. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to discuss (1) the key physiological stages of deep wound healing, and (2) how clinicians apply either the Rule of Nines or the ABCDE criteria." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_6'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (epidermis, dermis, strata, wound, healing, nines, burn, abcde, melanocyte) to detail integumentary structure and healing process." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_7: {
            lecture: `### 1. Real-World Case Study
A 72-year-old postmenopausal female presents to the clinic after a minor fall, complaining of severe right wrist pain. An X-ray reveals a comminuted fracture of the distal radius, along with systemic osteoporotic bone loss. In osteopenic bone, bone remodeling kinetics are severely imbalanced: osteoclasts resorb bone tissue faster than osteoblasts can form new bone matrix. This case demonstrates the critical role of hormonal regulation in skeletal homeostasis and the complex repair process required to heal a fractured bone.

### 2. Core Physiological Principles
Skeletal tissue provides structural support, joint mobility, and calcium storage regulated by endocrine feedback loops:
- **Bone Histology**: Compact bone is composed of osteons (Haversian systems) with concentric lamellae, osteocytes within lacunae, and a central canal. Spongy bone contains trabeculae arranged along lines of stress.
- **Hormonal Regulation of Calcium**:
  - *Parathyroid Hormone (PTH)*: Released when Ca2+ levels drop; stimulates osteoclasts to resorb bone, increases renal reabsorption, and promotes calcitriol synthesis.
  - *Calcitonin*: Released when Ca2+ levels rise; inhibits osteoclasts and stimulates calcium deposition into bone matrix.
- **Bone Fracture Classifications**: Simple (Closed), Compound (Open), Comminuted (splintered/fragmented), Greenstick (incomplete bend).
- **Stages of Bone Fracture Repair**:
  1. *Hematoma Formation*: A blood clot forms at the fracture site within hours, cutting off blood supply.
  2. *Fibrocartilaginous (Soft) Callus Formation*: Collagen fibers and cartilage bridge the bone gap.
  3. *Bony (Hard) Callus Formation*: Osteoblasts convert cartilage into spongy bone.
  4. *Bone Remodeling*: Osteoblasts and osteoclasts reshape bone to original geometry.

### 3. Empirical & Methodological Frameworks
Radiographic imaging (X-rays) is the primary clinical diagnostic tool used to identify fracture type and monitor calluses during the healing stages. Dual-energy X-ray absorptiometry (DEXA) scans measure bone mineral density to diagnose osteopenia/osteoporosis.

### 4. Clinical & Practical Application
Treatment of osteoporosis involves bisphosphonates to inhibit osteoclast activity, hormone replacement therapy, and calcium/Vitamin D supplements to support bone deposition, preventing future fragility fractures.`,
            socraticInit: "Welcome! Let's explore Lesson 1.7: Bone Physiology & Calcium Regulation. How do calcitonin and PTH regulate calcium homeostasis, and what are the four physiological stages of bone fracture repair?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasCalcium = (text.includes('pth') || text.includes('parathyroid')) && (text.includes('calcitonin') || text.includes('thyroid')) && (text.includes('calcium') || text.includes('resorb') || text.includes('osteoclast') || text.includes('osteoblast'));
                const hasRepair = text.includes('hematoma') && (text.includes('callus') || text.includes('fibrocartilage')) && text.includes('remodel');
                if (hasCalcium && hasRepair) {
                    return { passed: true, feedback: "Excellent! You accurately explained how PTH increases blood calcium by stimulating osteoclasts, while calcitonin decreases it. You also correctly outlined the chronological stages of fracture repair (hematoma, fibrocartilaginous callus, bony callus, remodeling). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Make sure to clearly state how PTH and calcitonin act on osteoclasts/osteoblasts to control calcium levels, and list all four steps of bone fracture repair in their correct chronological order." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_7'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (osteon, ossification, calcium, homeostasis, pth, calcitonin, osteoblast, osteoclast, fracture, remodeling) to detail skeletal structure and physiology." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_8: {
            lecture: `### 1. Real-World Case Study
A patient arrives in the ER after sustaining severe facial trauma in a car accident. An MRI scan reveals a fracture of the sphenoid bone, specifically involving the sella turcica. The clinical team monitors the patient closely because the pituitary gland rests inside this bony saddle. Additionally, a minor fracture of the nearby ethmoid bone's cribriform plate has damaged olfactory nerve fibers, leading to olfactory dysfunction (anosmia) and raising the risk of a cerebrospinal fluid (CSF) leak into the nasal cavity.

### 2. Core Physiological Principles
The axial skeleton forms the vertical axis of the body, protecting the central nervous system and organs of the head and thorax:
- **The Skull**: Divided into cranial bones (frontal, parietal, temporal, occipital, sphenoid, ethmoid) which enclose the brain, and facial bones (maxilla, mandible, zygomatic, nasal, lacrimal, palatine, vomer).
- **Key Cranial Landmarks**:
  - *Foramen Magnum*: The large opening at the base of the occipital bone allowing the spinal cord to connect to the brain stem.
  - *Sella Turcica*: A saddle-like depression in the sphenoid bone housing the pituitary gland.
  - *Mandibular Fossa*: Articulates with the mandible to form the temporomandibular joint (TMJ).
- **Vertebral Column**: Composed of 26 bones in five regions (Cervical: C1-C7, Thoracic: T1-T12, Lumbar: L1-L5, Sacrum, Coccyx). Four curvatures (cervical and lumbar lordosis, thoracic and sacral kyphosis) absorb mechanical shock.
- **Thoracic Cage**: Formed by the sternum, ribs (12 pairs: ribs 1-7 are true ribs, 8-10 are false ribs, 11-12 are floating ribs), and thoracic vertebrae, protecting the heart and lungs.

### 3. Empirical & Methodological Frameworks
Anatomists examine the sutures of the skull (coronal, sagittal, squamous, lambdoid) to estimate the age of skeletal remains. Clinicians use CT scans and X-rays to locate specific bone markings when planning neurosurgical entry routes.

### 4. Clinical & Practical Application
Fractures of the cribriform plate must be treated as medical emergencies. CSF leakage is confirmed by checking fluid for glucose or beta-2 transferrin, and surgical repairs are made to seal the dural barrier, preventing ascending meningitis.`,
            socraticInit: "Welcome! Let's explore Lesson 1.8: Axial Skeleton Landmarks. What are the key cranial bones of the skull, and what is the functional significance of the sella turcica and foramen magnum?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasCranium = text.includes('sphenoid') || text.includes('ethmoid') || text.includes('occipital') || text.includes('frontal') || text.includes('temporal') || text.includes('parietal');
                const hasMarkings = text.includes('sella turcica') || text.includes('foramen magnum') || text.includes('pituitary') || text.includes('spinal cord') || text.includes('opening');
                if (hasCranium && hasMarkings) {
                    return { passed: true, feedback: "Splendid! You correctly identified cranial bones and detailed the functional significance of the sella turcica (pituitary saddle) and foramen magnum (spinal cord passage). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please expand on (1) which cranial bones form the braincase, and (2) what organs or pathways travel through the sella turcica and the foramen magnum." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_8'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (axial, skull, vertebrae, sternum, ribs, foramen magnum, sella turcica) to describe the axial skeleton landmarks." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_9: {
            lecture: `### 1. Real-World Case Study
A collegiate gymnast lands awkwardly from a vault, sustaining a shoulder dislocation (glenohumeral joint). In the emergency clinic, an X-ray shows the humeral head has been displaced anteriorly from the scapula's glenoid cavity. In contrast, a pelvic dislocation (hip subluxation) is exceptionally rare and usually requires high-energy impacts like motor vehicle collisions. This difference illustrates the architectural design of the appendicular skeleton: the shoulder girdle trades structural stability for maximum range of motion, whereas the pelvic girdle is fused and deeply pocketed to bear weight and ensure stability.

### 2. Core Physiological Principles
The appendicular skeleton facilitates locomotion and object manipulation, consisting of the limb bones and the girdles that anchor them:
- **Pectoral Girdle**: Formed by the clavicle (collarbone) and scapula (shoulder blade). The glenoid cavity is shallow, providing minimal structural constraint but allowing extreme mobility.
- **Upper Extremity**: Composed of the humerus (arm), radius and ulna (forearm), carpals (wrist), metacarpals (palm), and phalanges (fingers).
- **Pelvic Girdle**: Formed by two coxal (hip) bones, which join anteriorly at the pubic symphysis and posteriorly with the sacrum. Each coxal bone is composed of three fused bones: ilium, ischium, and pubis.
- **Key Markings**:
  - *Acetabulum*: The deep lateral socket on the coxal bone that houses the head of the femur, creating a highly stable ball-and-socket joint.
  - *Greater & Lesser Trochanters*: Massive projections on the proximal femur for powerful hip muscle insertions.
- **Lower Extremity**: Composed of the femur (thigh), patella (kneecap), tibia and fibula (leg), tarsals (ankle), metatarsals (arch), and phalanges (toes).

### 3. Empirical & Methodological Frameworks
Radiologists check bone markings to diagnose dislocations and fractures. For example, measuring the angle of the pelvic inlet helps forensic anthropologists determine skeletal biological sex.

### 4. Clinical & Practical Application
Neer classification and other diagnostic algorithms utilize appendicular landmarks (like the greater tuberosity of the humerus) to determine if a fracture requires closed reduction, casting, or open-surgical internal fixation (ORIF).`,
            socraticInit: "Welcome! Let's explore Lesson 1.9: Appendicular Skeleton Landmarks. How does the anatomy of the scapular glenoid cavity compare with the pelvic acetabulum, and how does this affect joint function?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasMarkings = text.includes('glenoid') && text.includes('acetabulum');
                const hasComparison = text.includes('shallow') || text.includes('deep') || text.includes('stability') || text.includes('mobility') || text.includes('range of motion') || text.includes('weight');
                if (hasMarkings && hasComparison) {
                    return { passed: true, feedback: "Excellent! You correctly compared the shallow glenoid cavity (maximizing shoulder mobility) to the deep acetabulum (maximizing pelvic stability for weight-bearing). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to discuss (1) the structural differences between the glenoid cavity and the acetabulum, and (2) how this structural difference leads to a trade-off between joint mobility and stability." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_9'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (appendicular, girdle, extremity, glenoid cavity, acetabulum, trochanter) to describe appendicular landmarks." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_10: {
            lecture: `### 1. Real-World Case Study
A patient presents with knee instability and pain following a twisting sports injury. An MRI confirms a complete tear of the anterior cruciate ligament (ACL). The knee is a complex synovial joint that relies heavily on internal ligaments (ACL, PCL) and external cartilage (menisci) for guidance and support. Without the ACL to prevent the tibia from sliding anteriorly beneath the femur, the joint displays abnormal translation movements. Over time, this mechanical instability accelerates the wear of articular cartilage, leading to post-traumatic osteoarthritis.

### 2. Core Physiological Principles
Joints (articulations) link bones and determine mobility:
- **Structural Classification**:
  - *Fibrous Joints*: Connected by dense connective tissue; no joint cavity (e.g., cranial sutures, syndesmoses).
  - *Cartilaginous Joints*: Connected by hyaline cartilage or fibrocartilage (e.g., epiphyseal plates, pubic symphysis).
  - *Synovial Joints*: Possess a fluid-filled joint cavity, lined by a synovial membrane, allowing free movement (diarthroses).
- **Functional Classification**:
  - *Synarthrosis*: Immovable joint (protects organs).
  - *Amphiarthrosis*: Slightly movable joint (balances strength and movement).
  - *Diarthrosis*: Freely movable joint (limbs).
- **Synovial Joint Movements**:
  - *Angular*: Flexion (decreases angle), Extension (increases angle), Abduction (moves away from midline), Adduction (moves toward midline).
  - *Circular*: Rotation (turning bone around axis), Circumduction (cone-shaped movement).
  - *Special*: Pronation/Supination (forearm rotation), Inversion/Eversion (foot tilt), Dorsiflexion/Plantar flexion (ankle movements).

### 3. Empirical & Methodological Frameworks
Physical therapists measure joint range of motion (ROM) using goniometers. Comparing passive and active ROM values allows clinicians to identify mechanical blockages, muscle weakness, or ligamentous laxity.

### 4. Clinical & Practical Application
Treatment of ACL tears in active individuals involves surgical reconstruction using a tissue graft. Post-surgical rehabilitation focuses on strengthening surrounding muscles (like the hamstrings and quadriceps) to act as dynamic stabilizers, preserving synovial joint kinematics.`,
            socraticInit: "Welcome! Let's discuss Lesson 1.10: Joints & Articulations. How do structural joint classifications relate to functional mobility, and what anatomical features distinguish a synovial joint?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasJointClass = (text.includes('fibrous') || text.includes('cartilaginous') || text.includes('synovial')) && (text.includes('synarthrosis') || text.includes('amphiarthrosis') || text.includes('diarthrosis'));
                const hasSynovialFeatures = text.includes('cavity') || text.includes('synovial fluid') || text.includes('capsule') || text.includes('cartilage') || text.includes('ligament');
                if (hasJointClass && hasSynovialFeatures) {
                    return { passed: true, feedback: "Superb! You correctly connected structural classifications (fibrous, cartilaginous, synovial) to their functional mobility, and identified the key characteristics of synovial joints (fluid, cavity, capsule). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to discuss (1) how fibrous, cartilaginous, and synovial joints align with synarthroses, amphiarthroses, and diarthroses, and (2) what structures (like a cavity, capsule, and fluid) are unique to synovial joints." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_10'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (joint, synarthrosis, amphiarthrosis, diarthrosis, synovial, flexion, extension, abduction, adduction, rotation, pronation, supination) to detail joint structure and kinematics." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
                lesson_1_11: {
            lecture: `### 1. Real-World Case Study
A patient is admitted with symptoms of localized muscle rigidity and spasms, diagnosed with tetanus infection. The tetanus toxin blocks inhibitory neurotransmitters, causing continuous motor neuron firing, which leads to spastic paralysis (lockjaw) where the muscle remains in complete tetanic contraction. In contrast, cosmetic Botox injections block acetylcholine release at the neuromuscular junction, preventing excitation-contraction coupling and causing flaccid paralysis. This contrast highlights the balance of electrical excitation, calcium release, and sarcomere cross-bridge cycling required for controlled muscle movement.

### 2. Core Physiological Principles
Muscle tissue contraction is governed by cellular organization, electrical stimulation, and metabolic recruitment:
- **Muscle Tissue Types**:
  - *Skeletal Muscle*: Striated, parallel, multinucleated fibers under voluntary control.
  - *Cardiac Muscle*: Striated, branched, uninucleated cells joined by **intercalated discs** (containing gap junctions/desmosomes) under involuntary control.
  - *Smooth Muscle*: Non-striated, spindle-shaped, uninucleated cells under involuntary control.
- **Sarcomere & NMJ**: The sarcomere is the functional unit of contraction (actin thin filaments, myosin thick filaments, troponin, tropomyosin, Z-discs, A/I bands). Acetylcholine (ACh) releases at the NMJ, depolarizing the sarcolemma.
- **Excitation-Contraction Coupling**: Action potentials travel down T-tubules, triggering Ca2+ release from the sarcoplasmic reticulum. Ca2+ binds to troponin, moving tropomyosin to expose myosin-binding sites on actin.
- **Cross-Bridge Cycle**:
  1. Myosin head binds actin (cross-bridge).
  2. Power stroke pulls actin, releasing ADP and Pi.
  3. ATP binds myosin, releasing the cross-bridge.
  4. ATP hydrolysis recocks the myosin head.
- **Muscle Metabolism & Fiber Types**:
  - *Creatine Phosphate*: Immediate ATP source (15 seconds).
  - *Anaerobic Glycolysis*: Lactic acid pathway (1-2 minutes).
  - *Aerobic Respiration*: Mitochondria pathway (long-term).
  - *Fiber Types*: **Slow Oxidative (SO / Type I)** fibers are fatigue-resistant, rich in mitochondria/myoglobin (posture); **Fast Glycolytic (FG / Type IIb)** fibers are fast-contracting, anaerobic, easily fatigued (sprinting).
- **Twitch Mechanics & Summation**: A single twitch has latent, contraction, and relaxation phases. Repeated stimuli trigger **wave summation** and **tetanus** (sustained contraction). Contractions can be isotonic (concentric/eccentric) or isometric.

### 3. Empirical & Methodological Frameworks
Physiologists record muscle electrical activity using electromyography (EMG). In labs, investigators apply isolated electrical stimulations to muscle tissue preparations to graph load-velocity relationships and motor unit recruitment thresholds.

### 4. Clinical & Practical Application
In conditions like muscular dystrophy, the lack of dystrophin causes sarcolemma tears during contraction, leading to fiber death. Physical therapy exercises are custom-tailored to target specific fiber types (e.g., low-weight endurance for SO fibers, high-intensity resistance for FG fibers), maximizing physical conditioning.`,
            socraticInit: "Welcome! Let's explore Lesson 1.11: Muscle Contraction Physiology & Metabolism. Explain how calcium coordinates cross-bridge cycling, and contrast slow oxidative (Type I) versus fast glycolytic (Type IIb) muscle fibers.",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasCalcium = text.includes('calcium') && (text.includes('troponin') || text.includes('tropomyosin') || text.includes('bind') || text.includes('expose') || text.includes('myosin'));
                const hasFibers = (text.includes('slow') || text.includes('type i') || text.includes('oxidative') || text.includes('mitochondria') || text.includes('endur')) &&
                                  (text.includes('fast') || text.includes('type ii') || text.includes('glycolytic') || text.includes('anaerob') || text.includes('fatig'));
                if (hasCalcium && hasFibers) {
                    return { passed: true, feedback: "Excellent! You explained that calcium binds troponin, shifting tropomyosin to expose myosin active sites. You also correctly contrasted slow oxidative (mitochondrial, fatigue-resistant) and fast glycolytic (anaerobic, fast-fatiguing) fibers. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to detail (1) the role of calcium in troponin/tropomyosin shifting, and (2) the metabolic differences between slow oxidative and fast glycolytic muscle fibers." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_11'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (sarcomere, neuromuscular, excitation, contraction, filaments, summation, tetanus, isometric, isotonic) to detail muscle contraction and metabolism." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
                lesson_1_12: {
            lecture: `### 1. Real-World Case Study
A patient presents to a physical medicine clinic complaining of chronic jaw pain and difficulty chewing. Diagnostic testing reveals severe spasm of the masseter and temporalis muscles. In this leverage system, the jaw operates as a third-class lever, where the effort (muscle contraction) is located between the fulcrum (temporomandibular joint) and the load (food in the teeth). Understanding the naming rules of muscles (e.g., masseter means "chewer", biceps means "two heads") and their relative roles (e.g., temporalis is a synergist to the masseter) is vital for targeting therapies like myofascial release or botulinum toxin injections.

### 2. Core Physiological Principles
Skeletal muscles generate movement by leveraging bone structures and coordinating in functional groups:
- **Muscle Actions & Relationships**:
  - *Agonist (Prime Mover)*: The primary muscle responsible for a specific movement (e.g., biceps brachii in elbow flexion).
  - *Antagonist*: Opposes or reverses the agonist's movement (e.g., triceps brachii).
  - *Synergist*: Assists the agonist by adding force or stabilizing joints (e.g., brachialis).
  - *Fixator*: Stabilizes the bone of origin of the agonist (e.g., rotator cuff muscles).
- **Naming Nomenclature Rules**: Skeletal muscle names are descriptive and follow key guidelines:
  1. *Location*: e.g., temporalis (temporal bone), femoris (femur).
  2. *Shape*: e.g., deltoid (triangular), trapezius (trapezoid).
  3. *Size*: e.g., maximus (largest), minimus (smallest), longus (long), brevis (short).
  4. *Fibers Direction*: e.g., rectus (straight, parallel to midline), transversus (perpendicular), oblique (angled).
  5. *Origins Number*: e.g., biceps (2 heads), triceps (3 heads), quadriceps (4 heads).
  6. *Origin & Insertion*: e.g., sternocleidomastoid (sternum/clavicle origin, mastoid insertion).
  7. *Action*: e.g., flexor, extensor, adductor, masseter (chewer).
- **Lever Systems**:
  - *1st Class*: Fulcrum in middle (Effort - Fulcrum - Load). E.g., head nodding at atlanto-occipital joint.
  - *2nd Class*: Load in middle (Fulcrum - Load - Effort). High mechanical advantage. E.g., standing on tiptoes (calf lift).
  - *3rd Class*: Effort in middle (Fulcrum - Effort - Load). High speed/range of motion, mechanical disadvantage. E.g., biceps curl.

### 3. Empirical & Methodological Frameworks
Kinesiologists study muscle lever mechanics using mechanical force sensors and vector geometry. Measuring joint angles and torque outputs allows clinicians to quantify mechanical advantage and isolate muscle group deficiencies.

### 4. Clinical & Practical Application
Physical therapists apply biomechanics to muscle injuries. For example, during hamstring strains, rehabilitation focuses on training the hamstring (agonist in knee flexion, antagonist in extension) and gluteals (synergists in hip extension) using eccentric loading, ensuring proper joint stability and leverage load distribution.`,
            socraticInit: "Welcome! Let's explore Lesson 1.12: Gross Muscular Anatomy & Lever Systems. How do agonists and antagonists coordinate movement, and how does a 2nd class lever differ from a 3rd class lever in anatomical position and mechanical advantage?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasCoord = (text.includes('agonist') && (text.includes('prime') || text.includes('primary') || text.includes('cause') || text.includes('move'))) &&
                                 (text.includes('antagonist') && (text.includes('oppose') || text.includes('reverse') || text.includes('stretch') || text.includes('relax')));
                const hasLevers = (text.includes('2nd') || text.includes('second')) && (text.includes('3rd') || text.includes('third')) &&
                                  (text.includes('load') || text.includes('effort') || text.includes('advantage') || text.includes('disadvantage') || text.includes('middle'));
                if (hasCoord && hasLevers) {
                    return { passed: true, feedback: "Splendid! You correctly explained that agonists are the prime movers while antagonists oppose their action. You also accurately contrasted 2nd class levers (load in middle, mechanical advantage) and 3rd class levers (effort in middle, mechanical disadvantage). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to discuss (1) how agonists and antagonists coordinate (e.g. contracting vs. relaxing/opposing), and (2) how the load, effort, and mechanical advantages differ between 2nd class and 3rd class levers." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_12'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (agonist, antagonist, synergist, fixator, lever, mechanical advantage, masseter, deltoid, gastrocnemius) to detail gross muscles and lever systems." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_13: {
            lecture: `### 1. Real-World Case Study
A 28-year-old female presents with episodic double vision, weakness in her right leg, and paresthesias. A lumbar puncture shows oligoclonal bands in the CSF, and an MRI reveals scattered demyelinating lesions in her cerebral white matter. She is diagnosed with Multiple Sclerosis (MS). In patients with MS, the immune system mistakenly targets and destroys oligodendrocytes, the glial cells responsible for myelinating CNS axons. Without myelin, action potential conduction slows or fails, causing progressive neurological deficits.

### 2. Core Physiological Principles
The nervous system regulates homeostatic balance through neural circuits and glial support:
- **General Organization**:
  - *Central Nervous System (CNS)*: Brain and spinal cord; processes information.
  - *Peripheral Nervous System (PNS)*: Cranial and spinal nerves; connects CNS to body. Afferent (sensory) division carries signals to CNS, and Efferent (motor) division carries signals to effectors.
  - *Efferent Subdivisions*: Somatic nervous system (voluntary; skeletal muscles) and Autonomic nervous system (involuntary; smooth/cardiac muscle, glands).
- **Neuron Anatomy**: Dendrites (receive signals), soma (cell body; integrates signals), axon (conducts signals), axon hillock (initiates action potentials), myelin sheath (insulates axon), nodes of Ranvier (gaps in myelin allowing saltatory conduction).
- **Glial Cells (Support Cells)**:
  - *CNS Glia*: **Astrocytes** (form blood-brain barrier, regulate ions), **Oligodendrocytes** (form myelin sheath), **Microglia** (phagocytic immune cells), **Ependymal cells** (produce and circulate CSF).
  - *PNS Glia*: **Schwann cells** (form myelin sheath around a single axon segment), **Satellite cells** (regulate cell body microenvironment).

### 3. Empirical & Methodological Frameworks
Neurobiologists study neural cells using immunohistochemical staining and electron microscopy. Staining for myelin basic protein (MBP) allows researchers to quantify the density of myelinated fibers and identify demyelinated areas in pathological tissue slices.

### 4. Clinical & Practical Application
Pharmacotherapy for demyelinating disorders focuses on disease-modifying therapies (DMTs) like interferon-beta to suppress autoimmune activity, protecting oligodendrocytes from inflammatory destruction and conserving myelin.`,
            socraticInit: "Welcome! Let's explore Lesson 1.13: Nervous Tissue and Glial Cells. What are the divisions of the nervous system, and what are the specific locations and functions of oligodendrocytes versus Schwann cells?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasDivisions = text.includes('cns') || text.includes('pns') || text.includes('central') || text.includes('peripheral');
                const hasGlia = (text.includes('oligodendrocyte') && text.includes('cns')) && (text.includes('schwann') && text.includes('pns')) && text.includes('myelin');
                if (hasDivisions && hasGlia) {
                    return { passed: true, feedback: "Excellent! You correctly outlined the CNS and PNS divisions and contrasted oligodendrocytes (myelin in CNS) with Schwann cells (myelin in PNS). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please make sure to discuss (1) the basic structural/functional divisions of the nervous system, and (2) how oligodendrocytes and Schwann cells differ in their locations and myelination patterns." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_13'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (glia, astrocyte, oligodendrocyte, microglia, ependymal, schwann, myelin, dendrite, axon) to describe nervous tissue and neuroglia." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        },
        lesson_1_14: {
            lecture: `### 1. Real-World Case Study
A patient presents to the emergency room with severe muscle weakness, numbness, and cardiac dysrhythmias. Blood tests reveal acute hyperkalemia—elevated extracellular potassium levels. Hyperkalemia disrupts the resting membrane potential of excitable tissues. Because the concentration gradient for K+ is reduced, less potassium exits the cell, shifting the membrane potential closer to threshold (depolarization). Initially, this makes cells more excitable, but it quickly inactivates voltage-gated Na+ channels, blocking further action potential propagation. If untreated, it can stop the heart, demonstrating how ionic gradients and postsynaptic integrations maintain vital functions.

### 2. Core Physiological Principles
Neurons communicate via electrical signals governed by ion channels and local integrations at the cell body:
- **Action Potential Biophysics**: Initiated at the axon hillock when local depolarization reaches threshold (-55 mV).
  - *Depolarization*: Voltage-gated Na+ channels open rapidly, allowing Na+ influx.
  - *Repolarization*: Na+ channels inactivate, and voltage-gated K+ channels open, allowing K+ efflux.
  - *Hyperpolarization*: K+ channels close slowly, pushing membrane potential below rest before sodium-potassium pumps restore balance.
- **Postsynaptic Potentials**:
  - *Excitatory Postsynaptic Potential (EPSP)*: A local depolarization caused by neurotransmitter binding to ligand-gated Na+/K+ channels.
  - *Inhibitory Postsynaptic Potential (IPSP)*: A local hyperpolarization caused by neurotransmitter opening ligand-gated Cl- or K+ channels.
- **Summation at the Axon Hillock**:
  - *Temporal Summation*: A single presynaptic neuron firing repeatedly in rapid succession, releasing neurotransmitter to summate potentials over time.
  - *Spatial Summation*: Multiple different presynaptic neurons firing simultaneously at different synapses on the same postsynaptic neuron, summing their potentials over space.

### 3. Empirical & Methodological Frameworks
Neurophysiologists record membrane potentials using glass microelectrodes and voltage-clamp rigs. These instruments measure ionic currents across the axonal membrane, allowing researchers to calculate exact conductance rates and trace action potential graphs.

### 4. Clinical & Practical Application
Understanding summation is vital for understanding pharmacological interventions. Many anesthetics and sedatives enhance inhibitory postsynaptic potentials (such as GABAA receptor agonists like propofol), pushing the postsynaptic neuron far below threshold and blocking the summation required to propagate pain signals.`,
            socraticInit: "Welcome! Let's explore Lesson 1.14: Excitable Membranes & Action Potentials. How do graded potentials like EPSPs and IPSPs differ from action potentials, and what is the difference between temporal and spatial summation?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                const hasPotentials = (text.includes('epsp') || text.includes('ipsp') || text.includes('graded')) && (text.includes('action potential') || text.includes('threshold') || text.includes('all-or-none'));
                const hasSummation = text.includes('temporal') && text.includes('spatial') && (text.includes('time') || text.includes('space') || text.includes('single') || text.includes('multiple'));
                if (hasPotentials && hasSummation) {
                    return { passed: true, feedback: "Excellent! You correctly distinguished graded potentials (decremental, local EPSPs/IPSPs) from action potentials (all-or-none, propagated). You also explained that temporal summation is over time (one neuron firing repeatedly) while spatial summation is over space (multiple neurons firing at once). CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right track. Please expand on (1) how EPSPs/IPSPs are local, graded, and lack a refractory period compared to all-or-none action potentials, and (2) how temporal summation differs from spatial summation at the axon hillock." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                const missing = [];
                const checklist = KEY_TERM_CHECKLISTS['lesson_1_14'];
                checklist.forEach(term => {
                    if (!text.includes(term)) missing.push(term);
                });
                if (missing.length === 0) {
                    return { passed: true, feedback: "Perfect! Your explanation incorporates all key terms (potential, threshold, depolarization, repolarization, channels, voltage, potassium, epsp, spatial summation, temporal summation) to describe neural signaling and integration accurately." };
                }
                return { passed: false, feedback: `Your explanation is simple, but it is missing key anatomical/physiological terms. Please expand your explanation to include: **${missing.join(', ')}**.` };
            }
        }
    };

    function getMockFallback(lessonId, lessonTitle, concept, hook, feynmanPrompt) {
        if (mockDatabase[lessonId]) return mockDatabase[lessonId];
        
        const numStr = lessonId.replace('lesson_', '').replace('_', '.');
        return {
            lecture: `### 1. Real-World Case Study
For **Lesson ${numStr}: ${lessonTitle}**, we study how this anatomical pathway functions in patients. The hook: *${hook}*. Disruptions to these cellular or tissue layers trigger immediate systemic symptoms that require clinical intervention.

### 2. Core Physiological Principles
This lesson introduces: **${concept}**. 
We focus on how these organs, tissues, or cellular channels operate. A clear understanding of these physiological frameworks is essential for calculating clinical metrics and diagnosing pathological conditions.

### 3. Empirical & Methodological Frameworks
Anatomists investigate these configurations using laboratory models, dissection slides, and digital diagnostics. We learn to identify structural hallmarks, trace pathway boundaries, and analyze quantitative parameters.

### 4. Clinical & Practical Application
Clinical practices translate these frameworks directly to patient care. We examine diagnostic scans, monitor electrolyte levels, or calculate surface areas to restore homeostatic balance.`,
            socraticInit: `Let's discuss Lesson ${numStr}: ${lessonTitle}. The core concept is "${concept}". Based on the real-world hook (*${hook}*), why do you think this anatomical pathway behaves this way?`,
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
                                 moduleKey: 'anatomy1_llm',
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

                appendLocalBubble("assistant", "Hello! I am your Anatomy & Physiology I tutor. Let's analyze these anatomical structures together. What questions do you have?");
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
                    moduleKey: 'anatomy1_llm',
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
                     moduleKey: 'anatomy1_llm',
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
                    `Generate a challenging prompt to test the student's ability to explain the concept "${lesson.concept}" using the Feynman Technique (explaining a complex topic to a non-scientist or 10-year-old child in simple, everyday terms).`,
                    `The prompt should be based on the real-world/clinical hook: "${lesson.clinical_tie_in}".`,
                    `Return ONLY the prompt text itself. Do not include any introductory greetings, markdown headers, markdown code blocks, JSON wrapper, or conversational filler.`
                ].join('\n');
            }

            try {
                 const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                     moduleKey: 'anatomy1_llm',
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
                     moduleKey: 'anatomy1_llm',
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
                    moduleKey: 'anatomy1_llm',
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

            // 1. STAGE 4 PEDAGOGICAL CHECKLIST double-check (client-side enforcement)
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
                    moduleKey: 'anatomy1_llm',
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
                             moduleKey: 'anatomy1_llm',
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
