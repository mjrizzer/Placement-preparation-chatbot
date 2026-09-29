import { z } from 'zod';
import { questionSchema, type GeneratedQuestion } from '@/lib/contracts';
import { AppError } from '@/lib/http';

// Original project questions. Stable assessment IDs prevent bank questions repeating.
type Entry = [string, string, string, string[]];
const technical: Entry[] = [
  [
    'Databases',
    'What is a primary key, and why does a table need one?',
    'A primary key uniquely identifies each row and cannot contain null values.',
    ['unique', 'null'],
  ],
  [
    'APIs',
    'How do GET and POST requests usually differ?',
    'GET retrieves a resource; POST submits data for processing or creates a resource.',
    ['retriev|read|fetch', 'creat|submit|send'],
  ],
  [
    'Security',
    'Why should passwords be hashed rather than stored as plain text?',
    'A salted password hash is a one-way representation. It protects the original password if the database is exposed.',
    ['hash|one-way', 'salt', 'password'],
  ],
  [
    'OOP',
    'Explain encapsulation with a small example.',
    'Encapsulation groups data and methods and restricts direct access to internal state, for example private fields updated through methods.',
    ['data|state|field', 'private|restrict|access', 'method'],
  ],
  [
    'Databases',
    'What does a database index do, and what is one trade-off?',
    'An index speeds up lookups at the cost of extra storage and slower writes because the index must also be updated.',
    ['lookup|search|read', 'storage|space', 'write|insert|update'],
  ],
  [
    'Web',
    'What is the difference between authentication and authorization?',
    'Authentication verifies who a user is. Authorization determines which resources or actions that user may access.',
    ['identity|who|verify|verifies', 'permission|access|allow'],
  ],
  [
    'Operating systems',
    'How does a thread differ from a process?',
    'A process has its own address space. Threads within a process share memory and need synchronization when accessing shared state.',
    ['memory|address', 'share', 'synchron|lock'],
  ],
  [
    'Networking',
    'Why is HTTPS preferable to HTTP when submitting a login form?',
    'HTTPS uses TLS to encrypt traffic and authenticate the server, protecting credentials in transit.',
    ['encrypt', 'tls|certificate', 'server|transit'],
  ],
];
const dsa: Entry[] = [
  [
    'Stacks',
    'How does a stack work? Give one practical use.',
    'A stack follows last in, first out (LIFO). Examples include undo history and the function call stack.',
    ['lifo|last in', 'undo|call|backtrack'],
  ],
  [
    'Queues',
    'How does a queue work? Give one practical use.',
    'A queue follows first in, first out (FIFO), such as a print queue or breadth-first traversal.',
    ['fifo|first in', 'print|breadth|bfs|task'],
  ],
  [
    'Searching',
    'What must be true before binary search can be used, and what is its time complexity?',
    'The data must be sorted. Binary search repeatedly halves the search interval and takes O(log n) time.',
    ['sort', 'log', 'half|halv|middle'],
  ],
  [
    'Hash Tables',
    'Why can hash table lookup be slower than O(1)?',
    'Collisions can place multiple keys in the same bucket. In a basic implementation the worst case can be O(n).',
    ['collision', 'bucket|chain', 'o(n)|linear'],
  ],
  [
    'Graphs',
    'How can BFS find the shortest path in an unweighted graph?',
    'BFS visits vertices level by level using a queue. A visited set avoids repeats and parent pointers reconstruct the path.',
    ['queue', 'level|layer', 'visit'],
  ],
  [
    'Dynamic Programming',
    'When is dynamic programming useful?',
    'It is useful when a problem has overlapping subproblems and optimal substructure. Memoization or tabulation avoids repeated computation.',
    ['overlap', 'substructure', 'memo|tabul'],
  ],
  [
    'Arrays',
    'How can you find a pair with a given sum in an unsorted array in linear expected time?',
    'Scan once, storing seen numbers in a hash set. For each number check whether target minus that number has already been seen. This uses O(n) extra space.',
    ['hash|set', 'target|complement', 'o(n)|linear'],
  ],
  [
    'Recursion',
    'Why does a recursive function need a base case?',
    'A base case stops recursion. Each recursive call must make progress toward it to avoid unbounded recursion and stack overflow.',
    ['stop|terminat', 'progress|smaller|toward', 'stack'],
  ],
];
const hr: Entry[] = [
  [
    'Introduction',
    'Introduce yourself and explain why this role interests you.',
    'Use a short introduction, a relevant skill or project example, and a specific reason for choosing the role.',
    ['skill', 'project|experience', 'role|interest'],
  ],
  [
    'Teamwork',
    'Describe a time you helped a team complete a task.',
    'Describe the situation, your action, and the result. Be clear about your own contribution.',
    ['team', 'action|help|contribut', 'result|complet'],
  ],
  [
    'Learning',
    'How would you approach learning an unfamiliar technology for a project?',
    'Set a small goal, read documentation, build a small example, and seek feedback.',
    ['goal|plan', 'document|tutorial', 'example|build|practice'],
  ],
  [
    'Problem solving',
    'Tell me how you would handle being stuck on a bug.',
    'Reproduce the issue, isolate its cause, inspect logs, test a fix, and ask for help with evidence if needed.',
    ['reproduc', 'log|debug', 'test'],
  ],
  [
    'Planning',
    'What would you do if two project deadlines conflicted?',
    'Clarify priorities, estimate remaining work, communicate early, and agree on a realistic plan.',
    ['priorit', 'communicat|discuss', 'plan|estimate'],
  ],
];

export function offlineBank(mode: string): GeneratedQuestion[] {
  if (mode === 'Coding')
    throw new AppError(
      503,
      'Coding needs an AI key and a sandbox service. Try Technical, DSA or Aptitude, or open the sample practice at /demo.',
    );
  let entries = mode === 'DSA' ? dsa : mode === 'HR' ? hr : technical;
  let kind: GeneratedQuestion['kind'] = mode === 'DSA' ? 'dsa' : mode === 'HR' ? 'hr' : 'technical';
  if (['Aptitude', 'Quantitative Aptitude', 'Logical Reasoning', 'Verbal'].includes(mode)) {
    kind = mode === 'Verbal' ? 'verbal' : 'aptitude';
    entries =
      mode === 'Logical Reasoning'
        ? [
            [
              'Number Series',
              'What is the next number: 3, 6, 12, 24, ...? Give the number.',
              '48',
              ['48'],
            ],
            [
              'Number Series',
              'What is the next number: 1, 4, 9, 16, ...? Give the number.',
              '25',
              ['25'],
            ],
            [
              'Direction Sense',
              'You face north and turn right twice. Which direction do you face?',
              'south',
              ['south'],
            ],
            ['Analogies', 'Complete the analogy: bird : nest :: bee : ?', 'hive', ['hive']],
            [
              'Syllogisms',
              'All roses are flowers. All flowers are plants. Are all roses plants? Answer yes or no.',
              'yes',
              ['yes'],
            ],
          ]
        : mode === 'Verbal'
          ? [
              [
                'Grammar',
                'Fill the blank with one word: She ___ to college every day. (go/goes)',
                'goes',
                ['goes'],
              ],
              ['Vocabulary', 'Give the opposite of ancient in one word.', 'modern', ['modern']],
              [
                'Grammar',
                'Fill the blank: I have lived here ___ 2020. (since/for)',
                'since',
                ['since'],
              ],
              ['Vocabulary', 'Give the plural of child.', 'children', ['children']],
              ['Grammar', 'Choose the article: She is ___ engineer. (a/an)', 'an', ['an']],
            ]
          : [
              [
                'Percentages',
                'A book costs 200 rupees. Its price rises by 15%. What is its new price? Enter only the number.',
                '230',
                ['230'],
              ],
              [
                'Time and Work',
                'A worker finishes a job in 12 days. How many days do 3 equally fast workers need together? Enter only the number.',
                '4',
                ['4'],
              ],
              [
                'Averages',
                'Find the average of 12, 18, 24 and 30. Enter only the number.',
                '21',
                ['21'],
              ],
              [
                'Probability',
                'A bag has 3 red and 5 blue balls. What is the probability of drawing a red ball? Enter a fraction.',
                '3/8',
                ['3/8'],
              ],
              [
                'Ratios',
                'Divide 120 in the ratio 2:3. What is the smaller share? Enter only the number.',
                '48',
                ['48'],
              ],
              [
                'Simple Interest',
                'Find the simple interest on 1000 rupees at 5% per year for 2 years. Enter only the number.',
                '100',
                ['100'],
              ],
              [
                'Time Speed Distance',
                'A car travels 150 km in 3 hours. Find its average speed in km/h. Enter only the number.',
                '50',
                ['50'],
              ],
              [
                'Profit and Loss',
                'An item bought for 80 rupees is sold for 100 rupees. Find the profit percentage. Enter only the number.',
                '25',
                ['25'],
              ],
            ];
  }
  return entries.map(([topic, question, explanation, expectedConcepts]) => ({
    title: `Offline practice · ${topic}`,
    topic,
    question,
    explanation,
    expectedConcepts,
    concept: question,
    kind,
    difficulty: 'easy',
    coding: null,
    followUpPossible: false,
    hints: [
      'Identify what the question asks before answering.',
      kind === 'aptitude'
        ? 'Write down the given values and work through one step at a time.'
        : 'Start with a definition, then add a short example.',
    ],
  }));
}

export function offlineResponse(name: string, input: unknown): unknown {
  if (name === 'evaluation') {
    const { question, answer } = z
      .object({ question: questionSchema, answer: z.string() })
      .parse(input);
    const normalized = answer.toLowerCase().trim().replace(/[.!]$/, '');
    const objective = ['aptitude', 'verbal'].includes(question.kind);
    const matches = question.expectedConcepts.filter((c) =>
      c.split('|').some((word) => normalized.includes(word.toLowerCase())),
    );
    const score = objective
      ? normalized === question.explanation.toLowerCase()
        ? 10
        : 0
      : Math.round((10 * matches.length) / Math.max(1, question.expectedConcepts.length));
    const note = objective
      ? 'Offline answer check. Use the requested answer format.'
      : 'Offline keyword estimate only, not AI evaluation. Negation and reasoning are not assessed; compare your answer with the sample.';
    return {
      technicalAccuracy: score,
      problemSolving: score,
      communication: score,
      completeness: score,
      reasoning: score,
      timeComplexity: 'Not assessed offline',
      spaceComplexity: 'Not assessed offline',
      confidenceEvidence:
        'Not assessed offline. All numeric dimensions use the same basic practice estimate.',
      wellDone: score ? ['Your answer matched some expected content.'] : [],
      improve: [note, 'Review the sample answer and explain it in your own words.'],
      correctAnswer: question.explanation,
      followUp: null,
      mistakes:
        score < 10
          ? [
              {
                type: 'Incomplete answer',
                topic: question.topic,
                explanation:
                  'The basic offline checker did not find all expected content. This may require manual review.',
                correction: question.explanation,
              },
            ]
          : [],
    };
  }
  if (name === 'improvement_plan') {
    const context = z
      .object({ weakTopics: z.array(z.object({ topic: z.string() })).optional() })
      .parse(input);
    const topics = context.weakTopics?.length
      ? context.weakTopics.map((t) => t.topic)
      : ['Databases', 'Arrays', 'Percentages'];
    return {
      summary: 'Offline study plan based on recorded practice results. Scores are basic estimates.',
      tasks: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        title: `Review ${topics[i % topics.length]} and explain two examples`,
        topic: topics[i % topics.length],
        mode: 'Technical',
        minutes: 20,
      })),
    };
  }
  if (name === 'interview_report') {
    const data = z.object({ answered: z.number(), total: z.number() }).parse(input);
    return {
      summary: `Offline practice complete: ${data.answered} of ${data.total} questions answered. Scores use basic answer matching, not AI assessment.`,
      strengths: [],
      weaknesses: [],
      nextSteps: [
        'Review the saved answers and sample explanations in History.',
        'Use your study plan to revisit topics you found difficult.',
      ],
    };
  }
  throw new AppError(
    503,
    'This feature needs an AI API key. Technical, HR, DSA and aptitude practice are available offline.',
  );
}
