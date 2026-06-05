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
            // If page is coursework, call stage switch
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
                    
                    // compute target temp response
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
                                <label class="block text-[10px] text-slate-400 mb-1">Q3. Organic enzymes catalyze biochemical cellular reactions by:</label>
                                <select id="kin-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="">-- Select --</option>
                                    <option value="raise">Raising activation energy limits</option>
                                    <option value="lower">Lowering activation energy barriers</option>
                                    <option value="no-effect">Neutralizing pH acidity</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyTransportKinetics()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Kinetics</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Calibrate parameters to verify organic transport biology.</div>
                    </div>
                `;
                window.verifyTransportKinetics = () => {
                    const q1 = document.getElementById('kin-q1').value;
                    const q2 = document.getElementById('kin-q2').value;
                    const q3 = document.getElementById('kin-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'carrier' && q2 === 'crenate' && q3 === 'lower') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Facilitated diffusion utilizes channels; hypertonic environments cause shriveling (crenation); enzymes reduce activation energy. Lab complete.";
                        completeSandbox('lesson_1_2');
                    } else {
                        feedback.textContent = "Incorrect. Check your selections for facilitated channels, RBC tonicity shriveling, and enzyme activation effects.";
                    }
                };
                break;

            case 'lesson_1_3':
                // DIGITAL MICROSCOPE SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-microscope"></i> Digital Histological Scope</div>
                        <p class="text-slate-300">Focus the slide and match the structural matrix to identify transitional epithelium (bladder) vs stratified squamous epithelium (epidermis).</p>
                        
                        <div class="relative w-full h-44 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                            <!-- SVG drawing tissues dynamically based on slider values -->
                            <svg id="scope-svg" class="w-full h-full" viewBox="0 0 200 100">
                                <rect width="200" height="100" fill="#2d1d27" opacity="0.3"/>
                                <g id="tissue-cells" opacity="0.2">
                                    <!-- Stratified cells or transitional drops -->
                                </g>
                                <circle cx="100" cy="50" r="48" fill="none" stroke="#e11d48" stroke-width="1.5" stroke-dasharray="4 2"/>
                            </svg>
                            <div id="slide-label" class="absolute top-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded font-mono text-[9px] text-slate-400">Slide #109: Unfocused</div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Focus Dial:</span>
                                </label>
                                <input type="range" min="0" max="100" value="20" id="focus-slider" oninput="window.updateScope()" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                            </div>
                            <div>
                                <label class="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Zoom Objective:</span>
                                </label>
                                <select id="zoom-select" onchange="window.updateScope()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none focus:border-rose-600">
                                    <option value="10">10x Lens</option>
                                    <option value="40" selected>40x Lens</option>
                                    <option value="100">100x Oil Lens</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Determine Histological Tissue ID:</label>
                            <select id="tissue-select" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select Matrix --</option>
                                <option value="squamous">Stratified Squamous Epithelium (Thin flattened layers)</option>
                                <option value="transitional">Transitional Epithelium (Domed umbrella cells)</option>
                                <option value="areolar">Areolar Connective Tissue (Loose collagen fibers)</option>
                            </select>
                        </div>

                        <button onclick="window.verifyHistologyScope()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Analyze Specimen</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Adjust focus (70-80%) to see the cell morphology clearly.</div>
                    </div>
                `;
                window.updateScope = () => {
                    const focus = parseInt(document.getElementById('focus-slider').value);
                    const zoom = document.getElementById('zoom-select').value;
                    const cellsGroup = document.getElementById('tissue-cells');
                    const label = document.getElementById('slide-label');
                    
                    // Adjust opacity based on focus accuracy (correct: 70-80)
                    let focusScore = 0;
                    if (focus >= 70 && focus <= 80) {
                        focusScore = 1.0;
                        label.textContent = `Slide #109: Focused (${zoom}x)`;
                    } else {
                        focusScore = Math.max(0.1, 1 - (Math.abs(focus - 75) / 50));
                        label.textContent = `Slide #109: Blurry (${zoom}x)`;
                    }
                    
                    cellsGroup.setAttribute('opacity', focusScore.toFixed(2));
                    
                    // Draw cell outlines based on zoom and focus
                    cellsGroup.innerHTML = "";
                    if (focusScore > 0.5) {
                        // Renders dome-shaped Transitional cells
                        cellsGroup.innerHTML = `
                            <path d="M 60,60 Q 70,45 80,60 Q 90,45 100,60 Q 110,45 120,60" fill="none" stroke="#f43f5e" stroke-width="1.5"/>
                            <circle cx="70" cy="53" r="3" fill="#fda4af"/>
                            <circle cx="90" cy="53" r="3" fill="#fda4af"/>
                            <circle cx="110" cy="53" r="3" fill="#fda4af"/>
                            <path d="M 50,75 Q 70,60 90,75 Q 110,60 130,75" fill="none" stroke="#fb7185" stroke-width="1"/>
                            <circle cx="70" cy="70" r="2.5" fill="#fda4af"/>
                            <circle cx="110" cy="70" r="2.5" fill="#fda4af"/>
                        `;
                    } else {
                        cellsGroup.innerHTML = `
                            <line x1="50" y1="50" x2="150" y2="50" stroke="#fda4af" stroke-width="6" opacity="0.3"/>
                            <line x1="50" y1="65" x2="150" y2="65" stroke="#fda4af" stroke-width="6" opacity="0.3"/>
                        `;
                    }
                };
                window.verifyHistologyScope = () => {
                    const focus = parseInt(document.getElementById('focus-slider').value);
                    const choice = document.getElementById('tissue-select').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (focus >= 70 && focus <= 80 && choice === 'transitional') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Slide shows Transitional Epithelium with distinctive dome-shaped cells. Lab complete.";
                        completeSandbox('lesson_1_3');
                    } else if (choice !== 'transitional') {
                        feedback.textContent = "Incorrect tissue classification. Examine cell matrices: note the domed cells.";
                    } else {
                        feedback.textContent = "Focus dial is off. Adjust the slider to 70-80% to read cell boundaries.";
                    }
                };
                // Initial draw call
                window.updateScope();
                break;

            case 'lesson_1_4':
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
                        completeSandbox('lesson_1_4');
                    } else {
                        feedback.textContent = `Incorrect calculations. Double check your summation. You entered ${total || 0}%, but calculations do not match.`;
                    }
                };
                break;

            case 'lesson_1_5':
                // BONE LANDMARKS TAGGER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-skeleton"></i> Bone Landmarks & Synovial Movements</div>
                        <p class="text-slate-300">Identify osteon structures and synovial movements correctly:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q1. Concentric rings of calcified bone matrix surrounding osteons are:</label>
                                <select id="bone-q1" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="">-- Select --</option>
                                    <option value="lacunae">Lacunae (Chambers for osteocytes)</option>
                                    <option value="lamellae">Lamellae (Concentric rings)</option>
                                    <option value="canaliculi">Canaliculi (Microscopic canal links)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q2. Turning the palm of the hand upwards (anatomical position) is:</label>
                                <select id="bone-q2" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="">-- Select --</option>
                                    <option value="pronation">Pronation</option>
                                    <option value="supination">Supination</option>
                                    <option value="circumduction">Circumduction</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Q3. Which hormone reduces calcium levels by slowing osteoclast activity?</label>
                                <select id="bone-q3" class="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="">-- Select --</option>
                                    <option value="pth">Parathyroid Hormone (PTH)</option>
                                    <option value="calcitonin">Calcitonin</option>
                                    <option value="estrogen">Estrogen</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyBoneLandmarks()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Classifications</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Sync lamellae structures, supination movements, and calcitonin regulators.</div>
                    </div>
                `;
                window.verifyBoneLandmarks = () => {
                    const q1 = document.getElementById('bone-q1').value;
                    const q2 = document.getElementById('bone-q2').value;
                    const q3 = document.getElementById('bone-q3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (q1 === 'lamellae' && q2 === 'supination' && q3 === 'calcitonin') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Lamellae are concentric rings; supination rotates palm anteriorly; calcitonin acts to lower serum calcium. Lab complete.";
                        completeSandbox('lesson_1_5');
                    } else {
                        feedback.textContent = "Incorrect. Review osteon structures, palm rotation terms, or calcitonin vs PTH functions.";
                    }
                };
                break;

            case 'lesson_1_6':
                // SARCOMERE SEQUENCING GAME
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-person-running"></i> Sarcomere Cross-Bridge Cycling Chronology</div>
                        <p class="text-slate-300">Arrange the steps of the cross-bridge cycle and neuromuscular relations in order (1 to 4):</p>
                        
                        <div class="space-y-2.5">
                            <div class="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                                <span class="font-bold text-slate-400 text-[10px] shrink-0">Calcium binding:</span>
                                <p class="text-[10px] text-slate-300 flex-grow">Ca2+ binds troponin, shifting tropomyosin to expose actin binding sites.</p>
                                <select id="seq-step-1" class="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] focus:outline-none">
                                    <option value="">Order</option>
                                    <option value="1">Step 1</option>
                                    <option value="2">Step 2</option>
                                    <option value="3">Step 3</option>
                                    <option value="4">Step 4</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                                <span class="font-bold text-slate-400 text-[10px] shrink-0">Cross-Bridge attachment:</span>
                                <p class="text-[10px] text-slate-300 flex-grow">Energized myosin head binds to actin filament, forming cross-bridge.</p>
                                <select id="seq-step-2" class="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] focus:outline-none">
                                    <option value="">Order</option>
                                    <option value="1">Step 1</option>
                                    <option value="2">Step 2</option>
                                    <option value="3">Step 3</option>
                                    <option value="4">Step 4</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                                <span class="font-bold text-slate-400 text-[10px] shrink-0">Power stroke:</span>
                                <p class="text-[10px] text-slate-300 flex-grow">ADP and Pi are released; myosin head pivots, pulling thin actin filament toward M-line.</p>
                                <select id="seq-step-3" class="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] focus:outline-none">
                                    <option value="">Order</option>
                                    <option value="1">Step 1</option>
                                    <option value="2">Step 2</option>
                                    <option value="3">Step 3</option>
                                    <option value="4">Step 4</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                                <span class="font-bold text-slate-400 text-[10px] shrink-0">Detachment:</span>
                                <p class="text-[10px] text-slate-300 flex-grow">New ATP binds to myosin head, releasing it from the active site.</p>
                                <select id="seq-step-4" class="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] focus:outline-none">
                                    <option value="">Order</option>
                                    <option value="1">Step 1</option>
                                    <option value="2">Step 2</option>
                                    <option value="3">Step 3</option>
                                    <option value="4">Step 4</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifySarcomereSequence()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Sequence</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correct order: Calcium binds (1), myosin attaches (2), power stroke pivots (3), ATP detaches (4).</div>
                    </div>
                `;
                window.verifySarcomereSequence = () => {
                    const s1 = document.getElementById('seq-step-1').value;
                    const s2 = document.getElementById('seq-step-2').value;
                    const s3 = document.getElementById('seq-step-3').value;
                    const s4 = document.getElementById('seq-step-4').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    
                    if (s1 === '1' && s2 === '2' && s3 === '3' && s4 === '4') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Cross-bridge sequence verified. Slid filaments cause muscle shortening. Lab complete.";
                        completeSandbox('lesson_1_6');
                    } else {
                        feedback.textContent = "Incorrect sequence. Check the steps of cycle preparation, bind, pivot, and release.";
                    }
                };
                break;

            case 'lesson_1_7':
                // ACTION POTENTIAL MEMBRANE GRAPHER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-wave-square"></i> Action Potential Biophysics Simulator</div>
                        <p class="text-slate-300">A patient has severe hyperkalemia (high extracellular K+). Calibrate concentration values to restore normal potential propagation.</p>
                        
                        <div class="relative w-full h-36 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                            <!-- SVG drawing Action Potential graph dynamically -->
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
                    // Modify AP curve points based on concentrations
                    let startY = 40;
                    let peakY = 15;
                    let hyperY = 43;
                    
                    // Hyperkalemia reduces resting gradient (rest potential moves closer to threshold - more positive)
                    if (kVal > 8.0) {
                        startY = 35; // depolarized rest
                        peakY = 25;  // decreased amplitude
                        hyperY = 38; // no hyperpolarization
                    } else if (kVal < 3.5) {
                        startY = 43; // hyperpolarized rest
                        hyperY = 46;
                    }
                    
                    curve.setAttribute('d', `M 10,${startY} L 40,${startY} L 48,${peakY} L 56,${hyperY} L 90,${startY}`);
                };
                window.verifyActionPotentialGraph = () => {
                    const k = parseFloat(document.getElementById('k-ext-val').textContent);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (k >= 4.0 && k <= 5.5) {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Extracellular K+ gradients are back in normal boundaries, recovering the resting membrane potential. Lab complete.";
                        completeSandbox('lesson_1_7');
                    } else {
                        feedback.textContent = `Incorrect gradient. Extracellular K+ is ${k} mM. Calibrate it to 4.0 - 5.5 mM.`;
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
