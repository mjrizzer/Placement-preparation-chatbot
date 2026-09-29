export const languages = [
  'C',
  'C++',
  'Java',
  'Python',
  'JavaScript',
  'TypeScript',
  'Go',
  'Rust',
  'C#',
  'Kotlin',
  'Swift',
  'PHP',
] as const;
export const codingLanguages = languages.filter((l) => l !== 'Swift');
export const roles = [
  'Software Developer',
  'Full Stack Developer',
  'Backend Developer',
  'Frontend Developer',
  'Data Analyst',
  'Data Scientist',
  'AI/ML Engineer',
  'Cybersecurity Engineer',
  'DevOps Engineer',
];
export const difficulties = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof difficulties)[number];
export const modes = [
  'HR',
  'Technical',
  'Coding',
  'DSA',
  'Aptitude',
  'Logical Reasoning',
  'Quantitative Aptitude',
  'Mixed',
  'Mock',
  'Company',
  'Resume',
] as const;
export type Mode = (typeof modes)[number];
export const topics: Record<string, string[]> = {
  DSA: [
    'Arrays',
    'Strings',
    'Linked Lists',
    'Stacks',
    'Queues',
    'Trees',
    'Binary Search Trees',
    'Heaps',
    'Graphs',
    'Hash Tables',
    'Tries',
    'Recursion',
    'Backtracking',
    'Greedy Algorithms',
    'Dynamic Programming',
    'Sorting',
    'Searching',
    'Bit Manipulation',
    'Two Pointers',
    'Sliding Window',
  ],
  'Quantitative Aptitude': [
    'Percentages',
    'Profit and Loss',
    'Simple Interest',
    'Compound Interest',
    'Time and Work',
    'Time Speed Distance',
    'Ratios',
    'Averages',
    'Probability',
    'Permutation and Combination',
    'Number Systems',
    'HCF / LCM',
    'Ages',
    'Mixtures',
    'Pipes and Cisterns',
    'Boats and Streams',
    'Data Interpretation',
  ],
  'Logical Reasoning': [
    'Number Series',
    'Letter Series',
    'Coding-Decoding',
    'Blood Relations',
    'Direction Sense',
    'Syllogisms',
    'Seating Arrangement',
    'Puzzles',
    'Statements and Conclusions',
    'Analogies',
    'Odd One Out',
    'Pattern Recognition',
    'Data Sufficiency',
  ],
  Verbal: [
    'Grammar',
    'Sentence Correction',
    'Reading Comprehension',
    'Vocabulary',
    'Synonyms',
    'Antonyms',
    'Para Jumbles',
  ],
  Technical: [
    'Language Fundamentals',
    'Object-Oriented Programming',
    'Databases',
    'Operating Systems',
    'Computer Networks',
    'System Design',
    'Web Development',
    'Security',
    'Testing',
  ],
  HR: ['Communication', 'Teamwork', 'Project Ownership', 'Conflict Resolution', 'Career Goals'],
};
export const mockSections = [
  { mode: 'Quantitative Aptitude', count: 20 },
  { mode: 'Logical Reasoning', count: 15 },
  { mode: 'Verbal', count: 10 },
  { mode: 'Technical', count: 15 },
  { mode: 'DSA', count: 10 },
  { mode: 'Coding', count: 2 },
];
export function sectionFor(position: number) {
  let n = position;
  for (const s of mockSections) {
    if (n < s.count) return s.mode;
    n -= s.count;
  }
  return 'Coding';
}
