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
        lesson_1_1: () => [
            {
                question: "Which anatomical plane cuts horizontally through the body, dividing it into superior and inferior portions?",
                options: ["Sagittal Plane", "Coronal Plane", "Transverse Plane", "Frontal Plane"],
                correctAnswer: 2,
                explanation: "The transverse (horizontal) plane divides the body into upper (superior) and lower (inferior) sections."
            },
            {
                question: "A patient reports acute pain in the upper right abdominal area, directly beneath the ribs. In which abdominopelvic region is this pain located?",
                options: ["Epigastric Region", "Right Hypochondriac Region", "Right Lumbar Region", "Umbilical Region"],
                correctAnswer: 1,
                explanation: "The right hypochondriac region is situated in the upper right section of the abdomen, underneath the rib cartilage."
            },
            {
                question: "Which of the following is the correct sequence of events in a homeostatic negative feedback loop when body temperature increases?",
                options: [
                    "Thermoreceptors sense heat ➔ Hypothalamus processes signal ➔ Sweat glands secrete sweat (reducing temperature)",
                    "Sweat glands secrete sweat ➔ Thermoreceptors sense cooling ➔ Hypothalamus increases shivering",
                    "Hypothalamus senses heat ➔ Thermoreceptors activate ➔ Vasoconstriction occurs in skin",
                    "Thermoreceptors sense cold ➔ Hypothalamus processes signal ➔ Vasodilation increases core heat"
                ],
                correctAnswer: 0,
                explanation: "The negative feedback loop goes from Sensor (thermoreceptors) ➔ Control Center (hypothalamus) ➔ Effector (sweat glands secreting sweat to decrease temperature)."
            },
            {
                question: "How do effector actions in severe hyperthermia change skin blood flow to restore homeostatic balance?",
                options: [
                    "Skin vessels undergo vasoconstriction to keep blood inside the warm body core.",
                    "Skin vessels undergo vasodilation to dump heat to the surrounding environment.",
                    "Blood flow to the skin stops completely to preserve vital organ pressure.",
                    "Skin vessels undergo alternating constriction and dilation to pump heat away."
                ],
                correctAnswer: 1,
                explanation: "Cutaneous vasodilation increases blood flow to the skin, allowing heat to radiate away from the body."
            },
            {
                question: "What occurs during a homeostatic feedback failure state when external heat load exceeds cooling capacity?",
                options: [
                    "Negative feedback switches to positive feedback, causing temperature to drift further from set-point and damage tissue.",
                    "The control center shuts down all effector systems to prevent metabolic fatigue.",
                    "Sensors adapt and report a normal 37.0°C temperature despite the physical thermal rise.",
                    "Positive feedback loops activate to rapidly lower the temperature set-point."
                ],
                correctAnswer: 0,
                explanation: "Feedback failure means corrective negative loops fail, and positive loop kinetics take over as heat damage accelerates cellular metabolic heat production, driving temperature higher."
            }
        ],
        lesson_1_2: () => [
            {
                qText: "Describe the structural components of an atom and define an isotope.",
                maxScore: 10,
                rubric: {
                    criteria: [
                        { desc: "Identifies protons, neutrons, electrons and locations (nucleus vs orbitals)", points: 5 },
                        { desc: "Defines isotopes as atoms of same element with differing neutron counts", points: 5 }
                    ]
                }
            },
            {
                qText: "Contrast ionic, covalent (polar and nonpolar), and hydrogen bonds, providing physiological examples.",
                maxScore: 10,
                rubric: {
                    criteria: [
                        { desc: "Contrasts electron transfer (ionic) vs. sharing (covalent) vs. dipole-dipole attractions (hydrogen)", points: 5 },
                        { desc: "Provides accurate physiological examples (NaCl, O2, H2O molecules, DNA double helix)", points: 5 }
                    ]
                }
            },
            {
                qText: "Explain the properties of water that support cellular life and detail the bicarbonate buffer system.",
                maxScore: 10,
                rubric: {
                    criteria: [
                        { desc: "Details water solvency, high heat capacity, and polar bonding properties", points: 5 },
                        { desc: "Explains how HCO3- and H+ bind/release to buffer blood pH shifts", points: 5 }
                    ]
                }
            }
        ],
        lesson_1_3: () => [
            {
                question: "According to enzyme kinetics, how do cellular enzymes catalyze metabolic biochemical reactions?",
                options: [
                    "By raising the activation energy required for the reaction.",
                    "By lowering the activation energy barrier, speeding up reaction rates.",
                    "By generating ATP to phosphorylate reactants.",
                    "By changing the pH of the cellular cytoplasm to neutral."
                ],
                correctAnswer: 1,
                explanation: "Enzymes are organic catalysts that accelerate biochemical reactions by lowering the activation energy barrier."
            },
            {
                question: "Which organic macromolecule functions primarily as the cell's long-term energy storage, forms lipid bilayers of membranes, and acts as steroid hormones?",
                options: ["Carbohydrates", "Lipids", "Proteins", "Nucleic Acids"],
                correctAnswer: 1,
                explanation: "Lipids are hydrophobic molecules that function in energy storage (triglycerides), membrane structures (phospholipids), and hormonal signaling (steroids)."
            },
            {
                question: "In enzyme kinetics, what does the term Vmax represent?",
                options: [
                    "The maximum volume of the cellular cytoplasm.",
                    "The velocity of enzymatic reaction when the enzyme is fully saturated with substrate.",
                    "The substrate concentration at which reaction rate is half of maximum.",
                    "The voltage limit of resting membrane potentials."
                ],
                correctAnswer: 1,
                explanation: "Vmax is the maximum rate or velocity of an enzymatic reaction achieved when all active sites on the enzyme are saturated with substrate."
            },
            {
                question: "What is the primary role of adenosine triphosphate (ATP) in cellular respiration?",
                options: [
                    "To act as a structural building block for the cell wall.",
                    "To store genetic instructions for protein synthesis.",
                    "To store and transfer chemical energy within cells for metabolic work.",
                    "To buffer the cellular cytoplasm against basic changes."
                ],
                correctAnswer: 2,
                explanation: "ATP acts as the primary chemical energy carrier in all cells, capturing energy from glucose catabolism and releasing it to power cellular work."
            },
            {
                question: "Which of the following is the primary chemical buffer system responsible for balancing cellular and blood pH?",
                options: [
                    "The sodium-potassium buffer system",
                    "The carbonic acid-bicarbonate buffer system",
                    "The lactic acid-pyruvate buffer system",
                    "The hydrochloric acid-sodium chloride buffer system"
                ],
                correctAnswer: 1,
                explanation: "The carbonic acid-bicarbonate buffer system maintains pH balance in extracellular fluids by neutralizing excess hydrogen ions or hydroxide ions."
            }
        ],
        lesson_1_4: () => [
            {
                question: "Which membrane transport mechanism uses cellular energy (ATP) directly to pump sodium ions out of the cell against their concentration gradient?",
                options: ["Simple Diffusion", "Facilitated Diffusion", "Primary Active Transport", "Secondary Active Transport"],
                correctAnswer: 2,
                explanation: "Primary active transport (like the Na+/K+ ATPase pump) directly hydrolyzes ATP to move ions against their electrochemical gradient."
            },
            {
                question: "A nurse mistakenly infuses a sterile, pure water IV solution into a patient's vein. What will happen to the patient's red blood cells, and why?",
                options: [
                    "The cells will crenate because the solution is hypertonic.",
                    "The cells will swell and lyse because the solution is hypotonic relative to intracellular fluid.",
                    "The cells will remain unaffected because water is biologically neutral.",
                    "The cells will undergo simple diffusion of hemoglobin out of the membrane."
                ],
                correctAnswer: 1,
                explanation: "Pure water is hypotonic to red blood cells (which contain solutes). Water will rush into the cells by osmosis, causing them to swell and burst (hemolysis)."
            },
            {
                question: "During protein synthesis, the process of copying a gene's DNA sequence into a complementary messenger RNA (mRNA) strand is called _______, which occurs in the _______.",
                options: [
                    "translation; cytoplasm",
                    "transcription; nucleus",
                    "replication; nucleolus",
                    "transcription; ribosomes"
                ],
                correctAnswer: 1,
                explanation: "Transcription is the process of synthesizing mRNA from a DNA template in the nucleus. Translation is the decoding of mRNA into a polypeptide chain at the ribosome in the cytoplasm."
            },
            {
                question: "During which phase of mitosis do sister chromatids separate and move toward opposite poles of the cell?",
                options: ["Prophase", "Metaphase", "Anaphase", "Telophase"],
                correctAnswer: 2,
                explanation: "During anaphase, sister chromatids (now chromosomes) are pulled apart by spindle fibers toward opposite poles of the cell."
            },
            {
                question: "Which type of cell junction forms an impermeable seal between adjacent cells, preventing molecules from passing through the intercellular space?",
                options: ["Desmosomes", "Tight Junctions", "Gap Junctions", "Hemidesmosomes"],
                correctAnswer: 1,
                explanation: "Tight junctions (occluding junctions) seal adjacent epithelial cells together, creating a barrier that prevents leakage of extracellular fluid across the cellular sheet."
            }
        ],
        lesson_1_5: () => [
            {
                question: "Which primary tissue type is characterized by tightly packed cells, has no direct blood supply (avascular), and covers body surfaces?",
                options: ["Epithelial Tissue", "Connective Tissue", "Muscle Tissue", "Nervous Tissue"],
                correctAnswer: 0,
                explanation: "Epithelial tissues are cellular sheets that line cavities and cover surfaces. They are avascular and rely on diffusion from underlying connective tissues."
            },
            {
                question: "Connective tissues are distinguished from other tissue types primarily by having:",
                options: [
                    "A high density of excitable neurons and glia.",
                    "An abundance of extracellular matrix containing protein fibers and ground substance.",
                    "Interlocking cells linked by intercalated discs.",
                    "A direct apical surface facing the exterior environment."
                ],
                correctAnswer: 1,
                explanation: "Connective tissues consist of sparse cells scattered within an abundant extracellular matrix (fibers and ground substance)."
            },
            {
                question: "Which type of muscle tissue is striated, branched, contains single central nuclei, and is connected by intercalated discs?",
                options: ["Skeletal Muscle", "Smooth Muscle", "Cardiac Muscle", "Voluntary Muscle"],
                correctAnswer: 2,
                explanation: "Cardiac muscle is striated, branched, and possesses intercalated discs containing gap junctions and desmosomes."
            },
            {
                question: "Under a microscope, you observe a tissue lining the urinary bladder that has rounded, dome-shaped 'umbrella' cells at the apical layer. What tissue is this?",
                options: ["Simple Squamous Epithelium", "Stratified Squamous Epithelium", "Transitional Epithelium", "Pseudostratified Columnar Epithelium"],
                correctAnswer: 2,
                explanation: "Transitional epithelium is specialized to stretch. Apical cells are dome-like when relaxed and flatten out when the bladder is distended."
            },
            {
                question: "What is the primary cellular difference between neurons and neuroglia in nervous tissue?",
                options: [
                    "Neurons generate and propagate action potentials, while neuroglia provide structural and metabolic support.",
                    "Neuroglia transmit long-distance electrical signals, while neurons secrete the myelin sheath.",
                    "Neurons lack nuclei, while neuroglial cells are multinucleated.",
                    "Neuroglia only occur in the peripheral nerves, while neurons exist in the brain."
                ],
                correctAnswer: 0,
                explanation: "Neurons are the excitable cells that transmit nerve impulses. Neuroglia are support cells that protect and nourish neurons."
            },
            {
                question: "Which type of body membrane lines cavities that are closed to the exterior environment, such as the pleural, pericardial, and peritoneal cavities, and consists of simple squamous epithelium resting on a thin layer of loose connective tissue?",
                options: ["Mucous Membrane", "Serous Membrane", "Cutaneous Membrane", "Synovial Membrane"],
                correctAnswer: 1,
                explanation: "Serous membranes (serosae) line closed ventral body cavities and secrete watery serous fluid to reduce friction between moving organs."
            },
            {
                question: "During which type of exocrine gland secretion does the cell accumulate its secretory product in the cytoplasm, and then the entire cell ruptures and dies to release the secretion (as seen in sebaceous glands)?",
                options: ["Merocrine Secretion", "Apocrine Secretion", "Holocrine Secretion", "Eccrine Secretion"],
                correctAnswer: 2,
                explanation: "In holocrine secretion, the entire cell ruptures to release its contents. In merocrine secretion, products are released via exocytosis, and in apocrine secretion, only the apical portion of the cell pinches off."
            }
        ],
        lesson_1_6: () => [
            {
                question: "Put the strata of the epidermis in the correct order from the deepest layer to the most superficial layer (in thick skin):",
                options: [
                    "Corneum, Lucidum, Granulosum, Spinosum, Basale",
                    "Basale, Spinosum, Granulosum, Lucidum, Corneum",
                    "Basale, Granulosum, Spinosum, Corneum, Lucidum",
                    "Spinosum, Basale, Granulosum, Corneum, Lucidum"
                ],
                correctAnswer: 1,
                explanation: "The correct sequence from deep to superficial is: Stratum Basale ➔ Stratum Spinosum ➔ Stratum Granulosum ➔ Stratum Lucidum ➔ Stratum Corneum."
            },
            {
                question: "Which epidermal cells act as antigen-presenting immune cells, patrolling the stratum spinosum for pathogens?",
                options: ["Keratinocytes", "Melanocytes", "Langerhans (Dendritic) Cells", "Merkel Cells"],
                correctAnswer: 2,
                explanation: "Langerhans cells (dendritic cells) are specialized macrophages that reside in the epidermis and present foreign antigens to trigger immune responses."
            },
            {
                question: "Which of the following describes the correct chronological sequence of deep wound healing in the skin?",
                options: [
                    "Inflammatory ➔ Hemostasis ➔ Remodeling ➔ Proliferative",
                    "Hemostasis ➔ Inflammatory ➔ Proliferative ➔ Remodeling",
                    "Proliferative ➔ Hemostasis ➔ Inflammatory ➔ Remodeling",
                    "Remodeling ➔ Inflammatory ➔ Proliferative ➔ Hemostasis"
                ],
                correctAnswer: 1,
                explanation: "Wound healing follows: Hemostasis (clotting) ➔ Inflammatory (clearing debris) ➔ Proliferative (new tissue/collagen) ➔ Remodeling (maturation of scar)."
            },
            {
                question: "Using the Rule of Nines, calculate the burn percentage for an adult patient with severe burns covering their entire right upper limb (arm) and the entire anterior chest/abdomen (trunk).",
                options: ["18%", "27%", "36%", "45%"],
                correctAnswer: 1,
                explanation: "Rule of Nines values: Entire right arm = 9%. Anterior trunk = 18%. Sum: 9% + 18% = 27%."
            },
            {
                question: "When evaluating a patient for skin melanoma using the ABCDE criteria, what does the 'D' represent?",
                options: ["Depth of invasion", "Diameter greater than 6 mm", "Discoloration intensity", "Dermal borders"],
                correctAnswer: 1,
                explanation: "In ABCDE criteria: A=Asymmetry, B=Border, C=Color, D=Diameter (>6mm), E=Evolving."
            }
        ],
        lesson_1_7: () => [
            {
                question: "What structural bone unit consists of concentric lamellae rings surrounding a central vascular canal?",
                options: ["Trabecula", "Osteon", "Canaliculus", "Lacuna"],
                correctAnswer: 1,
                explanation: "The osteon (Haversian system) is the basic structural unit of compact bone, consisting of lamellae surrounding a central canal containing blood vessels."
            },
            {
                question: "Which bone cell is responsible for bone resorption (breaking down mineralized matrix using enzymes and acids)?",
                options: ["Osteocyte", "Osteoblast", "Osteoclast", "Osteoprogenitor Cell"],
                correctAnswer: 2,
                explanation: "Osteoclasts are large, multinucleated cells derived from monocytes that resorb (dissolve) bone matrix."
            },
            {
                question: "How does the body regulate low blood calcium levels via hormonal negative feedback?",
                options: [
                    "Thyroid gland secretes Calcitonin to stimulate osteoblasts to store calcium.",
                    "Parathyroid glands secrete PTH to stimulate osteoclast resorption and K+ excretion.",
                    "Parathyroid glands secrete PTH to stimulate osteoclast resorption and increase renal Ca2+ reabsorption.",
                    "Adrenal glands secrete aldosterone to increase calcium levels."
                ],
                correctAnswer: 2,
                explanation: "When blood Ca2+ is low, parathyroid glands release Parathyroid Hormone (PTH), which increases osteoclast activity (resorption) and increases calcium retention in the kidneys."
            },
            {
                question: "A young patient presents with a skeletal injury where the bone is partially fractured and bent, but not completely broken into two pieces. Which type of bone fracture is this?",
                options: ["Comminuted Fracture", "Greenstick Fracture", "Spiral Fracture", "Compound Fracture"],
                correctAnswer: 1,
                explanation: "Greenstick fractures are incomplete fractures where one side of the bone breaks and the other bends. They occur primarily in children whose bones are more flexible."
            },
            {
                question: "What is the correct chronological sequence of the four physiological stages of bone fracture repair?",
                options: [
                    "Hematoma formation ➔ Fibrocartilaginous callus formation ➔ Bony callus formation ➔ Bone remodeling",
                    "Fibrocartilaginous callus formation ➔ Hematoma formation ➔ Bony callus formation ➔ Bone remodeling",
                    "Hematoma formation ➔ Bony callus formation ➔ Fibrocartilaginous callus formation ➔ Bone remodeling",
                    "Bony callus formation ➔ Hematoma formation ➔ Fibrocartilaginous callus formation ➔ Bone remodeling"
                ],
                correctAnswer: 0,
                explanation: "Bone fracture repair proceeds through: 1) Hematoma (blood clot) formation, 2) Fibrocartilaginous (soft) callus formation, 3) Bony (hard) callus formation by osteoblasts, and 4) Bone remodeling to restore original structure."
            }
        ],
        lesson_1_8: () => [
            {
                question: "Which of the following is a bone of the axial skeleton?",
                options: ["Clavicle", "Sternum", "Scapula", "Femur"],
                correctAnswer: 1,
                explanation: "The axial skeleton forms the central axis of the body and includes the skull, vertebral column, ribs, and sternum. The clavicle, scapula, and femur are part of the appendicular skeleton."
            },
            {
                question: "What is the name of the prominent opening at the base of the occipital bone through which the spinal cord connects to the brain?",
                options: ["Foramen Magnum", "Sella Turcica", "Glenoid Cavity", "Mandibular Fossa"],
                correctAnswer: 0,
                explanation: "The foramen magnum is the large opening in the occipital bone of the skull, allowing the brain stem/spinal cord to pass through."
            },
            {
                question: "Which cranial bone contains the sella turcica, a saddle-like depression that houses the pituitary gland?",
                options: ["Temporal bone", "Sphenoid bone", "Ethmoid bone", "Frontal bone"],
                correctAnswer: 1,
                explanation: "The sphenoid bone, located at the center of the skull base, features the sella turcica (Turkish saddle) which protects the master endocrine gland, the pituitary gland."
            },
            {
                question: "A patient presents with pain localized to the bone that forms the forehead and the superior portion of the orbit. Which bone is affected?",
                options: ["Parietal bone", "Occipital bone", "Frontal bone", "Zygomatic bone"],
                correctAnswer: 2,
                explanation: "The frontal bone forms the forehead, the roof of the nasal cavity, and the superior arches of the orbits (eye sockets)."
            },
            {
                question: "Which region of the vertebral column consists of 5 fused vertebrae that articulate laterally with the pelvic girdle?",
                options: ["Cervical vertebrae", "Thoracic vertebrae", "Lumbar vertebrae", "Sacrum"],
                correctAnswer: 3,
                explanation: "The sacrum is a triangular bone formed by the fusion of five sacral vertebrae (S1-S5). It articulates with the coxal (hip) bones to form the sacroiliac joint, anchoring the vertebral column to the pelvis."
            }
        ],
        lesson_1_9: () => [
            {
                question: "A patient's radiology scan shows a fracture in the cup-like socket of the coxal bone that articulates with the head of the femur. What is this landmark called?",
                options: ["Glenoid Cavity", "Acetabulum", "Foramen Magnum", "Sella Turcica"],
                correctAnswer: 1,
                explanation: "The acetabulum is the deep, round socket on the lateral surface of the coxal bone (pelvis) that receives the head of the femur to form the hip joint."
            },
            {
                question: "Which shallow cavity on the lateral angle of the scapula articulates with the head of the humerus to form the glenohumeral (shoulder) joint?",
                options: ["Acetabulum", "Mandibular Fossa", "Glenoid Cavity", "Coracoid Process"],
                correctAnswer: 2,
                explanation: "The glenoid cavity of the scapula is a shallow socket that receives the head of the humerus, forming the highly mobile shoulder joint."
            },
            {
                question: "The prominent, non-articular bony projections located on the proximal femur that serve as attachment sites for powerful hip and thigh muscles are the:",
                options: ["Condyles", "Tuberosities", "Trochanters", "Fossae"],
                correctAnswer: 2,
                explanation: "The greater and lesser trochanters are large, bony projections unique to the proximal femur that serve as major attachment points for gluteal and other deep rotatory hip/thigh muscles."
            },
            {
                question: "Which of the following bones forms the lateral side of the forearm in anatomical position and articulates with the carpal bones at the wrist?",
                options: ["Ulna", "Radius", "Humerus", "Fibula"],
                correctAnswer: 1,
                explanation: "In the anatomical position, the radius is the lateral bone of the forearm (on the thumb side), whereas the ulna is medial (on the pinky side)."
            },
            {
                question: "Which pelvic bone marking is the rough, inferior projection of the ischium that bears the body's weight when sitting?",
                options: ["Ischial Spine", "Ischial Tuberosity", "Iliac Crest", "Pubic Symphysis"],
                correctAnswer: 1,
                explanation: "The ischial tuberosity (often called the 'sit bone') is a rough, inferior projection of the ischium that supports the weight of the pelvis when in a seated position."
            }
        ],
        lesson_1_10: () => [
            {
                question: "Rotating the forearm so that the palm faces anteriorly or upward is called:",
                options: ["Pronation", "Supination", "Inversion", "Eversion"],
                correctAnswer: 1,
                explanation: "Supination is the movement of the forearm that turns the palm anteriorly (upwards). Pronation turns the palm posteriorly (downwards)."
            },
            {
                question: "Which joint classification is structurally connected by a fluid-filled cavity and is functionally defined as a freely movable diarthrosis?",
                options: ["Fibrous Joint", "Cartilaginous Joint", "Synovial Joint", "Synarthrosis Joint"],
                correctAnswer: 2,
                explanation: "Synovial joints contain a joint cavity filled with synovial fluid and are structurally designed for high mobility, making them diarthroses."
            },
            {
                question: "The sutures of the skull and the gomphoses anchoring teeth to their sockets are examples of which structural joint classification?",
                options: ["Synovial Joints", "Cartilaginous Joints", "Fibrous Joints", "Diarthroses"],
                correctAnswer: 2,
                explanation: "Fibrous joints are joined by dense fibrous connective tissue and lack a joint cavity. Sutures and gomphoses are classic examples of fibrous joints that allow little to no movement."
            },
            {
                question: "The pubic symphysis and intervertebral discs are examples of symphyses, which are joined by fibrocartilage. How are these joints functionally classified based on mobility?",
                options: ["Synarthrosis", "Amphiarthrosis", "Diarthrosis", "Synovial"],
                correctAnswer: 1,
                explanation: "Symphyses are cartilaginous joints connected by fibrocartilage, allowing slight movement, which classifies them functionally as amphiarthroses."
            },
            {
                question: "Which type of uniaxial synovial joint allows rotation around a single axis, such as the atlantoaxial joint between the first two cervical vertebrae?",
                options: ["Hinge joint", "Pivot joint", "Ball-and-socket joint", "Saddle joint"],
                correctAnswer: 1,
                explanation: "A pivot joint is a uniaxial joint where a rounded portion of bone rotates within a ring formed by another bone and a ligament. The atlantoaxial joint and proximal radioulnar joint are pivot joints."
            }
        ],
        lesson_1_11: () => [
            {
                question: "Which protein in a sarcomere covers the myosin-binding sites on actin when a muscle is at rest?",
                options: ["Troponin", "Tropomyosin", "Titin", "Myosin"],
                correctAnswer: 1,
                explanation: "Tropomyosin is a filamentous protein that wraps around actin and physically blocks the myosin-binding sites in a resting muscle cell."
            },
            {
                question: "What role does Calcium (Ca2+) play in triggering sarcomere contraction?",
                options: [
                    "Ca2+ binds to troponin, causing a conformational change that pulls tropomyosin off the actin active sites.",
                    "Ca2+ binds to myosin, activating the ATPase head directly.",
                    "Ca2+ enters the synaptic cleft to block ACh receptors.",
                    "Ca2+ hydrolyzes ATP to reset the cross-bridge."
                ],
                correctAnswer: 0,
                explanation: "Ca2+ released from sarcoplasmic reticulum binds to troponin. Troponin then shifts tropomyosin, exposing myosin-binding sites on actin."
            },
            {
                question: "Put the steps of the cross-bridge cycle in the correct chronological order:",
                options: [
                    "Power stroke ➔ Myosin binds actin ➔ ATP binds and detaches myosin ➔ Myosin head resets",
                    "Myosin binds actin ➔ Power stroke ➔ ATP binds and detaches myosin ➔ Myosin head hydrolyzes ATP to reset",
                    "ATP binds and detaches myosin ➔ Myosin binds actin ➔ Power stroke ➔ Myosin resets",
                    "Myosin head resets ➔ ATP binds and detaches myosin ➔ Myosin binds actin ➔ Power stroke"
                ],
                correctAnswer: 1,
                explanation: "The correct sequence is: Cross-bridge attachment (myosin binds actin) ➔ Power stroke (myosin pulls actin and releases ADP/Pi) ➔ Detachment (new ATP binds) ➔ Reactivation (ATP is hydrolyzed, resetting myosin head)."
            },
            {
                question: "How does Botox (Botulinum toxin) cause flaccid muscle paralysis?",
                options: [
                    "By binding to and blocking acetylcholine receptors on the motor end plate.",
                    "By inhibiting the release of acetylcholine at the neuromuscular junction.",
                    "By locking voltage-gated sodium channels in an open state.",
                    "By preventing calcium uptake by the sarcoplasmic reticulum."
                ],
                correctAnswer: 1,
                explanation: "Botulinum toxin cleaves SNARE proteins at the presynaptic motor neuron terminal, preventing vesicle fusion and blockading ACh release, causing flaccid paralysis."
            },
            {
                question: "Which type of muscle contraction occurs when muscle tension develops, but the muscle does not change in length and the load is not moved (e.g., maintaining posture or holding a heavy book in a static position)?",
                options: ["Concentric Isotonic Contraction", "Eccentric Isotonic Contraction", "Isometric Contraction", "Tetanic Contraction"],
                correctAnswer: 2,
                explanation: "An isometric contraction occurs when tension is generated within the muscle, but muscle length remains constant because the load exceeds the maximal force produced."
            },
            {
                question: "When a muscle is stimulated at such a high frequency that the relaxation phase between stimuli completely disappears, resulting in a smooth, sustained, and maximal contraction, the muscle is in a state of:",
                options: ["Treppe", "Incomplete Tetanus", "Complete (Fused) Tetanus", "Wave Summation"],
                correctAnswer: 2,
                explanation: "Complete (fused) tetanus occurs at very high frequency stimulation where the muscle has no time to relax between stimuli, producing a smooth, maximal, and continuous plateau of tension."
            }
        ],
        lesson_1_12: () => [
            {
                question: "During elbow flexion, the biceps brachii acts as the main muscle driving the movement, while the triceps brachii must relax. What are their respective terms?",
                options: [
                    "Biceps = Antagonist; Triceps = Agonist",
                    "Biceps = Agonist (Prime Mover); Triceps = Antagonist",
                    "Biceps = Synergist; Triceps = Fixator",
                    "Biceps = Fixator; Triceps = Synergist"
                ],
                correctAnswer: 1,
                explanation: "The agonist (prime mover) is the main muscle contracting to cause a movement (biceps). The antagonist opposes that movement and must relax (triceps)."
            },
            {
                question: "Which muscle is the prime mover of jaw closure (mastication)?",
                options: ["Temporalis", "Masseter", "Sternocleidomastoid", "Deltoid"],
                correctAnswer: 1,
                explanation: "The masseter muscle originates on the zygomatic arch and inserts into the mandible, serving as the prime mover of jaw closure."
            },
            {
                question: "Which muscle is the prime mover of arm abduction along the frontal plane?",
                options: ["Pectoralis Major", "Latissimus Dorsi", "Deltoid", "Biceps Brachii"],
                correctAnswer: 2,
                explanation: "The deltoid muscle is the powerful prime mover of arm abduction (moving the arm away from the midline along the frontal plane)."
            },
            {
                question: "Which of the following muscles is located in the anterior compartment of the thigh and acts to extend the leg at the knee?",
                options: ["Biceps Femoris", "Rectus Femoris", "Gastrocnemius", "Gluteus Maximus"],
                correctAnswer: 1,
                explanation: "The rectus femoris is a member of the quadriceps femoris muscle group in the anterior thigh, acting to extend the knee (leg) and flex the hip."
            },
            {
                question: "A lever system where the load is positioned between the fulcrum and the effort (such as standing on your tiptoes, where the calf muscles lift the body weight) operates at a mechanical advantage and is classified as a:",
                options: ["First-class lever", "Second-class lever", "Third-class lever", "Fourth-class lever"],
                correctAnswer: 1,
                explanation: "In a second-class lever, the load is between the fulcrum and the effort (F-L-E). This system always operates at a mechanical advantage because the effort arm is longer than the load arm."
            }
        ],
        lesson_1_13: () => [
            {
                question: "Which neuroglial cells are responsible for myelinating axons in the Central Nervous System (CNS)?",
                options: ["Schwann Cells", "Astrocytes", "Oligodendrocytes", "Microglia"],
                correctAnswer: 2,
                explanation: "Oligodendrocytes myelinate axons in the CNS. Schwann cells perform this function in the PNS."
            },
            {
                question: "Which star-shaped neuroglial cells in the Central Nervous System (CNS) help form the blood-brain barrier (BBB) and regulate the chemical environment around neurons?",
                options: ["Schwann Cells", "Astrocytes", "Oligodendrocytes", "Ependymal Cells"],
                correctAnswer: 1,
                explanation: "Astrocytes are the most abundant glial cells in the CNS. They wrap around capillaries to form the blood-brain barrier, regulate extracellular ion and neurotransmitter concentrations, and support neurons structurally."
            },
            {
                question: "Which type of neuroglia acts as the resident immune cells (macrophages) of the Central Nervous System (CNS), phagocytizing pathogens and cellular debris?",
                options: ["Ependymal Cells", "Microglia", "Schwann Cells", "Satellite Cells"],
                correctAnswer: 1,
                explanation: "Microglia are specialized immune cells in the CNS that act as phagocytes to clear damaged cells, debris, and pathogens, playing a crucial protective role."
            },
            {
                question: "Which part of a neuron receives incoming synaptic signals from other neurons and conducts electrical changes toward the soma?",
                options: ["Axon", "Dendrites", "Myelin Sheath", "Axon Hillock"],
                correctAnswer: 1,
                explanation: "Dendrites are thin, branching processes extending from the neuron's cell body (soma) that receive chemical signals from presynaptic terminals and transmit them inward."
            },
            {
                question: "What type of neuroglia lines the ventricles of the brain and the central canal of the spinal cord, producing and circulating cerebrospinal fluid (CSF)?",
                options: ["Oligodendrocytes", "Astrocytes", "Ependymal Cells", "Schwann Cells"],
                correctAnswer: 2,
                explanation: "Ependymal cells are ciliated cuboidal or columnar cells that line the fluid-filled cavities of the CNS. They produce, monitor, and assist in the circulation of cerebrospinal fluid."
            }
        ],
        lesson_1_14: () => [
            {
                question: "During an action potential, what causes the rapid depolarization phase?",
                options: [
                    "Slow efflux of sodium ions.",
                    "Rapid influx of potassium ions.",
                    "Rapid influx of sodium ions through voltage-gated Na+ channels.",
                    "Active transport of calcium ions out of the axon."
                ],
                correctAnswer: 2,
                explanation: "Depolarization occurs when the threshold potential (-55 mV) is reached, triggering the rapid opening of voltage-gated Na+ channels and sodium influx."
            },
            {
                question: "What biophysical channel event causes the repolarization phase of an action potential?",
                options: [
                    "Inactivation of voltage-gated Na+ channels and efflux of K+ through voltage-gated K+ channels.",
                    "Opening of ligand-gated Na+ channels.",
                    "Influx of chloride ions into the axon.",
                    "Active pumping of potassium ions inside the cell by the Na+/K+ pump."
                ],
                correctAnswer: 0,
                explanation: "Repolarization is driven by voltage-gated Na+ channels closing (inactivation gate) and voltage-gated K+ channels opening, allowing potassium efflux out of the neuron."
            },
            {
                question: "How do graded potentials differ from action potentials?",
                options: [
                    "Graded potentials are 'all-or-none', while action potentials decay with distance.",
                    "Graded potentials vary in amplitude depending on stimulus strength and decay over distance, while action potentials are constant amplitude and propagate without decay.",
                    "Graded potentials only happen in myelinated axons.",
                    "Graded potentials require voltage-gated calcium channels to fire."
                ],
                correctAnswer: 1,
                explanation: "Graded potentials are local changes in membrane potential that decay over distance and are proportional in size to stimulus strength. Action potentials are all-or-none and self-propagating."
            },
            {
                question: "A patient has severe hyperkalemia (abnormally high extracellular potassium). What is the biophysical effect on neurons?",
                options: [
                    "It hyperpolarizes the membrane, making it impossible to reach threshold.",
                    "It depolarizes the resting membrane potential closer to threshold, initially hyperexciting cells, but ultimately inactivating sodium channels and blocking further action potentials.",
                    "It has no effect on resting potentials, but speeds up repolarization.",
                    "It causes instant degradation of the myelin sheath."
                ],
                correctAnswer: 1,
                explanation: "High extracellular K+ reduces the concentration gradient. Less K+ leaves the cell through leakage channels, depolarizing the resting potential. This inactivates voltage-gated Na+ channels, halting further action potential propagation."
            },
            {
                question: "Which of the following describes the electrical and ion channel events during an Excitatory Postsynaptic Potential (EPSP)?",
                options: [
                    "Opening of chemically-gated chloride channels, causing hyperpolarization.",
                    "Opening of chemically-gated sodium/potassium channels, causing a localized depolarization.",
                    "Opening of voltage-gated potassium channels, causing repolarization.",
                    "Closure of leakage channels, keeping the potential constant."
                ],
                correctAnswer: 1,
                explanation: "An EPSP is a local depolarization of the postsynaptic membrane caused by neurotransmitter binding to chemically-gated (ligand-gated) channels, allowing Na+ influx to exceed K+ efflux."
            },
            {
                question: "What is the term for postsynaptic summation that occurs when a single presynaptic neuron fires nerve impulses in rapid succession, releasing neurotransmitter repeatedly to build up voltage at the postsynaptic membrane?",
                options: ["Spatial Summation", "Temporal Summation", "Synaptic Summation", "Action Summation"],
                correctAnswer: 1,
                explanation: "Temporal summation occurs when a single presynaptic neuron fires repeatedly in rapid succession (summation over time). Spatial summation occurs when multiple different presynaptic neurons fire simultaneously (summation over space)."
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
            return JSON.parse(localStorage.getItem('anatomy1_masteryMatrix') || '{}');
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

        const scoreKey = `anatomy1_homework_score_${lesson.id}`;
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
            els.masteryStatus.className = 'text-[9px] uppercase font-bold text-emerald-450 font-mono mt-0.5';
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
                <div id="explanation_${qIdx}" class="hidden pl-6 py-2.5 text-[11px] text-slate-450 bg-slate-950 border-l border-rose-600/40 rounded-r-md leading-relaxed font-mono"></div>
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
                expEl.innerHTML = `<span class="font-bold text-slate-400">Explanation:</span> ${escapeHtml(q.explanation)}`;
            }

            // check answers
            const isCorrect = (selected === q.correctAnswer);
            if (isCorrect) {
                correctCount++;
            }

            // Color label borders
            for (let i = 0; i < rads.length; i++) {
                const label = rads[i].closest('label');
                if (label) {
                    label.classList.remove('border-rose-900/20', 'border-slate-850');
                    if (i === q.correctAnswer) {
                        label.classList.add('border-emerald-500/35', 'bg-emerald-950/15');
                    } else if (i === selected) {
                        label.classList.add('border-rose-500/35', 'bg-rose-950/15');
                    }
                }
            }
        });

        const score = Math.round((correctCount / appState.currentQuestions.length) * 100);
        localStorage.setItem(`anatomy1_homework_score_${appState.selectedLessonId}`, String(score));
        return score;
    }

    function isCurriculumBypassEnabledLocal() {
        return localStorage.getItem('anatomy1_curriculum_bypass') === 'true';
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

        // Sidebar selection highlight
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
            
            // Award XP and stats
            if (window.AnatomyGamification) {
                let xpReward = 50;
                let isPerfect = score === 100;
                if (isPerfect) {
                    xpReward += 50; // perfect bonus
                }
                window.AnatomyGamification.awardXP(xpReward, 'homework');
                window.AnatomyGamification.incrementStat('quizzesSolved');
                if (isPerfect) {
                    window.AnatomyGamification.incrementStat('perfectQuizzes');
                }
            }

            // Re-read matrix to load locks and status sidebar updates
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
