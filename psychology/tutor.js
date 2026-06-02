/**
 * PSY 201Z - AI Tutor Router & Prompt Interface
 * Handles interaction with local GnosysLLM and provides mock fallback data.
 */

window.PsychTutor = (() => {
    function getPsychModel() {
        if (typeof window.getActiveModel === 'function') {
            return window.getActiveModel('psych_llm');
        }
        return localStorage.getItem('psychology_llm') || localStorage.getItem('syngnosia_tutor_model') || 'gemma';
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
        cleaned = cleaned.replace(/\$\$/g, '');
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
            'PSYCHOLOGY TUTOR SYSTEM PROMPT:',
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
            bubble.className = "max-w-[80%] bg-purple-600 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-xs font-medium";
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

    // Comprehensive offline mock database for all 36 lessons to guarantee utility when LLM is unavailable
    const mockDatabase = {
        lesson_1_1: {
            lecture: `### 1. Real-World Case Study
A patient named Alex presents to a clinic with severe social anxiety. A psychodynamic psychologist traces this back to unconscious childhood conflicts. A behaviorist disregards the unconscious and focuses on conditioning, observing that Alex received negative reinforcement (safety) when avoiding social cues. A cognitive psychologist investigates Alex's automatic thoughts: "Everyone will judge me." A biological psychologist examines Alex's genetics and low serotonin levels.

### 2. Core Psychological Principles
Modern psychology relies on distinct viewpoints rather than a single theory:
- **Structuralism**: (Wundt, Titchener) Focused on breaking down consciousness into basic components using introspection.
- **Functionalism**: (James) Examined how mental activities help organisms adapt to their environments.
- **Behaviorism**: (Watson, Skinner) Rejects introspection, focusing only on observable behavior and environmental conditioning.
- **Cognitive**: Focuses on mental processes like memory, thinking, and language.
- **Biological**: Investigates the physiological, genetic, and chemical bases of behavior.
- **Humanistic**: (Rogers, Maslow) Emphasizes human growth, free will, and self-actualization.
- **Sociocultural**: Analyzes how culture and social settings shape behaviors.

### 3. Empirical & Methodological Frameworks
Psychologists use specific scientific subfields. Clinical psychologists treat disorders, developmental psychologists study change across the lifespan, and industrial-organizational (I/O) psychologists apply psychological concepts to workplaces.

### 4. Cross-Cultural & Practical Application
When analyzing Alex's anxiety cross-culturally, an individualistic society might view Alex's anxiety as a personal self-esteem deficit, whereas a collectivistic society might view it as concern over failing social duties.`,
            socraticInit: "Welcome to PSY201Z! Let's explore Lesson 1.1: Historical Perspectives. What is the fundamental difference between how a behaviorist and a cognitive psychologist would explain a child throwing a temper tantrum?",
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if ((text.includes('observe') || text.includes('behavior') || text.includes('reward') || text.includes('reinforce')) && 
                    (text.includes('think') || text.includes('thought') || text.includes('mind') || text.includes('cognitive') || text.includes('belief') || text.includes('process'))) {
                    return { passed: true, feedback: "Excellent! You correctly identified that behaviorists focus strictly on observable actions and environmental rewards, while cognitive psychologists analyze internal thinking and belief processes. CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." };
                }
                return { passed: false, feedback: "You are on the right path. Try to contrast the behaviorist focus on external rewards or observable actions with the cognitive focus on internal thoughts and beliefs. Try again." };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                if (text.length > 30 && (text.includes('perspective') || text.includes('view') || text.includes('different') || text.includes('multiple'))) {
                    return { passed: true, feedback: "Great summary! You've captured why modern psychology utilizes multiple perspectives (biological, behavioral, cognitive, etc.) to examine the complex layers of human behavior." };
                }
                return { passed: false, feedback: "Explain in simple terms why having different viewpoints (like biological vs. behavioral) is useful. Try expanding your explanation." };
            }
        }
    };

    // Generic mock generator for any lesson id not hardcoded above
    function getMockFallback(lessonId, lessonTitle, concept, hook, feynmanPrompt) {
        if (mockDatabase[lessonId]) return mockDatabase[lessonId];
        
        const numStr = lessonId.replace('lesson_', '').replace('_', '.');
        return {
            lecture: `### 1. Real-World Case Study
For **Lesson ${numStr}: ${lessonTitle}**, let us look at the case of a patient experiencing symptoms directly linked to this concept. The clinical/real-world hook: *${hook}*. This demonstrates how biological, behavioral, or cognitive mechanisms directly influence daily human functioning.

### 2. Core Psychological Principles
The primary concept of this lesson is: **${concept}**. 
In introductory psychology, this represents a fundamental framework. We analyze how this mechanism operates, how it interacts with other biological or mental systems, and the theories proposed by leading researchers to explain these phenomena.

### 3. Empirical & Methodological Frameworks
Researchers investigate this concept using rigorous empirical methods. This includes designing controlled laboratory experiments, collecting statistical data, or running clinical trials. Understanding the research parameters and avoiding confounding variables is essential for validating the scientific findings.

### 4. Cross-Cultural & Practical Application
From a cross-cultural perspective, psychologists emphasize that psychological phenomena are not universal; they are influenced by Western vs. Non-Western cultural settings, societal norms, and ecological environments.`,
            socraticInit: `Let's discuss Lesson ${numStr}: ${lessonTitle}. The core concept is "${concept}". Based on the real-world hook (*${hook}*), why do you think this phenomenon occurs?`,
            socraticEval: (input) => {
                const text = input.toLowerCase();
                if (text.length > 15) {
                    return { passed: true, feedback: `Great response! You've shown that you understand the core aspects of "${concept}". CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3.` };
                }
                return { passed: false, feedback: "Could you expand your explanation? Try to connect it back to the core concept of the lesson. What is your understanding?" };
            },
            feynmanEval: (input) => {
                const text = input.toLowerCase();
                if (text.length > 25) {
                    return { passed: true, feedback: "Excellent explanation. You have successfully summarized the concept in simple, accessible terms." };
                }
                return { passed: false, feedback: `Please try to elaborate. The prompt is: "${feynmanPrompt}". Explain it in simple terms.` };
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
                        bubble.className = "max-w-[80%] bg-purple-600 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-xs font-medium";
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
                    typingWrap.innerHTML = `<div class="bg-slate-900 px-3 py-2 rounded-2xl flex items-center space-x-1 border border-slate-800"><div class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0.15s"></div><div class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></div></div>`;
                    msgsEl.appendChild(typingWrap);
                    msgsEl.scrollTop = msgsEl.scrollHeight;

                    const model = getPsychModel();
                    const systemPrompt = "You are an expert introductory psychology college professor. Be encouraging, precise, and concise. Explain step by step. " + (systemContext ? "\n\nContext:\n" + systemContext : "");

                    try {
                        const result = await window.GnosysLLM.generateResponse(
                            systemPrompt,
                            text,
                            {
                                moduleKey: 'psych_llm',
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

                appendLocalBubble("assistant", "Hello! I am your psychology tutor. Let's analyze this concept together. What questions do you have?");
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

            if (opts.mountMode === 'append' && anchorEl instanceof HTMLElement) {
                const tpl = document.getElementById('inline-tutor-template');
                let widget;

                if (tpl?.content?.firstElementChild) {
                    widget = tpl.content.firstElementChild.cloneNode(true);
                } else {
                    widget = document.createElement('div');
                    widget.className = 'video-quiz-widget mt-4';
                    widget.innerHTML = `
                        <div class="bg-slate-900 rounded-2xl border border-purple-900/40 shadow-sm overflow-hidden">
                            <div class="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-purple-900/30">
                                <span class="text-xs font-bold text-purple-200">PsychTutor</span>
                                <button class="tutor-close w-7 h-7 rounded-full flex items-center justify-center text-purple-300 hover:text-purple-100 hover:bg-purple-900/40 transition-colors" title="Close"><i class="fa-solid fa-xmark text-sm"></i></button>
                            </div>
                            <div class="tutor-messages px-4 py-3 space-y-3 max-h-44 overflow-y-auto"></div>
                            <div class="border-t border-purple-900/30 p-3 flex gap-2 bg-slate-950/70">
                                <input type="text" placeholder="Ask for a hint..." class="tutor-input flex-1 text-sm px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none" />
                                <button class="tutor-send w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-colors shadow-sm shrink-0"><i class="fa-solid fa-paper-plane text-xs"></i></button>
                            </div>
                        </div>
                    `;
                }

                if (opts.widgetClassName) {
                    opts.widgetClassName.split(' ').filter(Boolean).forEach((cls) => widget.classList.add(cls));
                }

                anchorEl.replaceChildren(widget);
                startSession(
                    widget.querySelector('.tutor-messages'),
                    widget.querySelector('.tutor-input'),
                    widget.querySelector('.tutor-send'),
                    widget.querySelector('.tutor-close'),
                    () => widget.remove()
                );
                return;
            }

            // Re-use or create the tutor popup modal
            let popupEl = document.getElementById('tutor-popup-modal');
            if (!popupEl) {
                popupEl = document.createElement('div');
                popupEl.id = 'tutor-popup-modal';
                popupEl.className = 'fixed inset-0 z-[200] hidden flex items-center justify-center font-sans p-4';
                popupEl.innerHTML = `
                    <div class="tutor-popup-backdrop absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"></div>
                    <div class="tutor-popup-card bg-slate-900 border border-purple-900/40 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 rounded-3xl w-[440px] h-[550px] relative z-10">
                        <div class="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-purple-900/20 shrink-0">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center">
                                    <i class="fa-solid fa-brain text-xs text-white"></i>
                                </div>
                                <div>
                                    <span class="text-sm font-extrabold text-slate-200 block">PsychTutor AI</span>
                                    <span class="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Online</span>
                                </div>
                            </div>
                            <button class="tutor-popup-close w-8 h-8 rounded-full flex items-center justify-center text-slate-455 hover:text-slate-200 transition-colors">
                                <i class="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>
                        <div class="tutor-popup-messages flex-grow overflow-y-auto p-4 space-y-4 bg-slate-950/40"></div>
                        <div class="border-t border-purple-900/20 p-3 bg-slate-950 flex gap-2 shrink-0">
                            <input type="text" placeholder="Ask PsychTutor..." class="tutor-popup-input flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-250 focus:outline-none focus:border-purple-600" />
                            <button class="tutor-popup-send px-4 bg-purple-600 hover:bg-purple-500 text-white rounded transition"><i class="fa-solid fa-paper-plane text-xs"></i></button>
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

        // Generates the lecture content (Stage 1)
        getLecture: async (lessonId, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return "Error: Lesson not found.";

            const model = getPsychModel();
            const systemPrompt = "You are an expert introductory psychology college professor. Generate a comprehensive college-level lecture of 600-800 words based on the provided concept and hook. Structure the lecture strictly into four sections: (1) Real-World Case Study, (2) Core Psychological Principles, (3) Empirical & Methodological Frameworks, and (4) Cross-Cultural & Practical Application. Use markdown formatting and comparison tables to organize key differences where appropriate.";
            
            const prompt = `Generate a lecture for Lesson ${lesson.numStr}: ${lesson.title}.\nConcept: ${lesson.concept}\nReal-World Hook: ${lesson.clinical_tie_in}`;

            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                
                let result = '';
                await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'psych_llm',
                    model: model,
                    stream: false
                }).then(resp => {
                    result = resp;
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
            const model = getPsychModel();
            const systemPrompt = "You are an expert introductory psychology college professor. Generate a comprehensive college-level lecture of 600-800 words based on the provided concept and hook. Structure the lecture strictly into four sections: (1) Real-World Case Study, (2) Core Psychological Principles, (3) Empirical & Methodological Frameworks, and (4) Cross-Cultural & Practical Application. Use markdown formatting and comparison tables to organize key differences where appropriate.";
            
            const variationInstruction = variationIndex > 0
                ? `This is Lecture Variation #${variationIndex + 1} for this topic. You MUST create a completely different clinical scenario/context and use different real-world applications/case studies compared to previous variations to ensure variety.`
                : '';
            const prompt = `Write a comprehensive, college-level introductory psychology lecture (approximately 600-800 words).
${variationInstruction}
You MUST use the exact concept and clinical hook details below:
- Concept: ${lesson.concept}
- Real-World Hook: ${lesson.clinical_tie_in}
- Feynman Prompt: ${lesson.feynman_prompt}

Structure the lecture strictly into these four markdown headers (###):
1. ### Real-World Case Study
2. ### Core Psychological Principles
3. ### Empirical & Methodological Frameworks
4. ### Cross-Cultural & Practical Application

Do NOT use LaTeX math formatting (write math in simple text). Return ONLY markdown content.`;

            // 1. Connection Step
            onProgress('connect', 'running', 'Checking local AI provider...');
            try {
                if (window.GnosysLLM && typeof window.GnosysLLM.init === 'function') {
                    await window.GnosysLLM.init();
                }
                onProgress('connect', 'success', 'Successfully connected to local provider.');
            } catch (err) {
                console.warn('Local provider check failed:', err);
                onProgress('connect', 'warning', `Provider warning: ${err.message}. Proceeding...`);
            }

            // 2. Model Check Step
            onProgress('model', 'running', `Verifying model '${model}' status...`);
            try {
                onProgress('model', 'success', `Model '${model}' is ready.`);
            } catch (err) {
                onProgress('model', 'warning', `Model check warning. Proceeding...`);
            }

            // 3. Generation Step
            onProgress('generate', 'running', `Submitting prompt for '${lesson.title}'...`);
            let responseText = '';
            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                const resp = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'psych_llm',
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

            // 4. Parsing and rendering
            onProgress('render', 'running', 'Parsing content...');
            const cleanedText = cleanMathAndLaTeX(responseText);
            onProgress('render', 'success', 'Done.');
            return cleanedText;
        },

        cleanMathAndLaTeX,
        getMockFallback,

        fetchGeneratedQuestion: async (lesson, mode) => {
            const model = getPsychModel();
            await window.GnosysLLM?.init?.();

            let systemPrompt = `You are an Expert Professor of Introductory Psychology.`;
            let prompt = '';

            if (mode === 'socratic') {
                prompt = [
                    `Generate a single, unique, challenging, scenario-based question to test a student's understanding of the concept: "${lesson.concept}".`,
                    `The context must relate to the real-world/clinical hook: "${lesson.clinical_tie_in}".`,
                    `The question must require the student to explain the psychological principles and make critical clinical or methodological/ethical decisions.`,
                    `CRITICAL FORMATTING INSTRUCTION: Do NOT use LaTeX math formatting (such as $, $$, \\frac, \\text, etc.). Write all mathematical equations, formulas, and units in simple plain text.`,
                    `Return ONLY the question text itself. Do not include any introductory greetings, markdown headers, markdown code blocks, JSON wrapper, or conversational filler.`
                ].join('\n');
            } else if (mode === 'feynman') {
                prompt = [
                    `Generate a challenging prompt to test the student's ability to explain the concept "${lesson.concept}" using the Feynman technique (explaining a complex topic to a non-scientist or 10-year-old child in simple, everyday terms).`,
                    `The prompt should be based on the real-world/clinical hook: "${lesson.clinical_tie_in}".`,
                    `For example: "Explain how [concept] works to a non-scientist or 10-year-old child in simple, everyday terms."`,
                    `CRITICAL FORMATTING INSTRUCTION: Do NOT use LaTeX math formatting (such as $, $$, \\frac, \\text, etc.). Write all mathematical equations, formulas, and units in simple plain text.`,
                    `Return ONLY the prompt text itself. Do not include any introductory greetings, markdown headers, markdown code blocks, JSON wrapper, or conversational filler.`
                ].join('\n');
            } else {
                throw new Error(`Unsupported mode for question generation: ${mode}`);
            }

            try {
                const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'psych_llm',
                    model: model,
                    stream: false,
                });
                const question = typeof result === 'string' ? result : (result && typeof result.text === 'string' ? result.text : '');
                if (!question) {
                    throw new Error('Empty response received from local provider');
                }
                return cleanMathAndLaTeX(question.trim());
            } catch (err) {
                if (window.gnosysActiveModelsCache) {
                    delete window.gnosysActiveModelsCache[model];
                }
                throw err;
            }
        },

        fetchLocalTutor: async (systemPrompt, messageHistory, userInput) => {
            const model = getPsychModel();
            const prompt = buildTutorPrompt(systemPrompt, messageHistory, userInput);

            if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                return { ...TUTOR_OFFLINE_MOCK };
            }

            try {
                const result = await window.GnosysLLM.generateResponse('', prompt, {
                    moduleKey: 'psych_llm',
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
                if (window.gnosysActiveModelsCache) {
                    delete window.gnosysActiveModelsCache[model];
                }
                console.warn('Psychology tutor failed to respond via shared provider.', routerErr);
                return { ...TUTOR_ERROR_RESPONSE };
            }
        },

        // Initiates the Socratic dialog (Stage 2)
        getSocraticWelcome: async (lessonId, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return "Error: Lesson not found.";
            
            const mock = getMockFallback(lessonId, lesson.title, lesson.concept, lesson.clinical_tie_in, lesson.feynman_prompt);
            return mock.socraticInit;
        },

        // Evaluates a Socratic response (Stage 2)
        evaluateSocraticAnswer: async (lessonId, messageHistory, userInput, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return { passed: false, feedback: "Error: Lesson not found." };

            const model = getPsychModel();
            const systemPrompt = `You are a Socratic tutor evaluating a student's response. The topic is "${lesson.title}" and the concept is "${lesson.concept}". Follow a 3-Step Dialectic: (1) Elicit their reasoning, (2) Destabilize misconceptions, and (3) Reconstruct their definition.
If the student demonstrates a correct, accurate understanding of the concepts, you MUST include the keyword "CONGRATULATIONS! You have grasped the concepts and can proceed to Stage 3." in your feedback.
Return a JSON object with this exact schema: {"passed": boolean, "feedback": "string", "nextStage": null}`;

            const historyText = messageHistory.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join('\n');
            const prompt = `HISTORY:\n${historyText}\n\nSTUDENT'S ANSWER: ${userInput}\n\nReturn JSON.`;

            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                
                const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'psych_llm',
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

        // Evaluates a Feynman response (Stage 4)
        evaluateFeynmanExplanation: async (lessonId, explanation, syllabus) => {
            const lesson = Object.values(syllabus.lessonsByModule).flat().find(l => l.id === lessonId);
            if (!lesson) return { passed: false, feedback: "Error: Lesson not found." };

            const model = getPsychModel();
            const systemPrompt = `You are evaluating a student's explanation of a concept using the Feynman Technique. The prompt is: "${lesson.feynman_prompt}".
Assess if they explain it simply (as if to a 10-year-old) and capture the scientific core.
Return a JSON object with this exact schema: {"passed": boolean, "feedback": "string", "nextStage": null}`;

            const prompt = `EXPLANATION: ${explanation}\n\nReturn JSON.`;

            try {
                if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                    throw new Error('GnosysLLM is unavailable');
                }
                
                const result = await window.GnosysLLM.generateResponse(systemPrompt, prompt, {
                    moduleKey: 'psych_llm',
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

        // Main global chatbox initializer
        initMainChat: () => {
            const input = document.getElementById('chat-input');
            const sendBtn = document.getElementById('chat-btn-send');
            const clearBtn = document.getElementById('chat-btn-clear');
            const msgsEl = document.getElementById('chat-messages');
            const emptyState = document.getElementById('chat-empty-state');
            
            if (!input || !sendBtn || !msgsEl) return;
            
            let history = [];
            
            const checkStatus = async () => {
                const statusText = document.getElementById('chat-status-text');
                const statusDot = document.getElementById('chat-status-dot');
                if (!statusText || !statusDot) return;
                try {
                    if (window.GnosysLLM && typeof window.GnosysLLM.init === 'function') {
                        const status = await window.GnosysLLM.init();
                        const display = window.GnosysLLM?.getTutorStatusDisplay?.(status);
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        statusText.textContent = display?.text || (isMobile ? 'Mobile Setup Required' : 'Ollama Offline (Tap to Launch)');
                        statusDot.className = display?.dotClass || 'inline-block w-2 h-2 rounded-full bg-amber-500';
                        return;
                    }
                } catch(e) {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    statusText.textContent = isMobile ? 'Mobile Setup Required' : 'Ollama Offline (Tap to Launch)';
                    statusDot.className = 'inline-block w-2 h-2 rounded-full bg-amber-500';
                }
            };
            checkStatus();

            // Bind click to status elements to try launching Ollama
            const statusText = document.getElementById('chat-status-text');
            const statusDot = document.getElementById('chat-status-dot');
            const handleLaunchClick = () => {
                if (window.GnosysLLM && typeof window.GnosysLLM.tryLaunchOllama === 'function') {
                    window.GnosysLLM.tryLaunchOllama();
                } else if (typeof window.launchOllamaScheme === 'function') {
                    window.launchOllamaScheme();
                }
            };
            if (statusText) statusText.addEventListener('click', handleLaunchClick);
            if (statusDot) statusDot.addEventListener('click', handleLaunchClick);
            
            const handleSend = async () => {
                const text = input.value.trim();
                if (!text) return;
                
                if (emptyState) emptyState.style.display = 'none';
                
                if (window.PsychGamification) {
                    window.PsychGamification.incrementStat('companionChats');
                }

                appendBubble(msgsEl, "user", text);
                history.push({ role: "user", content: text });
                input.value = "";
                
                const typingWrap = document.createElement("div");
                typingWrap.className = "flex justify-start inline-typing mt-2";
                typingWrap.innerHTML = `<div class="bg-slate-900 px-3 py-2 rounded-2xl flex items-center space-x-1 border border-slate-800"><div class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0.15s"></div><div class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></div></div>`;
                msgsEl.appendChild(typingWrap);
                msgsEl.scrollTop = msgsEl.scrollHeight;

                const model = getPsychModel();
                const systemPrompt = "You are an expert psychology study companion. Engage in friendly conversation, answering general psychology questions accurately and concisely.";

                try {
                    const result = await window.GnosysLLM.generateResponse(
                        systemPrompt,
                        text,
                        {
                            moduleKey: 'psych_llm',
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
                    appendBubble(msgsEl, "assistant", "[Offline Mode] I received your question about psychology. Connect Ollama/Gnosys to talk online!");
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
                    if (emptyState) {
                        emptyState.style.display = 'flex';
                        msgsEl.appendChild(emptyState);
                    }
                });
            }
        }
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    if (window.PsychTutor && window.PsychTutor.initMainChat) {
        window.PsychTutor.initMainChat();
    }
});
