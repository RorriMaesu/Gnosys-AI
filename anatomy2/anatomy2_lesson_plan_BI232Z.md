# BI 232Z: Anatomy & Physiology II

**Target Audience:** Undergraduate college students taking their second course in human anatomy & physiology.
**AI Instruction:** When generating a lesson, you MUST use the exact Concept, Clinical/Real-World Hook, Interactive Target, and Feynman Prompt provided in this document. Lectures must be comprehensive, college-level, and approximately 600-800 words, structured using clear markdown headers (###) into four sections: (1) Real-World Case Study, (2) Core Physiological Principles, (3) Empirical & Methodological Frameworks, and (4) Clinical & Practical Application.

---

## Module 1: Nervous Coordination & Sensory Systems
*Goal: Understand brain architecture, autonomic controls, and sensory transduction pathways.*

### Lesson 2.1: The Central Nervous System (CNS)
* **Concept:** Cerebrum functional areas (lobes, motor/sensory cortex), cerebellum motor coordination, ascending (spinothalamic, dorsal column-medial lemniscal) and descending (corticospinal) spinal tracts, ventricles, and cerebrospinal fluid (CSF) flow path.
* **Clinical/Real-World Hook:** Tracing cerebrospinal fluid blockage to explain obstructive hydrocephalus, or mapping localized stroke deficits to specific cerebral artery territories.
* **Interactive Target:** `cns-tract-router`
* **Feynman Prompt:** "Detail the structural organization of the central nervous system, tracing ascending and descending tracts and the pathway of cerebrospinal fluid circulation."

### Lesson 2.2: The Peripheral (PNS) & Autonomic Nervous System (ANS)
* **Concept:** Cranial nerves, spinal nerves, plexuses, and dermatomes. Autonomic divisions: Sympathetic vs. Parasympathetic pre- and post-ganglionic pathways, neurotransmitters (acetylcholine, norepinephrine), and receptors (nicotinic, muscarinic, adrenergic alpha/beta).
* **Clinical/Real-World Hook:** Evaluating a patient showing symptoms of autonomic hyperreflexia (lock of control below spinal cord lesion) or diagnosing pharmacological effects of beta-blockers.
* **Interactive Target:** `autonomic-simulator`
* **Feynman Prompt:** "Contrast the sympathetic and parasympathetic divisions of the autonomic nervous system, highlighting pre- and post-ganglionic neurotransmitters and receptor interactions."

### Lesson 2.3: The Special & Somatic Senses
* **Concept:** Somatic and general senses (cutaneous mechanoreceptors [Meissner's and Pacinian corpuscles], nociceptors, proprioceptors), sensory pathways from receptor to postcentral gyrus. Special senses: Photoreception transduction (rhodopsin bleaching), audition (hair cells, cochlea mechanics), olfaction, and gustation.
* **Clinical/Real-World Hook:** Evaluating localized sensory loss in patients with peripheral nerve compression (carpal tunnel) and explaining visual field deficits from optic chiasm compression.
* **Interactive Target:** `sensory-propagation-mapper`
* **Feynman Prompt:** "Explain how somatic mechanoreceptors and special sensory systems convert physical stimuli into neural action potentials and propagate them to the sensory cortex."

---

## Module 2: Endocrine & Hematological Regulation
*Goal: Master endocrine signaling pathways and blood physiology.*

### Lesson 2.4: The Endocrine System
* **Concept:** Hypothalamic-hypophyseal tract and portal system, hormone classifications (peptide, steroid, amine), second-messenger systems (cAMP, IP3/DAG) vs. direct gene activation. Homeostatic feedback axes (thyroid HPT, adrenal HPA, growth hormone).
* **Clinical/Real-World Hook:** Diagnosing hyperthyroidism (Graves' disease) vs. hypothyroidism using serum TSH and thyroxine levels, and explaining endocrine pancreas failure in Type 1 diabetes.
* **Interactive Target:** `endocrine-simulator`
* **Feynman Prompt:** "Describe the differences in mechanisms between water-soluble and lipid-soluble hormones, and outline the feedback loops of a major hypothalamic-pituitary endocrine axis."

### Lesson 2.5: The Cardiovascular System: Blood
* **Concept:** Plasma composition, formed elements, erythropoiesis and its regulation by erythropoietin (EPO), blood typing antigens and antibodies (ABO and Rh systems), hemostasis stages (vascular spasm, platelet plug, coagulation cascade intrinsic vs. extrinsic vs. common pathways).
* **Clinical/Real-World Hook:** Testing donor-recipient blood compatibility to prevent hemolytic transfusion reactions, and treating deep vein thrombosis using anti-coagulants (heparin, warfarin).
* **Interactive Target:** `blood-matching-lab`
* **Feynman Prompt:** "Detail the steps of erythropoiesis and the coagulation cascade, and explain the immunological basis of ABO and Rh blood compatibility."

---

## Module 3: Cardiovascular Hemodynamics
*Goal: Master cardiac mechanics and blood vessel hemodynamics.*

### Lesson 2.6: The Cardiovascular System: The Heart & Hemodynamics
* **Concept:** Internal anatomy of the heart, pathway of blood, cardiac conduction system (SA node, AV node, bundle branches, Purkinje fibers), cardiac cycle mechanical phases, ECG wave interpretation (P, QRS, T), Wiggers diagram. Hemodynamics: vessel radius, blood viscosity, vessel length, Poiseuille's law, regulation of blood pressure. Systemic Circulatory Vessel Map (celiac trunk, renal arteries, hepatic portal system, internal/external jugulars, circle of Willis).
* **Clinical/Real-World Hook:** Diagnosing heart murmurs (mitral stenosis vs. aortic regurgitation) on a Wiggers diagram, and adjusting vessel radius sliders to observe how arteriole constriction alters total peripheral resistance.
* **Interactive Target:** `ecg-hemodynamics-editor`
* **Feynman Prompt:** "Explain the mechanical and electrical events of the cardiac cycle, how ECG waves correlate with contraction, and describe the physical factors that regulate hemodynamics and systemic vessel flow."
