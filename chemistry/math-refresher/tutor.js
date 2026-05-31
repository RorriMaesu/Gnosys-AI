window.ChemTutor = (() => {
    let popupHistory = [];
    let currentPopupSystemContext = "";
    let pendingInitialPrompt = "";
    let popupMode = 'chat';
    let popupCalculatorSession = null;
    let popupCalculatorHandlers = null;
    let popupCalculatorLastState = null;
    let popupTutorQuestionContext = null;

    function getChemistryModel() {
        if (typeof window.getActiveModel === 'function') {
            return window.getActiveModel('chemistry_llm');
        }
        return localStorage.getItem('gnosys_active_llm') || localStorage.getItem('chemistry_llm') || 'gemma4:e4b';
    }

    const parseMD = (text) => {
        if (typeof text !== 'string') return '';

        // Escape HTML tags to prevent XSS
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Extract code blocks and inline code to protect them
        const codeBlocks = [];
        
        // Match code blocks: ``` ... ```
        html = html.replace(/```(?:javascript|js|chemistry|html|css)?\n([\s\S]*?)\n```/g, (match, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<pre class="bg-gray-800 text-gray-100 p-3 rounded-lg my-2 overflow-x-auto font-mono text-xs">${code}</pre>`);
            return id;
        });

        // Match inline backticks: `...`
        html = html.replace(/`([^`\n]+?)`/g, (match, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<code class="bg-gray-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded font-mono text-xs">${code}</code>`);
            return id;
        });

        // Use KaTeX if available
        if (window.katex && typeof window.katex.renderToString === 'function') {
            // First match display equations: $$ ... $$
            html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, expr) => {
                try {
                    return `<div class="my-2 overflow-x-auto flex justify-center">${window.katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</div>`;
                } catch {
                    return match;
                }
            });
            // Match inline equations: $ ... $
            html = html.replace(/\$([^$\n]+?)\$/g, (match, expr) => {
                try {
                    return window.katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
                } catch {
                    return match;
                }
            });
        } else {
            // Fallback simple math rendering
            html = html.replace(/\\mathrm\{([^{}]+)\}/g, '$1')
                       .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
                       .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
                       .replace(/([A-Za-z0-9)])_([0-9]+)/g, '$1<sub>$2</sub>')
                       .replace(/([A-Za-z0-9)])\^([0-9+\-]+)/g, '$1<sup>$2</sup>')
                       .replace(/\$\$/g, '')
                       .replace(/\$/g, '');
        }

        // Headers
        html = html.replace(/^####\s+(.*)$/gm, '<h4 class="font-bold text-gray-200 mt-2 mb-1">$1</h4>');
        html = html.replace(/^###\s+(.*)$/gm, '<h3 class="font-bold text-white mt-3 mb-2">$1</h3>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italics
        html = html.replace(/(?<!\*)\*([^\*\n]+?)\*(?!\*)/g, '<em>$1</em>');
        
        // Lists
        html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li class="ml-5 list-disc text-amber-500"><span style="color:#cbd5e1;">$1</span></li>');
        
        // Newlines
        html = html.replace(/\n/g, '<br>');
        
        // Cleanup excessive breaks around block elements
        html = html.replace(/<\/(h3|h4|div|li)><br>/g, '</$1>');
        html = html.replace(/<br><li/g, '<li');
        html = html.replace(/(<br>\s*){2,}/g, '<br><br>');

        // Restore protected code blocks
        codeBlocks.forEach((codeHtml, index) => {
            html = html.replace(`__CODE_BLOCK_${index}__`, codeHtml);
        });

        return html;
    };

    function appendInlineBubble(msgsEl, role, text) {
        const wrap = document.createElement("div");
        wrap.className = "tutor-bubble-wrap";
        
        const bubble = document.createElement("div");
        if (role === "user") {
            bubble.className = "tutor-bubble user";
            bubble.innerHTML = parseMD(text);
        } else {
            bubble.className = "tutor-bubble assistant";
            if (text) bubble.innerHTML = parseMD(text);
        }
        wrap.appendChild(bubble);
        msgsEl.appendChild(wrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return bubble;
    }

    function renderTutorConversation(popupEl, initialPrompt = null) {
        const msgsEl = popupEl.querySelector('.tutor-popup-messages');
        if (!msgsEl) return;

        msgsEl.innerHTML = "";
        if (popupHistory.length === 0) {
            if (initialPrompt) {
                appendInlineBubble(msgsEl, "user", initialPrompt);
                popupHistory.push({ role: "user", content: initialPrompt });
                streamOllama(msgsEl, popupHistory, currentPopupSystemContext);
            } else {
                appendInlineBubble(msgsEl, "assistant", "Hello! I am Al-Gebra, your Math Tutor. How can I help you with your math workspace today?");
            }
            return;
        }

        popupHistory.forEach((msg) => {
            appendInlineBubble(msgsEl, msg.role, msg.content);
        });

        if (initialPrompt) {
            appendInlineBubble(msgsEl, "user", initialPrompt);
            popupHistory.push({ role: "user", content: initialPrompt });
            streamOllama(msgsEl, popupHistory, currentPopupSystemContext);
        }
    }

    async function streamOllama(msgsEl, chatHistory, systemContext = "") {
        // Typing indicator
        const typingWrap = document.createElement("div");
        typingWrap.className = "tutor-bubble-wrap inline-typing";
        const bubble = document.createElement("div");
        bubble.className = "tutor-bubble assistant";
        bubble.style.display = "flex";
        bubble.style.alignItems = "center";
        bubble.style.gap = "4px";
        bubble.innerHTML = `<span class="tutor-typing-dot"></span><span class="tutor-typing-dot" style="animation-delay:0.2s"></span><span class="tutor-typing-dot" style="animation-delay:0.4s"></span>`;
        typingWrap.appendChild(bubble);
        msgsEl.appendChild(typingWrap);
        msgsEl.scrollTop = msgsEl.scrollHeight;

        const tutorPrompt = `You are Al-Gebra, a professional math tutor. Your goal is to guide students to mathematical mastery using Socratic questioning, scaffolded feedback, and encouraging prompts.
Guidelines:
- Explain mathematical concepts step-by-step using clear, conversational language.
- Do not immediately give the final answer. Instead, guide the student with clarifying questions and hints so they can find it themselves.
- Acknowledge their current workspace state and focus on the specific problem they are stuck on.
- Use plain text mathematical notation (e.g. × for multiplication, ÷ for division, / for fractions) and avoid raw LaTeX backslashes.`;

        let payload = [
            { role: "system", content: tutorPrompt + (systemContext ? "\n\n[Student's current workspace state:\n" + systemContext + "]" : "") }, 
            ...chatHistory
        ];
        
        const currentModel = getChemistryModel();
        try {
            if (!window.GnosysLLM || typeof window.GnosysLLM.generateResponse !== 'function') {
                throw new Error('Shared LLM router is unavailable.');
            }

            const systemMessage = payload.find((msg) => msg.role === 'system');
            const nonSystem = payload.filter((msg) => msg.role !== 'system');
            const userEntry = nonSystem[nonSystem.length - 1] || { role: 'user', content: '' };
            const priorHistory = nonSystem.slice(0, -1);

            let assistantText = "";
            let firstToken = true;
            let bubbleEl = null;

            await window.GnosysLLM.generateResponse(systemMessage?.content || '', userEntry.content || '', {
                moduleKey: 'chemistry_llm',
                model: currentModel,
                stream: true,
                history: priorHistory,
                onToken: (token) => {
                    if (firstToken) {
                        if (typingWrap.parentNode) {
                            typingWrap.remove();
                        }
                        bubbleEl = appendInlineBubble(msgsEl, "assistant", "");
                        firstToken = false;
                    }
                    assistantText += token;
                    bubbleEl.innerHTML = parseMD(assistantText);
                    msgsEl.scrollTop = msgsEl.scrollHeight;
                }
            });

            if (typingWrap.parentNode) {
                typingWrap.remove();
            }
            chatHistory.push({ role: "assistant", content: assistantText });
        } catch (e) {
            if (window.gnosysActiveModelsCache) {
                delete window.gnosysActiveModelsCache[currentModel];
            }
            if (typingWrap.parentNode) {
                typingWrap.remove();
            }
            appendInlineBubble(msgsEl, "assistant", `Could not connect to the local AI provider: ${e && e.message ? e.message : e}`);
        }
    }

    function positionPopupCard(popupEl) {
        const card = popupEl.querySelector('.tutor-popup-card');
        const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
        const width = window.innerWidth;

        card.style.width = "";
        card.style.maxWidth = "";
        card.style.height = "";
        card.style.maxHeight = "";
        card.style.left = "";
        card.style.top = "";
        card.style.transform = "";
        card.style.opacity = "";
        popupEl.style.bottom = "";

        popupEl.style.position = "fixed";
        popupEl.style.inset = "0";
        popupEl.style.zIndex = "200";
        popupEl.style.display = "flex";
        popupEl.style.alignItems = "center";
        popupEl.style.justifyContent = "center";
        popupEl.style.padding = "1rem";
        backdrop.style.opacity = "0";

        if (width < 640) {
            card.style.width = "92%";
            card.style.height = "75vh";
            card.style.maxHeight = "540px";
            card.style.maxWidth = "400px";
        } else {
            card.style.width = "440px";
            card.style.height = "600px";
        }

        card.style.transform = "translate(-50%, -50%) scale(0.95)";
        card.style.opacity = "0";
        card.style.left = "50%";
        card.style.top = "50%";
        card.style.position = "fixed";
        
        adjustVisualViewport(popupEl);
    }

    function adjustVisualViewport(popupEl) {
        if (!popupEl || popupEl.classList.contains('hidden')) return;
        const card = popupEl.querySelector('.tutor-popup-card');
        if (!card) return;

        if (window.innerWidth < 640 && window.visualViewport) {
            const vv = window.visualViewport;
            card.style.left = `${vv.offsetLeft + vv.width / 2}px`;
            card.style.top = `${vv.offsetTop + vv.height / 2}px`;
            card.style.width = "92%";
            card.style.maxWidth = "400px";
            
            if (vv.height < window.innerHeight) {
                card.style.height = `${vv.height * 0.85}px`;
                card.style.maxHeight = `${vv.height * 0.85}px`;
            } else {
                card.style.height = "75vh";
                card.style.maxHeight = "540px";
            }
        } else {
            card.style.left = "50%";
            card.style.top = "50%";
            card.style.width = "440px";
            card.style.height = "600px";
            card.style.maxHeight = "min(90vh, 660px)";
        }
    }

    function clearCalculatorModeBindings() {
        if (!popupCalculatorHandlers) return;
        const { keypadEl, cardEl, onKeypadClick, onCardKeydown } = popupCalculatorHandlers;
        if (keypadEl && onKeypadClick) keypadEl.removeEventListener('click', onKeypadClick);
        if (cardEl && onCardKeydown) cardEl.removeEventListener('keydown', onCardKeydown);
        popupCalculatorHandlers = null;
    }

    function buildCalculatorSessionFromQuestionContext() {
        const context = popupTutorQuestionContext?.questionContext || popupTutorQuestionContext;
        if (!context?.phaseId || !context?.questionId) return null;

        const refresher = window.ChemMathRefresher;
        if (!refresher?.getQuestionCalculatorSnapshot || !refresher?.setQuestionCalculatorSnapshot || !refresher?.mapCalculatorKeyboard || !refresher?.reduceCalculatorState) {
            return null;
        }

        return {
            label: popupTutorQuestionContext?.label || `${context.phaseTitle || context.phaseId} • ${context.questionId} Calculator`,
            phaseId: context.phaseId,
            questionId: context.questionId,
            getState: () => refresher.getQuestionCalculatorSnapshot(context.phaseId, context.questionId),
            onKey: (key) => {
                const current = refresher.getQuestionCalculatorSnapshot(context.phaseId, context.questionId);
                const next = refresher.reduceCalculatorState(current, key);
                refresher.setQuestionCalculatorSnapshot(context.phaseId, context.questionId, next);
                return next;
            },
            mapKeyboard: (event) => refresher.mapCalculatorKeyboard(event)
        };
    }

    function getOrCreateTutorPopup() {
        let popupEl = document.getElementById('tutor-popup-modal');
        if (!popupEl) {
            popupEl = document.createElement('div');
            popupEl.id = 'tutor-popup-modal';
            popupEl.className = 'hidden';
            popupEl.innerHTML = `
                <div class="tutor-popup-backdrop"></div>
                <div class="tutor-popup-card">
                    <div class="tutor-popup-drag-bar"></div>
                    <div class="tutor-popup-header">
                        <div class="tutor-popup-header-info">
                            <div class="tutor-popup-avatar">
                                <i class="fa-solid fa-graduation-cap"></i>
                            </div>
                            <div style="display: flex; flex-direction: column; min-width: 0;">
                                <span class="tutor-popup-title">Al-Gebra</span>
                                <div class="tutor-popup-header-meta">
                                    <span class="tutor-popup-subtitle">Math Refresher</span>
                                    <span style="color: rgba(255,255,255,0.15); font-size: 0.6rem;">|</span>
                                    <span class="tutor-popup-status">
                                        <span class="tutor-popup-status-dot"></span>
                                        Online
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="tutor-popup-header-actions">
                            <div class="tutor-popup-action-group">
                            <button class="tutor-popup-clear" title="Clear Conversation">
                                <i class="fa-solid fa-trash-can" style="font-size:12px;"></i>
                            </button>
                            <button class="tutor-popup-minimize" title="Minimize">
                                <i class="fa-solid fa-minus" style="font-size:12px;"></i>
                            </button>
                            <button class="tutor-popup-close" title="Close">
                                <i class="fa-solid fa-xmark" style="font-size:14px;"></i>
                            </button>
                            </div>
                        </div>
                    </div>
                    <div class="tutor-popup-tabs-bar">
                        <div class="tutor-popup-mode-toggle" role="tablist" aria-label="Tutor and calculator views">
                            <button type="button" class="tutor-popup-mode-btn is-active" data-popup-mode="chat" role="tab" aria-selected="true">
                                <i class="fa-solid fa-message" aria-hidden="true"></i><span>Tutor</span>
                            </button>
                            <button type="button" class="tutor-popup-mode-btn" data-popup-mode="calculator" role="tab" aria-selected="false">
                                <i class="fa-solid fa-calculator" aria-hidden="true"></i><span>Calculator</span>
                            </button>
                        </div>
                    </div>
                    <div class="tutor-popup-messages"></div>
                    <div class="tutor-popup-input-area">
                        <textarea rows="1" placeholder="Ask Al-Gebra..." class="tutor-popup-input"></textarea>
                        <button class="tutor-popup-send">
                            <i class="fa-solid fa-paper-plane" style="font-size:12px;"></i>
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(popupEl);

            const closeBtn = popupEl.querySelector('.tutor-popup-close');
            const minimizeBtn = popupEl.querySelector('.tutor-popup-minimize');
            const clearBtn = popupEl.querySelector('.tutor-popup-clear');
            const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
            const input = popupEl.querySelector('.tutor-popup-input');
            const sendBtn = popupEl.querySelector('.tutor-popup-send');
            const card = popupEl.querySelector('.tutor-popup-card');
            const modeButtons = popupEl.querySelectorAll('.tutor-popup-mode-btn');
            
            closeBtn.addEventListener('click', closeTutorPopup);
            if (minimizeBtn) minimizeBtn.addEventListener('click', closeTutorPopup);
            backdrop.addEventListener('click', closeTutorPopup);
            card?.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    if (popupMode === 'calculator') {
                        return;
                    }
                    event.preventDefault();
                    closeTutorPopup('escape');
                }
            });

            modeButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    if (button.getAttribute('data-popup-mode') === popupMode) return;
                    if (button.getAttribute('data-popup-mode') === 'calculator') {
                        if (!popupCalculatorSession) {
                            popupCalculatorSession = buildCalculatorSessionFromQuestionContext();
                        }
                        if (popupCalculatorSession) {
                            setTutorMode(popupEl, 'calculator', popupCalculatorSession);
                            popupCalculatorSession.render?.(popupCalculatorLastState || popupCalculatorSession.getState?.());
                            setTimeout(() => {
                                const cardEl = popupEl.querySelector('.tutor-popup-card');
                                if (cardEl) cardEl.focus();
                            }, 50);
                        }
                        return;
                    }
                    setTutorMode(popupEl, 'chat');
                    setTimeout(() => {
                        const inputEl = popupEl.querySelector('.tutor-popup-input');
                        if (inputEl) inputEl.focus();
                    }, 50);
                });
            });
            
            clearBtn.addEventListener('click', () => {
                popupHistory = [];
                renderTutorConversation(popupEl);
            });
            
            const handleSend = () => {
                const text = input.value.trim();
                if (!text) return;
                const msgsEl = popupEl.querySelector('.tutor-popup-messages');
                appendInlineBubble(msgsEl, "user", text);
                popupHistory.push({ role: "user", content: text });
                input.value = "";
                input.style.height = "auto";
                streamOllama(msgsEl, popupHistory, currentPopupSystemContext);
            };
            
            sendBtn.addEventListener('click', handleSend);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            });
            input.addEventListener('input', () => {
                input.style.height = "auto";
                input.style.height = `${input.scrollHeight}px`;
            });
        }

        return popupEl;
    }

    function showTutorPopupShell(popupEl, focusSelector = '.tutor-popup-input') {
        const card = popupEl.querySelector('.tutor-popup-card');
        const backdrop = popupEl.querySelector('.tutor-popup-backdrop');

        positionPopupCard(popupEl);
        popupEl.classList.remove('hidden');

        setTimeout(() => {
            backdrop.style.opacity = '1';
            card.style.transform = 'translate(-50%, -50%) scale(1)';
            card.style.opacity = '1';
        }, 50);

        setTimeout(() => {
            const focusEl = popupEl.querySelector(focusSelector);
            if (focusEl) focusEl.focus();
        }, 350);
    }

    function setTutorMode(popupEl, mode, options = {}) {
        const titleEl = popupEl.querySelector('.tutor-popup-title');
        const subtitleEl = popupEl.querySelector('.tutor-popup-subtitle');
        const statusEl = popupEl.querySelector('.tutor-popup-status');
        const avatarEl = popupEl.querySelector('.tutor-popup-avatar i');
        const clearBtn = popupEl.querySelector('.tutor-popup-clear');
        const messagesEl = popupEl.querySelector('.tutor-popup-messages');
        const inputAreaEl = popupEl.querySelector('.tutor-popup-input-area');
        const cardEl = popupEl.querySelector('.tutor-popup-card');
        const modeButtons = popupEl.querySelectorAll('.tutor-popup-mode-btn');

        clearCalculatorModeBindings();

        if (mode === 'calculator') {
            popupMode = 'calculator';
            popupCalculatorSession = options;
            popupCalculatorLastState = options.getState?.() || popupCalculatorLastState || { display: '0', error: '' };

            if (titleEl) titleEl.textContent = 'Al-Gebra';
            if (subtitleEl) {
                const phaseId = popupTutorQuestionContext?.questionContext?.phaseId || popupTutorQuestionContext?.phaseId;
                if (phaseId) {
                    const stageNum = phaseId.replace(/stage(\d+)/i, 'Stage $1');
                    subtitleEl.textContent = `${stageNum} • Calculator`;
                } else {
                    subtitleEl.textContent = 'Calculator';
                }
            }
            if (statusEl) {
                statusEl.innerHTML = '<span class="tutor-popup-status-dot"></span>Utility Mode';
                statusEl.style.color = '#7dd3fc';
            }
            if (avatarEl) {
                avatarEl.className = 'fa-solid fa-calculator';
            }
            if (clearBtn) clearBtn.style.display = 'none';
            if (inputAreaEl) inputAreaEl.style.display = 'none';
            modeButtons.forEach((button) => {
                const isCalculator = button.getAttribute('data-popup-mode') === 'calculator';
                const active = isCalculator;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-selected', active ? 'true' : 'false');
                button.disabled = isCalculator && !(popupCalculatorSession || popupTutorQuestionContext);
            });

            if (messagesEl) {
                messagesEl.innerHTML = `
                <div class="tutor-calc-view" style="display:grid; gap:0.55rem;">
                    <div class="s6-calc-screen" id="tutor-calc-screen" aria-live="polite" role="status">0</div>
                    <div class="s6-keypad" id="tutor-calc-keypad">
                        <button type="button" class="s6-key" data-calc-key="7">7</button>
                        <button type="button" class="s6-key" data-calc-key="8">8</button>
                        <button type="button" class="s6-key" data-calc-key="9">9</button>
                        <button type="button" class="s6-key utility" data-calc-key="DEL">DEL</button>
                        <button type="button" class="s6-key utility" data-calc-key="C">C</button>
                        <button type="button" class="s6-key" data-calc-key="4">4</button>
                        <button type="button" class="s6-key" data-calc-key="5">5</button>
                        <button type="button" class="s6-key" data-calc-key="6">6</button>
                        <button type="button" class="s6-key operator" data-calc-key="*">x</button>
                        <button type="button" class="s6-key operator" data-calc-key="/">/</button>
                        <button type="button" class="s6-key" data-calc-key="1">1</button>
                        <button type="button" class="s6-key" data-calc-key="2">2</button>
                        <button type="button" class="s6-key" data-calc-key="3">3</button>
                        <button type="button" class="s6-key operator" data-calc-key="+">+</button>
                        <button type="button" class="s6-key operator" data-calc-key="-">-</button>
                        <button type="button" class="s6-key utility" data-calc-key="+/-">+/-</button>
                        <button type="button" class="s6-key" data-calc-key="0">0</button>
                        <button type="button" class="s6-key" data-calc-key=".">.</button>
                        <button type="button" class="s6-key ee" data-calc-key="EE">EE/EXP</button>
                        <button type="button" class="s6-key operator" data-calc-key="=">=</button>
                        <button type="button" class="s6-key utility" data-calc-key="ENTER" style="grid-column: span 5;">ENTER</button>
                    </div>
                    <div class="s6-calc-status" id="tutor-calc-status">Utility calculator ready.</div>
                    <div class="s6-calc-step" id="tutor-calc-step">State is saved per question.</div>
                </div>
            `;
            }

            const screenEl = popupEl.querySelector('#tutor-calc-screen');
            const statusCalcEl = popupEl.querySelector('#tutor-calc-status');
            const keypadEl = popupEl.querySelector('#tutor-calc-keypad');

            const renderCalc = (nextState) => {
                const resolved = nextState || options.getState?.() || { display: '0', error: '' };
                popupCalculatorLastState = resolved;
                if (screenEl) screenEl.textContent = resolved.display || '0';
                if (statusCalcEl) {
                    statusCalcEl.textContent = resolved.error || 'Utility calculator ready.';
                    statusCalcEl.classList.toggle('error', Boolean(resolved.error));
                }
            };

            const onKeypadClick = (event) => {
                const btn = event.target.closest('[data-calc-key]');
                if (!btn) return;
                const key = btn.getAttribute('data-calc-key');
                const next = options.onKey?.(key);
                btn.classList.remove('active', 'error');
                btn.classList.add(next?.error ? 'error' : 'active');
                setTimeout(() => btn.classList.remove('active', 'error'), 160);
                renderCalc(next);
            };

            const onCardKeydown = (event) => {
                const mapped = options.mapKeyboard?.(event);
                if (!mapped) return;
                event.preventDefault();
                const next = options.onKey?.(mapped);
                renderCalc(next);
            };

            keypadEl?.addEventListener('click', onKeypadClick);
            cardEl?.addEventListener('keydown', onCardKeydown);
            popupCalculatorHandlers = {
                keypadEl,
                cardEl,
                onKeypadClick,
                onCardKeydown
            };

            renderCalc(options.getState?.());
            return;
        }

        popupMode = 'chat';
        popupCalculatorLastState = null;

        if (titleEl) titleEl.textContent = 'Al-Gebra';
        if (subtitleEl) {
            const phaseId = popupTutorQuestionContext?.questionContext?.phaseId || popupTutorQuestionContext?.phaseId;
            if (phaseId) {
                const stageNum = phaseId.replace(/stage(\d+)/i, 'Stage $1');
                subtitleEl.textContent = `${stageNum} • Tutor`;
            } else {
                subtitleEl.textContent = 'Math Refresher';
            }
        }
        if (statusEl) {
            statusEl.innerHTML = '<span class="tutor-popup-status-dot"></span>Online';
            statusEl.style.color = '';
        }
        if (avatarEl) {
            avatarEl.className = 'fa-solid fa-graduation-cap';
        }
        if (clearBtn) clearBtn.style.display = '';
        if (inputAreaEl) inputAreaEl.style.display = '';
        if (messagesEl) {
            renderTutorConversation(popupEl, pendingInitialPrompt);
            pendingInitialPrompt = "";
        }
        modeButtons.forEach((button) => {
            const isCalculator = button.getAttribute('data-popup-mode') === 'calculator';
            const active = !isCalculator;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.disabled = isCalculator && !(popupCalculatorSession || popupTutorQuestionContext);
        });
    }

    function openTutorPopup({ initialPrompt = "", systemContext = "", defaultMode = 'chat' } = {}) {
        const popupEl = getOrCreateTutorPopup();
        currentPopupSystemContext = systemContext;
        pendingInitialPrompt = initialPrompt;

        if (defaultMode === 'calculator') {
            const calculatorSession = buildCalculatorSessionFromQuestionContext();
            if (calculatorSession) {
                setTutorMode(popupEl, 'calculator', calculatorSession);
                showTutorPopupShell(popupEl, '.tutor-popup-card');
                return;
            }
        }

        setTutorMode(popupEl, 'chat');
        showTutorPopupShell(popupEl, '.tutor-popup-input');
    }

    function openCalculatorPopup(options = {}) {
        const popupEl = getOrCreateTutorPopup();
        setTutorMode(popupEl, 'calculator', options);
        showTutorPopupShell(popupEl, '.tutor-popup-card');
    }

    function closeTutorPopup(reason = 'programmatic') {
        const popupEl = document.getElementById('tutor-popup-modal');
        if (!popupEl || popupEl.classList.contains('hidden')) return;
        
        const card = popupEl.querySelector('.tutor-popup-card');
        const backdrop = popupEl.querySelector('.tutor-popup-backdrop');
        
        backdrop.style.opacity = "0";
        card.style.transform = "translate(-50%, -50%) scale(0.95)";
        card.style.opacity = "0";
        
        setTimeout(() => {
            popupEl.classList.add('hidden');
            clearCalculatorModeBindings();
            if (popupMode === 'calculator' && popupCalculatorSession?.onClose) {
                popupCalculatorSession.onClose(reason);
            }
            popupMode = 'chat';
            popupCalculatorSession = null;
        }, 300);
    }

    window.addEventListener('resize', () => {
        const popupEl = document.getElementById('tutor-popup-modal');
        if (popupEl && !popupEl.classList.contains('hidden')) {
            positionPopupCard(popupEl);
            const card = popupEl.querySelector('.tutor-popup-card');
            card.style.transform = "translate(-50%, -50%) scale(1)";
            card.style.opacity = "1";
        }
    });

    if (window.visualViewport) {
        const handleVisualViewportChange = () => {
            const popupEl = document.getElementById('tutor-popup-modal');
            if (popupEl && !popupEl.classList.contains('hidden')) {
                adjustVisualViewport(popupEl);
                const card = popupEl.querySelector('.tutor-popup-card');
                card.style.transform = "translate(-50%, -50%) scale(1)";
                card.style.opacity = "1";
                
                const input = popupEl.querySelector('.tutor-popup-input');
                if (input === document.activeElement) {
                    setTimeout(() => {
                        input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                }
            }
        };
        window.visualViewport.addEventListener('resize', handleVisualViewportChange);
        window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }

    return {
        invoke: (initialPrompt, containerEl, contextData = null) => {
            popupTutorQuestionContext = contextData || null;
            let stageContext = '';
            try {
                const rawState = localStorage.getItem('adaptive_math_refresher_engine_v3');
                if (rawState) {
                    const parsed = JSON.parse(rawState);
                    const activeId = parsed.activePhase;
                    const stageTitles = {
                        stage1: "Stage 1: Sub-Base Arithmetic & Single-Digit Fluency",
                        stage2: "Stage 2: Multi-Digit Subtraction & Multiplicative Thinking",
                        stage3: "Stage 3: Division Technicalities, Integers & Number Properties",
                        stage4: "Stage 4: Fractions, Ratios & Proportional Reasoning",
                        stage5: "Stage 5: Decimals, Percentages & Precision Mechanics",
                        stage6: "Stage 6: Scientific Math & Dimensional Analysis",
                        stage7: "Stage 7: Algebraic Foundations & Linear Equations",
                        stage8: "Stage 8: Graphing, Slopes & Inequalities",
                        stage9: "Stage 9: Systems, Basic Geometry & Quadratics",
                        stage10: "Stage 10: Advanced Functions, Logarithms & Wave Geometry",
                        stage11: "Stage 11: Data Linearization & Graphical Analysis",
                        stage12: "Stage 12: Equilibrium Algebra, Power Ratios & Approximations"
                    };
                    if (activeId && parsed.phases?.[activeId]) {
                        const title = stageTitles[activeId] || activeId;
                        stageContext = `Active Stage: ${title}. State variables: ${JSON.stringify(parsed.phases[activeId])}.`;
                    }
                }
            } catch (e) {
                console.error("Failed to read stage state for tutor context", e);
            }

            let extraContext = '';
            if (typeof contextData === 'string' && contextData.trim()) {
                extraContext = contextData.trim();
            } else if (contextData && typeof contextData === 'object') {
                try {
                    if (contextData.questionContext) {
                        extraContext = `Question Context: ${JSON.stringify(contextData.questionContext)}`;
                    } else {
                        extraContext = `Additional Context: ${JSON.stringify(contextData)}`;
                    }
                } catch (_err) {
                    extraContext = '';
                }
            }

            const mergedContext = [stageContext, extraContext].filter(Boolean).join(' ');

            openTutorPopup({
                initialPrompt,
                systemContext: mergedContext,
                defaultMode: contextData?.defaultMode || 'chat'
            });
        },
        invokeCalculator: (options = {}) => {
            openCalculatorPopup(options);
        },
        getCalculatorPopupState: () => popupCalculatorLastState,
        getCalculatorMode: () => popupMode
    };
})();
