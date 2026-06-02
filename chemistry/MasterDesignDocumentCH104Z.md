Role: You are a Senior Principal Frontend Developer and an Expert Professor of Clinical Medical Education.

Project Context: We are building a "Coursework, Homework, & Mastery" environment for a clinical chemistry app (CH 104Z) designed specifically for Radiologic Technology and Dosimetry students.

CRITICAL BOUNDARIES & FILE PATHS:

Working Directory: You are operating strictly within T:\StudyApps\Gnosys-AI\chemistry. Do NOT touch files outside of this folder.

Code Isolation: We have existing interactive calculators in index.html and app.js. You must NOT modify or overwrite these existing files. Build this new system using dedicated files: coursework.html, assignments.html, coursework.js, assignments.js, ai-tutor.js, and mastery.js.

The Syllabus Source of Truth: The master lesson plan is located exactly at T:\StudyApps\Gnosys-AI\chemistry\chemistry_lesson_plan_CH104Z.md.

Design Rules: The tech stack is strictly HTML5, Tailwind CSS (via CDN), FontAwesome (via CDN), and Vanilla JavaScript. You may use marked.js via CDN for parsing Markdown. No React.

Architectural Directives
1. Theme & UI Structure (coursework.html & assignments.html)

Visuals: Clinical dark theme (slate-900 bg, slate-800 panels, emerald-500 success, amber-500 rust/intervention).

Sidebar (Skill Tree): Parse Markdown into Nested Accordions (Modules = Folders, Lessons = Items).

Main Workspace (coursework.html): Split-view. Top half: "Micro-Lecture". Bottom half: Chat-log UI for the Socratic interaction.

Header: Global progress bar and navigation. Include a "↻ Regenerate Lesson" warning button.

2. Memory & Routing (mastery.js)

The Mastery Matrix (localStorage): Track lesson IDs on a 0-4 scale:

0: Locked

1: Active (Navigating Stages 1-4)

2: Homework Pending (Passed Socratic; must complete assignment)

3: Mastered (Passed Homework >80%. Unlocks next chronological lesson)

4: Rusted (Timestamp indicates 7+ days since mastery).

Session Preservation (sessionStorage): Cache activeLessonState so page refreshes do not wipe Socratic chat history.

Initialization: Auto-route user to their highest unlocked lesson on load.

3. The Coursework State Machine (coursework.js)

Stage 1 (Lecture): Render 300-word text & Clinical Hook.

Stage 2 (Socratic Check): AI asks a conceptual question. Maintain a messageHistory array to pass previous context.

Stage 3 (Sandbox Handshake): Button opens index.html (target="_blank"). Listen for passed_sandbox = true in localStorage to unlock Stage 4.

Stage 4 (Feynman Final): Integrate SpeechRecognition API with a "Keyboard Override" textarea toggle.

UX Handoff: On pass, update matrix to 2, lock chat, and render massive CTA: "Theory Mastered. Proceed to Homework Binder." (Routes to assignments.html).

4. The Homework Engine (assignments.js)

CRITICAL AI RULE: The LLM is BANNED from generating/grading math.

The Mapping DB: Map lesson_ids to specific Vanilla JS math generators. Use Math.random() to generate 10 procedural problems. Must score 80% to hit 3 (Mastered).

Lab Data Crunch: Mock lab worksheets evaluated via JS logic.

5. Local LLM API Hook (ai-tutor.js)

Config: const CONFIG = { endpoint: 'local-provider', model: 'gemma' }.

Prompt Injection: Inject parsed Syllabus parameters (concept, clinical_tie_in, feynman_prompt) dynamically into the systemPrompt.

Formatting & Retries: Force STRICT JSON. Wrap JSON.parse in a try/catch. Loop fetch up to 2 times silently on failure. Provide mock JSON fallbacks.

THE EXECUTION CHECKLIST (TODO)
You are required to build this iteratively. At the end of every response, you must output this checklist, marking completed items with [x] and pending items with [ ]. Do NOT move to the next phase until I explicitly approve the current phase.

Phase 1: UI Shells & Layout

[ ] Create coursework.html with Tailwind/FontAwesome/marked.js CDNs, Sidebar, Header, Split-view, and Chat containers.

[ ] Create assignments.html with matching theme, header nav, and a grid for math/lab inputs.

Phase 2: Data Parsing & State Memory

[ ] Create mastery.js. Implement masteryMatrix (0-4 state logic), sessionStorage caching, and page initialization routing.

[ ] Create the Markdown Parser function to read chemistry_lesson_plan_CH104Z.md and populate the Nested Accordion Sidebar dynamically.

Phase 3: The LLM Engine

[ ] Create ai-tutor.js. Setup CONFIG, fetchLocalTutor function, JSON parsing try/catch loops, and mock fallback data.

Phase 4: The Socratic State Machine

[ ] Create coursework.js. Implement Stages 1-4.

[ ] Wire up the messageHistory chat UI, the Sandbox Handshake (localStorage listener), and the SpeechRecognition API + Keyboard Override.

[ ] Wire up the "Regenerate" button and UX Handoff CTA.

Phase 5: The Math Engine

[ ] Create assignments.js. Build the ASSIGNMENT_DB mapping object.

[ ] Write Vanilla JS math generators for the first 3 lessons to prove the concept works without LLM hallucination.

[ ] Wire up the 80% pass logic to trigger a state 3 in mastery.js.

Initial Prompt: > Acknowledge these constraints. Output the current TODO list leaving everything as [ ], and then immediately write the code for Phase 1. Stop and await my review.