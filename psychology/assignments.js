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
                question: "Which of the following historical perspectives in psychology focused on breaking down conscious experience into its basic components using introspection?",
                options: ["Functionalism", "Structuralism", "Behaviorism", "Humanism"],
                correctAnswer: 1,
                explanation: "Structuralism (Wundt, Titchener) aimed to map the elements of the conscious mind using experimental introspection."
            },
            {
                question: "A cognitive psychologist is most likely to study which of the following topics?",
                options: ["How neurotransmitters affect mood", "Unconscious conflicts from childhood", "How people organize and remember information", "The adaptive value of mating behaviors"],
                correctAnswer: 2,
                explanation: "Cognitive psychology is the scientific study of mental processes, including perception, memory, and reasoning."
            },
            {
                question: "Which perspective would emphasize that human behavior is driven by self-actualization, free will, and personal growth?",
                options: ["Humanistic", "Behavioral", "Biological", "Psychodynamic"],
                correctAnswer: 0,
                explanation: "Humanistic psychology (Rogers, Maslow) focuses on the unique qualities of humans, free will, and their potential for personal growth."
            },
            {
                question: "B.F. Skinner and John B. Watson are primary figures in which theoretical school?",
                options: ["Structuralism", "Psychoanalysis", "Behaviorism", "Evolutionary Psychology"],
                correctAnswer: 2,
                explanation: "Watson and Skinner were pioneers of Behaviorism, focusing strictly on observable actions and environmental rewards."
            },
            {
                question: "Which school of thought was heavily influenced by Charles Darwin and investigated how mental activities help us adapt to our environment?",
                options: ["Functionalism", "Structuralism", "Humanism", "Gestalt Psychology"],
                correctAnswer: 0,
                explanation: "Functionalism (William James) examined the functions of consciousness and how they enable survival and environmental adaptation."
            }
        ],
        lesson_2_1: () => [
            {
                question: "During the resting state, the membrane potential of a neuron is typically around -70 mV. This resting potential is primarily maintained by:",
                options: ["The passive diffusion of calcium ions", "The active sodium-potassium pump", "The rapid opening of vesicles", "Myelin sheath insulation"],
                correctAnswer: 1,
                explanation: "The sodium-potassium pump actively transports 3 sodium ions out of the cell for every 2 potassium ions it pumps in, maintaining the negative resting charge."
            },
            {
                question: "Which of the following describes the 'all-or-none' response of a neuron?",
                options: ["A stronger stimulus causes a larger electrical signal.", "All neurotransmitters are released simultaneously or not at all.", "An action potential occurs fully or not at all once threshold is reached.", "Neurons either fire continuously or remain permanently silent."],
                correctAnswer: 2,
                explanation: "The all-or-none law states that once stimulation crosses the threshold (approx -55mV), a nerve impulse fires at a constant, full intensity."
            },
            {
                question: "The electrical impulse travels down the neuron in which of the following sequences?",
                options: ["Axon ➔ Soma ➔ Dendrite ➔ Terminal Buttons", "Dendrite ➔ Soma ➔ Axon ➔ Terminal Buttons", "Soma ➔ Axon ➔ Dendrite ➔ Terminal Buttons", "Terminal Buttons ➔ Axon ➔ Soma ➔ Dendrite"],
                correctAnswer: 1,
                explanation: "Signaling starts at the dendrites (receiving input), moves to the cell body (soma), travels down the axon, and reaches the terminal buttons."
            },
            {
                question: "What wraps around the axon to act as an electrical insulator, speeding up the transmission of action potentials?",
                options: ["Synaptic vesicles", "Myelin sheath", "Reuptake pumps", "Dendritic spines"],
                correctAnswer: 1,
                explanation: "The myelin sheath is a fatty layer of tissue that insulates the axon and increases the speed of neural transmission."
            },
            {
                question: "In synaptic transmission, neurotransmitters are released from the vesicle into the:",
                options: ["Axon hillock", "Soma", "Synaptic cleft", "Myelin nodes"],
                correctAnswer: 2,
                explanation: "Neurotransmitters diffuse across the synaptic cleft (the microscopic gap between cells) to bind to postsynaptic receptors."
            }
        ],
        lesson_5_2: () => [
            {
                question: "A slot machine pays out jackpots after an unpredictable number of coin presses. This represents which schedule of reinforcement?",
                options: ["Fixed-Ratio", "Variable-Ratio", "Fixed-Interval", "Variable-Interval"],
                correctAnswer: 1,
                explanation: "Variable-ratio reinforcement delivers rewards after a changing, unpredictable number of responses, creating high, steady response rates."
            },
            {
                question: "Which of the following represents negative reinforcement?",
                options: ["Spanking a child for misbehaving.", "Taking away a teenager's phone to stop tantrums.", "Fastening your seatbelt to stop a loud, annoying buzzer.", "Giving a dog a treat when it sits on command."],
                correctAnswer: 2,
                explanation: "Reinforcement increases a behavior. Negative reinforcement does this by removing or avoiding an unpleasant/aversive stimulus (the buzzer)."
            },
            {
                question: "A factory worker is paid $20 for every 10 items assembled. This is an example of which schedule of reinforcement?",
                options: ["Fixed-Ratio", "Variable-Ratio", "Fixed-Interval", "Variable-Interval"],
                correctAnswer: 0,
                explanation: "Fixed-ratio reinforcement delivers a reward after a specific, constant number of responses (every 10 items)."
            },
            {
                question: "What is the primary difference between reinforcement and punishment?",
                options: ["Reinforcement increases a behavior; punishment decreases a behavior.", "Reinforcement uses positive stimuli; punishment uses negative stimuli.", "Reinforcement is immediate; punishment is always delayed.", "Reinforcement is operant conditioning; punishment is classical conditioning."],
                correctAnswer: 0,
                explanation: "By definition, reinforcement strengthens/increases a behavior, whereas punishment weakens/decreases a behavior."
            },
            {
                question: "The process of reinforcing successive approximations of a desired behavior to teach a complex task is known as:",
                options: ["Shaping", "Extinction", "Generalization", "Spontaneous Recovery"],
                correctAnswer: 0,
                explanation: "Shaping guides behavior towards a target action by rewarding closer and closer steps (successive approximations) to it."
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
            return JSON.parse(localStorage.getItem('psychology_masteryMatrix') || '{}');
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
        appState.syllabus.modules.forEach((mod) => {
            appState.syllabus.lessonsByModule[mod.id].forEach((lesson) => all.push(lesson));
        });
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

        if (state === STATE_MASTERED) {
            els.assignmentType.textContent = 'Accredited Homework Passed';
        } else {
            els.assignmentType.textContent = 'Conceptual Homework Sheet';
        }
    }

    function setGradeDisplay(percent, status, tone) {
        els.masteryGrade.textContent = `${percent}%`;
        els.masteryStatus.textContent = status;

        els.masteryStatus.classList.remove('text-slate-500', 'text-emerald-400', 'text-red-400');
        if (tone === 'emerald') {
            els.masteryStatus.classList.add('text-emerald-400');
        } else if (tone === 'red') {
            els.masteryStatus.classList.add('text-red-400');
        } else {
            els.masteryStatus.classList.add('text-slate-500');
        }
    }

    function resetGradeDisplayForState(state) {
        if (state === STATE_MASTERED) {
            setGradeDisplay(100, 'PASSED', 'emerald');
        } else {
            els.masteryGrade.textContent = '--%';
            els.masteryStatus.textContent = 'No Grade';
            els.masteryStatus.classList.remove('text-emerald-400', 'text-red-400');
            els.masteryStatus.classList.add('text-slate-500');
        }
    }

    // Dynamic Multiple-Choice Question builder for any lesson
    function buildFallbackQuestions(lesson) {
        return [
            {
                question: `Which of the following is most closely associated with the concept of "${lesson.concept}"?`,
                options: [
                    "An automatic reflex with no mental or sensory pathways.",
                    "A core psychological theory explaining mental operations and behaviors.",
                    "A chemical neurotransmitter stored inside muscle fibers.",
                    "An experimental design lacking independent variables."
                ],
                correctAnswer: 1,
                explanation: `This is a fundamental concept representing: ${lesson.concept}.`
            },
            {
                question: `Based on the lesson plan, how does "${lesson.title}" apply to real-world scenarios?`,
                options: [
                    `It explains the clinical/real-world hook: "${lesson.clinical_tie_in}".`,
                    "It has no real-world application and represents pure theoretical physics.",
                    "It is used exclusively to calibrate electronic blood pressure pumps.",
                    "It serves only as a historical reference for Wundt's structuralist labs."
                ],
                correctAnswer: 0,
                explanation: `The real-world significance of this lesson relates directly to: ${lesson.clinical_tie_in}.`
            },
            {
                question: "In scientific research, how do psychologists validate this concept?",
                options: [
                    "By relying entirely on personal anecdotes and introspection.",
                    "By using controlled experiments, surveys, and clinical observations.",
                    "By treating all hypotheses as absolute truths without collecting data.",
                    "By ignoring ethical guidelines established by the IRB."
                ],
                correctAnswer: 1,
                explanation: "Psychology uses empirical scientific methods, including controlled observations and experiments, to support concepts."
            },
            {
                question: "Why is a scientific approach preferred over common sense in explaining these behaviors?",
                options: [
                    "Common sense is always completely wrong about everything.",
                    "Scientific observations are systematically collected and open to replication.",
                    "Scientists are paid by universities to make concepts intentionally complex.",
                    "Common sense does not utilize simple language."
                ],
                correctAnswer: 1,
                explanation: "Systematic scientific empirical validation protects against bias and allows researchers to replicate findings."
            },
            {
                question: `The Feynman prompt for this lesson asks to explain: "${lesson.feynman_prompt}". This requires explaining the concept to:`,
                options: [
                    "A peer review board of neuroscientists.",
                    "A child in simple, jargon-free terms.",
                    "An AI model using complex math formulas.",
                    "A medical board auditor evaluating credentials."
                ],
                correctAnswer: 1,
                explanation: "The Feynman technique focuses on explaining complex concepts in simple, accessible language."
            }
        ];
    }

    function renderQuestions(questions) {
        els.questionsGrid.innerHTML = '';

        questions.forEach((q, index) => {
            const row = document.createElement('div');
            row.className = 'pt-6 first:pt-0 space-y-2';
            row.dataset.index = String(index);

            let optionsHtml = '';
            q.options.forEach((opt, optIdx) => {
                optionsHtml += `
                    <label class="flex items-center space-x-3 p-2 bg-slate-950/40 border border-slate-800 rounded hover:bg-purple-900/10 hover:border-purple-900/30 cursor-pointer transition">
                        <input type="radio" name="answer_${index}" value="${optIdx}" class="accent-purple-500">
                        <span class="text-xs text-slate-300">${opt}</span>
                    </label>
                `;
            });

            row.innerHTML = `
                <label class="block text-xs font-semibold text-purple-300 mb-2">Q${index + 1}. ${q.question}</label>
                <div class="space-y-1.5">${optionsHtml}</div>
                <p class="mt-2 text-[10px] text-slate-500 hidden" id="feedback_${index}"></p>
            `;

            els.questionsGrid.appendChild(row);
        });
    }

    function gradeSubmission() {
        let correctCount = 0;

        appState.currentQuestions.forEach((q, index) => {
            const checkedInput = document.querySelector(`input[name="answer_${index}"]:checked`);
            const feedback = document.getElementById(`feedback_${index}`);
            
            feedback.classList.remove('hidden', 'text-emerald-400', 'text-red-400');
            
            const userValue = checkedInput ? parseInt(checkedInput.value) : -1;

            const labels = document.querySelectorAll(`input[name="answer_${index}"]`);
            labels.forEach(radio => {
                const container = radio.closest('label');
                container.classList.remove('border-emerald-500/50', 'bg-emerald-950/20', 'border-red-500/50', 'bg-red-950/20');
            });

            if (userValue === q.correctAnswer) {
                correctCount += 1;
                if (checkedInput) {
                    checkedInput.closest('label').classList.add('border-emerald-500/50', 'bg-emerald-950/20');
                }
                feedback.classList.add('text-emerald-400');
                feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> Correct. ${q.explanation || ''}`;
            } else {
                if (checkedInput) {
                    checkedInput.closest('label').classList.add('border-red-500/50', 'bg-red-950/20');
                }
                labels.forEach(radio => {
                    if (parseInt(radio.value) === q.correctAnswer) {
                        radio.closest('label').classList.add('border-emerald-500/30', 'bg-emerald-950/10');
                    }
                });
                feedback.classList.add('text-red-400');
                feedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Incorrect. ${q.explanation || ''}`;
            }

            feedback.classList.remove('hidden');
        });

        return Math.round((correctCount / appState.currentQuestions.length) * 100);
    }

    function generateProblemSet() {
        const hasGlobalQuizzes = typeof psychQuizzes !== 'undefined';
        if (hasGlobalQuizzes && psychQuizzes[appState.selectedLessonId]) {
            appState.currentQuestions = psychQuizzes[appState.selectedLessonId];
        } else {
            const generator = ASSIGNMENT_DB[appState.selectedLessonId];
            appState.currentQuestions = generator
                ? generator()
                : buildFallbackQuestions(appState.selectedLesson);
        }

        renderQuestions(appState.currentQuestions);
        setGradeDisplay(0, 'PENDING', 'none');
    }

    function isCurriculumBypassEnabledLocal() {
        return localStorage.getItem('psychology_curriculum_bypass') === 'true';
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
            updateLessonState(appState.selectedLessonId, STATE_MASTERED);
            
            // Award XP and stats
            if (window.PsychGamification) {
                let xpReward = 50;
                let isPerfect = score === 100;
                if (isPerfect) {
                    xpReward += 50; // perfect bonus
                }
                window.PsychGamification.awardXP(xpReward, 'homework', els.masteryGrade);
                window.PsychGamification.incrementStat('quizzesSolved');
                if (isPerfect) {
                    window.PsychGamification.incrementStat('perfectQuizzes');
                }
            }

            // Re-read matrix to load locks and status sidebar updates
            appState.matrix = readMatrix();
            renderSidebar(appState.syllabus, appState.matrix);
            updateGlobalProgress(appState.matrix, appState.syllabus);
        } else {
            setGradeDisplay(score, 'FAILED', 'red');
        }
    }

    function initListeners() {
        els.homeworkForm.addEventListener('submit', handleFormSubmit);

        window.selectAssignment = (lessonId) => {
            updateForLessonSelection(lessonId);
        };

        // Bypass button
        const bypassBtn = document.getElementById('btn-curriculum-bypass');
        if (bypassBtn) {
            const updateBypassBtn = () => {
                const enabled = isCurriculumBypassEnabledLocal();
                bypassBtn.textContent = enabled ? "Explore Mode" : "Locked Mode";
                bypassBtn.className = enabled 
                    ? "px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-purple-500/25 bg-purple-500/10 text-purple-300 transition"
                    : "px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-350 hover:bg-slate-750 transition";
            };
            updateBypassBtn();
            bypassBtn.addEventListener('click', () => {
                const next = toggleCurriculumBypass();
                updateBypassBtn();
                appState.matrix = readMatrix();
                renderSidebar(appState.syllabus, appState.matrix);
                updateForLessonSelection(appState.selectedLessonId);
            });
        }
    }

    window.addEventListener('syllabusLoaded', (e) => {
        appState.syllabus = e.detail.syllabus;
        appState.matrix = e.detail.matrix;

        cacheDom();
        initListeners();

        const routeId = resolveInitialLessonId();
        if (routeId) {
            updateForLessonSelection(routeId);
        }
    });

})();
