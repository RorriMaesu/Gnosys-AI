/**
 * BI 232Z - Anatomy & Physiology II Skills Lab Engine
 * Contains interactive widgets, clinical simulations, and hemodynamics.
 */

window.AnatomySkillsLab = (() => {

    function completeSandbox(lessonId) {
        localStorage.setItem(`anatomy2_sandbox_complete_${lessonId}`, 'true');
        
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
            case 'lesson_2_1':
                // CNS SPINAL TRACT ROUTER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-route"></i> Spinal Tract routing pathway</div>
                        <p class="text-slate-300">Route a pain and temperature signal (ascending spinothalamic tract) from receptor to cerebral cortex. Select the correct sequential order of anatomical structures:</p>
                        
                        <div class="space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Step 1 (First-Order Neuron Origin):</label>
                                <select id="tract-step-1" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select --</option>
                                    <option value="nociceptor">Nociceptor in skin (synapses in dorsal horn)</option>
                                    <option value="thalamus">Thalamus nuclei</option>
                                    <option value="cortex">Postcentral gyrus cortex</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Step 2 (Second-Order Decussation & Ascent):</label>
                                <select id="tract-step-2" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select --</option>
                                    <option value="spinal">Spinal cord dorsal horn decussating to spinothalamic tract</option>
                                    <option value="medulla">Medulla oblongata decussating to medial lemniscus</option>
                                    <option value="corticospinal">Corticospinal voluntary tract</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Step 3 (Third-Order Relay):</label>
                                <select id="tract-step-3" class="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                    <option value="">-- Select --</option>
                                    <option value="thalamus">Thalamus (VPL nucleus routing to cortex)</option>
                                    <option value="precentral">Precentral gyrus (Motor cortex)</option>
                                    <option value="cerebellum">Cerebellum coordinate lobes</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifySpinalRouting()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Signal Propagation</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Correct path: Nociceptor ➔ Dorsal Horn Decussation ➔ Thalamus.</div>
                    </div>
                `;
                window.verifySpinalRouting = () => {
                    const s1 = document.getElementById('tract-step-1').value;
                    const s2 = document.getElementById('tract-step-2').value;
                    const s3 = document.getElementById('tract-step-3').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (s1 === 'nociceptor' && s2 === 'spinal' && s3 === 'thalamus') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Spinothalamic pathway verified. First-order synapses in dorsal horn, second-order decussates and ascends, third-order projects from thalamus. Lab complete.";
                        completeSandbox('lesson_2_1');
                    } else {
                        feedback.textContent = "Incorrect pathway sequence. Remember that pain decussates in the spinal cord, and relays through the thalamus.";
                    }
                };
                break;

            case 'lesson_2_2':
                // AUTONOMIC FIGHT-OR-FLIGHT SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-skull"></i> Autonomic Nervous System Simulator</div>
                        <p class="text-slate-300">Simulate a severe Sympathetic (Fight-or-Flight) response. Adjust receptor stimulation to increase heart rate and dilate pupils while slowing digestion.</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px]">
                            <div class="flex justify-between items-center">
                                <span>Heart Rate:</span>
                                <span id="autonomic-hr" class="text-slate-350">72 bpm</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span>Pupil Diameter:</span>
                                <span id="autonomic-pupils" class="text-slate-350">Constricted (3mm)</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span>Gastrointestinal Motility:</span>
                                <span id="autonomic-gi" class="text-slate-350">Active</span>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <div>
                                <label class="block text-[10px] text-slate-400 mb-1">Receptor Stimulated (Post-ganglionic):</label>
                                <select id="autonomic-receptor" onchange="window.updateAutonomicSim()" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                    <option value="muscarinic">Muscarinic ACh Receptors (Parasympathetic)</option>
                                    <option value="beta1">Beta-1 Adrenergic Receptors (Sympathetic Heart)</option>
                                    <option value="alpha1">Alpha-1 Adrenergic Receptors (Sympathetic Pupil)</option>
                                    <option value="combined">Beta-1 + Alpha-1 Adrenergic Stimulation</option>
                                </select>
                            </div>
                        </div>

                        <button onclick="window.verifyAutonomicSim()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify System Response</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Achieve sympathetic dominance to stimulate both cardiac and visual systems.</div>
                    </div>
                `;
                window.updateAutonomicSim = () => {
                    const rec = document.getElementById('autonomic-receptor').value;
                    const hrEl = document.getElementById('autonomic-hr');
                    const pupilsEl = document.getElementById('autonomic-pupils');
                    const giEl = document.getElementById('autonomic-gi');

                    if (rec === 'muscarinic') {
                        hrEl.textContent = "60 bpm (Bradycardia)";
                        pupilsEl.textContent = "Constricted (2mm)";
                        giEl.textContent = "Hyperactive / High secretion";
                    } else if (rec === 'beta1') {
                        hrEl.textContent = "120 bpm (Tachycardia)";
                        pupilsEl.textContent = "Normal (3mm)";
                        giEl.textContent = "Inhibited / Decreased";
                    } else if (rec === 'alpha1') {
                        hrEl.textContent = "72 bpm";
                        pupilsEl.textContent = "Dilated (7mm - Mydriasis)";
                        giEl.textContent = "Inhibited / Decreased";
                    } else if (rec === 'combined') {
                        hrEl.textContent = "125 bpm (Tachycardia)";
                        pupilsEl.textContent = "Dilated (8mm - Mydriasis)";
                        giEl.textContent = "Inhibited / Decreased";
                    }
                };
                window.verifyAutonomicSim = () => {
                    const rec = document.getElementById('autonomic-receptor').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (rec === 'combined') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Adrenergic beta-1 increases heart rate, and alpha-1 drives pupillary dilation. Digestion slows. Autonomic balance shifted. Lab complete.";
                        completeSandbox('lesson_2_2');
                    } else {
                        feedback.textContent = "Incorrect. Choose the combined adrenergic stimulation options to drive complete sympathetic responses.";
                    }
                };
                window.updateAutonomicSim();
                break;

            case 'lesson_2_3':
                // SENSORY PROPAGATION MAPPER
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-fingerprint"></i> Somatic Mechanoreceptor Classifier</div>
                        <p class="text-slate-300">We are testing tactile sensitivity in a patient's fingertips. Adjust skin indentation depth to select which mechanoreceptor responds:</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px] text-center">
                            <span class="block text-[9px] text-slate-500 uppercase">Finger Compression Level:</span>
                            <div class="text-lg font-bold text-rose-400" id="pressure-desc">Light Touch (No indentation)</div>
                            <div class="flex justify-around text-[10px] mt-2 text-slate-400">
                                <div>Meissner's: <span id="meiss-status" class="text-red-400">Inactive</span></div>
                                <div>Pacinian: <span id="pacin-status" class="text-red-400">Inactive</span></div>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <input type="range" min="0" max="100" value="0" id="pressure-slider" oninput="window.updatePressureSim(this.value)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Q1. Which receptor detects deep pressure and high-frequency vibration?</label>
                            <select id="somatic-q1" class="w-full bg-slate-905 border border-slate-800 rounded p-1 text-[11px] focus:outline-none">
                                <option value="">-- Select --</option>
                                <option value="meissner">Meissner's corpuscles (rapid light touch)</option>
                                <option value="pacinian">Pacinian corpuscles (deep pressure/vibration)</option>
                                <option value="proprioceptor">Muscle spindles (proprioceptors)</option>
                            </select>
                        </div>

                        <button onclick="window.verifySensoryMechanics()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Analyze Receptor Transduction</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Slide to maximum to trigger Pacinian corpuscles (deep tissue).</div>
                    </div>
                `;
                window.updatePressureSim = (val) => {
                    const v = parseInt(val);
                    const desc = document.getElementById('pressure-desc');
                    const mStatus = document.getElementById('meiss-status');
                    const pStatus = document.getElementById('pacin-status');

                    if (v === 0) {
                        desc.textContent = "Light Touch (0mm)";
                        mStatus.textContent = "Inactive"; mStatus.className = "text-red-400";
                        pStatus.textContent = "Inactive"; pStatus.className = "text-red-400";
                    } else if (v > 0 && v <= 40) {
                        desc.textContent = "Rapid Flutter/Vibration (1-2mm)";
                        mStatus.textContent = "ACTIVE"; mStatus.className = "text-emerald-400 font-bold";
                        pStatus.textContent = "Inactive"; pStatus.className = "text-red-400";
                    } else {
                        desc.textContent = "Deep Tissue Compression (5-8mm)";
                        mStatus.textContent = "Inactive (Fatigued)"; mStatus.className = "text-amber-400";
                        pStatus.textContent = "ACTIVE"; pStatus.className = "text-emerald-400 font-bold";
                    }
                };
                window.verifySensoryMechanics = () => {
                    const q1 = document.getElementById('somatic-q1').value;
                    const slider = parseInt(document.getElementById('pressure-slider').value);
                    const feedback = document.getElementById('sandbox-feedback');
                    if (slider > 50 && q1 === 'pacinian') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Pacinian corpuscles reside deep in the dermis/subcutaneous layers and code deep mechanical pressure. Lab complete.";
                        completeSandbox('lesson_2_3');
                    } else if (q1 !== 'pacinian') {
                        feedback.textContent = "Incorrect. Classify the deep pressure receptor correctly.";
                    } else {
                        feedback.textContent = "Increase compression slider (deep tissue) to fire the Pacinian receptor.";
                    }
                };
                break;

            case 'lesson_2_4':
                // ENDOCRINE SIMULATOR
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-vials"></i> Endocrine Diagnostic Board</div>
                        <p class="text-slate-300">Diagnose the patient's hormonal condition based on blood serum assays:</p>
                        
                        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[10px]">
                            <div class="text-[9px] text-slate-500 uppercase">Assay Results:</div>
                            <div class="flex justify-between"><span>Thyroid Stimulating Hormone (TSH):</span> <span class="text-red-400 font-bold">Abnormally Low (0.01 mIU/L)</span></div>
                            <div class="flex justify-between"><span>Free Thyroxine (T4):</span> <span class="text-emerald-450 font-bold">Abnormally High (4.2 ng/dL)</span></div>
                            <div class="flex justify-between"><span>Thyroid Stimulating Immunoglobulins:</span> <span class="text-emerald-450 font-bold">Detected (Positive)</span></div>
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Determine Pathology / Diagnosis:</label>
                            <select id="endocrine-dx" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select Diagnosis --</option>
                                <option value="graves">Graves' Disease (Hyperthyroidism via antibody activation)</option>
                                <option value="diabetes">Diabetes Mellitus Type 1 (Insulin Deficiency)</option>
                                <option value="gigantism">Pituitary Gigantism (Excessive Growth Hormone)</option>
                                <option value="hypothyroid">Primary Hypothyroidism (Hashimoto's)</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Explain the mechanism of TSH suppression:</label>
                            <select id="endocrine-mech" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select --</option>
                                <option value="positive">Antibodies trigger positive feedback</option>
                                <option value="negative">High T4/T3 levels exert strong negative feedback on anterior pituitary</option>
                                <option value="destruction">Thyroid cells are destroyed and cannot release TSH</option>
                            </select>
                        </div>

                        <button onclick="window.verifyEndocrineDx()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Diagnosis</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">TSH is suppressed because elevated thyroid hormones feed back negatively.</div>
                    </div>
                `;
                window.verifyEndocrineDx = () => {
                    const dx = document.getElementById('endocrine-dx').value;
                    const mech = document.getElementById('endocrine-mech').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (dx === 'graves' && mech === 'negative') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Graves' disease is diagnosed by auto-antibodies stimulating thyroid receptors. Elevated T4 suppresses TSH via negative feedback. Lab complete.";
                        completeSandbox('lesson_2_4');
                    } else {
                        feedback.textContent = "Incorrect. Review thyroid antibodies (Graves') and endocrine negative feedback loops.";
                    }
                };
                break;

            case 'lesson_2_5':
                // BLOOD TYPING AND COAGULATION LAB
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-droplet"></i> Blood Typing & Agglutination Assay</div>
                        <p class="text-slate-300">We add anti-serums to a patient's blood sample. Observe agglutination (clumping) and classify the correct blood type.</p>
                        
                        <div class="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px]">
                            <div class="text-center p-2 border border-slate-800 rounded">
                                <div>Anti-A Serum</div>
                                <div id="agglut-A" class="font-bold text-emerald-400 mt-1">Agglutination (+)</div>
                            </div>
                            <div class="text-center p-2 border border-slate-800 rounded">
                                <div>Anti-B Serum</div>
                                <div id="agglut-B" class="font-bold text-red-400 mt-1">No Clumping (-)</div>
                            </div>
                            <div class="text-center p-2 border border-slate-800 rounded">
                                <div>Anti-D (Rh)</div>
                                <div id="agglut-Rh" class="font-bold text-emerald-400 mt-1">Agglutination (+)</div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Determine Patient Blood Type:</label>
                            <select id="blood-type-select" class="w-full bg-slate-955 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select Type --</option>
                                <option value="A_pos">A Positive (A+)</option>
                                <option value="A_neg">A Negative (A-)</option>
                                <option value="B_pos">B Positive (B+)</option>
                                <option value="O_pos">O Positive (O+)</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Q2. The coagulation cascade common pathway begins with the activation of:</label>
                            <select id="coag-common" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select Factor --</option>
                                <option value="factorX">Factor X (Converting prothrombin to thrombin)</option>
                                <option value="fibrinogen">Fibrinogen (Factor I)</option>
                                <option value="factorVII">Factor VII (Extrinsic pathway)</option>
                            </select>
                        </div>

                        <button onclick="window.verifyBloodCompatibility()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Hematology Specs</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Agglutination in wells A and D (Rh) indicates A+ blood. Common pathway starts at Factor X.</div>
                    </div>
                `;
                window.verifyBloodCompatibility = () => {
                    const type = document.getElementById('blood-type-select').value;
                    const coag = document.getElementById('coag-common').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (type === 'A_pos' && coag === 'factorX') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Patient blood is A Positive (has A and Rh antigens). Coagulation common pathway is initiated by Factor X activating prothrombinase. Lab complete.";
                        completeSandbox('lesson_2_5');
                    } else {
                        feedback.textContent = "Incorrect compatibility details. Check blood antigens clumping and coagulation activation markers.";
                    }
                };
                break;

            case 'lesson_2_6':
                // ECG AND POISEUILLE HEMODYNAMICS
                viewport.innerHTML = `
                    <div class="w-full max-w-md p-4 bg-slate-900 border border-rose-900/35 rounded-2xl text-xs space-y-4">
                        <div class="font-bold text-rose-400 uppercase tracking-wide text-[10px]"><i class="fa-solid fa-heart-pulse"></i> Hemodynamics & ECG Calibration</div>
                        <p class="text-slate-300">Adjust the systemic arteriole radius to observe resistance changes according to Poiseuille's law (Resistance ∝ 1/r^4):</p>
                        
                        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-[11px]">
                            <div class="flex justify-between items-center">
                                <span>Arteriole Radius (r):</span>
                                <span id="hemo-radius-display" class="text-rose-455 font-bold">1.0</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span>Systemic Resistance (R):</span>
                                <span id="hemo-resistance-display" class="text-rose-300">1.0 R</span>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <input type="range" min="5" max="20" value="10" id="radius-slider" oninput="window.updateHemoCalculations(this.value)" class="w-full accent-rose-500 bg-slate-950 h-2 rounded-lg cursor-pointer appearance-none">
                        </div>

                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">What vessel branches off the abdominal aorta to supply the liver, spleen, and stomach?</label>
                            <select id="vessel-celiac" class="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs focus:outline-none">
                                <option value="">-- Select Vessel --</option>
                                <option value="celiac">Celiac Trunk</option>
                                <option value="hepatic">Hepatic Portal Vein</option>
                                <option value="renal">Renal Arteries</option>
                                <option value="jugular">Internal Jugular Vein</option>
                            </select>
                        </div>

                        <button onclick="window.verifyHemodynamicsResistance()" class="w-full py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white transition shadow-lg shadow-rose-900/20">Verify Hemodynamics</button>
                        <div id="sandbox-feedback" class="text-[10px] text-slate-400 text-center">Decrease radius (constriction) to increase resistance significantly. Identify celiac trunk.</div>
                    </div>
                `;
                window.updateHemoCalculations = (val) => {
                    const r = parseFloat(val) / 10;
                    document.getElementById('hemo-radius-display').textContent = r.toFixed(1);
                    
                    // R = 1/r^4
                    const R = 1 / Math.pow(r, 4);
                    document.getElementById('hemo-resistance-display').textContent = R.toFixed(2) + " R";
                };
                window.verifyHemodynamicsResistance = () => {
                    const r = parseFloat(document.getElementById('hemo-radius-display').textContent);
                    const vessel = document.getElementById('vessel-celiac').value;
                    const feedback = document.getElementById('sandbox-feedback');
                    if (r <= 0.6 && vessel === 'celiac') {
                        feedback.innerHTML = "<span class='text-emerald-400 font-bold'>Correct!</span> Vasoconstriction (radius <= 0.6) increases resistance dramatically (R ~ 8x). The celiac trunk supplies liver, spleen, and stomach. Lab complete.";
                        completeSandbox('lesson_2_6');
                    } else if (vessel !== 'celiac') {
                        feedback.textContent = "Incorrect vessel identification. Check abdominal aorta branches supplying stomach/spleen.";
                    } else {
                        feedback.textContent = "Please constrict the vessels (radius <= 0.6) to demonstrate resistance change.";
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
