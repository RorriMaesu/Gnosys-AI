/**
 * BI 231Z - Anatomy & Physiology I Skills Lab Engine
 * Contains interactive widgets, clinical simulations, and microscopes.
 */

window.AnatomySkillsLab = (() => {

    function completeSandbox(lessonId) {
        // Mark sandbox complete in LocalStorage
        localStorage.setItem(`anatomy1_sandbox_complete_${lessonId}`, 'true');
        
        // Award XP via Gamification
        if (window.AnatomyGamification) {
            window.AnatomyGamification.awardXP(30, 'sandbox');
            window.AnatomyGamification.incrementStat('sandboxesCleared');
        } else {
            console.log(`[Anatomy Skills Lab] Awarded 30 XP for completing sandbox: ${lessonId}`);
        }
        
        // Alert user and move to Stage 4 (Feynman)
        const badge = document.getElementById('sandbox-status-badge');
        if (badge) {
            badge.textContent = "COMPLETED";
            badge.className = "text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded px-1.5 py-0.5";
        }
        
        // Trigger coursework progression
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
            case 'lesson_1_1':
                // HOMEOSTATIC TEMPERATURE SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-temperature-half"></i> Core Temperature Regulatory Loop</div>
                        <p class="text-slate-300">A patient is in hyperthermia (heat stroke). Core temperature is drifting upwards. Adjust negative feedback sweat secretion rates to restore homeostatic 37.0°C.</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px]">
                            <div class="flex justify-between items-center">
                                <span>Core Temperature:</span>
                                <span id="loop-temp" class="text-rose-400 font-extrabold text-sm animate-pulse">40.5 °C</span>
                            </div>
                            <div class="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Afferent Signal (Sensor):</span>
                                <span class="text-rose-300">Cutaneous Thermoreceptors</span>
                            </div>
                            <div class="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Control Center:</span>
                                <span class="text-purple-300">Hypothalamus Axis</span>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="flex justify-between text-[10px] text-slate-400">
                                <span>Sweat Gland Secretion (Effector): <span id="sweat-val" class="font-bold text-rose-400">0%</span></span>
                            </label>
                            <input type="range" min="0" max="100" value="0" id="sweat-slider" oninput="window.updateSweatLoop(this.value)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                        </div>

                        <div class="space-y-2">
                            <label class="flex justify-between text-[10px] text-slate-400">
                                <span>Cutaneous Vasodilation: <span id="dilation-val" class="font-bold text-rose-400">Normal</span></span>
                            </label>
                            <select id="dilation-select" onchange="window.updateSweatLoop()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                <option value="constricted">Vasoconstriction (Conserve Heat)</option>
                                <option value="normal" selected>Normal Diameter</option>
                                <option value="dilated">Vasodilation (Dump Heat)</option>
                            </select>
                        </div>

                        <button onclick="window.verifyTemperatureHomeostasis()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Feedback Loop</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correct hyperthermia by setting maximum sweat glands output and maximum vasodilation.</div>
                    </div>
                `;
                window.updateSweatLoop = (val) => {
                    if (val !== undefined) {
                        document.getElementById('sweat-val').textContent = val + '%';
                    }
                    const sweat = parseInt(document.getElementById('sweat-slider').value);
                    const dilation = document.getElementById('dilation-select').value;
                    const tempEl = document.getElementById('loop-temp');
                    
                    let finalTemp = 40.5 - (sweat * 0.025);
                    if (dilation === 'dilated') {
                        finalTemp -= 1.0;
                    } else if (dilation === 'constricted') {
                        finalTemp += 0.8;
                    }
                    tempEl.textContent = finalTemp.toFixed(1) + ' °C';
                    if (Math.abs(finalTemp - 37.0) < 0.2) {
                        tempEl.className = "text-emerald-400 font-extrabold text-sm";
                    } else {
                        tempEl.className = "text-rose-400 font-extrabold text-sm animate-pulse";
                    }
                };
                window.verifyTemperatureHomeostasis = () => {
                    const sweat = parseInt(document.getElementById('sweat-slider').value);
                    const dilation = document.getElementById('dilation-select').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (sweat >= 90 && dilation === 'dilated') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Sweat evaporation and vasodilation dump internal heat, bringing temperature back to 37°C. Lab complete.";
                        completeSandbox('lesson_1_1');
                    } else {
                        feedback.textContent = "Incorrect. The patient's temperature is still elevated. Increase sweating (>=90%) and set dilation to Vasodilation.";
                    }
                };
                break;

            case 'lesson_1_2':
                // INORGANIC CHEMICAL BUFFER BALANCER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-flask-vial"></i> Inorganic Chemistry & pH Buffer Balancer</div>
                        <p class="text-slate-300">A patient is suffering from acute metabolic alkalosis. Calibrate bond style configurations and buffer concentration to restore arterial blood pH to physiological 7.4 (range 7.35 - 7.45).</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px]">
                            <div class="flex justify-between items-center">
                                <span>Arterial pH Level:</span>
                                <span id="chem-ph" class="text-rose-400 font-extrabold text-sm animate-pulse">7.85 pH</span>
                            </div>
                            <div class="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Bicarbonate Buffer (HCO3-):</span>
                                <span id="chem-buffer-status" class="text-rose-300">Depleted</span>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[10px] text-slate-450 mb-1">1. Select the chemical bond style formed when atoms share electron pairs equally (e.g. O2):</label>
                            <select id="chem-q1" onchange="window.updateChemLoop()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                <option value="">-- Select Bond --</option>
                                <option value="ionic">Ionic Bond (Electrostatic Transfer)</option>
                                <option value="nonpolar">Nonpolar Covalent Bond (Equal Sharing)</option>
                                <option value="polar">Polar Covalent Bond (Unequal Sharing)</option>
                                <option value="hydrogen">Hydrogen Bond (Intermolecular Dipole)</option>
                            </select>
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[10px] text-slate-450 mb-1">2. Water exhibits high heat capacity and solvency due to which bonding interaction?</label>
                            <select id="chem-q2" onchange="window.updateChemLoop()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                <option value="">-- Select Bond --</option>
                                <option value="ionic">Ionic Interactions</option>
                                <option value="covalent">Intramolecular Covalent Bonds</option>
                                <option value="hydrogen">Intermolecular Hydrogen Bonds</option>
                            </select>
                        </div>

                        <div class="space-y-2">
                            <label class="flex justify-between text-[10px] text-slate-400">
                                <span>Bicarbonate Buffer Concentration (mM): <span id="chem-buffer-val" class="font-bold text-rose-400">10 mM</span></span>
                            </label>
                            <input type="range" min="10" max="40" value="10" id="chem-buffer-slider" oninput="window.updateChemLoop(this.value)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                        </div>

                        <button onclick="window.verifyChemHomeostasis()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Chemical Balance</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Configure bonds (Nonpolar, Hydrogen) and raise Bicarbonate (22-26 mM) to restore homeostasis.</div>
                    </div>
                `;
                window.updateChemLoop = (val) => {
                    if (val !== undefined) {
                        document.getElementById('chem-buffer-val').textContent = val + ' mM';
                    }
                    const q1 = document.getElementById('chem-q1').value;
                    const q2 = document.getElementById('chem-q2').value;
                    const buffer = parseInt(document.getElementById('chem-buffer-slider').value);
                    const phEl = document.getElementById('chem-ph');
                    const statusEl = document.getElementById('chem-buffer-status');

                    let basePh = 7.85;
                    let phShift = (buffer - 10) * 0.03;
                    let currentPh = basePh - phShift;

                    phEl.textContent = currentPh.toFixed(2) + ' pH';

                    if (buffer >= 22 && buffer <= 26) {
                        statusEl.textContent = "Optimal (Normal Range)";
                        statusEl.className = "text-emerald-400";
                    } else if (buffer < 22) {
                        statusEl.textContent = "Deficient / Depleted";
                        statusEl.className = "text-rose-400";
                    } else {
                        statusEl.textContent = "Excess Buffer";
                        statusEl.className = "text-purple-300";
                    }

                    if (currentPh >= 7.35 && currentPh <= 7.45 && q1 === 'nonpolar' && q2 === 'hydrogen') {
                        phEl.className = "text-emerald-400 font-extrabold text-sm";
                    } else {
                        phEl.className = "text-rose-400 font-extrabold text-sm animate-pulse";
                    }
                };
                window.verifyChemHomeostasis = () => {
                    const q1 = document.getElementById('chem-q1').value;
                    const q2 = document.getElementById('chem-q2').value;
                    const buffer = parseInt(document.getElementById('chem-buffer-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    let currentPh = 7.85 - (buffer - 10) * 0.03;
                    
                    if (q1 === 'nonpolar' && q2 === 'hydrogen' && currentPh >= 7.35 && currentPh <= 7.45) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Nonpolar sharing characterizes O2 bonds, hydrogen bonds give water its thermal capacity, and bicarbonate buffer (22-26 mM) neutralizes the pH to 7.4. Lab complete.";
                        completeSandbox('lesson_1_2');
                    } else {
                        feedback.textContent = "Incorrect. Ensure O2 is classified as Nonpolar, water solvent bonding is Hydrogen, and Bicarbonate is set to restore 7.4 pH (22-26 mM).";
                    }
                };
                window.updateChemLoop();
                break;

            case 'lesson_1_3':
                // BIOCHEMICAL KINETIC SOLVER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-flask"></i> Enzyme Kinetics & pH Balancing Lab</div>
                        <p class="text-slate-300">A biological enzyme is denatured in acidosis. Calibrate cytoplasmic pH and substrate concentration to restore reaction velocity (Vmax).</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px]">
                            <div class="flex justify-between items-center">
                                <span>Reaction Velocity:</span>
                                <span id="kin-velocity" class="text-rose-400 font-extrabold text-sm animate-pulse">10% of Vmax</span>
                            </div>
                            <div class="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Active Site Status:</span>
                                <span id="site-status" class="text-rose-300">Acid-Denatured</span>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="flex justify-between text-[10px] text-slate-400">
                                <span>Cytoplasmic pH: <span id="ph-val" class="font-bold text-rose-400">6.2</span></span>
                            </label>
                            <input type="range" min="50" max="90" value="62" id="ph-slider" oninput="window.updateKineticsLoop(this.value, null)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                        </div>

                        <div class="space-y-2">
                            <label class="flex justify-between text-[10px] text-slate-400">
                                <span>Substrate Concentration: <span id="sub-val" class="font-bold text-rose-400">20%</span></span>
                            </label>
                            <input type="range" min="0" max="100" value="20" id="sub-slider" oninput="window.updateKineticsLoop(null, this.value)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                        </div>

                        <button onclick="window.verifyEnzymeKinetics()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Kinetics</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Set pH to physiological 7.4 and increase substrate concentration (>=80%) to maximize velocity.</div>
                    </div>
                `;
                window.updateKineticsLoop = (ph, sub) => {
                    const phVal = (ph ? parseInt(ph) : parseInt(document.getElementById('ph-slider').value)) / 10;
                    const subVal = sub ? parseInt(sub) : parseInt(document.getElementById('sub-slider').value);

                    document.getElementById('ph-val').textContent = phVal.toFixed(1);
                    document.getElementById('sub-val').textContent = subVal + '%';

                    const velEl = document.getElementById('kin-velocity');
                    const statusEl = document.getElementById('site-status');

                    // Compute kinetics response
                    let pHDiff = Math.abs(phVal - 7.4);
                    let enzymeEfficiency = Math.max(0.05, 1 - (pHDiff * 0.7)); // 100% efficient at 7.4
                    let velocity = Math.round(enzymeEfficiency * subVal);

                    velEl.textContent = velocity + '% of Vmax';

                    if (pHDiff < 0.1) {
                        statusEl.textContent = "Physiological Optimal";
                        statusEl.className = "text-emerald-400";
                    } else if (pHDiff < 0.5) {
                        statusEl.textContent = "Mildly Distorted";
                        statusEl.className = "text-amber-400";
                    } else {
                        statusEl.textContent = "Acid-Denatured";
                        statusEl.className = "text-rose-400";
                    }

                    if (velocity >= 80) {
                        velEl.className = "text-emerald-400 font-extrabold text-sm";
                    } else {
                        velEl.className = "text-rose-400 font-extrabold text-sm animate-pulse";
                    }
                };
                window.verifyEnzymeKinetics = () => {
                    const phVal = parseFloat(document.getElementById('ph-val').textContent);
                    const subVal = parseInt(document.getElementById('sub-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    if (Math.abs(phVal - 7.4) < 0.15 && subVal >= 80) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Restoring pH to 7.4 recalibrates enzyme active site geometry, enabling near-maximal reaction velocity. Lab complete.";
                        completeSandbox('lesson_1_3');
                    } else {
                        feedback.textContent = `Incorrect calibration. Velocity is still too low. Set pH to 7.4 and substrate concentration above 80%.`;
                    }
                };
                window.updateKineticsLoop();
                break;

            case 'lesson_1_4':
                // MEMBRANE TRANSPORT SORTER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-grip-vertical"></i> Membrane Transport & Tonicity Classifier</div>
                        <p class="text-slate-300">Sort the transport kinetics and tonicity balancing conditions correctly:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q1. Facilitated diffusion requires:</label>
                                <select id="kin-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select --</option>
                                    <option value="no-carrier">Passive lipid diffusion (No carrier/channel needed)</option>
                                    <option value="carrier">Transmembrane channel or carrier protein (No ATP)</option>
                                    <option value="active">Direct ATP phosphorylation (Against gradient)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q2. Red blood cells placed in a hypertonic saline IV fluid will:</label>
                                <select id="kin-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select --</option>
                                    <option value="swell">Swell and lyse (Bursting)</option>
                                    <option value="crenate">Crenate (Shriveling due to water loss)</option>
                                    <option value="neutral">Remain in osmotic equilibrium</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q3. Gap junctions coordinate cellular transmission by:</label>
                                <select id="kin-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select --</option>
                                    <option value="imp">Sealing adjacent tissues impermeably</option>
                                    <option value="con">Forming watery connexon channels for direct communication</option>
                                    <option value="anch">Anchoring cells together via keratin networks</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyTransportKinetics()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Kinetics</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Calibrate parameters to verify membrane transport.</div>
                    </div>
                `;
                window.verifyTransportKinetics = () => {
                    const q1 = document.getElementById('kin-q1').value;
                    const q2 = document.getElementById('kin-q2').value;
                    const q3 = document.getElementById('kin-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'carrier' && q2 === 'crenate' && q3 === 'con') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Facilitated diffusion utilizes channel proteins, hypertonic fluid causes shriveling (crenation), and gap junctions consist of connexons. Lab complete.";
                        completeSandbox('lesson_1_4');
                    } else {
                        feedback.textContent = "Incorrect. Check your selections for facilitated channels, RBC tonicity shriveling, and gap junctions.";
                    }
                };
                break;

            case 'lesson_1_5':
                // DIGITAL MICROSCOPE SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-microscope"></i> Digital Histological Scope</div>
                        <p class="text-slate-300">Select a slide, adjust focus dial, and match the cell matrix morphology to classify the tissue specimen.</p>
                        
                        <div class="relative w-full h-44 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                            <svg id="scope-svg" class="w-full h-full" viewBox="0 0 200 100">
                                <rect width="200" height="100" fill="#2d1d27" opacity="0.3"/>
                                <g id="tissue-cells" opacity="0.2">
                                </g>
                                <circle cx="100" cy="50" r="48" fill="none" stroke="#e11d48" stroke-width="1.5" stroke-dasharray="4 2"/>
                            </svg>
                            <div id="slide-label" class="absolute top-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded font-mono text-[9px] text-slate-400">Slide Unfocused</div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] text-slate-450 mb-1">Select Slide:</label>
                                <select id="slide-select" onchange="window.updateScope()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="109">Slide #109: Bladder Biopsy</option>
                                    <option value="204">Slide #204: Compact Bone</option>
                                    <option value="307">Slide #307: Muscle Biopsy</option>
                                    <option value="401">Slide #401: Brain Smear</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-450 mb-1">Zoom Lens:</label>
                                <select id="zoom-select" onchange="window.updateScope()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="10">10x Lens</option>
                                    <option value="40" selected>40x Lens</option>
                                    <option value="100">100x Oil Lens</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Focus Dial:</span>
                                </label>
                                <input type="range" min="0" max="100" value="20" id="focus-slider" oninput="window.updateScope()" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-450 mb-1">Tissue Matrix ID:</label>
                                <select id="tissue-select" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="">-- Select Identity --</option>
                                    <option value="transitional">Transitional Epithelium (Dome cells)</option>
                                    <option value="osseous">Osseous/Bone Tissue (Osteons)</option>
                                    <option value="muscle">Skeletal Muscle (Striated parallel)</option>
                                    <option value="nervous">Nervous Tissue (Multipolar neurons)</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyHistologyScope()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Analyze Specimen</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Adjust focus (70-80%) to see the cellular matrix morphology.</div>
                    </div>
                `;
                window.updateScope = () => {
                    const focus = parseInt(document.getElementById('focus-slider').value);
                    const slide = document.getElementById('slide-select').value;
                    const zoom = document.getElementById('zoom-select').value;
                    const cellsGroup = document.getElementById('tissue-cells');
                    const label = document.getElementById('slide-label');
                    
                    let focusScore = 0;
                    if (focus >= 70 && focus <= 80) {
                        focusScore = 1.0;
                        label.textContent = `Slide #${slide}: Focused (${zoom}x)`;
                    } else {
                        focusScore = Math.max(0.1, 1 - (Math.abs(focus - 75) / 50));
                        label.textContent = `Slide #${slide}: Blurry (${zoom}x)`;
                    }
                    
                    cellsGroup.setAttribute('opacity', focusScore.toFixed(2));
                    cellsGroup.innerHTML = "";
                    
                    if (focusScore > 0.5) {
                        if (slide === '109') {
                            cellsGroup.innerHTML = `
                                <path d="M 50,60 Q 65,40 80,60 Q 95,40 110,60 Q 125,40 140,60" fill="none" stroke="#f43f5e" stroke-width="1.8"/>
                                <circle cx="65" cy="50" r="3.5" fill="#ec4899"/>
                                <circle cx="95" cy="50" r="3.5" fill="#ec4899"/>
                                <circle cx="125" cy="50" r="3.5" fill="#ec4899"/>
                                <path d="M 40,75 Q 65,55 90,75 Q 115,55 140,75" fill="none" stroke="#e11d48" stroke-width="1.2"/>
                                <circle cx="65" cy="67" r="3" fill="#fda4af"/>
                                <circle cx="115" cy="67" r="3" fill="#fda4af"/>
                            `;
                        } else if (slide === '204') {
                            cellsGroup.innerHTML = `
                                <circle cx="100" cy="50" r="35" fill="none" stroke="#b45309" stroke-width="1.5" stroke-dasharray="2 2"/>
                                <circle cx="100" cy="50" r="22" fill="none" stroke="#b45309" stroke-width="1.5" stroke-dasharray="2 2"/>
                                <circle cx="100" cy="50" r="10" fill="#78350f" stroke="#451a03" stroke-width="1"/>
                                <circle cx="80" cy="35" r="2" fill="#451a03"/>
                                <circle cx="120" cy="65" r="2" fill="#451a03"/>
                                <circle cx="100" cy="28" r="2" fill="#451a03"/>
                                <circle cx="100" cy="72" r="2" fill="#451a03"/>
                            `;
                        } else if (slide === '307') {
                            cellsGroup.innerHTML = `
                                <line x1="40" y1="35" x2="160" y2="35" stroke="#e11d48" stroke-width="10" stroke-linecap="round"/>
                                <line x1="40" y1="50" x2="160" y2="50" stroke="#e11d48" stroke-width="10" stroke-linecap="round"/>
                                <line x1="40" y1="65" x2="160" y2="65" stroke="#e11d48" stroke-width="10" stroke-linecap="round"/>
                                <path d="M 60,30 L 60,70 M 80,30 L 80,70 M 100,30 L 100,70 M 120,30 L 120,70 M 140,30 L 140,70" stroke="#f43f5e" stroke-width="0.8" opacity="0.6"/>
                                <ellipse cx="55" cy="38" rx="4" ry="2" fill="#312e81"/>
                                <ellipse cx="115" cy="53" rx="4" ry="2" fill="#312e81"/>
                                <ellipse cx="85" cy="68" rx="4" ry="2" fill="#312e81"/>
                            `;
                        } else if (slide === '401') {
                            cellsGroup.innerHTML = `
                                <path d="M 100,50 L 85,35 M 100,50 L 120,38 M 100,50 L 115,65 M 100,50 L 80,60 M 100,50 L 60,50" stroke="#6b21a8" stroke-width="2.5"/>
                                <circle cx="100" cy="50" r="8" fill="#8b5cf6" stroke="#6b21a8" stroke-width="1"/>
                                <circle cx="100" cy="50" r="3.5" fill="#4c1d95"/>
                                <circle cx="70" cy="30" r="1.5" fill="#4c1d95"/>
                                <circle cx="130" cy="35" r="1.5" fill="#4c1d95"/>
                                <circle cx="125" cy="70" r="1.5" fill="#4c1d95"/>
                                <circle cx="75" cy="70" r="1.5" fill="#4c1d95"/>
                            `;
                        }
                    } else {
                        cellsGroup.innerHTML = `
                            <line x1="50" y1="50" x2="150" y2="50" stroke="#fda4af" stroke-width="6" opacity="0.3"/>
                            <line x1="50" y1="65" x2="150" y2="65" stroke="#fda4af" stroke-width="6" opacity="0.3"/>
                        `;
                    }
                };
                window.verifyHistologyScope = () => {
                    const focus = parseInt(document.getElementById('focus-slider').value);
                    const slide = document.getElementById('slide-select').value;
                    const choice = document.getElementById('tissue-select').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    if (focus < 70 || focus > 80) {
                        feedback.textContent = "Focus dial is off. Adjust the slider to 70-80% to read cell boundaries.";
                        return;
                    }
                    
                    if (slide === '109' && choice === 'transitional') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Slide shows Transitional Epithelium with dome cells. Lab complete.";
                        completeSandbox('lesson_1_5');
                    } else if (slide === '204' && choice === 'osseous') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Slide shows Osseous/Bone Tissue with concentric osteons. Lab complete.";
                        completeSandbox('lesson_1_5');
                    } else if (slide === '307' && choice === 'muscle') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Slide shows striated Skeletal Muscle fibers. Lab complete.";
                        completeSandbox('lesson_1_5');
                    } else if (slide === '401' && choice === 'nervous') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Slide shows Nervous Tissue with multipolar neuron soma/processes. Lab complete.";
                        completeSandbox('lesson_1_5');
                    } else {
                        feedback.textContent = "Incorrect tissue classification for this slide. Examine focused morphology and try again.";
                    }
                };
                window.updateScope();
                break;

            case 'lesson_1_6':
                // RULE OF NINES BURN TRACKER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-fire-burner"></i> Clinical Rule of Nines Burn Case Study</div>
                        <p class="text-slate-300">A patient arrives with partial and full-thickness burns. Calculate the Total Body Surface Area (TBSA) affected using the Rule of Nines.</p>
                        
                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                            <span class="block text-[9px] font-mono text-slate-400 uppercase">Emergency Case File:</span>
                            <p class="text-slate-300 leading-normal italic text-[10px]">
                                "Patient has deep burns covering the entire anterior chest/abdomen (trunk), the entire right upper limb (arm), and the anterior surface of the right lower limb (leg)."
                            </p>
                        </div>

                        <div class="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded border border-slate-850">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">1. Anterior Trunk %:</label>
                                <select id="nines-trunk" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="0">0%</option>
                                    <option value="9">9%</option>
                                    <option value="18">18%</option>
                                    <option value="36">36%</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">2. Right Arm %:</label>
                                <select id="nines-arm" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="0">0%</option>
                                    <option value="4.5">4.5%</option>
                                    <option value="9">9%</option>
                                    <option value="18">18%</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">3. Anterior Right Leg %:</label>
                                <select id="nines-leg" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="0">0%</option>
                                    <option value="9">9%</option>
                                    <option value="18">18%</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Calculated TBSA %:</label>
                                <input type="number" id="nines-total" placeholder="Enter Total %" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none focus:border-rose-600">
                            </div>
                        </div>

                        <button onclick="window.verifyNinesTBSA()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Resuscitation Fluid Needs</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Recall: Anterior Trunk = 18%, Arm = 9%, Anterior Leg = 9%. Sum them.</div>
                    </div>
                `;
                window.verifyNinesTBSA = () => {
                    const t = parseFloat(document.getElementById('nines-trunk').value);
                    const a = parseFloat(document.getElementById('nines-arm').value);
                    const l = parseFloat(document.getElementById('nines-leg').value);
                    const total = parseFloat(document.getElementById('nines-total').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    const correctTotal = t + a + l; // 18 + 9 + 9 = 36%
                    if (total === correctTotal && correctTotal === 36) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Total surface area is exactly 36%. Fluid volume requirements will be computed based on this. Lab complete.";
                        completeSandbox('lesson_1_6');
                    } else {
                        feedback.textContent = `Incorrect calculations. Double check your summation. You entered ${total || 0}%, but calculations do not match.`;
                    }
                };
                break;

            case 'lesson_1_7':
                // CALCIUM HOMEOSTASIS SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-bone"></i> Calcium Homeostasis Feedback Loop</div>
                        <p class="text-slate-300">A patient is in hypocalcemia (low blood calcium levels). Calibrate hormone axes to activate calcium reserves and restore homeostasis (9.0-10.5 mg/dL).</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px]">
                            <div class="flex justify-between items-center">
                                <span>Blood Ca2+ Level:</span>
                                <span id="ca-level" class="text-rose-400 font-extrabold text-sm animate-pulse">7.2 mg/dL</span>
                            </div>
                            <div class="flex justify-between items-center text-[10px] text-slate-400">
                                <span>Osteoclast Kinetics:</span>
                                <span id="clast-kinetics" class="text-rose-300">Inactive</span>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[10px] text-slate-400 mb-1">Parathyroid Hormone (PTH) Secretion:</label>
                            <select id="pth-select" onchange="window.updateCalciumLoop()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                <option value="suppressed">Suppressed / Low</option>
                                <option value="elevated">Elevated / High</option>
                            </select>
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[10px] text-slate-400 mb-1">Calcitonin Secretion:</label>
                            <select id="calcitonin-select" onchange="window.updateCalciumLoop()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                <option value="suppressed">Suppressed / Low</option>
                                <option value="elevated">Elevated / High</option>
                            </select>
                        </div>

                        <button onclick="window.verifyCalciumHomeostasis()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Ca2+ Balance</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">To correct hypocalcemia, increase PTH to resorb bone and decrease Calcitonin to prevent bone storage.</div>
                    </div>
                `;
                window.updateCalciumLoop = () => {
                    const pth = document.getElementById('pth-select').value;
                    const calcitonin = document.getElementById('calcitonin-select').value;
                    const caEl = document.getElementById('ca-level');
                    const clastEl = document.getElementById('clast-kinetics');

                    let bloodCa = 7.2;
                    if (pth === 'elevated') {
                        bloodCa += 2.4;
                        clastEl.textContent = "Stimulated (Resorbing Matrix)";
                        clastEl.className = "text-emerald-400";
                    } else {
                        clastEl.textContent = "Inactive";
                        clastEl.className = "text-rose-455";
                    }

                    if (calcitonin === 'elevated') {
                        bloodCa -= 1.0;
                        clastEl.textContent = "Suppressed (Storing Calcium)";
                        clastEl.className = "text-purple-300";
                    }

                    caEl.textContent = bloodCa.toFixed(1) + ' mg/dL';

                    if (bloodCa >= 9.0 && bloodCa <= 10.5) {
                        caEl.className = "text-emerald-400 font-extrabold text-sm";
                    } else {
                        caEl.className = "text-rose-400 font-extrabold text-sm animate-pulse";
                    }
                };
                window.verifyCalciumHomeostasis = () => {
                    const pth = document.getElementById('pth-select').value;
                    const calcitonin = document.getElementById('calcitonin-select').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    if (pth === 'elevated' && calcitonin === 'suppressed') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> High PTH acts on osteoclasts to trigger matrix breakdown, releasing Ca2+ into blood, while suppressed Calcitonin keeps calcium from being stored in bone. Lab complete.";
                        completeSandbox('lesson_1_7');
                    } else {
                        feedback.textContent = "Incorrect. The patient is still hypocalcemic. Set PTH to Elevated / High and Calcitonin to Suppressed / Low.";
                    }
                };
                window.updateCalciumLoop();
                break;

            case 'lesson_1_8':
                // DIGITAL AXIAL LANDMARKS PRACTICAL
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-skeleton"></i> Axial Bone Practical</div>
                        <p class="text-slate-300">Identify the specific axial skeleton bones and landmarks from their anatomical descriptions below:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Landmark 1: Large circular opening at the base of the occipital bone of the skull.</label>
                                <select id="axial-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Landmark --</option>
                                    <option value="foramen_magnum">Foramen Magnum</option>
                                    <option value="sella_turcica">Sella Turcica</option>
                                    <option value="crista_galli">Crista Galli</option>
                                    <option value="cribriform_plate">Cribriform Plate</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Landmark 2: Saddle-like depression in the sphenoid bone that houses the pituitary gland.</label>
                                <select id="axial-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Landmark --</option>
                                    <option value="foramen_magnum">Foramen Magnum</option>
                                    <option value="sella_turcica">Sella Turcica</option>
                                    <option value="mastoid_process">Mastoid Process</option>
                                    <option value="crista_galli">Crista Galli</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Landmark 3: Bony, tooth-like projection of the second cervical vertebra (axis) acting as a pivot.</label>
                                <select id="axial-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Landmark --</option>
                                    <option value="atlas">Atlas</option>
                                    <option value="dens">Dens (Odontoid Process)</option>
                                    <option value="spinous_process">Spinous Process</option>
                                    <option value="transverse_foramen">Transverse Foramen</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyAxialPractical()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Submit Axial Practical</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correctly identify the skull opening, pituitary saddle, and axis pivot.</div>
                    </div>
                `;
                window.verifyAxialPractical = () => {
                    const q1 = document.getElementById('axial-q1').value;
                    const q2 = document.getElementById('axial-q2').value;
                    const q3 = document.getElementById('axial-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'foramen_magnum' && q2 === 'sella_turcica' && q3 === 'dens') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Foramen magnum, sella turcica, and dens identified successfully. Practical complete.";
                        completeSandbox('lesson_1_8');
                    } else {
                        feedback.textContent = "Incorrect. Recall: Occipital opening is foramen magnum, sphenoid saddle is sella turcica, and axis pivot is the dens.";
                    }
                };
                break;

            case 'lesson_1_9':
                // DIGITAL APPENDICULAR LANDMARKS PRACTICAL
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-bone"></i> Appendicular Bone Practical</div>
                        <p class="text-slate-300">Identify the specific appendicular skeleton bones and landmarks from their anatomical descriptions below:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Landmark 1: Shallow lateral cavity of the scapula that articulates with the head of the humerus.</label>
                                <select id="append-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Landmark --</option>
                                    <option value="glenoid_cavity">Glenoid Cavity</option>
                                    <option value="acetabulum">Acetabulum</option>
                                    <option value="acromion">Acromion Process</option>
                                    <option value="coracoid_process">Coracoid Process</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Landmark 2: Deep cup-like socket of the coxal bone that receives the head of the femur.</label>
                                <select id="append-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Landmark --</option>
                                    <option value="glenoid_cavity">Glenoid Cavity</option>
                                    <option value="acetabulum">Acetabulum</option>
                                    <option value="obturator_foramen">Obturator Foramen</option>
                                    <option value="iliac_fossa">Iliac Fossa</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Landmark 3: Large bony projection on the lateral proximal femur serving as a major muscle site.</label>
                                <select id="append-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Landmark --</option>
                                    <option value="greater_trochanter">Greater Trochanter</option>
                                    <option value="medial_condyle">Medial Condyle</option>
                                    <option value="radial_tuberosity">Radial Tuberosity</option>
                                    <option value="deltoid_tuberosity">Deltoid Tuberosity</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyAppendicularPractical()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Submit Appendicular Practical</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correctly identify the scapular socket, pelvic socket, and femoral projection.</div>
                    </div>
                `;
                window.verifyAppendicularPractical = () => {
                    const q1 = document.getElementById('append-q1').value;
                    const q2 = document.getElementById('append-q2').value;
                    const q3 = document.getElementById('append-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'glenoid_cavity' && q2 === 'acetabulum' && q3 === 'greater_trochanter') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Glenoid cavity, acetabulum, and greater trochanter identified successfully. Practical complete.";
                        completeSandbox('lesson_1_9');
                    } else {
                        feedback.textContent = "Incorrect. Recall: Scapular socket is glenoid cavity, pelvic socket is acetabulum, and large femoral projection is greater trochanter.";
                    }
                };
                break;

            case 'lesson_1_10':
                // JOINTS AND ARTICULATIONS
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-link"></i> Joints & Articulations Matching</div>
                        <p class="text-slate-300">Match the joint classifications and movements correctly:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">1. Suture joints of the skull are structurally fibrous and functionally classified as:</label>
                                <select id="joints-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Classification --</option>
                                    <option value="synarthrosis">Synarthrosis (Immovable)</option>
                                    <option value="amphiarthrosis">Amphiarthrosis (Slightly Movable)</option>
                                    <option value="diarthrosis">Diarthrosis (Freely Movable)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">2. Symphysis joints (e.g., pubic symphysis, intervertebral discs) are functionally classified as:</label>
                                <select id="joints-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Classification --</option>
                                    <option value="synarthrosis">Synarthrosis (Immovable)</option>
                                    <option value="amphiarthrosis">Amphiarthrosis (Slightly Movable)</option>
                                    <option value="diarthrosis">Diarthrosis (Freely Movable)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">3. Angular movement that decreases the joint angle, such as bending the elbow:</label>
                                <select id="joints-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Movement --</option>
                                    <option value="flexion">Flexion</option>
                                    <option value="extension">Extension</option>
                                    <option value="abduction">Abduction</option>
                                    <option value="adduction">Adduction</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyJointsLab()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Matching</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Classify sutures, symphyses, and elbow bending.</div>
                    </div>
                `;
                window.verifyJointsLab = () => {
                    const q1 = document.getElementById('joints-q1').value;
                    const q2 = document.getElementById('joints-q2').value;
                    const q3 = document.getElementById('joints-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'synarthrosis' && q2 === 'amphiarthrosis' && q3 === 'flexion') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Skull sutures are synarthroses, symphyses are amphiarthroses, and elbow bending is flexion. Lab complete.";
                        completeSandbox('lesson_1_10');
                    } else {
                        feedback.textContent = "Incorrect. Skull sutures are immovable, symphyses are slightly movable, and elbow bending decreases joint angle.";
                    }
                };
                break;

            case 'lesson_1_11':
                // SARCOMERE CROSS-BRIDGE CYCLE SEQUENCING
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-person-running"></i> Sarcomere Cross-Bridge Cycle Sequencing</div>
                        <p class="text-slate-300">Arrange the steps of the sarcomere cross-bridge cycle in the correct chronological sequence (1 to 4):</p>
                        
                        <div class="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[10.5px]">
                            <div class="flex items-center justify-between gap-2">
                                <span class="truncate text-slate-300">Ca2+ binds troponin, shifting tropomyosin:</span>
                                <select id="seq-step-1" class="bg-slate-900 border border-slate-800 rounded p-0.5 text-xs focus:outline-none">
                                    <option value="">Order</option><option value="1">Step 1</option><option value="2">Step 2</option><option value="3">Step 3</option><option value="4">Step 4</option>
                                </select>
                            </div>
                            <div class="flex items-center justify-between gap-2">
                                <span class="truncate text-slate-300">Energized myosin head binds to actin:</span>
                                <select id="seq-step-2" class="bg-slate-900 border border-slate-800 rounded p-0.5 text-xs focus:outline-none">
                                    <option value="">Order</option><option value="1">Step 1</option><option value="2">Step 2</option><option value="3">Step 3</option><option value="4">Step 4</option>
                                </select>
                            </div>
                            <div class="flex items-center justify-between gap-2">
                                <span class="truncate text-slate-300">Myosin head pivots, pulling actin (power stroke):</span>
                                <select id="seq-step-3" class="bg-slate-900 border border-slate-800 rounded p-0.5 text-xs focus:outline-none">
                                    <option value="">Order</option><option value="1">Step 1</option><option value="2">Step 2</option><option value="3">Step 3</option><option value="4">Step 4</option>
                                </select>
                            </div>
                            <div class="flex items-center justify-between gap-2">
                                <span class="truncate text-slate-300">ATP binds to myosin head, releasing it:</span>
                                <select id="seq-step-4" class="bg-slate-900 border border-slate-800 rounded p-0.5 text-xs focus:outline-none">
                                    <option value="">Order</option><option value="1">Step 1</option><option value="2">Step 2</option><option value="3">Step 3</option><option value="4">Step 4</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifySarcomereSequence()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Sequence</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correctly sequence the steps of skeletal contraction.</div>
                    </div>
                `;
                window.verifySarcomereSequence = () => {
                    const s1 = document.getElementById('seq-step-1').value;
                    const s2 = document.getElementById('seq-step-2').value;
                    const s3 = document.getElementById('seq-step-3').value;
                    const s4 = document.getElementById('seq-step-4').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    if (s1 === '1' && s2 === '2' && s3 === '3' && s4 === '4') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Sarcomere cross-bridge sequence verified. Lab complete.";
                        completeSandbox('lesson_1_11');
                    } else {
                        feedback.textContent = "Incorrect sequence. Check cycle steps 1 to 4. Recall: Ca2+ binds ➔ Myosin binds ➔ Power stroke ➔ ATP releases.";
                    }
                };
                break;

            case 'lesson_1_12':
                // MUSCLE LEVER SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-dumbbell"></i> Skeletal Muscle Lever Systems Lab</div>
                        <p class="text-slate-300">Identify the correct leverage classifications of these three major skeletal movements:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10.5px] text-slate-400 mb-1">Movement 1: Standing on tiptoes (calf extension, fulcrum at toes, body weight in middle).</label>
                                <select id="lever-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Class --</option>
                                    <option value="1">1st Class (Effort - Fulcrum - Load)</option>
                                    <option value="2">2nd Class (Fulcrum - Load - Effort)</option>
                                    <option value="3">3rd Class (Fulcrum - Effort - Load)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10.5px] text-slate-400 mb-1">Movement 2: Head nodding at atlanto-occipital joint (fulcrum in middle, neck muscle pulls down).</label>
                                <select id="lever-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Class --</option>
                                    <option value="1">1st Class (Effort - Fulcrum - Load)</option>
                                    <option value="2">2nd Class (Fulcrum - Load - Effort)</option>
                                    <option value="3">3rd Class (Fulcrum - Effort - Load)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10.5px] text-slate-400 mb-1">Movement 3: Elbow flexion (Biceps contracting at radius, fulcrum at elbow joint, load in hand).</label>
                                <select id="lever-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Class --</option>
                                    <option value="1">1st Class (Effort - Fulcrum - Load)</option>
                                    <option value="2">2nd Class (Fulcrum - Load - Effort)</option>
                                    <option value="3">3rd Class (Fulcrum - Effort - Load)</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyLeverSystems()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Lever Classes</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Classify the calf lift (2nd class), head nod (1st class), and arm curl (3rd class).</div>
                    </div>
                `;
                window.verifyLeverSystems = () => {
                    const q1 = document.getElementById('lever-q1').value;
                    const q2 = document.getElementById('lever-q2').value;
                    const q3 = document.getElementById('lever-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    if (q1 === '2' && q2 === '1' && q3 === '3') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Tiptoes is a 2nd Class lever, Head nodding is a 1st Class lever, and Biceps curl is a 3rd Class lever. Lab complete.";
                        completeSandbox('lesson_1_12');
                    } else {
                        feedback.textContent = "Incorrect classifications. Check the relative positions of the Fulcrum, Load, and Effort for each system.";
                    }
                };
                break;

            case 'lesson_1_13':
                // NEUROGLIA CLASSIFICATION & FUNCTION MATCHING
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-network-wired"></i> Neuroglia Cells Identification</div>
                        <p class="text-slate-300">Identify these Central Nervous System (CNS) neuroglial cells by function:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">1. Star-shaped cell regulating chemical environment and forming the blood-brain barrier:</label>
                                <select id="glia-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Glial Cell --</option>
                                    <option value="astrocyte">Astrocyte</option>
                                    <option value="oligodendrocyte">Oligodendrocyte</option>
                                    <option value="microglia">Microglia</option>
                                    <option value="ependymal">Ependymal Cell</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">2. Cell responsible for myelinating axons in the CNS:</label>
                                <select id="glia-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Glial Cell --</option>
                                    <option value="astrocyte">Astrocyte</option>
                                    <option value="oligodendrocyte">Oligodendrocyte</option>
                                    <option value="microglia">Microglia</option>
                                    <option value="schwann">Schwann Cell</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">3. Phagocytic immune cell clearing pathogens and cell debris in the CNS:</label>
                                <select id="glia-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select Glial Cell --</option>
                                    <option value="astrocyte">Astrocyte</option>
                                    <option value="oligodendrocyte">Oligodendrocyte</option>
                                    <option value="microglia">Microglia</option>
                                    <option value="satellite">Satellite Cell</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyGliaLab()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Glial Identification</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Identify astrocytes, oligodendrocytes, and microglia.</div>
                    </div>
                `;
                window.verifyGliaLab = () => {
                    const q1 = document.getElementById('glia-q1').value;
                    const q2 = document.getElementById('glia-q2').value;
                    const q3 = document.getElementById('glia-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'astrocyte' && q2 === 'oligodendrocyte' && q3 === 'microglia') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> CNS glial cells (astrocytes, oligodendrocytes, microglia) identified successfully. Lab complete.";
                        completeSandbox('lesson_1_13');
                    } else {
                        feedback.textContent = "Incorrect. Remember: astrocytes support BBB, oligodendrocytes myelinate CNS, and microglia are phagocytic.";
                    }
                };
                break;

            case 'lesson_1_14':
                // ACTION POTENTIAL MEMBRANE GRAPHER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-wave-square"></i> Action Potential Biophysics Simulator</div>
                        <p class="text-slate-300">A patient has severe hyperkalemia (high extracellular K+). Calibrate concentration values to restore normal potential propagation.</p>
                        
                        <div class="relative w-full h-36 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                            <svg id="ap-graph-svg" class="w-full h-full" viewBox="0 0 100 50">
                                <line x1="10" y1="40" x2="90" y2="40" stroke="#334155" stroke-width="0.5"/>
                                <line x1="10" y1="10" x2="90" y2="10" stroke="#334155" stroke-width="0.5" stroke-dasharray="2 1"/>
                                <path id="ap-curve" d="M 10,40 L 40,40 L 48,15 L 56,43 L 90,40" fill="none" stroke="#f43f5e" stroke-width="1.5"/>
                            </svg>
                            <div class="absolute top-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded font-mono text-[9px] text-slate-400">AP Profile: Normal</div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Extracellular K+ (mM): <span id="k-ext-val" class="font-bold text-rose-400">5.0</span></span>
                                </label>
                                <input type="range" min="30" max="150" value="50" id="k-ext-slider" oninput="window.updateAPGraph(this.value, null)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                            </div>
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Intracellular Na+ (mM): <span id="na-int-val" class="font-bold text-rose-400">15.0</span></span>
                                </label>
                                <input type="range" min="100" max="250" value="150" id="na-int-slider" oninput="window.updateAPGraph(null, this.value)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                            </div>
                        </div>

                        <button onclick="window.verifyActionPotentialGraph()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Membrane Biophysics</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Calibrate Extracellular K+ to 4.0 - 5.5 mM to recover resting membrane gradients.</div>
                    </div>
                `;
                window.updateAPGraph = (k, na) => {
                    const kVal = parseFloat(k || document.getElementById('k-ext-slider').value) / 10;
                    const naVal = parseFloat(na || document.getElementById('na-int-slider').value) / 10;
                    
                    document.getElementById('k-ext-val').textContent = kVal.toFixed(1);
                    document.getElementById('na-int-val').textContent = naVal.toFixed(1);
                    
                    const curve = document.getElementById('ap-curve');
                    let startY = 40;
                    let peakY = 15;
                    let hyperY = 43;
                    
                    if (kVal > 8.0) {
                        startY = 35;
                        peakY = 25;
                        hyperY = 38;
                    } else if (kVal < 3.5) {
                        startY = 43;
                        hyperY = 46;
                    }
                    
                    curve.setAttribute('d', `M 10,${startY} L 40,${startY} L 48,${peakY} L 56,${hyperY} L 90,${startY}`);
                };
                window.verifyActionPotentialGraph = () => {
                    const k = parseFloat(document.getElementById('k-ext-val').textContent);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (k >= 4.0 && k <= 5.5) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Extracellular K+ gradients are back in normal boundaries, recovering the resting membrane potential. Lab complete.";
                        completeSandbox('lesson_1_14');
                    } else {
                        feedback.textContent = `Incorrect gradient. Extracellular K+ is ${k} mM. Calibrate it to 4.0 - 5.5 mM.`;
                    }
                };
                window.updateAPGraph();
                break;
        }
    }

    return {
        renderSandboxWidget,
        completeSandbox
    };
})();
