/**
 * BI 233Z - Anatomy & Physiology III Skills Lab Engine
 * Contains interactive widgets, clinical simulations, and homeostatic calculations.
 */

window.AnatomySkillsLab = (() => {

    function completeSandbox(lessonId) {
        localStorage.setItem(`anatomy3_sandbox_complete_${lessonId}`, 'true');
        
        if (window.AnatomyGamification) {
            window.AnatomyGamification.awardXP(30, 'sandbox');
            window.AnatomyGamification.incrementStat('sandboxesCleared');
        } else {
            console.log(`[Anatomy Skills Lab] Awarded 30 XP for completing sandbox: ${lessonId}`);
        }
        
        const badge = document.getElementById('sandbox-status-badge');
        if (badge) {
            badge.textContent = "COMPLETED";
            badge.className = "text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded px-1.5 py-0.5";
        }
        
        if (typeof window.onSandboxSuccess === 'function') {
            window.onSandboxSuccess();
        } else {
            alert("Lab complete! Proceeding to Stage 4 Feynman explanation.");
            if (window.setCourseworkStage) {
                window.setCourseworkStage(4);
            }
        }
    }

    function renderSandboxWidget(id, viewport) {
        if (!viewport) return;
        viewport.innerHTML = "";

        switch (id) {
            case 'lesson_3_1':
                // IMMUNOLOGY DEFENSE GAME
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-shield-halved"></i> Immunology Socratic Defense Game</div>
                        <p class="text-slate-300">A viral pathogen has invaded the respiratory epithelium. Coordinate the immune defense by matching the immune cell/molecule to its correct clinical function:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q1. Destroy intracellular viral hosts by binding MHC-I molecules:</label>
                                <select id="imm-step-1" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select Cell --</option>
                                    <option value="cytotoxic">CD8+ Cytotoxic T-cells</option>
                                    <option value="helper">CD4+ Helper T-cells</option>
                                    <option value="plasma">Plasma B-cells</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q2. Perform phagocytosis of extracellular viruses and present antigens on MHC-II:</label>
                                <select id="imm-step-2" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select Cell --</option>
                                    <option value="macrophage">Macrophages / Dendritic Cells</option>
                                    <option value="nk">Natural Killer (NK) Cells</option>
                                    <option value="erythrocyte">Erythrocytes</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q3. Synthesize and secrete structured antibodies to neutralize viral antigens:</label>
                                <select id="imm-step-3" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select Cell --</option>
                                    <option value="plasma">Plasma B-cells</option>
                                    <option value="helper">CD4+ Helper T-cells</option>
                                    <option value="complement">Complement Proteins</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyImmunology()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Coordinate Defense</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Innate barriers delay infection; adaptive cells neutralize and destroy.</div>
                    </div>
                `;
                window.verifyImmunology = () => {
                    const s1 = document.getElementById('imm-step-1').value;
                    const s2 = document.getElementById('imm-step-2').value;
                    const s3 = document.getElementById('imm-step-3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (s1 === 'cytotoxic' && s2 === 'macrophage' && s3 === 'plasma') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Immune response coordinated. Macrophages phagocytose and present antigen, Helper T-cells activate clones, CD8+ T-cells kill host cells, and Plasma cells neutralize viruses. Lab complete.";
                        completeSandbox('lesson_3_1');
                    } else {
                        feedback.textContent = "Incorrect cell coordination. Review MHC matching and antibody secreting cells.";
                    }
                };
                break;

            case 'lesson_3_2':
                // BOHR EFFECT SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-lungs"></i> Bohr Effect Affinity Simulator</div>
                        <p class="text-slate-300">Simulate systemic exercise acidosis. Manipulate pH (decrease) and Temperature (increase) to shift the oxygen-hemoglobin curve and increase oxygen release:</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px]">
                            <div class="flex justify-between items-center">
                                <span>Blood pH:</span>
                                <span id="bohr-pH-display" class="text-rose-400 font-bold">7.4</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span>Blood Temperature:</span>
                                <span id="bohr-temp-display" class="text-rose-400 font-bold">37.0°C</span>
                            </div>
                            <div class="flex justify-between items-center border-t border-slate-900 pt-2">
                                <span>O2 Unloading at PO2=40 mmHg:</span>
                                <span id="bohr-unload-display" class="text-slate-350">Normal (25% unloaded)</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span>Affinity Shift:</span>
                                <span id="bohr-shift-display" class="text-slate-350">Standard Curve</span>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Adjust pH:</label>
                                <input type="range" min="68" max="78" value="74" id="bohr-pH-slider" oninput="window.updateBohrSim()" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Adjust Temperature (°C):</label>
                                <input type="range" min="30" max="43" value="37" id="bohr-temp-slider" oninput="window.updateBohrSim()" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                            </div>
                        </div>

                        <button onclick="window.verifyBohrSim()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Dissociation Shifts</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Lower pH (acidosis) and raise temperature to mimic active exercise tissues.</div>
                    </div>
                `;
                window.updateBohrSim = () => {
                    const pH = parseFloat(document.getElementById('bohr-pH-slider').value) / 10;
                    const temp = parseFloat(document.getElementById('bohr-temp-slider').value);
                    
                    document.getElementById('bohr-pH-display').textContent = pH.toFixed(2);
                    document.getElementById('bohr-temp-display').textContent = temp.toFixed(1) + "°C";

                    const pHDisplay = document.getElementById('bohr-unload-display');
                    const shiftDisplay = document.getElementById('bohr-shift-display');

                    if (pH < 7.2 && temp > 39.0) {
                        pHDisplay.textContent = "High Unloading (45% unloaded - Hyperactive)";
                        pHDisplay.className = "text-emerald-400 font-bold";
                        shiftDisplay.textContent = "Right-Shifted (Bohr Effect)";
                        shiftDisplay.className = "text-emerald-400 font-bold";
                    } else if (pH > 7.5 && temp < 34.0) {
                        pHDisplay.textContent = "Low Unloading (10% unloaded - Hypoxia risk)";
                        pHDisplay.className = "text-blue-400";
                        shiftDisplay.textContent = "Left-Shifted (High affinity)";
                        shiftDisplay.className = "text-blue-400";
                    } else {
                        pHDisplay.textContent = "Normal (25% unloaded)";
                        pHDisplay.className = "text-slate-350";
                        shiftDisplay.textContent = "Standard Curve";
                        shiftDisplay.className = "text-slate-350";
                    }
                };
                window.verifyBohrSim = () => {
                    const pH = parseFloat(document.getElementById('bohr-pH-slider').value) / 10;
                    const temp = parseFloat(document.getElementById('bohr-temp-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (pH < 7.2 && temp > 39.0) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Exercise conditions (acidosis pH < 7.2, temp > 39°C) cause a rightward Bohr shift, lowering hemoglobin's oxygen affinity to release oxygen to tissue cells. Lab complete.";
                        completeSandbox('lesson_3_2');
                    } else {
                        feedback.textContent = "Incorrect parameters. Slide pH lower (< 7.2) and temperature higher (> 39.0°C) to simulate exercise metabolic demand.";
                    }
                };
                window.updateBohrSim();
                break;

            case 'lesson_3_3':
                // DIGESTION & METABOLISM LAB
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-utensils"></i> GI Histology & Respiration Matrix</div>
                        <p class="text-slate-300">Identify the alimentary canal layering and calculate aerobic cellular respiration yields:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q1. Histological layer containing smooth muscle sheets that drive peristalsis:</label>
                                <select id="digest-layer" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select Layer --</option>
                                    <option value="mucosa">Mucosa (inner lining/absorption)</option>
                                    <option value="submucosa">Submucosa (vessels/nerves)</option>
                                    <option value="muscularis">Muscularis Externa (contraction sheets)</option>
                                    <option value="serosa">Serosa (outer fibrous boundary)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q2. Net ATP generated per mole of glucose in anaerobic Glycolysis:</label>
                                <select id="glycolysis-atp" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select ATP --</option>
                                    <option value="0">0 ATP</option>
                                    <option value="2">2 ATP (net)</option>
                                    <option value="4">4 ATP</option>
                                    <option value="36">36-38 ATP</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q3. Main pathway where NADH/FADH2 transfer electrons to drive ATP synthase:</label>
                                <select id="respiration-path" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select Pathway --</option>
                                    <option value="glycolysis">Glycolysis</option>
                                    <option value="krebs">Krebs Citric Acid Cycle</option>
                                    <option value="etc">Electron Transport Chain (ETC)</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyDigestiveSim()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Metabolic Matrix</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Peristalsis is muscular; glycolysis is anaerobic; ETC utilizes oxygen.</div>
                    </div>
                `;
                window.verifyDigestiveSim = () => {
                    const layer = document.getElementById('digest-layer').value;
                    const atp = document.getElementById('glycolysis-atp').value;
                    const path = document.getElementById('respiration-path').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (layer === 'muscularis' && atp === '2' && path === 'etc') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Layering and metabolism confirmed. Muscularis externa executes peristalsis, glycolysis nets 2 ATP anaerobically, and the ETC uses NADH/FADH2 for massive ATP generation. Lab complete.";
                        completeSandbox('lesson_3_3');
                    } else {
                        feedback.textContent = "Incorrect matrix answers. Review histological layers and cellular respiration ATP pathways.";
                    }
                };
                break;

            case 'lesson_3_4':
                // GLOMERULAR FILTRATION CALCULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-calculator"></i> Glomerular Filtration Pressure Calculator</div>
                        <p class="text-slate-300">Calculate Net Filtration Pressure (NFP) and evaluate kidney mechanics. Net Filtration Pressure is calculated as: <br><strong class="text-rose-300 font-mono">NFP = HP_g - (HP_c + OP_g)</strong></p>
                        
                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px] space-y-2">
                            <div class="text-[9px] text-slate-500 uppercase">Glomerular Pressures:</div>
                            <div class="flex justify-between"><span>Glomerular Hydrostatic Pressure (HP_g):</span> <span>55 mmHg</span></div>
                            <div class="flex justify-between"><span>Bowman Capsule Hydrostatic Pressure (HP_c):</span> <span>15 mmHg</span></div>
                            <div class="flex justify-between"><span>Glomerular Oncotic Pressure (OP_g):</span> <span>30 mmHg</span></div>
                        </div>

                        <div class="space-y-3">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Enter Calculated Net Filtration Pressure (NFP) (mmHg):</label>
                                <input type="number" id="gfr-nfp-input" placeholder="e.g. 10" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-600">
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q2. Under low GFR/renal stenosis, what hormonal pathway triggers systemic vasoconstriction?</label>
                                <select id="gfr-hormone" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="">-- Select Pathway --</option>
                                    <option value="insulin">Insulin Secretion</option>
                                    <option value="raas">Renin-Angiotensin-Aldosterone System (RAAS)</option>
                                    <option value="adh">Vasopressin / ADH alone</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyGlomerularCalculations()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Filtration Pressures</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">NFP = 55 - (15 + 30). Low pressure triggers RAAS to retain volume.</div>
                    </div>
                `;
                window.verifyGlomerularCalculations = () => {
                    const nfp = parseInt(document.getElementById('gfr-nfp-input').value);
                    const hormone = document.getElementById('gfr-hormone').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (nfp === 10 && hormone === 'raas') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> NFP is 10 mmHg [55 - (15 + 30)]. Low blood pressure triggers the RAAS cascade to restore glomerular filtration and systemic pressure. Lab complete.";
                        completeSandbox('lesson_3_4');
                    } else if (nfp !== 10) {
                        feedback.textContent = "Incorrect NFP value. Remember: NFP = HP_g - (HP_c + OP_g).";
                    } else {
                        feedback.textContent = "Select the correct hormonal feedback pathway triggered by low GFR.";
                    }
                };
                break;

            case 'lesson_3_5':
                // ARTERIAL BLOOD GAS (ABG) INTERPRETER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-droplet"></i> Clinical ABG Panel Interpreter</div>
                        <p class="text-slate-300">Diagnose the patient's acid-base condition and identify endocrine compensation based on this arterial blood panel:</p>
                        
                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px] space-y-1">
                            <div class="text-[9px] text-slate-500 uppercase">ABG Results:</div>
                            <div class="flex justify-between"><span>Arterial pH:</span> <span class="text-red-400 font-bold">7.28 (Acidosis; normal: 7.35-7.45)</span></div>
                            <div class="flex justify-between"><span>Partial Pressure of CO2 (PaCO2):</span> <span class="text-red-400 font-bold">52 mmHg (Elevated; normal: 35-45)</span></div>
                            <div class="flex justify-between"><span>Bicarbonate (HCO3-):</span> <span class="text-emerald-400 font-bold">29 mEq/L (Compensating; normal: 22-26)</span></div>
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Select Clinical Diagnosis:</label>
                            <select id="abg-dx" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select Diagnosis --</option>
                                <option value="resp_acid">Respiratory Acidosis, partially compensated by kidneys</option>
                                <option value="met_acid">Metabolic Acidosis, with respiratory hyperventilation</option>
                                <option value="resp_alk">Respiratory Alkalosis, uncompensated</option>
                                <option value="met_alk">Metabolic Alkalosis, with renal retention</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Q2. Which hormone is released by adrenal cortex under RAAS to retain Na+ and excrete H+/K+?</label>
                            <select id="abg-compensation" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select Hormone --</option>
                                <option value="aldosterone">Aldosterone</option>
                                <option value="anp">Atrial Natriuretic Peptide (ANP)</option>
                                <option value="renin">Renin enzyme</option>
                            </select>
                        </div>

                        <button onclick="window.verifyAbgInterpreter()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Diagnostics</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Elevated PaCO2 causes acidosis. Kidneys retain HCO3- and aldosterone retains electrolytes.</div>
                    </div>
                `;
                window.verifyAbgInterpreter = () => {
                    const dx = document.getElementById('abg-dx').value;
                    const comp = document.getElementById('abg-compensation').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (dx === 'resp_acid' && comp === 'aldosterone') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> The patient has Respiratory Acidosis (hypoventilation retains CO2). The kidneys compensate by retaining bicarbonate. Aldosterone regulates sodium/potassium in the renal tubules. Lab complete.";
                        completeSandbox('lesson_3_5');
                    } else {
                        feedback.textContent = "Incorrect diagnosis or compensatory hormone. Check pH origin (respiratory) and RAAS mechanisms.";
                    }
                };
                break;

            case 'lesson_3_6':
                // MENSTRUAL CYCLE CALENDAR SYNC
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-calendar-days"></i> Menstrual & Ovarian Cycle Calendar Sync</div>
                        <p class="text-slate-300">Synchronize the endocrine phases of the ovarian and uterine cycles chronologically:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">During Ovarian Luteal Phase (Days 15-28), what is the uterine cycle phase driven by progesterone?</label>
                                <select id="cycle-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select Phase --</option>
                                    <option value="menstrual">Menstrual Phase (shedding)</option>
                                    <option value="proliferative">Proliferative Phase (estrogen growth)</option>
                                    <option value="secretory">Secretory Phase (endometrial thickening)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Which anterior pituitary hormone spike triggers follicle rupture (ovulation) on Day 14?</label>
                                <select id="cycle-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select Hormone --</option>
                                    <option value="lh">Luteinizing Hormone (LH)</option>
                                    <option value="fsh">Follicle Stimulating Hormone (FSH)</option>
                                    <option value="progesterone">Progesterone</option>
                                    <option value="hgc">Human Chorionic Gonadotropin (hCG)</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyCycleSync()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Calendar Synchronization</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">LH surges for ovulation; progesterone feeds secretory endometrium.</div>
                    </div>
                `;
                window.verifyCycleSync = () => {
                    const q1 = document.getElementById('cycle-q1').value;
                    const q2 = document.getElementById('cycle-q2').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'secretory' && q2 === 'lh') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Calendar synchronized. LH surge triggers ovulation, and the luteal phase matches the uterine secretory phase driven by progesterone. Lab complete.";
                        completeSandbox('lesson_3_6');
                    } else {
                        feedback.textContent = "Incorrect synchronization. Review LH surge details and endometrial progesterone responses.";
                    }
                };
                break;
        }
    }

    return {
        renderSandboxWidget,
        completeSandbox
    };
})();
