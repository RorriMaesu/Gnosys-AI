/**
 * PSY 201Z - Handcrafted Quiz Question Database
 * 36 lessons * 5 questions each = 180 total multiple choice questions
 */

const psychQuizzes = {
    // MODULE 1: Foundations & Scientific Methods
    lesson_1_1: [
        {
            question: "Which historical school of psychology used introspection to map the basic elements of the mind?",
            options: ["Functionalism", "Structuralism", "Behaviorism", "Humanism"],
            correctAnswer: 1,
            explanation: "Structuralism (Wundt, Titchener) aimed to identify the basic structures of conscious experience through introspection."
        },
        {
            question: "A psychologist explaining anxiety as a result of automatic cognitive distortions represents which perspective?",
            options: ["Biological", "Cognitive", "Behavioral", "Psychodynamic"],
            correctAnswer: 1,
            explanation: "The cognitive perspective focuses on how mental processes, like interpretations and thoughts, shape behavior."
        },
        {
            question: "Which of the following perspectives focuses strictly on observable actions and environmental reinforcement?",
            options: ["Behavioral", "Humanistic", "Evolutionary", "Cognitive"],
            correctAnswer: 0,
            explanation: "Behaviorism rejects mental states, focusing only on how environmental rewards and punishments shape observable actions."
        },
        {
            question: "A researcher analyzing the adaptive, survival-based value of human mating preferences is using which lens?",
            options: ["Sociocultural", "Psychodynamic", "Evolutionary", "Structuralist"],
            correctAnswer: 2,
            explanation: "The evolutionary perspective examines how behaviors and traits evolved via natural selection for survival and reproduction."
        },
        {
            question: "Rogers and Maslow are primary figures associated with which psychological perspective?",
            options: ["Behavioral", "Biological", "Humanistic", "Functionalist"],
            correctAnswer: 2,
            explanation: "Humanistic psychology emphasizes human potential, free will, self-actualization, and personal growth."
        }
    ],
    lesson_1_2: [
        {
            question: "A researcher wants to study a rare neurological condition in a single patient. Which research design is most appropriate?",
            options: ["Experiment", "Correlational study", "Survey", "Case study"],
            correctAnswer: 3,
            explanation: "Case studies conduct in-depth analyses of a single individual or unique event over a prolonged period."
        },
        {
            question: "To determine if a new study technique causes higher exam scores, a researcher must use which design?",
            options: ["Naturalistic observation", "Correlational study", "Experimental design", "Survey"],
            correctAnswer: 2,
            explanation: "Only experimental designs, by manipulating an independent variable under controlled conditions, can establish cause-and-effect relationships."
        },
        {
            question: "Which of the following is the key distinction between random selection and random assignment?",
            options: [
                "Selection relates to drawing a representative sample; assignment relates to placing participants in groups.",
                "Selection is used in experiments; assignment is used only in naturalistic surveys.",
                "Selection guarantees causation; assignment eliminates all independent variables.",
                "There is no difference; they are interchangeable terms in research methodology."
            ],
            correctAnswer: 0,
            explanation: "Random selection ensures a representative sample of a population. Random assignment places sample participants into experimental vs. control groups."
        },
        {
            question: "A study finds a correlation coefficient of r = -0.85 between stress levels and sleep duration. This indicates:",
            options: [
                "High stress causes insomnia.",
                "A strong negative relationship, where higher stress relates to less sleep.",
                "A weak relationship, as the correlation coefficient is negative.",
                "A positive relationship, where higher stress relates to more sleep."
            ],
            correctAnswer: 1,
            explanation: "The sign (-) indicates a negative relationship (variables move in opposite directions), and the magnitude (0.85) indicates a strong correlation."
        },
        {
            question: "In an experiment testing how drug dosage affects memory, what is the independent variable (IV)?",
            options: ["Memory scores", "The control group", "The drug dosage", "The age of participants"],
            correctAnswer: 2,
            explanation: "The independent variable is the factor manipulated by the researcher (drug dosage) to observe its effect on the dependent variable (memory)."
        }
    ],
    lesson_1_3: [
        {
            question: "In a skewed distribution of income data, which measure of central tendency is least affected by extreme outliers?",
            options: ["Mean", "Median", "Mode", "Standard Deviation"],
            correctAnswer: 1,
            explanation: "The median is the middle score, which remains stable and representative of skewed data, unlike the mean which is pulled by outliers."
        },
        {
            question: "What does a standard deviation measure in a set of exam scores?",
            options: [
                "The average score of the class.",
                "The difference between the highest and lowest score.",
                "The dispersion or spread of scores around the mean.",
                "The statistical significance of the overall results."
            ],
            correctAnswer: 2,
            explanation: "Standard deviation measures how much scores vary (disperse) around the average (mean) score."
        },
        {
            question: "What does it mean if a study report states that the difference between groups was statistically significant at p < 0.05?",
            options: [
                "The independent variable had a 5% effect rate.",
                "The results are highly likely to have occurred by random chance.",
                "The probability that the observed differences occurred by chance is less than 5%.",
                "The study has a 95% chance of containing experimental design errors."
            ],
            correctAnswer: 2,
            explanation: "Statistical significance at p < 0.05 indicates there is less than a 5% probability that the results occurred by random chance under the null hypothesis."
        },
        {
            question: "Which ethical guideline requires researchers to explain the true purpose and any deception of a study to participants after completion?",
            options: ["Informed Consent", "Debriefing", "Confidentiality", "IRB Approval"],
            correctAnswer: 1,
            explanation: "Debriefing occurs post-experiment, where researchers reveal any deceptions and explain the real purpose of the study."
        },
        {
            question: "A Type I error occurs when a researcher:",
            options: [
                "Fails to reject a false null hypothesis.",
                "Rejects a true null hypothesis (finds a false positive).",
                "Uses descriptive statistics instead of inferential statistics.",
                "Conducts a study without obtaining informed consent."
            ],
            correctAnswer: 1,
            explanation: "A Type I error is a false positive: rejecting a true null hypothesis, thereby claiming an effect exists when it does not."
        }
    ],

    // MODULE 2: Biological Bases of Behavior
    lesson_2_1: [
        {
            question: "Which neuronal structure acts as the receiving zone for incoming chemical signals from other neurons?",
            options: ["Axon", "Dendrite", "Soma", "Myelin Sheath"],
            correctAnswer: 1,
            explanation: "Dendrites are branching extensions that receive messages and conduct impulses toward the cell body (soma)."
        },
        {
            question: "During an action potential, the rapid depolarization of the axon membrane is caused by:",
            options: [
                "Sodium ions (Na+) rushing into the cell.",
                "Potassium ions (K+) rushing out of the cell.",
                "Vesicles releasing acetylcholine into the soma.",
                "The myelin sheath absorbing electrical charges."
            ],
            correctAnswer: 0,
            explanation: "When threshold is reached, voltage-gated sodium channels open, letting Na+ ions flood in, depolarizing the inner membrane."
        },
        {
            question: "The resting membrane potential of a neuron (-70 mV) is maintained actively by:",
            options: [
                "Calcium vesicles diffusing across the axon.",
                "The sodium-potassium pump transporting 3 Na+ out for every 2 K+ in.",
                "The all-or-none decay of neurotransmitters.",
                "Myelin sheath nodes absorbing negative charges."
            ],
            correctAnswer: 1,
            explanation: "The sodium-potassium pump maintains the negative interior charge by pumping 3 Na+ out and 2 K+ in."
        },
        {
            question: "What is the primary function of the myelin sheath?",
            options: [
                "To synthesize neurotransmitters.",
                "To insulate the axon and speed up action potential transmission.",
                "To bind to receptors in the synaptic cleft.",
                "To control the resting potential threshold."
            ],
            correctAnswer: 1,
            explanation: "Myelin is a fatty layer insulating axons, enabling action potentials to hop between nodes (saltatory conduction) and speed up signaling."
        },
        {
            question: "What is the synaptic cleft?",
            options: [
                "The junction connecting the soma and axon.",
                "The microscopic gap between the presynaptic and postsynaptic membranes.",
                "The threshold point required to trigger an action potential.",
                "The channel through which sodium ions flow during depolarization."
            ],
            correctAnswer: 1,
            explanation: "The synaptic cleft is the tiny gap separating neurons where neurotransmitter molecules diffuse to bind to receptors."
        }
    ],
    lesson_2_2: [
        {
            question: "Curare acts as a muscle paralytic by blocking acetylcholine receptors. In this context, curare is an:",
            options: ["Agonist", "Antagonist", "Enzyme inhibitor", "Reuptake pump"],
            correctAnswer: 1,
            explanation: "Antagonists bind to receptors and block neurotransmitter activity, preventing the chemical signal (acetylcholine) from activating the muscle."
        },
        {
            question: "Which of the following neurotransmitters is primarily associated with pleasure, reward systems, and motor control?",
            options: ["Serotonin", "GABA", "Dopamine", "Glutamate"],
            correctAnswer: 2,
            explanation: "Dopamine is key in brain reward pathways and motor functions. Deficits are linked to Parkinson's, and excesses to Schizophrenia."
        },
        {
            question: "Which neurotransmitter serves as the primary inhibitory signal in the central nervous system, slowing down neural activity?",
            options: ["Glutamate", "GABA", "Norepinephrine", "Acetylcholine"],
            correctAnswer: 1,
            explanation: "GABA (gamma-aminobutyric acid) is the primary inhibitory neurotransmitter, reducing neural excitability."
        },
        {
            question: "Selective Serotonin Reuptake Inhibitors (SSRIs) treat depression by preventing the reabsorption of serotonin. SSRIs act as:",
            options: ["Serotonin antagonists", "Serotonin agonists", "Enzymes", "Myelin builders"],
            correctAnswer: 1,
            explanation: "By blocking reuptake, SSRIs keep serotonin in the synapse longer, boosting its signaling and acting as functional agonists."
        },
        {
            question: "Which neurotransmitter is involved in pain reduction and acts as the body's natural opiate?",
            options: ["Glutamate", "Endorphins", "Acetylcholine", "Dopamine"],
            correctAnswer: 1,
            explanation: "Endorphins are natural chemical compounds released in response to pain or vigorous exercise, acting as internal analgesics."
        }
    ],
    lesson_2_3: [
        {
            question: "Which division of the autonomic nervous system is activated when a person experiences a sudden fright, raising heart rate and stopping digestion?",
            options: ["Somatic Nervous System", "Sympathetic Nervous System", "Parasympathetic Nervous System", "Central Nervous System"],
            correctAnswer: 1,
            explanation: "The sympathetic nervous system coordinates the 'fight-or-flight' arousal response, accelerating heart rate and suppressing non-essential functions."
        },
        {
            question: "Which division of the nervous system controls voluntary skeletal muscle movements?",
            options: ["Autonomic Nervous System", "Somatic Nervous System", "Sympathetic Division", "Endocrine System"],
            correctAnswer: 1,
            explanation: "The somatic nervous system carries sensory and motor signals to control voluntary movements of skeletal muscles."
        },
        {
            question: "The endocrine system communicates throughout the body by releasing chemical messengers called:",
            options: ["Neurotransmitters", "Hormones", "Synapses", "Action potentials"],
            correctAnswer: 1,
            explanation: "The endocrine glands secrete hormones directly into the bloodstream to regulate distant organs and systems."
        },
        {
            question: "Which endocrine gland is referred to as the 'master gland' because it regulates the activity of other hormone-secreting glands?",
            options: ["Adrenal gland", "Pituitary gland", "Thyroid gland", "Pancreas"],
            correctAnswer: 1,
            explanation: "The pituitary gland, controlled by the hypothalamus, secretes hormones that direct other endocrine glands."
        },
        {
            question: "After a stressor has passed, which system returns physiological functions (heart rate, breathing) to resting levels?",
            options: ["Sympathetic Nervous System", "Parasympathetic Nervous System", "Somatic Nervous System", "Endocrine Gland Axis"],
            correctAnswer: 1,
            explanation: "The parasympathetic nervous system conserves energy and calms the body ('rest-and-digest'), lowering heart rate and resuming digestion."
        }
    ],
    lesson_2_4: [
        {
            question: "A patient suffers a brain injury and loses the ability to form new memories, though their old memories remain intact. Which structure was damaged?",
            options: ["Amygdala", "Hippocampus", "Hypothalamus", "Thalamus"],
            correctAnswer: 1,
            explanation: "The hippocampus is essential for consolidating new explicit/declarative memories, though long-term storage occurs elsewhere."
        },
        {
            question: "Which lobe of the cerebral cortex houses the primary visual cortex, responsible for processing sights?",
            options: ["Frontal Lobe", "Parietal Lobe", "Occipital Lobe", "Temporal Lobe"],
            correctAnswer: 2,
            explanation: "The occipital lobe, at the back of the brain, is dedicated to processing visual information."
        },
        {
            question: "A patient with damage to Broca's area will experience which of the following deficits?",
            options: [
                "Inability to understand spoken language.",
                "Difficulty producing fluent speech, though comprehension remains intact.",
                "Complete loss of long-term memory structures.",
                "Loss of fine motor coordination in the limbs."
            ],
            correctAnswer: 1,
            explanation: "Broca's area (usually in the left frontal lobe) controls motor speech production. Damage leads to expressive aphasia."
        },
        {
            question: "What is the primary role of the corpus callosum?",
            options: [
                "It regulates survival functions like heart rate and breathing.",
                "It serves as a neural pathway connecting the left and right hemispheres.",
                "It houses the somatosensory strip.",
                "It controls basic drives like hunger and thirst."
            ],
            correctAnswer: 1,
            explanation: "The corpus callosum is a thick band of nerve fibers that bridges and transmits signals between the two cerebral hemispheres."
        },
        {
            question: "Split-brain surgery, which severs the corpus callosum, is typically performed to treat:",
            options: ["Schizophrenia", "Severe epilepsy", "Alzheimer's disease", "Broca's aphasia"],
            correctAnswer: 1,
            explanation: "Severing the corpus callosum stops seizure electrical waves from spreading between hemispheres, reducing severe epileptic episodes."
        }
    ],
    lesson_2_5: [
        {
            question: "A researcher wants to track rapid brainwave fluctuations during a sleep study in real-time. Which technique is most appropriate?",
            options: ["fMRI", "PET scan", "EEG", "CT scan"],
            correctAnswer: 2,
            explanation: "An EEG (electroencephalogram) records scalp electrical currents, providing excellent temporal resolution for sleep waves."
        },
        {
            question: "Which brain imaging technique uses magnetic fields and radio waves to produce detailed structural images without radiation?",
            options: ["CT scan", "PET scan", "MRI", "EEG"],
            correctAnswer: 2,
            explanation: "Magnetic Resonance Imaging (MRI) uses magnetic fields to align atomic nuclei, generating high-resolution structural images."
        },
        {
            question: "To observe active metabolic consumption of glucose in specific brain structures during a cognitive task, a researcher uses:",
            options: ["CT scan", "PET scan", "Standard MRI", "Lesion mapping"],
            correctAnswer: 1,
            explanation: "PET (positron emission tomography) scans inject a radioactive glucose tracer to visualize functional metabolic activity."
        },
        {
            question: "How does functional MRI (fMRI) construct functional activation maps of the brain?",
            options: [
                "By recording radio waves from calcium decay.",
                "By tracking blood oxygenation level-dependent (BOLD) signals.",
                "By measuring electrical potentials directly on dendrites.",
                "By mapping structural bone fractures via X-rays."
            ],
            correctAnswer: 1,
            explanation: "fMRI tracks blood flow and oxygen usage (BOLD contrast) to detect active brain regions during tasks."
        },
        {
            question: "A clinical doctor suspecting a localized skull fracture or internal bleeding would prioritize which fast, structural imaging scan?",
            options: ["fMRI", "CT scan", "PET scan", "EEG"],
            correctAnswer: 1,
            explanation: "A CT (computed tomography) scan uses rotating X-rays to generate fast, cross-sectional structural images, ideal for emergencies."
        }
    ],

    // MODULE 3: Sensation, Perception, & Consciousness
    lesson_3_1: [
        {
            question: "The process by which sensory receptors convert physical energy (like light waves) into neural impulses is called:",
            options: ["Transduction", "Adaptation", "Perception", "Weber's Law"],
            correctAnswer: 0,
            explanation: "Transduction is the transformation of physical stimulus energy (light, sound) into electrochemical signals."
        },
        {
            question: "According to the opponent-process theory of color vision, if you stare at a green square, what color afterimage will you see on a white background?",
            options: ["Yellow", "Red", "Blue", "Black"],
            correctAnswer: 1,
            explanation: "Green is paired with red. Staring at green fatigues its neural pathway, leaving the red channel unopposed when looking at white."
        },
        {
            question: "Weber's Law states that the just-noticeable difference (JND) is proportional to:",
            options: [
                "The absolute threshold of the stimulus.",
                "The intensity of the baseline stimulus.",
                "The speed of sensory adaptation.",
                "The number of rods active in the retina."
            ],
            correctAnswer: 1,
            explanation: "Weber's Law states that the JND is a constant fraction of the original stimulus intensity, meaning heavier stimuli require larger changes to be noticed."
        },
        {
            question: "Which cells in the retina transduce light waves into neural impulses?",
            options: ["Ganglion cells", "Bipolar cells", "Photoreceptors (rods and cones)", "Glial cells"],
            correctAnswer: 2,
            explanation: "Rods (low-light, peripheral) and cones (color, detail) are the photoreceptors that perform visual transduction."
        },
        {
            question: "The dual-process theory of color vision reconciles competing models by stating:",
            options: [
                "Cones process color, while rods process black-and-white silhouettes.",
                "Trichromatic rules apply at the retina; Opponent-Process rules apply at the ganglion cells/cortex.",
                "Both eyes must process light independently to create depth perception.",
                "Visual signals travel through both the temporal and occipital lobes simultaneously."
            ],
            correctAnswer: 1,
            explanation: "Dual-process theory integrates both models, showing that trichromatic receptors feed into opponent-process ganglion cells."
        }
    ],
    lesson_3_2: [
        {
            question: "Where are the actual auditory receptors (hair cells) located in the ear?",
            options: ["Tympanic membrane", "Ossicles", "Basilar membrane inside the cochlea", "Auditory canal"],
            correctAnswer: 2,
            explanation: "Mechanical fluid waves in the cochlea bend the hair cells on the basilar membrane, performing auditory transduction."
        },
        {
            question: "According to the Gate-Control theory of pain, how can pain signals be blocked at the spinal cord level?",
            options: [
                "By severing the vestibular nerve pathway.",
                "By stimulating large-diameter fibers (e.g. via rubbing or massage) which closes the gate.",
                "By increasing neurotransmission of substance P.",
                "By activating small-diameter nociceptor fibers."
            ],
            correctAnswer: 1,
            explanation: "Gate-Control theory states that stimulating large sensory fibers (touch/pressure) activates inhibitory neurons, closing the spinal gate to pain signals."
        },
        {
            question: "Which of the following senses is responsible for informing you of your body's orientation and balance relative to gravity?",
            options: ["Kinesthetic sense", "Vestibular sense", "Olfaction", "Gustation"],
            correctAnswer: 1,
            explanation: "The vestibular sense, regulated by fluid in the semicircular canals of the inner ear, tracks balance and head position."
        },
        {
            question: "How does the kinesthetic (proprioceptive) sense differ from the vestibular sense?",
            options: [
                "Kinesthesis relies on visual cues; vestibular does not.",
                "Kinesthesis monitors the position and movement of individual body parts; vestibular monitors overall balance.",
                "Kinesthesis is chemical; vestibular is mechanical.",
                "There is no difference; they are the same system."
            ],
            correctAnswer: 1,
            explanation: "Kinesthesis uses receptors in muscles, tendons, and joints to track body position, whereas the vestibular system tracks head position and balance."
        },
        {
            question: "Which pitch perception theory states that we detect pitch based on the specific location of basilar membrane vibration?",
            options: ["Frequency Theory", "Place Theory", "Gate Theory", "Opponent-Process Theory"],
            correctAnswer: 1,
            explanation: "Place Theory (Helmholtz) suggests different frequencies stimulate hair cells at specific spots along the basilar membrane."
        }
    ],
    lesson_3_3: [
        {
            question: "Which processing style is driven by cognitive expectations, context, and prior knowledge?",
            options: ["Bottom-up processing", "Top-down processing", "Sensory transduction", "Absolute threshold"],
            correctAnswer: 1,
            explanation: "Top-down processing uses existing knowledge, experiences, and expectations to interpret sensory incoming data."
        },
        {
            question: "The Gestalt principle of 'closure' describes our tendency to:",
            options: [
                "Group items together that are physically close to one another.",
                "Fill in missing gaps to perceive a complete, whole object.",
                "Group similar elements (like color or shape) together.",
                "Perceive continuous, flowing patterns rather than disjointed lines."
            ],
            correctAnswer: 1,
            explanation: "Closure is the perceptual grouping principle where the brain fills in missing visual gaps to perceive complete shapes."
        },
        {
            question: "Which of the following is a binocular depth cue?",
            options: ["Relative size", "Linear perspective", "Retinal disparity", "Interposition"],
            correctAnswer: 2,
            explanation: "Retinal disparity relies on the slightly different images received by each eye to calculate depth."
        },
        {
            question: "What is a perceptual set?",
            options: [
                "The threshold JND value calculated using Weber's constant.",
                "A mental predisposition to perceive something in a certain way based on expectations.",
                "The physical coordinates where rods and cones meet the optic nerve.",
                "The sequence of sleep cycles recorded on an EEG."
            ],
            correctAnswer: 1,
            explanation: "A perceptual set is a bias or readiness to perceive a stimulus in a particular way, shaped by context, mood, or expectations."
        },
        {
            question: "Cross-cultural research on the Müller-Lyer illusion (carpentry world hypothesis) indicates:",
            options: [
                "All humans perceive the illusion identically due to biological eye structure.",
                "People from urban, rectangular environments are more susceptible than those from round-hut societies.",
                "The illusion only occurs in infants who have not developed conservation.",
                "The illusion is completely dependent on retinal color vision cells."
            ],
            correctAnswer: 1,
            explanation: "The carpentered-world hypothesis suggests urban dwellers learn to interpret angles as 3D corners, making them more susceptible to the illusion than non-carpentered cultures."
        }
    ],
    lesson_3_4: [
        {
            question: "What phenomenon is demonstrated when a participant fails to notice a person in a gorilla suit walking across a screen because they are counting basketball passes?",
            options: ["Inattentional blindness", "Change blindness", "Sensory adaptation", "Cocktail party effect"],
            correctAnswer: 0,
            explanation: "Inattentional blindness is the failure to see visible objects when attention is directed elsewhere."
        },
        {
            question: "Which of the following describes the Stroop Effect?",
            options: [
                "Failing to notice differences in visual scenes after a brief flash.",
                "Difficulty naming the print color of a word when the word itself spells a different color.",
                "Hearing a sound change due to mismatched visual lip movements.",
                "Hearing your name across a noisy room of conversations."
            ],
            correctAnswer: 1,
            explanation: "The Stroop Effect shows that naming the color of ink is slower and more error-prone when the word spells a conflicting color name (e.g. the word 'RED' written in green ink)."
        },
        {
            question: "The cocktail party effect demonstrates our ability to:",
            options: [
                "Distinguish high pitches from low pitches using place theory.",
                "Focus auditory attention on a single conversation among many, yet still detect self-relevant words (like our name).",
                "Name colors faster than reading words.",
                "Transition directly from wakefulness into REM sleep."
            ],
            correctAnswer: 1,
            explanation: "The cocktail party effect is the phenomenon of focusing attention on one voice among many, while still monitoring the background for self-relevant cues."
        },
        {
            question: "What is the McGurk Effect?",
            options: [
                "Failing to see a visual detail due to high cognitive load.",
                "An illusion showing that visual lip movements can alter the sound we perceive.",
                "The delay in response when reading conflicting words.",
                "Sensory adaptation to pain after ice application."
            ],
            correctAnswer: 1,
            explanation: "The McGurk Effect shows sensory interaction: hearing one sound (e.g., 'ba') while seeing lip movements for another ('ga') causes the brain to perceive a third sound ('da')."
        },
        {
            question: "Failing to notice that your conversational partner has been swapped for a different person after a brief door obstruction is:",
            options: ["Change blindness", "Inattentional blindness", "The Stroop effect", "Divided attention"],
            correctAnswer: 0,
            explanation: "Change blindness is the failure to detect visual changes in an environment after a brief interruption."
        }
    ],
    lesson_3_5: [
        {
            question: "Which stage of sleep is characterized by delta waves and is considered the deepest stage of NREM sleep?",
            options: ["NREM-1", "NREM-2", "NREM-3", "REM"],
            correctAnswer: 2,
            explanation: "NREM-3 (slow-wave sleep) is characterized by high-amplitude, slow delta waves on an EEG, representing deep sleep."
        },
        {
            question: "During which sleep stage does muscle paralysis occur alongside active brain activity and vivid dreaming?",
            options: ["NREM-1", "NREM-2", "NREM-3", "REM"],
            correctAnswer: 3,
            explanation: "REM (Rapid Eye Movement) sleep is marked by active brain patterns, vivid dreams, and motor paralysis (paradoxical sleep)."
        },
        {
            question: "Which sleep disorder is characterized by temporary pauses in breathing during sleep, causing frequent micro-arousals?",
            options: ["Insomnia", "Narcolepsy", "Sleep apnea", "Night terrors"],
            correctAnswer: 2,
            explanation: "Sleep apnea is a disorder where breathing repeatedly stops and starts, disrupting deep sleep cycles."
        },
        {
            question: "The presence of sleep spindles and K-complexes on an EEG is a defining characteristic of which stage?",
            options: ["NREM-1", "NREM-2", "NREM-3", "REM"],
            correctAnswer: 1,
            explanation: "NREM-2 sleep is characterized by sleep spindles (bursts of rapid brain activity) and K-complexes."
        },
        {
            question: "The activation-synthesis theory of dreaming proposes that dreams are:",
            options: [
                "Unconscious wish-fulfillments representing hidden urges.",
                "Brain attempts to make sense of random neural firing in the brainstem.",
                "The consolidation of procedural motor memories.",
                "Cognitive exercises matching critical thinking pathways."
            ],
            correctAnswer: 1,
            explanation: "Activation-synthesis theory suggests that dreams are stories the brain creates to interpret random neural activity originating in the pons during REM."
        }
    ],
    lesson_3_6: [
        {
            question: "Cocaine acts as a stimulant primarily by:",
            options: [
                "Blocking reuptake of dopamine, serotonin, and norepinephrine.",
                "Mimicking the inhibitory actions of GABA at receptor sites.",
                "Destroying myelin sheaths on motor nerves.",
                "Activating endorphin channels to reduce pain."
            ],
            correctAnswer: 0,
            explanation: "Cocaine binds to reuptake pumps, blocking the reabsorption of dopamine, serotonin, and norepinephrine, leading to a build-up in the synapse."
        },
        {
            question: "Alcohol is classified under which category of psychoactive drugs?",
            options: ["Stimulant", "Depressant", "Hallucinogen", "Opiate"],
            correctAnswer: 1,
            explanation: "Alcohol is a CNS depressant. It enhances the inhibitory neurotransmitter GABA and blocks excitatory glutamate receptors."
        },
        {
            question: "Neurochemically, how does tolerance to a drug develop over chronic use?",
            options: [
                "The brain synthesizes more receptors to bind the drug.",
                "The brain reduces its natural receptors or production of the neurotransmitter (downregulation).",
                "The myelin sheath thickens, blocking all synaptic entries.",
                "The drug starts acting as an antagonist instead of an agonist."
            ],
            correctAnswer: 1,
            explanation: "With chronic exposure, the brain adapts by downregulating receptors (reducing sensitivity) to maintain homeostasis, requiring larger doses."
        },
        {
            question: "Which of the following is a primary characteristic of physical dependence?",
            options: [
                "A cognitive craving to use a substance for emotional relief.",
                "The emergence of physical withdrawal symptoms when the drug is stopped.",
                "An increase in natural dopamine synthesis in the synapses.",
                "The immediate loss of sensory thresholds."
            ],
            correctAnswer: 1,
            explanation: "Physical dependence is characterized by physiological adaptations that produce painful withdrawal symptoms when the substance is discontinued."
        },
        {
            question: "Opiates (like heroin and morphine) mimic which class of natural neurotransmitters in the brain?",
            options: ["Acetylcholine", "Endorphins", "GABA", "Glutamate"],
            correctAnswer: 1,
            explanation: "Opiates bind to the body's natural endorphin receptors, suppressing pain signals and inducing euphoria."
        }
    ],

    // MODULE 4: Lifespan Development
    lesson_4_1: [
        {
            question: "What is a teratogen?",
            options: [
                "A motor reflex present in newborns.",
                "An environmental agent that can cause developmental harm during pregnancy.",
                "A parenting style characterized by high warmth and low control.",
                "A chromosome error resulting in cognitive deficits."
            ],
            correctAnswer: 1,
            explanation: "Teratogens are harmful environmental substances (drugs, alcohol, viruses) that cross the placenta and damage the developing embryo or fetus."
        },
        {
            question: "A parent who establishes strict rules, expects absolute obedience, and offers little warmth is using which parenting style?",
            options: ["Authoritative", "Authoritarian", "Permissive", "Uninvolved"],
            correctAnswer: 1,
            explanation: "Authoritarian parenting is highly demanding and low in responsiveness, emphasizing rules and obedience over warmth."
        },
        {
            question: "Which parenting style is associated with the most positive social-emotional outcomes in children?",
            options: ["Authoritarian", "Authoritative", "Permissive", "Uninvolved"],
            correctAnswer: 1,
            explanation: "Authoritative parenting balances high expectations (control) with high responsiveness (warmth and open communication)."
        },
        {
            question: "The prenatal stage that lasts from week 2 through week 8, during which major organs begin to form, is the:",
            options: ["Zygotic stage", "Embryonic stage", "Fetal stage", "Germinal stage"],
            correctAnswer: 1,
            explanation: "The embryonic stage (weeks 2-8) is a critical period marked by rapid cell division and organogenesis."
        },
        {
            question: "A newborn baby automatically turns its head and opens its mouth when its cheek is stroked. This is the:",
            options: ["Moro reflex", "Grasping reflex", "Rooting reflex", "Babinski reflex"],
            correctAnswer: 2,
            explanation: "The rooting reflex helps infants locate food by directing their mouth toward a touch on their cheek."
        }
    ],
    lesson_4_2: [
        {
            question: "According to Jean Piaget, a child who believes a tall thin glass holds more water than a short wide glass is struggling with:",
            options: ["Object permanence", "Conservation", "Egocentrism", "Theory of Mind"],
            correctAnswer: 1,
            explanation: "Conservation is the understanding that quantity remains constant despite changes in physical shape, a concept preoperational children struggle with."
        },
        {
            question: "A child hiding their eyes and assuming no one can see them because they cannot see anyone is demonstrating:",
            options: ["Assimilation", "Conservation failure", "Egocentrism", "Scaffolding"],
            correctAnswer: 2,
            explanation: "Egocentrism is the preoperational child's inability to see scenarios from another person's perspective."
        },
        {
            question: "In Lev Vygotsky's theory, the gap between what a child can do alone vs. with assistance is the:",
            options: ["Stage of Formal Operations", "Zone of Proximal Development (ZPD)", "Sensorimotor Range", "Schema boundary"],
            correctAnswer: 1,
            explanation: "The ZPD represents tasks a child is close to mastering but needs guidance or 'scaffolding' to complete."
        },
        {
            question: "An individual who decides not to steal a drug because 'it is against the law' represents which level of Kohlberg's moral reasoning?",
            options: ["Preconventional", "Conventional", "Postconventional", "Concrete"],
            correctAnswer: 1,
            explanation: "Conventional morality is driven by social order, laws, duty, and seeking approval from others."
        },
        {
            question: "A baby learns that a four-legged animal is a 'dog'. When seeing a cat, they call it a 'dog'. When corrected, they adjust their category. This adjustment is:",
            options: ["Assimilation", "Accommodation", "Conservation", "Object permanence"],
            correctAnswer: 1,
            explanation: "Accommodation is the process of modifying existing cognitive structures (schemas) to incorporate new, conflicting information."
        }
    ],
    lesson_4_3: [
        {
            question: "Harry Harlow's studies with infant rhesus monkeys demonstrated that attachment is primarily driven by:",
            options: ["Biological nutrition (milk source)", "Contact comfort (tactile warmth)", "Operant conditioning of food sounds", "Imprinting behaviors"],
            correctAnswer: 1,
            explanation: "Infant monkeys spent significantly more time clinging to soft cloth surrogate mothers than wire ones, even if the wire mother provided food."
        },
        {
            question: "In the Strange Situation, an infant who is distressed by separation but easily comforted upon the parent's return displays which attachment style?",
            options: ["Secure attachment", "Insecure-avoidant", "Insecure-anxious/resistant", "Disorganized"],
            correctAnswer: 0,
            explanation: "Securely attached infants explore environments when the mother is present, show distress when she leaves, and seek contact/are easily calmed upon reunion."
        },
        {
            question: "According to Erik Erikson, the primary psychosocial challenge during adolescence is:",
            options: [
                "Trust vs. Mistrust",
                "Identity vs. Role Confusion",
                "Intimacy vs. Isolation",
                "Generativity vs. Stagnation"
            ],
            correctAnswer: 1,
            explanation: "Adolescents focus on developing a stable, cohesive sense of self and direction, navigating identity vs. role confusion."
        },
        {
            question: "How does cognitive capability change in late adulthood regarding fluid vs. crystallized intelligence?",
            options: [
                "Both decline rapidly.",
                "Fluid intelligence (processing speed) declines; Crystallized intelligence (accumulated knowledge) remains stable or increases.",
                "Fluid intelligence increases; Crystallized intelligence declines.",
                "Both remain completely stable until death."
            ],
            correctAnswer: 1,
            explanation: "Fluid intelligence (abstract reasoning, processing speed) generally declines with age, while crystallized intelligence (vocabulary, facts) remains stable or grows."
        },
        {
            question: "Which Erikson stage focuses on middle-aged adults reflecting on their contributions to society and family?",
            options: ["Autonomy vs. Shame", "Integrity vs. Despair", "Generativity vs. Stagnation", "Industry vs. Inferiority"],
            correctAnswer: 2,
            explanation: "Generativity vs. Stagnation is the mid-adulthood crisis centered on producing meaningful work and guiding the next generation."
        }
    ],
    lesson_4_4: [
        {
            question: "According to gender schema theory, how do children develop gender-typed behaviors?",
            options: [
                "Through pure genetic inheritance of toy preferences.",
                "By organizing behaviors into mental concepts of 'boy' vs. 'girl' styles, then self-conforming.",
                "Through direct hormone replacement therapies in childhood.",
                "By matching brain lateralization patterns."
            ],
            correctAnswer: 1,
            explanation: "Gender schema theory states that children form cognitive frameworks (schemas) about gender roles, which they use to interpret and guide their own behavior."
        },
        {
            question: "Which of the following is the correct order of the stages in the human sexual response cycle described by Masters and Johnson?",
            options: [
                "Excitement ➔ Orgasm ➔ Plateau ➔ Resolution",
                "Excitement ➔ Plateau ➔ Orgasm ➔ Resolution",
                "Plateau ➔ Excitement ➔ Orgasm ➔ Resolution",
                "Excitement ➔ Resolution ➔ Orgasm ➔ Plateau"
            ],
            correctAnswer: 1,
            explanation: "The sexual response cycle consists of four distinct phases: Excitement, Plateau, Orgasm, and Resolution."
        },
        {
            question: "How does the refractory period differ between men and women during the resolution phase?",
            options: [
                "Women experience a long refractory period; men do not.",
                "Men experience a refractory period during which another orgasm is physiologically impossible; women generally do not.",
                "There is no difference; both have identical refractory phases.",
                "The refractory period only occurs during the excitement phase."
            ],
            correctAnswer: 1,
            explanation: "Men have a mandatory refractory period lasting minutes to hours where physiological restimulation cannot occur; women can experience multiple orgasms without a refractory period."
        },
        {
            question: "Research on the biological bases of sexual orientation indicates that:",
            options: [
                "Orientation is entirely a chosen social behavior with no biological factors.",
                "Genetic factors, prenatal hormone exposure, and brain differences (e.g. hypothalamus) influence orientation.",
                "Dominant mothers and weak fathers are the sole cause of homosexuality.",
                "Twins never share identical sexual orientations."
            ],
            correctAnswer: 1,
            explanation: "Scientific consensus indicates that biological variables—including genetics, prenatal androgen exposure, and hypothalamus morphology—play a significant role in orientation."
        },
        {
            question: "The term 'gender typing' refers to:",
            options: [
                "The biological chromosomes that determine sex.",
                "The acquisition of traditional masculine or feminine roles.",
                "The physiological stages of the refractory period.",
                "The clinical diagnostics for somatoform disorders."
            ],
            correctAnswer: 1,
            explanation: "Gender typing is the process by which children acquire and conform to the traditional gender roles and expectations of their culture."
        }
    ],

    // MODULE 5: Learning & Memory
    lesson_5_1: [
        {
            question: "In Pavlov's classic conditioning experiments, what was the bell before conditioning took place?",
            options: ["Unconditioned Stimulus (UCS)", "Neutral Stimulus (NS)", "Conditioned Response (CR)", "Unconditioned Response (UCR)"],
            correctAnswer: 1,
            explanation: "Before pairing with food, the bell triggered no salivation, making it a neutral stimulus."
        },
        {
            question: "A dog conditioned to salivate to a high-pitched bell also salivates slightly to a low-pitched bell. This demonstrates:",
            options: ["Extinction", "Generalization", "Discrimination", "Spontaneous Recovery"],
            correctAnswer: 1,
            explanation: "Stimulus generalization is the tendency for stimuli similar to the conditioned stimulus to elicit the conditioned response."
        },
        {
            question: "How is extinction achieved in classical conditioning?",
            options: [
                "By presenting the Unconditioned Stimulus (UCS) repeatedly without the Conditioned Stimulus (CS).",
                "By presenting the Conditioned Stimulus (CS) repeatedly without the Unconditioned Stimulus (UCS).",
                "By punishing the animal whenever it shows the Conditioned Response (CR).",
                "By introducing a new neutral stimulus."
            ],
            correctAnswer: 1,
            explanation: "Extinction occurs when the CS (bell) is repeatedly presented alone without the UCS (food), causing the CR (salivation) to diminish."
        },
        {
            question: "John Garcia's taste aversion studies challenged classical conditioning assumptions by proving that:",
            options: [
                "Conditioning requires hundreds of pairings to occur.",
                "Animals are biologically prepared to associate taste with nausea, but not light with nausea.",
                "Extinction is permanent and immediate.",
                "Any neutral stimulus can be conditioned to any response with equal ease."
            ],
            correctAnswer: 1,
            explanation: "Garcia showed biological constraints on learning: rats easily paired taste (but not light/sound) with sickness, highlighting evolutionary preparedness."
        },
        {
            question: "A child gets sick from a bad seafood dish. Now, even looking at the restaurant sign makes them feel nauseated. The restaurant sign is the:",
            options: ["Unconditioned Stimulus (UCS)", "Conditioned Stimulus (CS)", "Neutral Stimulus (NS)", "Unconditioned Response (UCR)"],
            correctAnswer: 1,
            explanation: "The sign was originally neutral, but after pairing with illness (UCS), it became a conditioned stimulus (CS) that triggers nausea (CR)."
        }
    ],
    lesson_5_2: [
        {
            question: "What is negative reinforcement?",
            options: [
                "Adding a negative stimulus to reduce a behavior.",
                "Removing an unpleasant stimulus to strengthen a behavior.",
                "Taking away a pleasant stimulus to weaken a behavior.",
                "Administering a mild shock to stop an action."
            ],
            correctAnswer: 1,
            explanation: "Reinforcement always increases a behavior. Negative reinforcement does this by removing an aversive/unpleasant stimulus (e.g. turning off an alarm)."
        },
        {
            question: "A parent takes away a teenager's car keys to stop them from coming home past curfew. This is:",
            options: ["Positive Reinforcement", "Negative Reinforcement", "Positive Punishment", "Negative Punishment"],
            correctAnswer: 3,
            explanation: "This is negative punishment (response cost) because a desirable stimulus (car keys) is removed to decrease a behavior (breaking curfew)."
        },
        {
            question: "Which reinforcement schedule produces the highest rate of response and the greatest resistance to extinction?",
            options: ["Fixed-Ratio", "Variable-Ratio", "Fixed-Interval", "Variable-Interval"],
            correctAnswer: 1,
            explanation: "Variable-ratio schedules (like slot machines) deliver reinforcement after an unpredictable number of responses, yielding rapid, persistent behavior."
        },
        {
            question: "A student receives a gold star sticker for every 3 homework sheets completed. This is which schedule?",
            options: ["Fixed-Ratio", "Variable-Ratio", "Fixed-Interval", "Variable-Interval"],
            correctAnswer: 0,
            explanation: "This is a fixed-ratio schedule because the reinforcement is delivered after a fixed, set number of responses (every 3 sheets)."
        },
        {
            question: "The process of teaching a dog to roll over by first reinforcing sitting, then lying down, then rolling is called:",
            options: ["Shaping", "Extinction", "Latent learning", "Insight learning"],
            correctAnswer: 0,
            explanation: "Shaping involves reinforcing successive approximations of a target behavior until the final complex behavior is achieved."
        }
    ],
    lesson_5_3: [
        {
            question: "In Albert Bandura's Bobo Doll experiments, children who observed an adult act aggressively toward the doll:",
            options: [
                "Acted friendly to the doll to compensate.",
                "Imitated the adult's aggressive actions and language.",
                "Showed no interest in playing with the doll.",
                "Experienced learned helplessness."
            ],
            correctAnswer: 1,
            explanation: "The study demonstrated observational learning: children exposed to aggressive models imitated the specific physical and verbal aggression."
        },
        {
            question: "Edward Tolman's latent learning experiments showed that rats in a maze:",
            options: [
                "Only learn the layout if they are rewarded on every single trial.",
                "Form cognitive maps of the maze without immediate rewards, demonstrating learning is not just association.",
                "Require classical conditioning to find the exit.",
                "Display mirror neuron activation when watching other rats."
            ],
            correctAnswer: 1,
            explanation: "Rats explored the maze without food, forming a cognitive map (latent learning). Once food was introduced, they ran the maze as fast as rats rewarded all along."
        },
        {
            question: "Which of the following describes Martin Seligman's concept of learned helplessness?",
            options: [
                "Learning to navigate a maze through observational modeling.",
                "An organism giving up attempts to avoid pain after experiencing unavoidable aversive events.",
                "The sudden realization of a problem's solution (insight).",
                "The inability to form long-term memory structures."
            ],
            correctAnswer: 1,
            explanation: "Learned helplessness occurs when an animal or human learns that their actions do not affect outcomes, leading to passive resignation."
        },
        {
            question: "A chimpanzee spends hours trying to reach bananas with a stick, stops, then suddenly hooks two sticks together to reach them. This is:",
            options: ["Latent learning", "Insight learning", "Shaping", "Classical conditioning"],
            correctAnswer: 1,
            explanation: "Insight learning (Köhler) is a sudden, novel realization of a problem's solution without gradual trial-and-error."
        },
        {
            question: "What neurons are believed to fire both when an organism performs an action and when they watch another perform that same action?",
            options: ["Sensory neurons", "Motor neurons", "Mirror neurons", "Interneurons"],
            correctAnswer: 2,
            explanation: "Mirror neurons, located in the frontal lobe, provide a neural basis for observational learning and empathy."
        }
    ],
    lesson_5_4: [
        {
            question: "In the Atkinson-Shiffrin model, which memory store holds visual information (iconic memory) for less than half a second?",
            options: ["Sensory memory", "Short-term memory", "Working memory", "Long-term memory"],
            correctAnswer: 0,
            explanation: "Sensory memory holds brief sensory traces (iconic for visual < 0.5s, echoic for auditory 3-4s) before decay."
        },
        {
            question: "What is the typical capacity limit of short-term (working) memory, according to George Miller?",
            options: ["2 items", "7 +/- 2 items", "Unlimited", "15 items"],
            correctAnswer: 1,
            explanation: "George Miller's research identified the capacity limit of short-term memory as 7 plus or minus 2 chunks of information."
        },
        {
            question: "A patient with damage to the hippocampus cannot form new memories of facts and events (explicit), but can still learn new motor skills (implicit). This indicates:",
            options: [
                "The hippocampus stores all implicit memories.",
                "Explicit and implicit memories utilize distinct neural pathways and structures.",
                "Sensory memory bypasses the brainstem entirely.",
                "The patient is experiencing retrograde amnesia."
            ],
            correctAnswer: 1,
            explanation: "The hippocampus processes explicit (declarative) memories, while structures like the cerebellum and basal ganglia process implicit (procedural) memories."
        },
        {
            question: "Long-Term Potentiation (LTP) refers to:",
            options: [
                "The deterioration of myelin sheaths during aging.",
                "The strengthening of synaptic connections following rapid, repeated stimulation.",
                "The capacity of working memory to group items into chunks.",
                "The consolidation of emotional memory in the amygdala."
            ],
            correctAnswer: 1,
            explanation: "LTP is the neural basis of learning, characterized by an increase in synaptic efficiency and firing ease after repeated pathway activation."
        },
        {
            question: "Memories of personal experiences and life events (like your first day of school) are classified as:",
            options: ["Semantic memory", "Episodic memory", "Procedural memory", "Echoic memory"],
            correctAnswer: 1,
            explanation: "Episodic memory is a subcategory of explicit memory that stores personally experienced events and their context."
        }
    ],
    lesson_5_5: [
        {
            question: "You study for your psychology test, then study for a sociology test. During the psych test, sociology concepts keep interfering with your recall. This is:",
            options: ["Proactive interference", "Retroactive interference", "Anterograde amnesia", "Source amnesia"],
            correctAnswer: 1,
            explanation: "Retroactive interference occurs when new learning (sociology) disrupts the recall of older information (psychology)."
        },
        {
            question: "A patient suffers a traumatic head injury and can remember their childhood, but cannot form any new memories post-accident. This is:",
            options: ["Retrograde amnesia", "Anterograde amnesia", "Proactive interference", "Source amnesia"],
            correctAnswer: 1,
            explanation: "Anterograde amnesia is the inability to transfer new information from short-term to long-term memory after a brain injury."
        },
        {
            question: "Elizabeth Loftus's research on the misinformation effect demonstrates that:",
            options: [
                "Memory works like a video camera, recording details perfectly.",
                "Exposing people to misleading post-event information can alter their memory of the event.",
                "Proactive interference is caused by synaptic pruning.",
                "Amnesia always wipes out procedural skills first."
            ],
            correctAnswer: 1,
            explanation: "The misinformation effect shows that memories are reconstructive and easily distorted by suggestive questioning or false information."
        },
        {
            question: "You change your phone password. When trying to enter it, you accidentally type your old password. This is:",
            options: ["Proactive interference", "Retroactive interference", "Retrograde amnesia", "Encoding decay"],
            correctAnswer: 0,
            explanation: "Proactive interference occurs when older, established memories (the old password) disrupt the retrieval of newer information (the new password)."
        },
        {
            question: "Recalling a joke but attributing it to the wrong friend (or believing you came up with it yourself) is an example of:",
            options: ["Source amnesia", "Retroactive decay", "Anterograde block", "Effortful consolidation"],
            correctAnswer: 0,
            explanation: "Source amnesia (or source misattribution) is attributing an event or information to the wrong origin."
        }
    ],

    // MODULE 6: Cognition, Motivation, & Emotion
    lesson_6_1: [
        {
            question: "A step-by-step mathematical or logical formula that guarantees a correct solution to a problem is an:",
            options: ["Algorithm", "Heuristic", "Prototype", "Mental set"],
            correctAnswer: 0,
            explanation: "Algorithms are step-by-step procedures that guarantee a correct answer, unlike heuristics which are fast, error-prone shortcuts."
        },
        {
            question: "A person avoids flying because they recently saw a dramatic plane crash on TV, believing plane travel is highly dangerous. This is the:",
            options: ["Representativeness heuristic", "Availability heuristic", "Confirmation bias", "Functional fixedness"],
            correctAnswer: 1,
            explanation: "The availability heuristic estimates the likelihood of events based on how easily examples come to mind (often vivid or recent media events)."
        },
        {
            question: "In language, the smallest unit of sound that can distinguish words (such as the 'b' in 'bat') is a:",
            options: ["Morpheme", "Phoneme", "Syntax", "Grammar"],
            correctAnswer: 1,
            explanation: "Phonemes are the basic, distinctive units of sound in language. Morphemes are the smallest units of meaning (like prefix 'un-')."
        },
        {
            question: "Noam Chomsky argued against B.F. Skinner's behavioral model of language acquisition by stating that:",
            options: [
                "Children learn language entirely through imitation and operant reinforcement.",
                "Humans possess an inborn Language Acquisition Device (LAD) that facilitates grammar learning.",
                "Language is entirely determined by Whorfian relativity.",
                "Children do not show syntax rules until adulthood."
            ],
            correctAnswer: 1,
            explanation: "Chomsky's nativist theory proposes that the human brain has an innate capacity for language (LAD) to explain the rapid acquisition of grammar."
        },
        {
            question: "Benjamin Whorf's linguistic relativity hypothesis suggests that:",
            options: [
                "Language acquisition is controlled by the left temporal lobe.",
                "The language we speak shapes and structures the way we think.",
                "Grammar is universal across all biological species.",
                "Children learn language only through shaping."
            ],
            correctAnswer: 1,
            explanation: "Linguistic relativity (the Whorfian hypothesis) states that vocabulary and grammatical structures influence cognitive perception and thought."
        }
    ],
    lesson_6_2: [
        {
            question: "Which theory of intelligence proposes that we possess eight or nine distinct, independent intelligences (like musical, spatial, kinesthetic)?",
            options: ["Spearman's g factor theory", "Gardner's Multiple Intelligences", "Sternberg's Triarchic Theory", "Thurstone's Primary Abilities"],
            correctAnswer: 1,
            explanation: "Howard Gardner proposed multiple intelligences, arguing that the traditional IQ test only measures a narrow subset of academic capabilities."
        },
        {
            question: "If a test yields consistent, identical scores when retaken by the same individual, the test has high:",
            options: ["Validity", "Reliability", "Standardization", "Normalization"],
            correctAnswer: 1,
            explanation: "Reliability refers to the consistency of a test's scores (e.g. test-retest or split-half reliability)."
        },
        {
            question: "If an intelligence test is valid, it means the test:",
            options: [
                "Yields consistent results over time.",
                "Measures what it actually claims to measure.",
                "Has been administered to a large representative group to establish norms.",
                "Fits a perfectly symmetrical normal distribution curve."
            ],
            correctAnswer: 1,
            explanation: "Validity is the extent to which a test measures or predicts what it is designed to measure (e.g. content or predictive validity)."
        },
        {
            question: "The 'Flynn Effect' refers to the historical observation that:",
            options: [
                "Standardized IQ scores have steadily increased over generations, requiring tests to be periodically re-standardized.",
                "Intelligence is 100% determined by genetics.",
                "Language limits our ability to reason mathematically.",
                "Working memory capacity increases by 2 items every decade."
            ],
            correctAnswer: 0,
            explanation: "The Flynn effect is the worldwide rise in average intelligence test scores over time, likely due to environmental shifts (education, health)."
        },
        {
            question: "According to Sternberg's triarchic theory, what are the three components of intelligence?",
            options: [
                "Verbal, Mathematical, Spatial",
                "Analytical, Creative, Practical",
                "Emotional, Social, Academic",
                "Fluid, Crystallized, General"
            ],
            correctAnswer: 1,
            explanation: "Sternberg's Triarchic Theory outlines analytical (problem-solving), creative (novel solutions), and practical (street smarts) intelligences."
        }
    ],
    lesson_6_3: [
        {
            question: "Which motivation theory states that physical needs create an aroused state that pushes an organism to reduce the need (e.g. eating to stop hunger)?",
            options: ["Instinct Theory", "Drive-Reduction Theory", "Arousal Theory", "Maslow's Hierarchy"],
            correctAnswer: 1,
            explanation: "Drive-reduction theory states that physiological needs create internal tension (drives) that motivate behavior to restore homeostasis (balance)."
        },
        {
            question: "According to the Yerkes-Dodson Law, what level of physiological arousal leads to optimal performance on a difficult or complex task?",
            options: ["Extremely high arousal", "Moderate to low arousal", "Complete lack of arousal", "Maximum panic level"],
            correctAnswer: 1,
            explanation: "The Yerkes-Dodson Law states that optimal arousal is lower for difficult/complex tasks (to avoid anxiety blocks) and higher for simple/well-learned tasks."
        },
        {
            question: "A rat has its ventromedial hypothalamus (VMH) damaged. What behavior will the rat display?",
            options: [
                "It will refuse to eat and starve to death.",
                "It will eat continuously and become severely obese.",
                "It will lose all motor coordination.",
                "It will show a loss of drive-reduction homeostasis."
            ],
            correctAnswer: 1,
            explanation: "The VMH acts as the satiety center (stops hunger). Damage leads to hyperphagia (uncontrolled overeating)."
        },
        {
            question: "Which of the following metabolic hormones is released by the stomach to signal hunger to the brain?",
            options: ["Leptin", "Insulin", "Ghrelin", "PYY"],
            correctAnswer: 2,
            explanation: "Ghrelin is the 'hunger hormone' secreted by an empty stomach that sends signal pathways to the lateral hypothalamus to trigger eating."
        },
        {
            question: "The lateral hypothalamus (LH) primarily functions to:",
            options: [
                "Initiate hunger drives (acts as the 'start eating' center).",
                "Register fullness and stop eating.",
                "Synthesize adrenaline during stress.",
                "Consolidate explicit memories."
            ],
            correctAnswer: 0,
            explanation: "The LH stimulates hunger. Damage to the LH results in aphagia (refusal to eat and starvation)."
        }
    ],
    lesson_6_4: [
        {
            question: "You see a snake, your heart races, and simultaneously you feel fear. This matches which theory of emotion?",
            options: ["James-Lange Theory", "Cannon-Bard Theory", "Schachter-Singer Two-Factor Theory", "Lazarus Cognitive Theory"],
            correctAnswer: 1,
            explanation: "The Cannon-Bard theory states that emotional feelings and physiological arousal occur simultaneously and independently."
        },
        {
            question: "The Schachter-Singer Two-Factor theory proposes that emotion results from physiological arousal and:",
            options: [
                "An unconscious Freudian defense mechanism.",
                "A cognitive label we attach to that arousal based on environmental cues.",
                "Immediate muscle contraction signals.",
                "The direct activation of Broca's area."
            ],
            correctAnswer: 1,
            explanation: "Two-Factor theory states that to experience emotion, one must be physically aroused and cognitively identify/label the source of that arousal."
        },
        {
            question: "What are the three stages of Hans Selye's General Adaptation Syndrome (GAS) in response to chronic stress?",
            options: [
                "Fear, Arousal, Recovery",
                "Alarm, Resistance, Exhaustion",
                "Shock, Appraisal, Coping",
                "Denial, Anger, Acceptance"
            ],
            correctAnswer: 1,
            explanation: "GAS models stress adaptation through three stages: Alarm Reaction (mobilize resources), Resistance (cope with stressor), and Exhaustion (depletion of resources)."
        },
        {
            question: "Which theory of emotion states that we feel fear because we run (i.e. emotional experience arises from our perception of body physiological changes)?",
            options: ["James-Lange Theory", "Cannon-Bard Theory", "Two-Factor Theory", "Facial Feedback Theory"],
            correctAnswer: 0,
            explanation: "The James-Lange theory states that our emotional experiences are direct results of interpreting our physiological reactions to stimuli."
        },
        {
            question: "A person focuses on planning a study schedule and seeking tutoring to manage their failing grade. This is which style of coping?",
            options: ["Emotion-focused coping", "Problem-focused coping", "Defense mechanism coping", "Aversive counterconditioning"],
            correctAnswer: 1,
            explanation: "Problem-focused coping targets the stressor directly to resolve or alter the problem causing the stress."
        }
    ],
    lesson_6_5: [
        {
            question: "A student who loved drawing is offered $5 for every sketch they complete. Over time, they lose their organic interest in drawing and stop sketching once the money is removed. This demonstrates the:",
            options: ["Flynn Effect", "Overjustification Effect", "Yerkes-Dodson Law", "Bystander Effect"],
            correctAnswer: 1,
            explanation: "The overjustification effect occurs when external rewards (extrinsic motivation) decrease an individual's intrinsic motivation to perform a task."
        },
        {
            question: "According to Self-Determination Theory (SDT), what are the three basic psychological needs that foster motivation and growth?",
            options: [
                "Hunger, Thirst, Sleep",
                "Autonomy, Competence, Relatedness",
                "Self-Esteem, Safety, Achievement",
                "Intimacy, Identity, Integrity"
            ],
            correctAnswer: 1,
            explanation: "SDT outlines three basic needs: Autonomy (control over actions), Competence (mastering tasks), and Relatedness (belonging and connection)."
        },
        {
            question: "David McClelland's 'nAch' refers to a person's:",
            options: [
                "Need for affiliation and social groups.",
                "Need for achievement, driving them to set challenging goals and seek feedback.",
                "Natural neurological response to stress adaptation.",
                "Threshold index calculated under Weber's law."
            ],
            correctAnswer: 1,
            explanation: "The need for achievement (nAch) is an individual's desire for significant accomplishment, mastering skills, and high standards."
        },
        {
            question: "Ostracism, the deliberate exclusion from a social group, activates brain regions similar to:",
            options: ["Sleep-state spindles", "Physical pain pathways", "Implicit motor memory consolidation", "Visual transduction pathways"],
            correctAnswer: 1,
            explanation: "Neurological research shows that social exclusion (ostracism) triggers activation in the anterior cingulate cortex, the same region that registers physical pain."
        },
        {
            question: "What term describes the persistent desire to perform a task for its own sake, simply because it is satisfying or fun?",
            options: ["Extrinsic motivation", "Intrinsic motivation", "Homeostatic drive", "Refractory drive"],
            correctAnswer: 1,
            explanation: "Intrinsic motivation drives behaviors performed for internal satisfaction rather than external rewards or punishments."
        }
    ],

    // MODULE 7: Personality & Social Psychology
    lesson_7_1: [
        {
            question: "According to Sigmund Freud, which component of personality operates on the pleasure principle, seeking immediate gratification of primal urges?",
            options: ["Id", "Ego", "Superego", "Defense Mechanism"],
            correctAnswer: 0,
            explanation: "The id is the unconscious reservoir of libido and basic drives, operating strictly on the pleasure principle."
        },
        {
            question: "An angry employee goes home and kicks their dog instead of confronting their boss. Which defense mechanism are they using?",
            options: ["Projection", "Reaction Formation", "Displacement", "Sublimation"],
            correctAnswer: 2,
            explanation: "Displacement redirects hostile impulses toward a safer, less threatening substitute target (the dog)."
        },
        {
            question: "Carl Rogers proposed that healthy personality development requires parents to provide:",
            options: [
                "Strict schedules of reinforcement.",
                "Unconditional positive regard (acceptance regardless of behavior).",
                "Conditions of worth.",
                "Psychoanalytic dream analysis."
            ],
            correctAnswer: 1,
            explanation: "Unconditional positive regard is an attitude of total acceptance toward another, essential in humanistic client-centered growth."
        },
        {
            question: "Which of the following represents the correct list of the Big Five personality traits (OCEAN)?",
            options: [
                "Optimism, Cleverness, Extroversion, Agreeableness, Neuroticism",
                "Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism",
                "Openness, Control, Efficacy, Altruism, Narcissism",
                "Outgoing, Careful, Emotional, Assertive, Naive"
            ],
            correctAnswer: 1,
            explanation: "The Big Five model consists of: Openness to experience, Conscientiousness, Extraversion, Agreeableness, and Neuroticism."
        },
        {
            question: "Albert Bandura's concept of reciprocal determinism states that personality is shaped by the interaction of:",
            options: [
                "Id, Ego, and Superego.",
                "Cognitive/personal factors, environmental influences, and behaviors.",
                "Genetics, birth order, and hormone levels.",
                "Conscientiousness, extraversion, and standard deviations."
            ],
            correctAnswer: 1,
            explanation: "Reciprocal determinism describes the mutual, back-and-forth interaction between behaviors, internal cognitions, and environmental factors."
        }
    ],
    lesson_7_2: [
        {
            question: "You see a student fail a test and immediately assume they are 'lazy and unintelligent', ignoring the fact that they worked a night shift. This is the:",
            options: ["Self-serving bias", "Fundamental Attribution Error (FAE)", "Actor-observer bias", "Cognitive dissonance"],
            correctAnswer: 1,
            explanation: "The FAE is the tendency for observers to underestimate situational factors and overestimate dispositional traits when explaining others' behavior."
        },
        {
            question: "When you pass an exam, you attribute it to your intelligence (dispositional). When you fail, you blame the 'unfair questions' (situational). This is the:",
            options: ["Fundamental Attribution Error", "Self-serving bias", "Bystander effect", "Overjustification effect"],
            correctAnswer: 1,
            explanation: "The self-serving bias is the tendency to claim credit for successes (internal) and blame failures on external, situational factors."
        },
        {
            question: "According to Leon Festinger, cognitive dissonance occurs when:",
            options: [
                "We conform to a group to seek their social approval.",
                "We experience a conflict between two inconsistent cognitions or attitudes, causing psychological discomfort.",
                "We make dispositional attributions for our own failures.",
                "We process information through the central route to persuasion."
            ],
            correctAnswer: 1,
            explanation: "Cognitive dissonance is the internal tension experienced when our attitudes conflict with other attitudes or behaviors, motivating us to change one to restore balance."
        },
        {
            question: "A political campaign uses a highly emotional celebrity endorsement to persuade voters rather than presenting factual policies. This is which route to persuasion?",
            options: ["Central route", "Peripheral route", "Socratic route", "Reciprocal route"],
            correctAnswer: 1,
            explanation: "The peripheral route to persuasion uses incidental, superficial cues (celebrity, emotion) to induce quick, temporary attitude changes."
        },
        {
            question: "How do attribution patterns differ cross-culturally between individualist and collectivist societies?",
            options: [
                "Collectivist societies show higher rates of the Fundamental Attribution Error.",
                "Individualist societies show higher rates of the Fundamental Attribution Error, overestimating personal traits.",
                "There are no cultural differences; attributions are universal.",
                "Collectivist societies never attribute behavior to situational factors."
            ],
            correctAnswer: 1,
            explanation: "Individualist cultures focus on personal agency, increasing FAE rates, whereas collectivist cultures emphasize situational contexts, leading to lower rates of the FAE."
        }
    ],
    lesson_7_3: [
        {
            question: "Solomon Asch's classic experiments, where participants judged line lengths, were designed to measure:",
            options: ["Obedience to authority", "Conformity to group pressure", "Bystander intervention rates", "Social loafing"],
            correctAnswer: 1,
            explanation: "Asch's study demonstrated conformity, showing that participants would agree with a group's obviously incorrect visual judgment."
        },
        {
            question: "Stanley Milgram's shock generator experiments demonstrated that:",
            options: [
                "People conform to group pressure only when visual tasks are highly ambiguous.",
                "A surprising majority of ordinary people will obey destructive commands from an authority figure.",
                "Group size is the primary factor in bystander intervention.",
                "Individuals exert less effort in groups than when working alone."
            ],
            correctAnswer: 1,
            explanation: "Milgram showed that over 60% of participants fully complied with commands to administer lethal-level shocks to an innocent learner, demonstrating the powerful influence of authority."
        },
        {
            question: "What term describes the tendency for people in a group to exert less effort toward a common goal than when working individually?",
            options: ["Social facilitation", "Social loafing", "Deindividuation", "Groupthink"],
            correctAnswer: 1,
            explanation: "Social loafing is the reduction in individual effort that occurs when people pool work toward a shared goal, due to diffused accountability."
        },
        {
            question: "Deindividuation refers to:",
            options: [
                "The loss of self-awareness and self-restraint occurring in group situations that foster arousal and anonymity.",
                "The tendency to conform to seek social approval.",
                "The escalation of group decisions toward extreme viewpoints.",
                "Refusing to help a victim because other bystanders are present."
            ],
            correctAnswer: 0,
            explanation: "Deindividuation is the loss of individual identity and self-monitoring in crowds, often leading to uncharacteristic, impulsive behaviors (e.g. rioting)."
        },
        {
            question: "Which group dynamic is marked by a desire for group harmony that overrides realistic, critical appraisals of alternative choices?",
            options: ["Group polarization", "Groupthink", "Social facilitation", "De-escalation"],
            correctAnswer: 1,
            explanation: "Groupthink (Janis) occurs when group cohesion and the pressure to agree prevent critical thinking and objective decision-making."
        }
    ],
    lesson_7_4: [
        {
            question: "Which of the following describes the difference between prejudice and discrimination?",
            options: [
                "Prejudice is a behavior; discrimination is a cognitive belief.",
                "Prejudice is an attitude; discrimination is a negative behavior directed at a group.",
                "Prejudice is biological; discrimination is entirely social.",
                "There is no difference; they are synonymous."
            ],
            correctAnswer: 1,
            explanation: "Prejudice is an evaluation/attitude (often containing negative stereotypes), while discrimination is the actual negative action or treatment resulting from that prejudice."
        },
        {
            question: "The mere exposure effect states that attraction and liking of a stimulus increases with:",
            options: [
                "The physical attractiveness of the stimulus.",
                "Repeated exposure and familiarity with the stimulus.",
                "The similarity of the stimulus to our own traits.",
                "The presence of positive reinforcement rewards."
            ],
            correctAnswer: 1,
            explanation: "The mere exposure effect is the phenomenon where repeated exposure to a novel stimulus increases our preference or liking for it."
        },
        {
            question: "The just-world phenomenon refers to the cognitive bias where people believe that:",
            options: [
                "Laws are always fair and should never be broken.",
                "The world is fundamentally just, and therefore people get what they deserve (blaming the victim).",
                "Altruism is the primary biological drive of humans.",
                "In-group bias can be eliminated through contact theory."
            ],
            correctAnswer: 1,
            explanation: "The just-world bias leads people to believe that good things happen to good people and bad things to bad people, often leading them to rationalize injustice or blame victims."
        },
        {
            question: "According to the bystander effect, the likelihood of an individual helping a victim decreases as:",
            options: [
                "The emergency becomes more severe.",
                "The number of other bystanders increases (diffusion of responsibility).",
                "The bystander's level of empathy rises.",
                "The victim's similarity to the bystander drops."
            ],
            correctAnswer: 1,
            explanation: "The bystander effect shows that the presence of other witnesses diffuses individual accountability, reducing the likelihood that any single person will help."
        },
        {
            question: "Which social norm states that we should help those who have helped us, establishing a cycle of mutual aid?",
            options: ["Social-responsibility norm", "Reciprocity norm", "Bystander norm", "Just-world norm"],
            correctAnswer: 1,
            explanation: "The reciprocity norm is the expectation that people will respond positively to others by returning benefits for benefits."
        }
    ],

    // MODULE 8: Psychological Disorders & Treatments
    lesson_8_1: [
        {
            question: "Under the UMAD criteria of abnormality, which component describes a behavior that interferes with daily functioning and survival?",
            options: ["Unjustifiable", "Maladaptive", "Atypical", "Disturbing"],
            correctAnswer: 1,
            explanation: "Maladaptive behaviors prevent individuals from adapting or functioning successfully in daily life."
        },
        {
            question: "How does the biopsychosocial approach differ from the historical medical model of psychological disorders?",
            options: [
                "It focuses exclusively on genetic factors and brain structures.",
                "It views disorders as arising from interactions between biological, psychological, and social-cultural factors.",
                "It rejects the use of diagnostic manuals like the DSM-5.",
                "It attributes all abnormal behavior to childhood psychosexual stages."
            ],
            correctAnswer: 1,
            explanation: "The biopsychosocial model integrates genetics/neurobiology, cognitive coping styles, and environmental stressors, rather than focusing purely on disease biology."
        },
        {
            question: "Which of the following disorders is characterized by persistent, uncontrollable, and free-floating anxiety without a specific trigger?",
            options: ["Panic Disorder", "Generalized Anxiety Disorder (GAD)", "Phobias", "OCD"],
            correctAnswer: 1,
            explanation: "GAD is defined by chronic, generalized, and excessive anxiety that is not tied to a specific object or situation."
        },
        {
            question: "An individual experiences recurring, intrusive thoughts of contamination (obsessions) and washes their hands 50 times a day (compulsions). The hand-washing represents:",
            options: [
                "A cognitive appraisal.",
                "A compulsion designed to reduce the anxiety caused by the obsession.",
                "An unconditioned response to hand bacteria.",
                "A conversion symptom."
            ],
            correctAnswer: 1,
            explanation: "Compulsions are repetitive behaviors performed to prevent or reduce the distress and anxiety caused by obsessions."
        },
        {
            question: "The Rosenhan study, where healthy researchers gained admission to mental hospitals by faking hallucinations, highlighted:",
            options: [
                "The extreme difficulty of curing schizophrenia.",
                "The biasing power and stigma associated with diagnostic labels.",
                "The efficacy of behavioral token economies.",
                "The biological genetics of somatic symptom disorders."
            ],
            correctAnswer: 1,
            explanation: "Rosenhan demonstrated that once labeled with a diagnosis (Schizophrenia), all normal behaviors of the pseudopatients were interpreted by staff as symptoms."
        }
    ],
    lesson_8_2: [
        {
            question: "A patient with schizophrenia believes they are the Emperor of the Moon and that the government is transmitting rays into their teeth. These beliefs are:",
            options: ["Hallucinations", "Delusions", "Flat affect", "Compulsions"],
            correctAnswer: 1,
            explanation: "Delusions are false, fixed beliefs maintained despite clear, contradictory evidence. Hallucinations are false sensory perceptions (like hearing voices)."
        },
        {
            question: "Which of the following represents a 'negative symptom' of Schizophrenia?",
            options: ["Auditory hallucinations", "Delusions of persecution", "Flat affect (lack of emotional expression)", "Disorganized, rapid speech"],
            correctAnswer: 2,
            explanation: "Negative symptoms involve behavioral deficits or absences (e.g. flat affect, social withdrawal, alogia), whereas positive symptoms are additions (hallucinations, delusions)."
        },
        {
            question: "The dopamine hypothesis of Schizophrenia suggests that the disorder is linked to:",
            options: [
                "An underactivity of dopamine in the temporal lobes.",
                "An overactivity or excess of dopamine receptors (specifically D2 receptors).",
                "The complete depletion of serotonin reuptake pumps.",
                "A decay of myelin in the cerebellum."
            ],
            correctAnswer: 1,
            explanation: "The dopamine hypothesis proposes that hyperactive dopamine transmission (specifically excess D2 receptors) produces positive symptoms like hallucinations."
        },
        {
            question: "How does Bipolar I disorder differ from Bipolar II disorder?",
            options: [
                "Bipolar I requires at least one full manic episode; Bipolar II involves hypomanic episodes and major depression.",
                "Bipolar I involves only depressive episodes; Bipolar II involves schizophrenia.",
                "Bipolar I is purely situational; Bipolar II is genetic.",
                "Bipolar I is treated with SSRIs; Bipolar II is treated with antipsychotics."
            ],
            correctAnswer: 0,
            explanation: "Bipolar I is characterized by severe manic episodes (often requiring hospitalization), while Bipolar II involves hypomania (less severe) and major depressive episodes."
        },
        {
            question: "A patient displays two or more distinct, alternating personalities, along with severe memory gaps. This is:",
            options: ["Schizophrenia", "Dissociative Identity Disorder (DID)", "Antisocial Personality Disorder", "Illness Anxiety Disorder"],
            correctAnswer: 1,
            explanation: "DID is a dissociative disorder marked by the presence of two or more distinct personality states that control behavior, accompanied by memory lapses."
        }
    ],
    lesson_8_3: [
        {
            question: "A patient presents with sudden, total blindness in their left eye. A thorough neurological audit reveals no physical damage to the eye, optic nerve, or visual cortex. This is:",
            options: ["Somatic Symptom Disorder", "Conversion Disorder", "Illness Anxiety Disorder", "Borderline Personality Disorder"],
            correctAnswer: 1,
            explanation: "Conversion disorder (functional neurological symptom disorder) involves physical symptoms affecting sensory or motor functions with no organic, biological explanation."
        },
        {
            question: "An individual displays a pervasive pattern of disregard for the rights of others, shows no remorse, and frequently engages in manipulative, deceitful behaviors. They fit the criteria for:",
            options: ["Borderline Personality Disorder", "Antisocial Personality Disorder", "Obsessive-Compulsive Personality Disorder", "Conversion Disorder"],
            correctAnswer: 1,
            explanation: "Antisocial personality disorder is a Cluster B disorder characterized by a lack of conscience, deceitfulness, and manipulation without remorse."
        },
        {
            question: "Cluster B personality disorders (which include Borderline and Antisocial) are characterized by behaviors that are:",
            options: [
                "Odd, eccentric, and socially withdrawn.",
                "Dramatic, emotional, erratic, and impulsive.",
                "Anxious, fearful, and obsessive.",
                "Purely somatic and neurological in nature."
            ],
            correctAnswer: 1,
            explanation: "Cluster B includes dramatic, emotional, or erratic behaviors (Antisocial, Borderline, Histrionic, Narcissistic)."
        },
        {
            question: "A person experiences extreme instability in their self-image, relationships, and emotions, displaying a frantic fear of abandonment and self-harming behaviors. This is:",
            options: ["Antisocial Personality Disorder", "Borderline Personality Disorder", "Avoidant Personality Disorder", "Somatic Symptom Disorder"],
            correctAnswer: 1,
            explanation: "Borderline personality disorder is marked by emotional instability, unstable relationships, chronic emptiness, and impulsivity."
        },
        {
            question: "How does Somatic Symptom Disorder differ from Conversion Disorder?",
            options: [
                "Somatic Symptom involves excessive anxiety over real or minor physical symptoms; Conversion involves specific neurological deficits with no physical basis.",
                "Somatic Symptom is treated with drugs; Conversion is completely untreatable.",
                "Somatic Symptom is a Cluster A disorder; Conversion is a Cluster B disorder.",
                "There is no difference; they are interchangeable."
            ],
            correctAnswer: 0,
            explanation: "Somatic Symptom disorder involves disproportionate anxiety over somatic symptoms, whereas Conversion disorder features specific sensory/motor failures (like paralysis or blindness) without organic cause."
        }
    ],
    lesson_8_4: [
        {
            question: "Which therapeutic approach focuses on active listening, unconditional positive regard, and helping the client achieve self-actualization?",
            options: ["Psychoanalysis", "Client-Centered (Humanistic) Therapy", "Cognitive-Behavioral Therapy (CBT)", "Systematic Desensitization"],
            correctAnswer: 1,
            explanation: "Carl Rogers' client-centered therapy is a humanistic approach emphasizing empathy, warmth (positive regard), and facilitating self-guided growth."
        },
        {
            question: "A behavioral therapist treats a spider phobia by exposing the client to a fear hierarchy (photos, plastic spiders, real spiders) while teaching deep muscle relaxation. This is:",
            options: ["Aversive conditioning", "Systematic desensitization", "Cognitive restructuring", "Free association"],
            correctAnswer: 1,
            explanation: "Systematic desensitization is a counterconditioning technique that pairs a hierarchy of anxiety-triggering stimuli with deep relaxation."
        },
        {
            question: "Cognitive-Behavioral Therapy (CBT) helps clients primarily by:",
            options: [
                "Exploring unconscious childhood conflicts through free association.",
                "Restructuring irrational, negative thoughts and modifying maladaptive behaviors.",
                "Using token economies to control involuntary reflexes.",
                "Administering lithium to stabilize synaptic transmission."
            ],
            correctAnswer: 1,
            explanation: "CBT combines cognitive restructuring (altering negative thoughts) with behavioral modification to improve coping."
        },
        {
            question: "Tardive dyskinesia is a serious side effect characterized by involuntary facial muscle movements. It is associated with the long-term use of:",
            options: ["Antidepressants (SSRIs)", "First-generation Antipsychotic medications (neuroleptics)", "Antianxiety drugs (benzodiazepines)", "Mood stabilizers (lithium)"],
            correctAnswer: 1,
            explanation: "Tardive dyskinesia is a neurological side effect caused by long-term blockade of dopamine receptors from older antipsychotic drugs."
        },
        {
            question: "Which drug class treats anxiety by enhancing the inhibitory activity of GABA at receptor sites?",
            options: ["SSRIs", "Benzodiazepines", "Neuroleptics", "Lithium salts"],
            correctAnswer: 1,
            explanation: "Benzodiazepines (e.g. Xanax, Valium) are antianxiety drugs that act as GABA agonists, depressing central nervous system excitability to calm anxiety."
        }
    ]
};

// Expose the database globally to let assignments.js access it
window.psychQuizzes = psychQuizzes;
