<!-- converted from Year 6 Lesson Plan.docx -->

Build Tetris with A.I.
30 Minutes  |  Year 6  |  Hook Lesson
WALT
- We are learning to apply prompt engineering principles in Google A.I. Studio to create a functional game, analyse the relationship between input (prompt) and output (generated code), and evaluate the A.I. output against the design criteria specified in the prompt. (QCAA cognitive verbs: apply, create, analyse, evaluate)
Success Criteria
- ★ I can log into Google A.I. Studio, navigate the interface, and understand its purpose.
- ★★ I can paste the one-shot prompt, run it, and generate a working Tetris game.
- ★★★ I can analyse the prompt structure, explain why specific input produces quality output, and write an if/then feature statement for the follow-up lesson.
Key Vocabulary
- Google A.I. Studio
- Generative A.I.
- Prompt Engineering
- One-Shot Prompt
- Input (data/instructions given to a system)
- Output (the result a system produces)
- Large Language Model (LLM)
- Code Generation
- HTML / JavaScript / React / TypeScript
- Tetris (game mechanics: rows, blocks, rotation, collision, score, levels)
- Design Criteria / Design Brief
- Algorithms
- Variables (score, level, speed)
- Control Structures
- If/Then Statements
- Iterate / Iteration
Resources
- Student devices (Chromebooks or laptops) with internet access, 1:1 preferred
- Projector/display for teacher demonstration
- Google A.I. Studio accounts (students log in via school Google accounts)
- Pre-written one-shot Tetris prompt (prepared by teacher, shared via Google Classroom or displayed on screen)
- Google Classroom assignment set up with the prompt and submission link
- Timer (visible on screen)
- Exit Ticket: Google Form or Google Meet Poll
Hook (3 minutes)
- Teacher loads a polished browser-based Tetris game on the projector, plays for 15 seconds, then closes it. Then asks: "How long do you think it took to build that? A week? A month?" (Wait time.) "What if I told you it took less than 30 seconds?"
- Pause for reactions. Then reveal: "Today, you are going to use a tool called Google A.I. Studio to generate an entire Tetris game from a single prompt. But here is the real lesson: the A.I. is only as good as the instructions you give it. Rubbish in, rubbish out. Let me prove it."
- Brief class discussion (30 seconds): "Has anyone used ChatGPT, Gemini, or another A.I. tool before?" (Cold call 2 to 3 students.)
Prompt Engineering: Input, Output, and Design Criteria
In Digital Technologies, we talk about INPUT and OUTPUT as core computing concepts:
- INPUT: The data or instructions we give to a system. Today, our input is a prompt (written instructions for the A.I.).
- OUTPUT: The result the system produces. Today, our output is generated code that creates a playable Tetris game.
- The quality of the output is directly determined by the quality of the input. This is true for ALL computing systems, not just A.I.

Step 1: Analyse the Bad Prompt

- Student Activity: In pairs, list at least 3 things the A.I. would have to GUESS if given only this prompt. (1 minute, then share.)

Step 2: Analyse the Good Prompt (The One-Shot Prompt)
Teacher displays the full prompt on screen:


Student-Led Analysis:
Teacher divides the prompt into sections and asks students to identify what each section controls:

- Role Assignment: "Act as an expert developer." Why does this matter? (It tells the A.I. what level of quality to aim for.)
- Architecture: The prompt specifies the technology stack. This is like telling a builder what materials to use.
- Layout (Design Criteria): Exact descriptions of the 3-column layout, board size (10x20), and what goes where. This is a design specification.
- Styling: Colours, themes, visual effects. Without this, the A.I. guesses.
- Game Mechanics (Algorithms): Movement, rotation, scoring, levels, collision. These are the RULES, the if/then logic: "If a row is full, then clear it. If 10 rows are cleared, then increase the level."

Step 3: Predict and Compare

- Discussion Question: "How is writing a good prompt similar to writing a design brief or user story? What are the similarities?" (Think-pair-share, 1 minute.)
Lesson Sequence (30 minutes total)
- I Do (Teacher model) - 7 minutes
- We Do (Guided practice) - 8 minutes
- You Do (Independent play, evaluation, and reflection) - 9 minutes
- Share and Exit Ticket - 3 minutes
- Input/Output prompt discussion - embedded within I Do and We Do
I Do (7 minutes)
- Teacher demonstrates from projected device:
- Open browser and navigate to aistudio.google.com. Log in using a Google account.
- Explain: "Google A.I. Studio is a platform where we interact with a Large Language Model called Gemini. We provide input in the form of a prompt, and the A.I. generates output. Today, that output will be an entire playable game."
- Show the prompt interface: point out the text input area, the model selector, the Run button, and the output panel.
- Paste the one-shot prompt. Briefly highlight: "Notice we have given it a role, layout instructions, styling details, game rules, and control mappings. Every section serves a purpose."
- Click Run and wait. Narrate: "The A.I. is processing our input and generating HTML, JavaScript, and CSS code. This is the language web browsers understand."
- Copy the generated code, open a new tab, paste it into an HTML previewer (or save as .html and open), and show the working Tetris game.
- Play for a few seconds. Point out features that were specified in the prompt (colours, layout, controls).
We Do (Guided Practice) - 8 minutes
- Students follow along step by step with the teacher guiding from the projector:
- Students open browsers and navigate to aistudio.google.com. Log in using school Google accounts.
- Teacher shares the prompt via Google Classroom. Students paste it into their A.I. Studio window.
- Teacher counts down: "3, 2, 1, Run!"
- While the A.I. generates, teacher asks: "What is the A.I. doing right now? Is it thinking? Is it copying? How does it know how to make Tetris?" (Think-pair-share, then cold call.)
- Once code appears, students copy the output and preview it in a new browser tab.
- Teacher: "Check your game. Does it match what the prompt asked for? Look at the layout, the colours, the controls."
You Do (Independent Play, Evaluation, and Reflection) - 9 minutes
Structure:
- Students play their A.I.-generated Tetris game for 3 to 4 minutes.
- While playing, students evaluate (teacher writes on board):
- "Does the output match the input? Which features from the prompt can I identify in the game?"
- "What is missing or different from what the prompt specified?"
- "What feature would I add? How would I describe it to the A.I.?"
- In the final 5 minutes, students open a Google Doc and write:
- One feature they would add, written as an if/then statement: e.g., "If the player scores 200 points, then the background colour changes and the speed increases by 20%."
- A brief explanation of WHY they chose this feature (connecting to user stories / design criteria).
- Teacher circulates, asking: "How specific does your if/then statement need to be for the A.I. to understand it? What did we learn from the good prompt vs the bad prompt?"
These if/then statements and explanations become the starting point for the follow-up lesson.
Share (1 minute)
- Two to three students share their if/then feature idea with the class.
- Teacher gives feedback tied to success criteria (Level 3) and previews: "Next lesson, you will use these if/then statements as prompts to modify your game. You will add colours, super powers, and new rules."
Exit Ticket (2 minutes)
- Complete the Google Form or Google Meet Poll to record student mastery of the Success Criteria.
- Poll questions:
- "I logged in and ran the prompt successfully." (Yes / No)
- "I generated a working Tetris game." (Yes / No)
- "I can analyse the prompt and explain why specific input produces quality output." (Yes / No)
- "I wrote an if/then feature statement with an explanation." (Yes / No)
Differentiation
Support:
- Pair students who need help with a confident peer for login and prompt execution.
- Provide a printed step-by-step guide for reference.
- Teacher or teaching assistant works with a small group needing scaffolding.
- For the if/then writing task, provide sentence starters: "If the player ___, then the game ___."
Extension:
- Challenge students to read through sections of the generated code and identify where score, colour, or speed might be controlled.
- Ask students to write a second prompt that modifies one specific feature (preview of next lesson).
- Invite students to compare outputs: "Did the A.I. generate identical code for everyone? Why might there be differences?"
- Ask: "What are the ethical considerations of using A.I. to generate code? Who owns the output?"
Teacher Questions and Questioning Moves
- Opening cold call: "What is Artificial Intelligence? Can someone give me an example of A.I. they have used?" (Wait 5 to 7 seconds.)
- During prompt analysis: "Why do you think the prompt starts with 'Act as an expert'? What difference does that make?" (Think-pair-share.)
- During We Do: "What is the A.I. actually doing when we click Run? Is it thinking? Copying? Something else?" (Cold call after wait time.)
- During You Do: "If you wanted the blocks to change colour when you reach level 5, how would you write that as an instruction for the A.I.?" (Circulating.)
High-impact moves:
- Wait time + Cold call at Hook to increase thinking and inclusion.
- Think-pair-share during prompt analysis to deepen understanding.
- Break it down during We Do: ask students to narrate what the A.I. is doing.
Assessment Opportunities
Formative:
- Teacher observation during We Do and You Do: successful login, prompt execution, game generation, and engagement with reflection.
- Exit Ticket responses for self-assessed mastery.
- Written if/then statements collected via Google Doc (evidence of computational thinking).
Summative (follow-up lesson):
- Students modify their Tetris game using additional A.I. prompts, implementing if/then logic and evaluating the results against their design criteria.
Rubric (informal):
- Meets criteria mapped to observed behaviours and Exit Ticket responses at the one-star, two-star, and three-star levels.
ACARA Connections
Source Reference: Australian Curriculum Version 9.0, Digital Technologies, Years 5-6 Achievement Standard.

Achievement Standard:
- By the end of Year 6, students develop and modify digital solutions, and define problems and evaluate solutions using user stories and design criteria. They process data and show how digital systems represent data. Students design algorithms involving complex branching and iteration and implement them as visual programs including variables. They securely access and use multiple digital systems and describe their components and how they interact to process and transmit data. Students select and use appropriate digital tools effectively to plan, create, locate and share content, and to collaborate, applying agreed conventions and behaviours. They identify their digital footprint and recognise its permanence.

Content Descriptions (Years 5-6 Digital Technologies):
- AC9TDI6P02 - Implement visual programs with variables involving control structures and input.
- Connection: Students analyse how the generated code uses variables (score, level, speed) and control structures (if/then logic for row clearing, collision detection). The follow-up lesson has them modify these directly.
- AC9TDI6P01 - Define problems with given or co-developed design criteria and by creating user stories.
- Connection: Students critically analyse the one-shot prompt as a detailed design brief and compare it to a vague prompt, understanding that specificity in problem definition drives solution quality.
- AC9TDI6P05 - Evaluate existing and student solutions against the design criteria and user stories.
- Connection: Students evaluate the A.I. output and write their own if/then feature requests, connecting prompt engineering to design evaluation.
- AC9TDI6K02 - Explain how digital systems represent all data using numbers (binary).
- Connection: Brief connection: the game the A.I. creates is ultimately represented as code (text data) that the browser interprets. Everything is data.

K-12 Roadmap Alignment:
- Grades 5-6: This stage introduces complex programming logic and critical reflection on A.I. bias and the 'digital footprint'. Students design algorithms involving complex branching and iteration, implementing them as visual programs with variables.
Common Misconceptions and Fixes
- Misconception: "The A.I. is thinking and being creative like a human."
- Fix: Explain that the A.I. is a Large Language Model that predicts the most likely next word based on patterns in training data. It does not understand or think; it generates text based on probability.

- Misconception: "The A.I. wrote the code perfectly and it will always work first time."
- Fix: Show that A.I. output can have errors or unexpected behaviour. This is why we evaluate and iterate, which is what we will do in the follow-up lesson.

- Misconception: "I do not need to understand code if A.I. can write it for me."
- Fix: Explain that understanding code helps you give better prompts and fix problems. A.I. is a tool, not a replacement for knowledge.

- Misconception: "Google A.I. Studio is the same as Google Search."
- Fix: Clarify: Google Search finds existing web pages. Google A.I. Studio generates NEW content based on your instructions.

Classroom Routines and Safety
Routines:
- Devices closed/screens down until teacher says "Mission Active."
- Login using school Google accounts only (no personal accounts).
- Students use ONLY the prompt provided by the teacher. No free-form prompting during this lesson.
- Hands up if something unexpected appears on screen.
- Timer visible on the projector for each phase.
Digital Safety (explicit routines):
- Responsible A.I. Use: Only use the prompt provided. Do not type personal information, inappropriate content, or off-topic requests into A.I. Studio.
- Critical Thinking: A.I. can make mistakes. Always check the output. If the game does not work, that is okay.
- Digital Footprint: Remind students that interactions with A.I. tools may be stored. Use school accounts and keep interactions appropriate.
- Speak Up: If you see anything unexpected or inappropriate in the A.I. output, stop and tell the teacher immediately.
| BAD Prompt (Vague Input)
Make me a Tetris game. |
| --- |
| GOOD Prompt (Detailed Input) - The One-Shot Prompt
Role: Act as an expert React, TypeScript, and Tailwind CSS developer. Your task is to build a fully functional, highly polished Tetris game in a single shot.

Architecture & Tech Stack: Use React functional components and hooks (useState, useEffect, useCallback). Use custom hooks to manage game logic (e.g., useBoard, usePlayer, useGameStatus). Use Tailwind CSS for all styling. Do not use external CSS files. Use lucide-react for icons.

Layout Structure (CRITICAL): The app must be centered on the screen with a dark background (bg-zinc-950). The main game container must use a 3-column CSS grid: grid-cols-[300px_auto_300px] with a gap of gap-8.

Center Column (The Board): A 10x20 grid. It must have a strict aspect ratio of 10 / 20. Use a 1px gap between cells to create subtle grid lines.

Left Column (Hold & Instructions): Must take up the full height of the center board (h-full). Top: A "Hold" piece preview box. Bottom: A "How to Play" panel. Use mt-auto on this panel so it is perfectly flush with the bottom of the center game board. It should list keyboard controls: Left/Right/Down/Up arrows for movement/rotation, SPACE for Hard Drop, SHIFT for Hold Piece, and ENTER for Start/Pause.

Right Column (Next, Stats & Buttons): Must take up the full height of the center board (h-full). Top: A "Next" piece preview box. Middle: Three separate display boxes stacked vertically for "Score", "Rows", and "Level". Bottom: A button container using mt-auto so it is perfectly flush with the bottom of the center game board. It contains a "START GAME" button and a "PAUSE/RESUME" button.

Styling & Theme: Colors: Use a modern dark theme. The background is zinc-950. Panels and boxes should use zinc-900/50 or zinc-900/80 with subtle borders (border-zinc-700 or border-zinc-800). Accents: Use Cyan (cyan-500 and cyan-400) for primary highlights.

Piece Previews: The "Hold" and "Next" boxes should NOT be perfectly square. They should tightly wrap the tetromino blocks with padding (py-6 px-4) and a minimum height (min-h-[5rem]).

Glassmorphism: Use backdrop-blur-sm on panels and overlays.

Game Mechanics: Standard Tetris Rules: 7 standard Tetrominoes (I, J, L, O, S, T, Z) with standard colors. Movement: Left, Right, Soft Drop (Down arrow), Rotate (Up arrow). Hard Drop: Pressing SPACE should instantly drop the piece. Hold Mechanism: Pressing SHIFT swaps the current piece with the held piece. Scoring & Leveling: Clearing 1, 2, 3, or 4 lines awards standard Tetris points multiplied by the current level. Every 10 lines cleared increases the Level. Speed: The drop speed should start at 1000ms and decrease as the level increases. Collision Detection: Ensure pieces cannot move through walls, the floor, or other locked pieces. |
| --- |
| Detailed Input (Design Criteria Met)
Every feature is specified
A.I. follows a clear blueprint
Output matches expectations
This is prompt ENGINEERING | Vague Input (No Design Criteria)
A.I. fills in every gap itself
No control over look, feel, or function
Output is unpredictable
This is prompt GUESSING |
| --- | --- |