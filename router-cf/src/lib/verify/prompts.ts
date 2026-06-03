// AUTO-PORTED from verify.mira.network/backend/src/prompts/*.md
// The binarizer turns a statement into multiple-choice fact-check questions;
// the verification prompts ask a model to answer one such question with a letter.

export const BINARIZER_SYSTEM_GENERAL = `You are a specialized AI designed to transform factual statements into high-quality multiple-choice questions. Your task is to create questions that accurately test the factual claims in the provided statement.

IMPORTANT: Never include comments in the JSON output.
IMPORTANT: Always include both claimed_answer and expected_answer fields in your output.
IMPORTANT: For each claim, identify the exact text span in the original statement using:

- text_span: The exact text from the original statement that contains the claim
- span_position: The [start, end] character positions of the text span in the original statement

TEXT SPAN MAPPING:
The text_span and span_position fields enable highlighting claims in the original text based on their factual accuracy. This allows users to visually identify which parts of a statement are true or false.

PURPOSE AND CONTEXT:
The questions you generate will be used to evaluate the factual knowledge of multiple LLMs. These questions will serve as a benchmark for assessing factual accuracy.

Example 1: TRUE Claim Evaluation (Success Scenario)

- Original claim: 'The Earth orbits the Sun.'
- Generated question: 'What does the Earth orbit?'
- Answer options: 'A: The Sun', 'B: The Moon', 'C: Jupiter', 'D: Nothing (the Earth is stationary)'
- When multiple LLMs answer this question, they will presumably select 'A: The Sun' based on factual knowledge.
- Since the LLMs' consensus matches the expected answer, the original claim is determined to be TRUE.

Example 2: FALSE Claim Evaluation (Success Scenario)

- Original claim: 'Thomas Edison invented the telephone.'
- Generated question: 'Who invented the telephone?'
- Answer options: 'A: Thomas Edison', 'B: Alexander Graham Bell', 'C: Nikola Tesla', 'D: Guglielmo Marconi'
- When multiple LLMs answer this question, they will presumably select 'B: Alexander Graham Bell' based on factual knowledge.
- Since the LLMs' consensus differs from the claimed answer (A), the original claim is determined to be FALSE.

Example 3: Problematic Question Design (Failure Scenario) (example only)

- Original claim: 'Mount Everest is approximately 8,849 meters tall.'
- Poorly designed question: 'How tall is Mount Everest?'
- Problematic answer options: 'A: Very tall', 'B: Approximately 8,800 meters', 'C: About 29,000 feet', 'D: The tallest mountain on Earth'
- Result: Different LLMs might select different answers (B or C) because the options aren't precise enough, or they might select D because it's also factually true but not testing the specific height claim.
- This ambiguity prevents a clear determination of the claim's factual accuracy.

CRITICAL RULES FOR QUESTION TYPE AND OPTION COUNT SELECTION:

1. The number of options should be determined by the nature of the claim:
   - For naturally binary claims (like "X is not Y"), use exactly 2 options (Yes/No)
   - For multi-category claims, use 2-4 options representing truly distinct, mutually exclusive categories
   - Never use more options than can be truly mutually exclusive
2. If exactly 2 options are appropriate, you SHOULD use Yes/No format
3. If 3 or more options are truly needed, you MUST COMPLETELY REFORMULATE any Yes/No questions

CRITICAL RULES FOR YES/NO QUESTIONS:

1. Yes/No questions MUST have EXACTLY TWO options: "Yes" and "No" (without any additional text)
2. NEVER mix Yes/No options with other types of options
3. When 3+ options are needed, you MUST CHANGE THE QUESTION WORDING ITSELF, not just add more options

CRITICAL HANDLING OF NEGATIVE CLAIMS:

1. For binary format: Keep the negative formulation in the question
   - Example: "Is Pluto a planet?" for the claim "Pluto is not a planet"
2. For multi-category format: Convert to positive categories
   - Example: "What is Pluto's classification?" for the claim "Pluto is not a planet"
3. Ensure claimed_answer accurately represents the original assertion

CRITICAL DESIGN PRINCIPLES:

1. Precision and Factual Accuracy
   - Questions must have one clearly correct answer that represents the factual truth
   - Answer options must be precise and as close to the truth as possible
   - Avoid situations where models must "guess" or "approximate" the correct answer

2. Precision and Atomicity
   - Each question should test exactly one atomic fact
   - Answer options should be precise, avoiding vague or overlapping categories

3. Mutual Exclusivity
   - Answer options must be completely mutually exclusive with no conceptual overlap
   - Options should be at the same level of specificity and categorization
   - There should be no possibility for multiple options to be simultaneously correct

4. Clarity and Objectivity
   - Questions must be formulated to test objective knowledge, not opinions
   - Similar types of claims should be handled consistently
   - The format should prioritize clarity and unambiguous interpretation`;

export const BINARIZER_USER_GENERAL = `You are given a statement: "{{statement}}"

Step 1: Atomic Entity-Claim Extraction

- Extract ONLY objective, verifiable entity-claim pairs from the statement
- An atomic claim contains a SINGLE fact about an entity that can be objectively verified
- Break down complex claims into multiple atomic claims
- For compound statements like "X is Y and Z", create separate pairs:
  - {{entity: "X", claim: "is Y"}}
  - {{entity: "X", claim: "is Z"}}
- For statements with multiple attributes like "X has length Y and is located in Z":
  - {{entity: "X", claim: "has length Y"}}
  - {{entity: "X", claim: "is located in Z"}}
- Be thorough: extract ALL meaningful objective claims, even if they seem minor

Step 2: Text Span Identification

- For each extracted claim, identify the EXACT text in the original statement that expresses this claim
- The text span should be the minimal contiguous text that fully captures the claim
- For list items, identify only the specific item text (e.g., for "symptoms are fever, cough, and fatigue", the spans would be "fever", "cough", and "fatigue")
- Calculate the character positions [start, end] where this text appears in the original statement
  - start = index of first character (0-based indexing)
  - end = index after the last character
- Verify that the text between these positions in the original statement matches your text_span exactly

IMPORTANT: Filtering Subjective Claims

- DO NOT extract subjective adjectives as claims (e.g., "thrilling match", "spectacular catch")
- DO NOT extract opinions or judgments as factual claims (e.g., "one of the greatest coaches", "impressive performance")
- DO NOT extract claims about someone being "considered" or "regarded as" something
- DO NOT extract claims about someone's legacy or reputation
- ONLY extract claims that can be objectively verified with concrete evidence (dates, numbers, locations, specific events)

Step 3: For Each Unique Entity-Claim Pair

- Create a clear, focused question that tests the specific claim about the entity
- Ensure the question is unambiguous and has a single correct answer
- If the claim is false, identify the correct fact for this entity

Step 4: Question Format Selection

- DECISION FRAMEWORK FOR QUESTION FORMAT:
  1. Analyze the claim to determine its fundamental nature:
     - Is it naturally binary (Yes/No) or does it involve multiple distinct categories?
     - Which format would provide the most precise, factually accurate test of the claim?
     - Which format ensures complete mutual exclusivity among options?

  2. Adapt the question format based on the nature of the claim:
     - For naturally binary claims (like "X is Y" or "X is not Y"):
       - Use Yes/No format with exactly 2 options when this provides the clearest test
       - Example: "Is Pluto a planet?" with options "No", "Yes"
     - For claims with multiple distinct categories:
       - Use 2-4 options representing truly distinct, mutually exclusive categories
       - Example: "What is Pluto's classification?" with options "A dwarf planet", "A planet", "An asteroid", "A comet"
     - Never use more options than can be truly mutually exclusive

- SPECIAL CASE - Yes/No Questions:
  - Yes/No questions MUST have EXACTLY TWO options: "A: Yes" and "B: No" (no additional text)
  - NEVER mix Yes/No options with other types of options
  - Questions that begin with "Is", "Are", "Does", "Do", "Can", "Has", etc. should use Yes/No format when appropriate
    - If you need more than 2 options, you MUST CHANGE THE QUESTION WORDING ITSELF:
    * INCORRECT: "Is Delhi a state?" with options "Yes", "No", "Partially"
    * CORRECT: "What is Delhi's administrative status?" with options "A state", "A union territory", etc.

- CRITICAL HANDLING OF NEGATIVE CLAIMS:
  - When a claim contains a negation ("not", "isn't", etc.), NEVER use the negative formulation as an option
  - Instead, ALWAYS use the specific positive category the entity belongs to as option A
  - For administrative/political status claims (e.g., "X is not a state"), ALWAYS use the specific status (e.g., "A union territory", "A province", etc.) as option A
  - For classification claims (e.g., "X is not a Y"), ALWAYS use the correct classification as option A
  - Examples of negative claims that require special handling:
    - "X is not a state" → Use "A: A [specific status]" (e.g., "A union territory", "A federal district")
    - "X is not a Y" → Use "A: A [correct classification]" (e.g., "A mammal", "A fruit")
    - "X does not Y" → Use "A: [Opposite/correct action]" (e.g., "Orbits the Sun", "Conducts electricity")

- ANSWER OPTION REQUIREMENTS:
  - All options must be mutually exclusive with no conceptual overlap
  - Options should be at the same level of specificity and granularity
  - Options should be precise and factually accurate
  - Distractors (wrong answers) should be plausible but clearly incorrect
  - For numerical claims, use specific numbers rather than ranges (unless the claim itself is about a range)

Step 5: Generate the appropriate number of answer choices (A, B, and additional options C, D only if appropriate)

- For Yes/No questions: Use EXACTLY 2 options (A and B)
- For multi-category questions: Use 2-4 options based on the nature of the claim
  - Use only as many options as can be truly mutually exclusive
  - Never use more than 4 options
- Ensure all options are mutually exclusive (no conceptual overlap)
- Make all options plausible but ensure only one is correct
- Avoid options that are subsets of other options
- Avoid negative options (e.g., "Not a state") - use positive categories instead

Step 6: Comprehensive Validation Checklist
Before finalizing your output, verify ALL of the following:

1. QUESTION FORMAT CHECK: Ensure the question format (Yes/No or multi-category) is appropriate for the claim
2. YES/NO FORMAT CHECK: If using Yes/No format, confirm you have EXACTLY two options: "Yes" and "No"
3. MUTUAL EXCLUSIVITY CHECK: Ensure all options are mutually exclusive with no conceptual overlap
4. NEGATIVE CLAIM CHECK: Verify that negative claims are handled appropriately
5. CLAIMED vs. EXPECTED CHECK: Verify that claimed_answer represents what the original statement asserts, while expected_answer represents the factually correct answer
6. PRECISION CHECK: Confirm all options are precise and at the same level of specificity
7. OPTION COUNT CHECK: Confirm you have the appropriate number of options:
   - EXACTLY 2 options for Yes/No questions
   - Between 2-4 options for multi-category questions (based on the nature of the claim)
8. TEXT SPAN CHECK: Verify that:
   - The text_span is the exact text from the original statement that expresses the claim
   - The span_position correctly identifies the position of this text in the original statement
   - For list items, only the specific item is included in the text_span

Step 7: Output Formatting
Generate a JSON object with the following structure:
{{
  "questions": [
    {{
      "entity": "entity from the statement",
      "original_claim": "claim about the entity",
      "text_span": "exact text from the original statement that contains this claim",
      "span_position": [start_index, end_index],
      "question": "question text",
      "options": {{
        "A": "option text",
        "B": "option text"
        // Additional options (C, D) ONLY for multi-category questions that truly require more than 2 options
      }},
"claimed_answer": "letter of the answer that matches the original claim (A, B, etc.)",
"expected_answer": "letter of the factually correct answer (A, B, etc.)"
}}
]
}}

Note: The number of options should be determined by the nature of the claim:

- For binary (Yes/No) questions: Use exactly 2 options (A and B)
- For multi-category questions: Use 2-4 options based on the nature of the claim, using only as many as needed for truly distinct, mutually exclusive categories

Examples:

# 2-OPTION (YES/NO) EXAMPLES

Example 1: Binary Fact (Astronomy)
Statement: "Pluto is not a planet."
{{
  "questions": [
    {{
      "entity": "Pluto",
      "original_claim": "is not a planet",
      "text_span": "is not a planet",
      "span_position": [6, 19],
      "question": "Is Pluto a planet?",
      "options": {{
        "A": "No",
        "B": "Yes"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 2: Binary Fact (Geography/Administrative)
Statement: "Delhi is not a state."
{{
  "questions": [
    {{
      "entity": "Delhi",
      "original_claim": "is not a state",
      "text_span": "is not a state",
      "span_position": [6, 19],
      "question": "Is Delhi a state?",
      "options": {{
        "A": "No",
        "B": "Yes"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 3: Binary Fact (Biology)
Statement: "Whales are mammals."
{{
  "questions": [
    {{
      "entity": "Whales",
      "original_claim": "are mammals",
      "text_span": "are mammals",
      "span_position": [7, 18],
      "question": "Are whales mammals?",
      "options": {{
        "A": "Yes",
        "B": "No"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 4: Binary Fact (History - False Claim)
Statement: "Abraham Lincoln was the first President of the United States."
{{
  "questions": [
    {{
      "entity": "Abraham Lincoln",
      "original_claim": "was the first President of the United States",
      "text_span": "was the first President of the United States",
      "span_position": [16, 58],
      "question": "Was Abraham Lincoln the first President of the United States?",
      "options": {{
        "A": "No",
        "B": "Yes"
      }},
"claimed_answer": "B",
"expected_answer": "A"
}}
]
}}

Example 5: Binary Fact (Physics)
Statement: "Sound cannot travel through a vacuum."
{{
  "questions": [
    {{
      "entity": "Sound",
      "original_claim": "cannot travel through a vacuum",
      "text_span": "cannot travel through a vacuum",
      "span_position": [6, 35],
      "question": "Can sound travel through a vacuum?",
      "options": {{
        "A": "No",
        "B": "Yes"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 6: Binary Fact (Technology)
Statement: "The iPhone was invented by Microsoft."
{{
  "questions": [
    {{
      "entity": "iPhone",
      "original_claim": "was invented by Microsoft",
      "question": "Was the iPhone invented by Microsoft?",
      "options": {{
        "A": "No",
        "B": "Yes"
      }},
"claimed_answer": "B",
"expected_answer": "A"
}}
]
}}

# 4-OPTION (MULTI-CATEGORY) EXAMPLES

Example 7: Location Question (Geography)
Statement: "The Great Barrier Reef is located in Australia."
{{
  "questions": [
    {{
      "entity": "Great Barrier Reef",
      "original_claim": "is located in Australia",
      "question": "Where is the Great Barrier Reef located?",
      "options": {{
        "A": "Australia",
        "B": "Indonesia",
        "C": "Philippines",
        "D": "Thailand"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 8: Classification Question (Astronomy)
Statement: "Pluto is not a planet."
{{
  "questions": [
    {{
      "entity": "Pluto",
      "original_claim": "is not a planet",
      "question": "What is Pluto's classification?",
      "options": {{
        "A": "A dwarf planet",
        "B": "A planet",
        "C": "An asteroid",
        "D": "A comet"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 9: Invention Question (History - False Claim)
Statement: "Thomas Edison invented the telephone."
{{
  "questions": [
    {{
      "entity": "Telephone",
      "original_claim": "was invented by Thomas Edison",
      "question": "Who invented the telephone?",
      "options": {{
        "A": "Thomas Edison",
        "B": "Alexander Graham Bell",
        "C": "Nikola Tesla",
        "D": "Guglielmo Marconi"
      }},
"claimed_answer": "A",
"expected_answer": "B"
}}
]
}}

Example 10: Element Classification (Chemistry)
Statement: "Gold is a transition metal."
{{
  "questions": [
    {{
      "entity": "Gold",
      "original_claim": "is a transition metal",
      "question": "What type of element is gold?",
      "options": {{
        "A": "A transition metal",
        "B": "An alkali metal",
        "C": "A noble gas",
        "D": "A halogen"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 11: Animal Classification (Biology)
Statement: "Penguins are reptiles."
{{
  "questions": [
    {{
      "entity": "Penguins",
      "original_claim": "are reptiles",
      "question": "What class of animals do penguins belong to?",
      "options": {{
        "A": "Reptiles",
        "B": "Birds",
        "C": "Mammals",
        "D": "Amphibians"
      }},
"claimed_answer": "A",
"expected_answer": "B"
}}
]
}}

Example 12: Capital City (Geography)
Statement: "Tokyo is the capital of Japan."
{{
  "questions": [
    {{
      "entity": "Tokyo",
      "original_claim": "is the capital of Japan",
      "question": "What is the capital of Japan?",
      "options": {{
        "A": "Tokyo",
        "B": "Kyoto",
        "C": "Osaka",
        "D": "Seoul"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 13: List-Based Statement (Medical)
Statement: "The symptoms of Covid are fever, constipation, and sneezing."
{{
  "questions": [
    {{
      "entity": "Covid",
      "original_claim": "has fever as a symptom",
      "text_span": "fever",
      "span_position": [27, 32],
      "question": "Is fever a symptom of Covid?",
      "options": {{
        "A": "Yes",
        "B": "No"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}},
{{
      "entity": "Covid",
      "original_claim": "has constipation as a symptom",
      "text_span": "constipation",
      "span_position": [34, 46],
      "question": "Is constipation a symptom of Covid?",
      "options": {{
        "A": "Yes",
        "B": "No"
      }},
"claimed_answer": "A",
"expected_answer": "B"
}},
{{
      "entity": "Covid",
      "original_claim": "has sneezing as a symptom",
      "text_span": "sneezing",
      "span_position": [52, 60],
      "question": "Is sneezing a symptom of Covid?",
      "options": {{
        "A": "Yes",
        "B": "No"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Example 14: Comparative Structure
Statement: "Unlike Mars, Venus has a thicker atmosphere than Earth and rotates clockwise."
{{
  "questions": [
    {{
      "entity": "Mars",
      "original_claim": "does not have a thicker atmosphere than Earth",
      "text_span": "Unlike Mars",
      "span_position": [0, 11],
      "question": "Does Mars have a thicker atmosphere than Earth?",
      "options": {{
        "A": "No",
        "B": "Yes"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}},
{{
      "entity": "Venus",
      "original_claim": "has a thicker atmosphere than Earth",
      "text_span": "has a thicker atmosphere than Earth",
      "span_position": [13, 47],
      "question": "Which planet has a thicker atmosphere than Earth?",
      "options": {{
        "A": "Venus",
        "B": "Mars",
        "C": "Jupiter",
        "D": "Mercury"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}},
{{
      "entity": "Venus",
      "original_claim": "rotates clockwise",
      "text_span": "rotates clockwise",
      "span_position": [52, 69],
      "question": "In which direction does Venus rotate?",
      "options": {{
        "A": "Clockwise",
        "B": "Counterclockwise"
      }},
"claimed_answer": "A",
"expected_answer": "A"
}}
]
}}

Now, transform the statement I provided into one or more multiple-choice questions following these guidelines.`;

export const BINARIZER_SYSTEM_LEGAL = `You are a specialized AI designed to transform legal statements and claims into high-quality multiple-choice questions. Your task is to create questions that accurately test the legal facts, statutes, case law, and legal principles in the provided statement.

IMPORTANT: Never include comments in the JSON output.
IMPORTANT: Always include both claimed_answer and expected_answer fields in your output.
IMPORTANT: For each claim, identify the exact text span in the original statement using:

- text_span: The exact text from the original statement that contains the claim
- span_position: The [start, end] character positions of the text span in the original statement

TEXT SPAN MAPPING:
The text_span and span_position fields enable highlighting claims in the original text based on their factual accuracy. This allows users to visually identify which parts of a legal statement are true or false.

PURPOSE AND CONTEXT:
The questions you generate will be used to evaluate the legal knowledge and fact-checking capabilities of multiple LLMs. These questions will serve as a benchmark for assessing legal accuracy and understanding of jurisprudence.

LEGAL-SPECIFIC CONSIDERATIONS:

1. Jurisdiction Awareness
   - Be aware that legal facts may vary by jurisdiction
   - When jurisdiction is not specified, note this limitation
   - Consider common law vs civil law distinctions where relevant

2. Legal Terminology Precision
   - Use precise legal terminology (e.g., "defendant" vs "respondent", "statute" vs "regulation")
   - Distinguish between legal concepts (e.g., "murder" vs "manslaughter", "contract" vs "agreement")
   - Be specific about legal standards (e.g., "beyond reasonable doubt" vs "preponderance of evidence")

3. Case Law and Precedent
   - When referencing cases, ensure accuracy of case names, years, and holdings
   - Distinguish between binding precedent and persuasive authority
   - Be precise about the court level (Supreme Court, Appeals Court, District Court)

4. Statutory References
   - Include specific section numbers when referencing statutes
   - Be aware of amendments and current versions of laws
   - Distinguish between federal, state, and local laws

5. Legal Qualifiers
   - Pay attention to legal qualifiers like "allegedly", "purportedly", "prima facie"
   - Understand the difference between "shall", "may", and "must" in legal context
   - Recognize conditional language and exceptions in legal statements

Example: Legal Claim Evaluation

- Original claim: 'Miranda v. Arizona established the requirement for police to inform suspects of their rights before custodial interrogation.'
- Generated question: 'What did Miranda v. Arizona establish?'
- Answer options: 'A: Requirement to inform suspects of rights before custodial interrogation', 'B: Right to jury trial', 'C: Exclusionary rule for illegal searches', 'D: Right to speedy trial'
- Expected answer: 'A'

CRITICAL RULES FOR QUESTION TYPE AND OPTION COUNT SELECTION:

1. The number of options should be determined by the nature of the legal claim:
   - For binary legal determinations (guilty/not guilty, constitutional/unconstitutional), use exactly 2 options
   - For multi-category legal claims, use 2-4 options representing distinct legal categories
   - Never use more options than can be truly mutually exclusive under the law
2. If exactly 2 options are appropriate, you SHOULD use Yes/No format
3. If 3 or more options are truly needed, you MUST COMPLETELY REFORMULATE any Yes/No questions

CRITICAL RULES FOR YES/NO QUESTIONS:

1. Yes/No questions MUST have EXACTLY TWO options: "Yes" and "No" (without any additional text)
2. NEVER mix Yes/No options with other types of options
3. When 3+ options are needed, you MUST CHANGE THE QUESTION WORDING ITSELF, not just add more options

CRITICAL DESIGN PRINCIPLES FOR LEGAL QUESTIONS:

1. Legal Accuracy and Precision
   - Questions must reflect accurate legal principles and current law
   - Answer options must be legally distinct and meaningful
   - Avoid mixing different areas of law in options

2. Jurisdictional Clarity
   - Be clear about which jurisdiction's law applies
   - Note when legal principles vary by jurisdiction
   - Default to general common law principles when jurisdiction is unclear

3. Temporal Accuracy
   - Ensure legal facts are current (laws change over time)
   - Note historical legal facts with appropriate time context
   - Be aware of effective dates for statutes and regulations

4. Professional Standards
   - Use language appropriate for legal professionals
   - Maintain the precision expected in legal documents
   - Avoid colloquialisms unless they are established legal terms`;

export const BINARIZER_USER_LEGAL = `You are given a legal statement: "{{statement}}"

Step 1: Legal Entity-Claim Extraction

- Extract ONLY objective, verifiable legal entity-claim pairs from the statement
- A legal atomic claim contains a SINGLE legal fact about an entity that can be objectively verified
- Break down complex legal claims into multiple atomic claims
- For compound legal statements, create separate pairs for each distinct legal assertion
- Be thorough: extract ALL meaningful objective legal claims, including case holdings, statutory provisions, and legal principles

LEGAL CLAIM CATEGORIES TO CONSIDER:

- Case law holdings and precedents
- Statutory provisions and regulations
- Constitutional principles
- Legal definitions and terminology
- Procedural requirements
- Jurisdictional facts
- Legal rights and obligations
- Court decisions and rulings
- Legal standards and tests
- Regulatory compliance requirements

Step 2: Text Span Identification

- For each extracted legal claim, identify the EXACT text in the original statement that expresses this claim
- The text span should be the minimal contiguous text that fully captures the legal claim
- Calculate the character positions [start, end] where this text appears in the original statement
  - start = index of first character (0-based indexing)
  - end = index after the last character
- Verify that the text between these positions in the original statement matches your text_span exactly

IMPORTANT: Filtering Non-Legal or Subjective Claims

- DO NOT extract opinions about legal strategy or tactics
- DO NOT extract predictions about case outcomes
- DO NOT extract subjective assessments of legal arguments
- DO NOT extract claims about lawyer reputation or skill
- ONLY extract claims that can be objectively verified through legal sources (statutes, case law, regulations)

Step 3: For Each Unique Legal Entity-Claim Pair

- Create a clear, focused question that tests the specific legal claim about the entity
- Ensure the question targets precise legal knowledge
- If the claim is legally incorrect, identify the correct legal fact

Step 4: Legal Question Format Selection

- DECISION FRAMEWORK FOR LEGAL QUESTIONS:
  1. Analyze the legal claim to determine its fundamental nature:
     - Is it a binary legal determination (constitutional/unconstitutional, valid/invalid)?
     - Does it involve multiple distinct legal categories or standards?
     - Which format would provide the most legally precise test of the claim?
  2. Adapt the question format based on the legal nature:
     - For binary legal determinations:
       - Use Yes/No format with exactly 2 options
       - Example: "Is the Miranda warning required before custodial interrogation?" with options "Yes", "No"
     - For legal categorization or multi-option scenarios:
       - Use 2-4 options representing distinct legal categories
       - Example: "What level of scrutiny applies to this constitutional claim?" with options "Strict scrutiny", "Intermediate scrutiny", "Rational basis"

Step 5: Generate Legal Answer Choices

- For Yes/No questions: Use EXACTLY 2 options (A and B)
- For multi-category questions: Use 2-4 options based on legal distinctions
- Ensure all options are legally meaningful and distinct
- Use proper legal terminology in all options
- Avoid mixing different areas of law in the same question

Step 6: Legal Validation Checklist
Before finalizing your output, verify ALL of the following:

1. LEGAL ACCURACY CHECK: Ensure all legal facts, case names, and statutory references are accurate
2. JURISDICTION CHECK: Verify that jurisdictional context is clear or noted as general
3. TERMINOLOGY CHECK: Confirm use of precise legal terminology throughout
4. TEMPORAL CHECK: Ensure legal facts reflect current law or are properly dated
5. MUTUAL EXCLUSIVITY CHECK: Ensure all options are legally distinct with no overlap
6. PRECISION CHECK: Confirm all options use appropriate legal language and standards
7. TEXT SPAN CHECK: Verify accurate text span mapping for legal claims

Step 7: Output Formatting
Generate a JSON object with the following structure:
{
"questions": [
{
"entity": "legal entity from the statement",
"original_claim": "legal claim about the entity",
"text_span": "exact text from the original statement that contains this legal claim",
"span_position": [start_index, end_index],
"question": "legal question text",
"options": {
"A": "option text",
"B": "option text"
// Additional options (C, D) ONLY for multi-category legal questions
},
"claimed_answer": "letter of the answer that matches the original legal claim (A, B, etc.)",
"expected_answer": "letter of the legally correct answer (A, B, etc.)"
}
]
}

Legal Examples:

Example 1: Case Law (Binary)
Statement: "Brown v. Board of Education overturned the separate but equal doctrine."
{
"questions": [
{
"entity": "Brown v. Board of Education",
"original_claim": "overturned the separate but equal doctrine",
"text_span": "overturned the separate but equal doctrine",
"span_position": [29, 72],
"question": "Did Brown v. Board of Education overturn the separate but equal doctrine?",
"options": {
"A": "Yes",
"B": "No"
},
"claimed_answer": "A",
"expected_answer": "A"
}
]
}

Example 2: Statutory Provision (Multi-category)
Statement: "Under federal law, copyright protection lasts for 50 years after the author's death."
{
"questions": [
{
"entity": "Copyright protection under federal law",
"original_claim": "lasts for 50 years after the author's death",
"text_span": "lasts for 50 years after the author's death",
"span_position": [40, 84],
"question": "How long does copyright protection last after the author's death under federal law?",
"options": {
"A": "50 years",
"B": "70 years",
"C": "95 years",
"D": "Life of the author only"
},
"claimed_answer": "A",
"expected_answer": "B"
}
]
}

Example 3: Legal Standard
Statement: "Criminal cases require proof by a preponderance of the evidence."
{
"questions": [
{
"entity": "Criminal cases",
"original_claim": "require proof by a preponderance of the evidence",
"text_span": "require proof by a preponderance of the evidence",
"span_position": [15, 64],
"question": "What is the standard of proof required in criminal cases?",
"options": {
"A": "Preponderance of the evidence",
"B": "Beyond a reasonable doubt",
"C": "Clear and convincing evidence",
"D": "Probable cause"
},
"claimed_answer": "A",
"expected_answer": "B"
}
]
}

Now, transform the legal statement I provided into one or more multiple-choice questions following these legal-specific guidelines.`;

export const VERIFICATION_SYSTEM = `You are a helpful assistant that answers multiple choice questions accurately and concisely.`;

export const VERIFICATION_USER = `Question: {{question}}

Options:
{{options}}

Answer with just the letter of the correct option (A, B, C, or D). Don't include any other text in your response.`;

